// La connexion temps réel : ticket, reconnexion (délai croissant, plafond, gigue), reprise, file d'envoi.
import { api } from './api';
import { store, roomState, addMessage, addPending, ackMessage, toast, resetStore } from './store';
import { nextDelay, uuid } from './util';

let ws = null;
let attempt = 0;
let retryTimer = null;
let stableTimer = null;
let stopped = true;

export function start() {
  stopped = false;
  attempt = 0;
  connect();
}

export function stop() {
  stopped = true;
  clearTimeout(retryTimer);
  clearTimeout(stableTimer);
  if (ws) { const s = ws; ws = null; s.close(1000, 'Au revoir'); }
  store.conn.status = 'idle';
  store.conn.instance = null;
}

export function retryNow() {
  if (stopped || ws) return;
  connect();
}
window.addEventListener('online', retryNow);

async function connect() {
  clearTimeout(retryTimer);
  if (stopped || ws) return;
  store.conn.status = attempt ? 'reconnecting' : 'connecting';
  store.conn.retryAt = 0;

  // 1) Un ticket neuf à chaque tentative : l'ancien a été consommé (usage unique).
  let ticket;
  try {
    ticket = await api.ticket();
  } catch (e) {
    if (e.status === 401) return sessionLost('Ta session a expiré : reconnecte-toi.');
    return scheduleRetry();
  }
  if (stopped || ws) return;

  // 2) Ouverture du WebSocket avec le ticket.
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const sock = new WebSocket(`${proto}://${location.host}/ws?ticket=${encodeURIComponent(ticket)}`);
  ws = sock;

  sock.onopen = () => {
    store.conn.status = 'open';
    store.conn.attempt = 0;
    stableTimer = setTimeout(() => { attempt = 0; }, 10_000); // compteur remis à zéro après 10 s stables
    // 3) Reprise : on rejoint à nouveau les salons en indiquant le dernier message reçu.
    for (const room of store.joined) {
      const { lastId } = roomState(room);
      raw({ type: 'join', room, ...(lastId && { since: lastId }) });
    }
    // 4) File d'envoi : les messages écrits hors ligne partent maintenant (même clientMsgId = pas de doublon).
    for (const room of store.joined) {
      for (const m of roomState(room).messages) if (m.pending) raw({ type: 'chat', room, text: m.text, clientMsgId: m.clientMsgId });
    }
  };

  sock.onmessage = e => {
    let data;
    try { data = JSON.parse(e.data); } catch { return; }
    for (const m of [].concat(data)) handle(m); // un tableau = plusieurs messages regroupés (BATCH_MS)
  };

  sock.onclose = e => {
    if (ws !== sock) return;
    ws = null;
    clearTimeout(stableTimer);
    store.conn.instance = null;
    if (stopped) return;
    if (e.code === 4003) return sessionLost('Tu as été déconnecté de partout (accès révoqué).');
    if (e.code === 1008) toast('Doucement ! Trop de messages d\'un coup.', 'jaune');
    if (e.code === 1009) toast('Message trop long : il a été refusé.', 'rouge');
    if (e.code === 4001 || e.code === 1001) attempt = 0; // session expirée ou instance arrêtée : on repart vite
    scheduleRetry();
  };
}

function scheduleRetry() {
  const delay = nextDelay(attempt);
  attempt++;
  store.conn.status = 'reconnecting';
  store.conn.attempt = attempt;
  store.conn.retryAt = Date.now() + delay;
  retryTimer = setTimeout(connect, delay);
}

function sessionLost(message) {
  stop();
  resetStore();
  toast(message, 'rouge', 6000);
}

function raw(obj) {
  if (ws?.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(obj));
  return true;
}

async function renew() {
  try {
    raw({ type: 'reauth', ticket: await api.ticket() });
  } catch (e) {
    if (e.status === 401) sessionLost('Ta session a expiré : reconnecte-toi.');
  }
}

function handle(m) {
  switch (m.type) {
    case 'welcome':
      store.conn.instance = m.instance;
      store.me.role = m.role;
      break;
    case 'joined': {
      const rs = roomState(m.room);
      rs.members = Object.fromEntries(m.members.map(x => [x.user, x.color]));
      rs.reads = m.reads || {};
      break;
    }
    case 'history': {
      const rs = roomState(m.room);
      for (const msg of m.messages) addMessage(msg, { silent: !m.resumed });
      if (!m.complete) rs.incomplete = true;
      break;
    }
    case 'chat':
      addMessage(m);
      break;
    case 'ack':
      ackMessage(m);
      break;
    case 'presence': {
      const rs = roomState(m.room);
      if (m.status === 'online') rs.members[m.user] = m.color;
      else delete rs.members[m.user];
      break;
    }
    case 'typing':
      if (m.user !== store.me?.user) roomState(m.room).typing[m.user] = { color: m.color, until: Date.now() + 3000 };
      break;
    case 'read':
      roomState(m.room).reads[m.user] = m.upTo;
      break;
    case 'session_expiring':
      renew();
      break;
    case 'error':
      if (m.code === 'forbidden' && m.room) {
        store.joined = store.joined.filter(r => r !== m.room);
        if (store.current === m.room) store.current = 'colline';
      }
      toast(m.message, m.code === 'rate_limited' ? 'jaune' : 'rouge');
      break;
  }
}

// ---------- Actions appelées par l'interface ----------

export function openRoom(name) {
  store.current = name;
  roomState(name).unread = 0;
  if (!store.joined.includes(name)) {
    store.joined.push(name);
    raw({ type: 'join', room: name });
  }
}

export function sendChat(room, text) {
  const clientMsgId = uuid();
  addPending(room, text, clientMsgId); // affichage optimiste, grisé jusqu'à l'accusé de réception
  raw({ type: 'chat', room, text, clientMsgId });
}

let lastTypingSent = 0;
export function sendTyping(room) {
  if (Date.now() - lastTypingSent < 1500) return;
  lastTypingSent = Date.now();
  raw({ type: 'typing', room });
}

export function markRead(room) {
  const rs = roomState(room);
  if (!rs.lastId || rs.lastReadSent === rs.lastId) return;
  if (raw({ type: 'read', room, upTo: rs.lastId })) {
    rs.lastReadSent = rs.lastId;
    rs.reads[store.me.user] = rs.lastId;
  }
}

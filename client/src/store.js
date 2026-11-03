// État de l'interface : un seul objet réactif, mis à jour par les événements reçus du serveur.
import { reactive } from 'vue';
import { cmpId } from './util';

export const store = reactive({
  me: null,              // { user, color, role }
  rooms: [],             // définition des salons (GET /api/rooms)
  current: 'colline',    // salon affiché
  joined: [],            // salons rejoints (re-rejoints automatiquement après une reconnexion)
  rs: {},                // état par salon (voir roomState)
  conn: { status: 'idle', instance: null, retryAt: 0, attempt: 0 },
  toasts: [],
  now: Date.now(),       // horloge partagée (indicateurs « écrit… », compte à rebours)
});
setInterval(() => { store.now = Date.now(); }, 500);

// Ids déjà affichés, par salon : sert au dédoublonnage (livraison « au moins une fois »).
const seen = new Map();
const seenIn = room => seen.get(room) || seen.set(room, new Set()).get(room);

export function roomState(name) {
  if (!store.rs[name]) {
    store.rs[name] = { messages: [], lastId: null, members: {}, reads: {}, typing: {}, unread: 0, incomplete: false, lastReadSent: null };
  }
  return store.rs[name];
}

const MAX_KEPT = 500;

export function addMessage(m, { silent = false } = {}) {
  const rs = roomState(m.room);
  const ids = seenIn(m.room);
  if (ids.has(m.id)) return;            // doublon (reprise + direct) : ignoré
  ids.add(m.id);

  // Mon propre message déjà affiché « en attente » : on le remplace par la version confirmée.
  const pending = rs.messages.findIndex(x => x.pending && x.clientMsgId === m.clientMsgId);
  if (pending >= 0) rs.messages.splice(pending, 1);

  // Insertion triée par id (presque toujours à la fin). Les messages en attente restent en bas.
  let i = rs.messages.length;
  while (i > 0 && (rs.messages[i - 1].pending || cmpId(rs.messages[i - 1].id, m.id) > 0)) i--;
  rs.messages.splice(i, 0, { ...m, pending: false });
  if (rs.messages.length > MAX_KEPT) rs.messages.splice(0, rs.messages.length - MAX_KEPT);

  if (!rs.lastId || cmpId(m.id, rs.lastId) > 0) rs.lastId = m.id;
  delete rs.typing[m.from];
  const mine = m.from === store.me?.user;
  if (!silent && !mine && (store.current !== m.room || document.hidden)) rs.unread++;
}

export function addPending(room, text, clientMsgId) {
  roomState(room).messages.push({
    pending: true, clientMsgId, room, text, at: Date.now(),
    from: store.me.user, color: store.me.color,
  });
}

export function ackMessage({ clientMsgId, id }) {
  for (const room of store.joined) {
    const rs = roomState(room);
    const m = rs.messages.find(x => x.pending && x.clientMsgId === clientMsgId);
    if (m) return addMessage({ ...m, id }, { silent: true });
  }
}

export function toast(text, color = 'violet', ms = 4000) {
  const t = { id: Math.random(), text, color };
  store.toasts.push(t);
  setTimeout(() => { store.toasts = store.toasts.filter(x => x !== t && x.id !== t.id); }, ms);
}

export function resetStore() {
  store.me = null;
  store.joined = [];
  store.rs = {};
  for (const r of store.rooms) roomState(r.name);
  store.current = 'colline';
  store.conn = { status: 'idle', instance: null, retryAt: 0, attempt: 0 };
  seen.clear();
}

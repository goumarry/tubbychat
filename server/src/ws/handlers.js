// Traitement des messages VALIDÉS. Chaque handler vérifie d'abord l'AUTORISATION.
const { redis } = require('../redis');
const cfg = require('../config');
const { publish } = require('../broker');
const presence = require('../presence');
const { consumeTicket } = require('../auth');
const { byRoom, addTo, removeFrom } = require('./state');
const { send, sendError } = require('./send');
const log = require('../log');

// Compare deux identifiants de Redis Stream « millisecondes-séquence ».
function cmpId(a, b) {
  const [am, as] = a.split('-').map(Number);
  const [bm, bs] = b.split('-').map(Number);
  return am - bm || as - bs;
}

function toMessage(room, id, fields) {
  const f = {};
  for (let i = 0; i < fields.length; i += 2) f[fields[i]] = fields[i + 1];
  return { type: 'chat', room, id, from: f.from, color: f.color, text: f.text, at: Number(f.at), clientMsgId: f.clientMsgId };
}

async function maxDeletedId(key) {
  try {
    const info = await redis.call('XINFO', 'STREAM', key);
    const i = info.indexOf('max-deleted-entry-id');
    return i >= 0 && info[i + 1] !== '0-0' ? info[i + 1] : null;
  } catch { return null; } // le salon n'a encore aucun message
}

async function sendHistory(ws, room, since) {
  const key = `stream:${room}`;
  let entries;
  let complete = true;
  if (since) {
    // Reprise : tout ce qui est STRICTEMENT après le dernier id reçu par le client.
    entries = await redis.xrange(key, `(${since}`, '+', 'COUNT', cfg.HISTORY_RESUME_MAX);
    // Redis 7 retient l'id du dernier message supprimé par la troncature (MAXLEN).
    // S'il est postérieur à « since », le client a raté des messages qui n'existent plus : perte signalée.
    const maxDeleted = await maxDeletedId(key);
    if (maxDeleted && cmpId(maxDeleted, since) > 0) complete = false;
    if (entries.length === cfg.HISTORY_RESUME_MAX) complete = false;
  } else {
    entries = (await redis.xrevrange(key, '+', '-', 'COUNT', cfg.HISTORY_INITIAL)).reverse();
  }
  send(ws, { type: 'history', room, messages: entries.map(([id, fields]) => toMessage(room, id, fields)), complete, resumed: Boolean(since) });
}

const handlers = {
  async join(ws, { room, since }) {
    const def = cfg.ROOMS_BY_NAME.get(room);
    if (!def) return sendError(ws, 'forbidden', 'Ce salon n\'existe pas', { room });
    if (def.adminOnly && ws.role !== 'admin') {
      log.warn('salon interdit', { user: ws.user, room });
      return sendError(ws, 'forbidden', 'Seuls les admins peuvent entrer dans le placard de Noo-Noo', { room });
    }
    if (!ws.rooms.has(room)) {
      ws.rooms.add(room);
      addTo(byRoom, room, ws);
      await presence.enter(ws, room);
    }
    const [members, reads] = await Promise.all([presence.members(room), redis.hgetall(`reads:${room}`)]);
    send(ws, { type: 'joined', room, members, reads });
    await sendHistory(ws, room, since);
  },

  async leave(ws, { room }) {
    if (!ws.rooms.delete(room)) return;
    removeFrom(byRoom, room, ws);
    await presence.exit(ws, room);
  },

  async chat(ws, { room, text, clientMsgId }, receivedAt) {
    if (!ws.rooms.has(room)) return sendError(ws, 'not_in_room', 'Rejoins le salon avant d\'y écrire', { room });

    // Idempotence : si le client renvoie le même message après une coupure, on ne l'enregistre pas deux fois.
    const dedupeKey = `dedupe:${ws.user}:${clientMsgId}`;
    const fresh = await redis.set(dedupeKey, 'pending', 'EX', 300, 'NX');
    if (!fresh) {
      const id = await redis.get(dedupeKey);
      if (id && id !== 'pending') send(ws, { type: 'ack', clientMsgId, id, duplicate: true });
      return;
    }

    // 1) on écrit dans le Stream (durable), 2) on publie (éphémère). Si 2) se perd, la reprise rattrape.
    const id = await redis.xadd(`stream:${room}`, 'MAXLEN', '~', cfg.HISTORY_MAX, '*',
      'from', ws.user, 'color', ws.color, 'text', text, 'at', receivedAt, 'clientMsgId', clientMsgId);
    await redis.set(dedupeKey, id, 'EX', 300);
    send(ws, { type: 'ack', clientMsgId, id });
    // L'auteur vient de la session, JAMAIS du message.
    await publish(room, { type: 'chat', room, id, from: ws.user, color: ws.color, text, at: receivedAt, clientMsgId, via: cfg.INSTANCE_ID });
  },

  async typing(ws, { room }) {
    if (!ws.rooms.has(room)) return;
    const now = Date.now();
    if (now - (ws.lastTyping.get(room) || 0) < 1500) return; // au plus un signal toutes les 1,5 s
    ws.lastTyping.set(room, now);
    await publish(room, { type: 'typing', room, user: ws.user, color: ws.color });
  },

  async read(ws, { room, upTo }) {
    if (!ws.rooms.has(room)) return sendError(ws, 'not_in_room', 'Rejoins le salon d\'abord', { room });
    await redis.hset(`reads:${room}`, ws.user, upTo);
    await publish(room, { type: 'read', room, user: ws.user, upTo });
  },

  async reauth(ws, { ticket }) {
    const identity = await consumeTicket(ticket);
    if (!identity || identity.user !== ws.user) {
      log.warn('renouvellement refusé', { user: ws.user });
      return ws.close(4001, 'Renouvellement refusé');
    }
    ws.scheduleExpiry();
    log.info('session renouvelée', { user: ws.user });
    send(ws, { type: 'reauth_ok', sessionSeconds: cfg.SESSION_TTL_S });
  },
};

module.exports = { handlers };

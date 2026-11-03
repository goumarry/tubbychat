// Envoi vers un client, avec contre-pression et regroupement optionnel (BATCH_MS).
const { BATCH_MS } = require('../config');
const metrics = require('../metrics');
const log = require('../log');

const SOFT_LIMIT = 64 * 1024;    // au-delà : on saute les messages « jetables » (typing)
const HARD_LIMIT = 1024 * 1024;  // au-delà : le client est trop lent, on le coupe

function deliver(ws, str, type, droppable = false) {
  if (ws.readyState !== ws.OPEN) return;
  if (ws.bufferedAmount > HARD_LIMIT) {
    log.warn('client trop lent, connexion coupée', { user: ws.user, enAttente: ws.bufferedAmount });
    ws.terminate();
    return;
  }
  if (droppable && ws.bufferedAmount > SOFT_LIMIT) return;
  metrics.messages.inc({ direction: 'out', type });

  if (!BATCH_MS) return ws.send(str);
  // Regroupement : on accumule pendant BATCH_MS puis on envoie un tableau JSON en une seule trame.
  ws.queue.push(str);
  if (!ws.flushTimer) ws.flushTimer = setTimeout(() => flush(ws), BATCH_MS);
}

function flush(ws) {
  ws.flushTimer = null;
  const q = ws.queue;
  ws.queue = [];
  if (!q.length || ws.readyState !== ws.OPEN) return;
  ws.send(q.length === 1 ? q[0] : `[${q.join(',')}]`);
}

function send(ws, obj) { deliver(ws, JSON.stringify(obj), obj.type); }

function sendError(ws, code, message, extra = {}) {
  metrics.errors.inc({ code });
  send(ws, { type: 'error', code, message, ...extra });
}

module.exports = { deliver, send, sendError };

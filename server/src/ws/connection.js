// Poignée de main (origine, ticket, quotas) puis cycle de vie d'une connexion.
const { WebSocketServer } = require('ws');
const cfg = require('../config');
const { consumeTicket } = require('../auth');
const presence = require('../presence');
const metrics = require('../metrics');
const log = require('../log');
const { sockets, byUser, byRoom, byIp, addTo, removeFrom } = require('./state');
const { send, sendError } = require('./send');
const { parse } = require('./schema');
const { TokenBucket } = require('./ratelimit');
const { handlers } = require('./handlers');

function clientIp(req) {
  if (cfg.TRUST_PROXY && req.headers['x-forwarded-for']) {
    // La DERNIÈRE adresse est celle ajoutée par notre nginx ; les précédentes peuvent être inventées par le client.
    return req.headers['x-forwarded-for'].split(',').pop().trim();
  }
  return req.socket.remoteAddress;
}

function attach(server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: cfg.MAX_PAYLOAD });

  server.on('upgrade', async (req, socket, head) => {
    socket.on('error', () => {}); // un client qui coupe pendant la poignée de main ne doit rien faire planter
    const origin = req.headers.origin;
    const ip = clientIp(req);
    const reject = (status, text, reason, extra = {}) => {
      metrics.rejected.inc({ reason });
      log.warn('poignée de main refusée', { status, reason, origin, ip, ...extra });
      socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
      socket.destroy();
    };

    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/ws') return reject(404, 'Not Found', 'path');
    // 1) Origine : liste blanche exacte (protection contre le CSWSH).
    if (!origin || !cfg.ALLOWED_ORIGINS.has(origin)) return reject(403, 'Forbidden', 'origin');
    // 2) Quota par adresse IP.
    if ((byIp.get(ip) || 0) >= cfg.MAX_CONN_PER_IP) return reject(429, 'Too Many Requests', 'quota_ip');
    // 3) Authentification : ticket à usage unique.
    let identity;
    try { identity = await consumeTicket(url.searchParams.get('ticket')); }
    catch { return reject(503, 'Service Unavailable', 'redis'); }
    if (!identity) return reject(401, 'Unauthorized', 'ticket');
    // 4) Quota par utilisateur (sur cette instance).
    if ((byUser.get(identity.user)?.size || 0) >= cfg.MAX_CONN_PER_USER) return reject(429, 'Too Many Requests', 'quota_user', { user: identity.user });

    wss.handleUpgrade(req, socket, head, ws => onConnection(ws, identity, ip, origin));
  });

  // Battement de cœur WebSocket (ping/pong) : coupe les connexions mortes.
  setInterval(() => {
    for (const ws of sockets) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, cfg.PING_INTERVAL_MS).unref();

  return wss;
}

function onConnection(ws, identity, ip, origin) {
  Object.assign(ws, {
    user: identity.user, color: identity.color, role: identity.role, ip,
    rooms: new Set(), lastTyping: new Map(), queue: [], flushTimer: null,
    bucket: new TokenBucket(cfg.BUCKET_CAPACITY, cfg.BUCKET_REFILL_PER_S), strikes: 0,
    isAlive: true, chain: Promise.resolve(),
  });
  sockets.add(ws);
  addTo(byUser, ws.user, ws);
  byIp.set(ip, (byIp.get(ip) || 0) + 1);
  metrics.connections.inc();

  // Expiration : le jeton n'est vérifié qu'une fois, c'est donc au serveur de surveiller l'heure.
  ws.scheduleExpiry = () => {
    clearTimeout(ws.warnTimer); clearTimeout(ws.expiryTimer);
    const ttl = cfg.SESSION_TTL_S * 1000;
    const warnBefore = Math.min(60_000, ttl / 3);
    ws.warnTimer = setTimeout(() => send(ws, { type: 'session_expiring', inSeconds: Math.round(warnBefore / 1000) }), ttl - warnBefore);
    ws.expiryTimer = setTimeout(() => { log.info('session expirée', { user: ws.user }); ws.close(4001, 'Session expirée'); }, ttl);
  };
  ws.scheduleExpiry();

  log.info('connexion acceptée', { user: ws.user, origin, ip });
  send(ws, { type: 'welcome', user: ws.user, color: ws.color, role: ws.role, instance: cfg.INSTANCE_ID, sessionSeconds: cfg.SESSION_TTL_S });

  ws.on('pong', () => { ws.isAlive = true; });

  // INDISPENSABLE : sans écouteur, un message trop gros lève une exception et arrête tout le processus.
  ws.on('error', err => {
    metrics.errors.inc({ code: err.code || 'ws_error' });
    log.warn('trame rejetée', { user: ws.user, code: err.code });
  });

  ws.on('message', (data, isBinary) => {
    if (ws.readyState !== ws.OPEN) return;
    const receivedAt = Date.now();
    metrics.messages.inc({ direction: 'in', type: 'raw' });

    if (!ws.bucket.take()) {
      ws.strikes++;
      sendError(ws, 'rate_limited', 'Doucement ! Trop de messages d\'un coup', { strikes: ws.strikes });
      if (ws.strikes >= cfg.MAX_STRIKES) {
        log.warn('débit abusif, connexion fermée', { user: ws.user });
        ws.close(1008, 'Débit abusif');
      }
      return;
    }
    if (isBinary) return sendError(ws, 'invalid_message', 'Les messages binaires ne sont pas acceptés');

    const parsed = parse(data.toString('utf8'));
    if (!parsed.msg) {
      log.warn('message rejeté', { user: ws.user, code: parsed.code, raison: parsed.message });
      return sendError(ws, parsed.code, parsed.message);
    }

    if (cfg.LOG_MESSAGES) log.info('ws ←', { user: ws.user, trame: log.redact(parsed.msg) });

    // Les messages d'une même connexion sont traités dans l'ordre d'arrivée.
    ws.chain = ws.chain
      .then(() => handlers[parsed.msg.type](ws, parsed.msg, receivedAt))
      .catch(e => {
        log.error('erreur de traitement', { user: ws.user, type: parsed.msg.type, message: e.message });
        sendError(ws, 'internal', 'Oups, le serveur a trébuché. Réessaie.');
      });
  });

  ws.on('close', code => {
    clearTimeout(ws.warnTimer); clearTimeout(ws.expiryTimer); clearTimeout(ws.flushTimer);
    sockets.delete(ws);
    removeFrom(byUser, ws.user, ws);
    const n = (byIp.get(ws.ip) || 1) - 1;
    n ? byIp.set(ws.ip, n) : byIp.delete(ws.ip);
    metrics.connections.dec();
    metrics.disconnects.inc({ close_code: String(code) });
    for (const room of ws.rooms) {
      removeFrom(byRoom, room, ws);
      presence.exit(ws, room).catch(e => log.error('présence (sortie)', { message: e.message }));
    }
    log.info('connexion fermée', { user: ws.user, code });
  });
}

module.exports = { attach };

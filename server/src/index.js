// Point d'entrée : un serveur HTTP qui sert l'API REST et accepte les WebSockets sur /ws.
const http = require('node:http');
const cfg = require('./config');
const log = require('./log');
const broker = require('./broker');
const presence = require('./presence');
const { handle } = require('./http');
const { attach } = require('./ws/connection');
const { sockets } = require('./ws/state');

const server = http.createServer((req, res) => { handle(req, res); });
attach(server);
broker.start();
presence.start();

server.listen(cfg.PORT, () => {
  log.info('serveur démarré', { port: cfg.PORT, origines: [...cfg.ALLOWED_ORIGINS], batchMs: cfg.BATCH_MS, sessionSeconds: cfg.SESSION_TTL_S });
});

// Arrêt propre (docker compose stop) : on prévient les clients (1001) pour qu'ils se reconnectent ailleurs.
let stopping = false;
function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  log.warn('arrêt de l\'instance', { signal, connexions: sockets.size });
  server.close();
  for (const ws of sockets) ws.close(1001, 'Instance arrêtée');
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Métriques Prometheus exposées sur /metrics (bloqué par nginx, lu par Prometheus dans le réseau Docker).
const client = require('prom-client');
const { INSTANCE_ID } = require('./config');

const register = new client.Registry();
// « instance » est déjà un label réservé par Prometheus : on utilise « server ».
register.setDefaultLabels({ server: INSTANCE_ID });
client.collectDefaultMetrics({ register });

const m = {
  register,
  connections: new client.Gauge({ name: 'ws_connections_active', help: 'Connexions WebSocket ouvertes', registers: [register] }),
  messages: new client.Counter({ name: 'ws_messages_total', help: 'Messages WebSocket', labelNames: ['direction', 'type'], registers: [register] }),
  latency: new client.Histogram({
    name: 'ws_message_latency_seconds',
    help: 'Délai entre la réception d\'un message (instance d\'origine) et sa diffusion (instance de destination)',
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [register],
  }),
  errors: new client.Counter({ name: 'ws_errors_total', help: 'Messages refusés', labelNames: ['code'], registers: [register] }),
  disconnects: new client.Counter({ name: 'ws_disconnects_total', help: 'Fermetures de connexion', labelNames: ['close_code'], registers: [register] }),
  rejected: new client.Counter({ name: 'ws_handshake_rejected_total', help: 'Poignées de main refusées', labelNames: ['reason'], registers: [register] }),
};

module.exports = m;

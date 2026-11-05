// Toute la configuration vient des variables d'environnement (voir docker-compose.yml).
const list = v => (v || '').split(',').map(s => s.trim()).filter(Boolean);
const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

const ROOMS = [
  { name: 'colline', label: 'La Colline', color: 'rouge', description: 'Le grand salon où tout le monde se retrouve' },
  { name: 'maison-tubby', label: 'La Maison Tubby', color: 'violet', description: 'Au chaud sous le dôme, on papote' },
  { name: 'jardin', label: 'Le Jardin', color: 'vert', description: 'Fleurs qui parlent et lapins qui sautent' },
  { name: 'soleil', label: 'Le Soleil', color: 'jaune', description: 'Bonnes nouvelles et grands sourires' },
  { name: 'placard-noo-noo', label: 'Le placard de Noo-Noo', color: 'bleu', adminOnly: true, description: 'Réservé aux admins (démo d\'autorisation)' },
];

module.exports = {
  PORT: num(process.env.PORT, 3000),
  INSTANCE_ID: process.env.INSTANCE_ID || 'api-local',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // Origines autorisées à ouvrir un WebSocket : comparaison EXACTE.
  ALLOWED_ORIGINS: new Set(list(process.env.ALLOWED_ORIGINS || 'http://localhost:8090,http://localhost:5173')),
  // Derrière nginx, l'IP du client est la DERNIÈRE entrée de X-Forwarded-For (celle ajoutée par notre proxy).
  TRUST_PROXY: process.env.TRUST_PROXY === '1',
  // En HTTPS : cookie Secure + préfixe __Host-. Impossible en HTTP sur localhost.
  SECURE_COOKIES: process.env.SECURE_COOKIES === '1',

  // Journalise chaque trame WebSocket entrante et sortante (debug / démo). Désactivé par défaut : volume + vie privée.
  LOG_MESSAGES: process.env.LOG_MESSAGES === '1',

  LOGIN_TTL_S: 7 * 24 * 3600,                               // session HTTP (cookie)
  SESSION_TTL_S: num(process.env.SESSION_TTL_SECONDS, 900), // session WebSocket avant renouvellement
  TICKET_TTL_S: 30,                                         // ticket à usage unique

  MAX_PAYLOAD: 8 * 1024,
  MAX_CONN_PER_USER: num(process.env.MAX_CONN_PER_USER, 5),
  MAX_CONN_PER_IP: num(process.env.MAX_CONN_PER_IP, 50),
  BUCKET_CAPACITY: 10,
  BUCKET_REFILL_PER_S: 5,
  MAX_STRIKES: 3,

  HISTORY_MAX: 1000,      // messages conservés par salon (Redis Stream MAXLEN ~)
  HISTORY_INITIAL: 50,    // messages envoyés à l'arrivée dans un salon
  HISTORY_RESUME_MAX: 500,

  PRESENCE_BEAT_MS: 10_000,
  PRESENCE_STALE_MS: 30_000,
  PING_INTERVAL_MS: 30_000,

  // Optimisation phase 5 : regrouper les envois pendant BATCH_MS millisecondes (0 = désactivé).
  BATCH_MS: num(process.env.BATCH_MS, 0),

  ADMINS: new Set(list(process.env.ADMIN_USERS || 'admin')),
  ROOMS,
  ROOMS_BY_NAME: new Map(ROOMS.map(r => [r.name, r])),
};

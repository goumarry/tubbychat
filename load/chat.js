// Scénario de charge TubbyChat (k6).
//   MAX_CONN_PER_IP=100000 docker compose up -d       (toutes les connexions k6 viennent d'une seule IP)
//   docker compose --profile charge run --rm k6
//
// Chaque utilisateur virtuel (VU) : s'inscrit/se connecte (une fois), obtient un ticket, ouvre un WebSocket,
// rejoint un des 4 salons publics, envoie un message toutes les 2 s et mesure le temps jusqu'à
// la réception de SON PROPRE message diffusé (aller-retour complet : client → nginx → instance → Redis → instance → client).
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const BASE = __ENV.BASE || 'http://web';
const ORIGIN = __ENV.ORIGIN || 'http://localhost:8090';
const ROOMS = ['colline', 'maison-tubby', 'jardin', 'soleil'];
const SEND_EVERY_MS = 2000;
const CONNECTION_MS = 60_000;

const latency = new Trend('chat_latency', true);
const received = new Counter('chat_messages_received');
const sent = new Counter('chat_messages_sent');
const wsErrors = new Counter('ws_errors');

export const options = {
  noCookiesReset: true, // garder le cookie de session d'une itération à l'autre
  scenarios: {
    montee: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 100 }, { duration: '30s', target: 100 },
        { duration: '20s', target: 300 }, { duration: '30s', target: 300 },
        { duration: '20s', target: 600 }, { duration: '30s', target: 600 },
        { duration: '20s', target: 1000 }, { duration: '30s', target: 1000 },
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    chat_latency: ['p(95)<250'],
    ws_errors: ['count<50'],
  },
};

const json = { headers: { 'Content-Type': 'application/json', Origin: ORIGIN } };
let loggedIn = false;

export default function () {
  const user = `k6u${__VU}`;
  if (!loggedIn) {
    // 409 si le compte existe déjà (relance du test) : on se connecte simplement ensuite.
    http.post(`${BASE}/api/register`, JSON.stringify({ username: user, password: 'motdepasse', color: 'vert' }), json);
    const r = http.post(`${BASE}/api/login`, JSON.stringify({ username: user, password: 'motdepasse' }), json);
    loggedIn = check(r, { 'connexion HTTP 200': x => x.status === 200 });
    if (!loggedIn) { sleep(1); return; }
  }
  const t = http.post(`${BASE}/api/ws-ticket`, null, json); // le cookie de session est géré par k6
  if (!check(t, { 'ticket obtenu': x => x.status === 200 })) { loggedIn = false; sleep(1); return; }

  const room = ROOMS[__VU % ROOMS.length];
  const url = `${BASE.replace(/^http/, 'ws')}/ws?ticket=${t.json('ticket')}`;
  let seq = 0;

  const res = ws.connect(url, { headers: { Origin: ORIGIN } }, socket => {
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'join', room }));
      socket.setInterval(() => {
        socket.send(JSON.stringify({ type: 'chat', room, text: `k6 ${Date.now()}`, clientMsgId: `k6-${__VU}-${__ITER}-${seq++}` }));
        sent.add(1);
      }, SEND_EVERY_MS);
      socket.setTimeout(() => socket.close(), CONNECTION_MS);
    });
    socket.on('message', data => {
      for (const m of [].concat(JSON.parse(data))) {
        if (m.type !== 'chat') continue;
        received.add(1);
        if (m.from === user && m.text.startsWith('k6 ')) latency.add(Date.now() - Number(m.text.slice(3)));
      }
    });
    socket.on('error', () => wsErrors.add(1));
  });
  if (!check(res, { 'poignée de main 101': r => r && r.status === 101 })) sleep(1);
}

// Recette de la phase 3, jouée contre l'application lancée (par défaut à travers nginx).
//   docker compose exec api-1 npm run test-securite
//   ou, depuis le poste : BASE=http://localhost:8090 node test/securite.test.js
const WebSocket = require('ws');

const BASE = process.env.BASE || 'http://web';
const WS_URL = BASE.replace(/^http/, 'ws') + '/ws';
const ORIGIN = process.env.ORIGIN || 'http://localhost:8090';
let passed = 0, failed = 0;

function check(name, ok, detail = '') {
  ok ? passed++ : failed++;
  console.log(`${ok ? '\x1b[32m✔' : '\x1b[31m✘'}\x1b[0m ${name}${detail ? `  \x1b[90m${detail}\x1b[0m` : ''}`);
}

async function api(path, body, cookie) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...(cookie && { cookie }) },
    body: body && JSON.stringify(body),
  });
  return { status: r.status, cookie: r.headers.get('set-cookie')?.split(';')[0], body: r.status === 204 ? null : await r.json() };
}

function open(url, origin = ORIGIN) {
  return new Promise(resolve => {
    const ws = new WebSocket(url, { origin });
    ws.on('unexpected-response', (_req, res) => resolve({ status: res.statusCode }));
    ws.on('open', () => resolve({ ws }));
    ws.on('error', e => resolve({ status: e.message }));
  });
}

// Attend le prochain message dont le type correspond (ou la fermeture).
function next(ws, types) {
  return new Promise(resolve => {
    const onMsg = d => {
      for (const m of [].concat(JSON.parse(d))) {
        if (!types || types.includes(m.type)) { cleanup(); return resolve({ msg: m }); }
      }
    };
    const onClose = code => { cleanup(); resolve({ closed: code }); };
    const cleanup = () => { ws.off('message', onMsg); ws.off('close', onClose); };
    ws.on('message', onMsg);
    ws.on('close', onClose);
  });
}

(async () => {
  const user = 'test' + Math.random().toString(36).slice(2, 8);
  const reg = await api('/api/register', { username: user, password: 'motdepasse', color: 'vert' });
  const cookie = reg.cookie;
  const ticket = async () => (await api('/api/ws-ticket', null, cookie)).body.ticket;
  console.log(`Utilisateur de test : ${user}\n`);

  // --- Critère 1 : connexion sans jeton valide refusée
  let r = await open(WS_URL);
  check('Connexion sans jeton refusée', r.status === 401, `HTTP ${r.status}`);
  r = await open(WS_URL + '?ticket=nimportequoi-123456');
  check('Connexion avec un faux ticket refusée', r.status === 401, `HTTP ${r.status}`);

  // --- Critère 2 : origine absente de la liste blanche refusée
  r = await open(`${WS_URL}?ticket=${await ticket()}`, 'https://evil.example');
  check('Origine non autorisée refusée', r.status === 403, `HTTP ${r.status}`);

  // --- Bonus : rejeu du ticket
  const t = await ticket();
  r = await open(`${WS_URL}?ticket=${t}`);
  r.ws.close();
  r = await open(`${WS_URL}?ticket=${t}`);
  check('Ticket rejoué refusé (usage unique)', r.status === 401, `HTTP ${r.status}`);

  // --- Critère 3 : message malformé rejeté SANS arrêter le serveur
  const { ws } = await open(`${WS_URL}?ticket=${await ticket()}`);
  await next(ws, ['welcome']);
  ws.send('{ceci nest pas du json');
  let a = await next(ws, ['error']);
  check('JSON malformé rejeté', a.msg?.code === 'invalid_json', JSON.stringify(a.msg));
  ws.send(JSON.stringify({ type: 'chat', room: 'colline', text: 42, clientMsgId: 'abcdefgh-1' }));
  a = await next(ws, ['error']);
  check('Mauvais type de champ rejeté', a.msg?.code === 'invalid_message', a.msg?.message);
  ws.send(JSON.stringify({ type: 'join', room: 'colline', from: 'admin' }));
  a = await next(ws, ['error']);
  check('Champ inconnu (usurpation) rejeté', a.msg?.code === 'invalid_message', a.msg?.message);
  ws.send(JSON.stringify({ type: 'join', room: 'colline' }));
  a = await next(ws, ['joined']);
  check('… la même connexion fonctionne encore', a.msg?.type === 'joined');

  // --- Autorisation
  ws.send(JSON.stringify({ type: 'join', room: 'placard-noo-noo' }));
  a = await next(ws, ['error']);
  check('Salon réservé aux admins refusé', a.msg?.code === 'forbidden', a.msg?.message);
  ws.send(JSON.stringify({ type: 'chat', room: 'jardin', text: 'coucou', clientMsgId: 'abcdefgh-2' }));
  a = await next(ws, ['error']);
  check('Écrire dans un salon non rejoint refusé', a.msg?.code === 'not_in_room');

  // --- Idempotence : le même clientMsgId envoyé deux fois n'est enregistré qu'une fois
  const cid = 'dedupe-' + Date.now();
  ws.send(JSON.stringify({ type: 'chat', room: 'colline', text: 'une seule fois', clientMsgId: cid }));
  const ack1 = await next(ws, ['ack']);
  ws.send(JSON.stringify({ type: 'chat', room: 'colline', text: 'une seule fois', clientMsgId: cid }));
  const ack2 = await next(ws, ['ack']);
  check('Doublon détecté (même id renvoyé)', ack1.msg.id === ack2.msg.id && ack2.msg.duplicate === true, ack1.msg.id);

  // --- Message trop gros : fermeture 1009, le serveur survit
  await new Promise(res => setTimeout(res, 2000)); // laisser le seau à jetons se remplir
  ws.send(JSON.stringify({ type: 'chat', room: 'colline', text: 'A'.repeat(20_000), clientMsgId: 'abcdefgh-3' }));
  a = await next(ws);
  check('Message de 20 Kio : fermeture 1009', a.closed === 1009, `code ${a.closed}`);
  r = await open(`${WS_URL}?ticket=${await ticket()}`);
  check('… et le serveur accepte toujours de nouvelles connexions', !!r.ws);

  // --- Limitation de débit
  await next(r.ws, ['welcome']);
  let limited = false;
  r.ws.on('message', d => { for (const m of [].concat(JSON.parse(d))) if (m.code === 'rate_limited') limited = true; });
  for (let i = 0; i < 30; i++) r.ws.send(JSON.stringify({ type: 'typing', room: 'colline' }));
  await new Promise(res => setTimeout(res, 500));
  check('Rafale de 30 messages : débit limité', limited);
  r.ws.close();

  // --- Révocation : la déconnexion ferme les WebSockets ouverts (4003)
  const { ws: ws2 } = await open(`${WS_URL}?ticket=${await ticket()}`);
  await next(ws2, ['welcome']);
  const closing = next(ws2);
  await api('/api/logout', null, cookie);
  a = await closing;
  check('Déconnexion : WebSocket fermé avec 4003', a.closed === 4003, `code ${a.closed}`);
  const after = await api('/api/ws-ticket', null, cookie);
  check('… et la session ne permet plus d\'obtenir de ticket', after.status === 401, `HTTP ${after.status}`);

  console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('Erreur : l\'application est-elle lancée ?', e); process.exit(1); });

// Routes HTTP : comptes, session (cookie), ticket WebSocket, salons, métriques.
const cfg = require('./config');
const auth = require('./auth');
const { revoke } = require('./broker');
const metrics = require('./metrics');
const log = require('./log');

const COOKIE = cfg.SECURE_COOKIES ? '__Host-sid' : 'sid';

function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

function readCookie(req) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return v.join('=');
  }
  return null;
}

function sessionCookie(sid, maxAge) {
  return `${COOKIE}=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${cfg.SECURE_COOKIES ? '; Secure' : ''}`;
}

function readJson(req, limit = 10 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new auth.HttpError(413, 'Requête trop grosse')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new auth.HttpError(400, 'JSON invalide')); }
    });
    req.on('error', reject);
  });
}

async function requireSession(req) {
  const s = await auth.getSession(readCookie(req));
  if (!s) throw new auth.HttpError(401, 'Non connecté');
  return s;
}

async function handle(req, res) {
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    if (pathname === '/metrics') {
      res.writeHead(200, { 'Content-Type': metrics.register.contentType });
      return res.end(await metrics.register.metrics());
    }
    if (pathname === '/healthz') return json(res, 200, { ok: true, instance: cfg.INSTANCE_ID });
    if (!pathname.startsWith('/api/')) return json(res, 404, { error: 'Introuvable' });

    // Protection CSRF en complément de SameSite=Strict : un POST venant d'une autre origine est refusé.
    const origin = req.headers.origin;
    if (req.method === 'POST' && origin && !cfg.ALLOWED_ORIGINS.has(origin)) return json(res, 403, { error: 'Origine refusée' });

    switch (`${req.method} ${pathname}`) {
      case 'POST /api/register': {
        const identity = await auth.register(await readJson(req));
        const sid = await auth.createSession(identity);
        log.info('compte créé', { user: identity.user });
        return json(res, 201, identity, { 'Set-Cookie': sessionCookie(sid, cfg.LOGIN_TTL_S) });
      }
      case 'POST /api/login': {
        const identity = await auth.login(await readJson(req));
        const sid = await auth.createSession(identity);
        log.info('connexion HTTP', { user: identity.user });
        return json(res, 200, identity, { 'Set-Cookie': sessionCookie(sid, cfg.LOGIN_TTL_S) });
      }
      case 'POST /api/logout': {
        const s = await requireSession(req);
        await auth.destroySessions(s.user);
        await revoke(s.user); // ferme les WebSockets ouverts de l'utilisateur, sur TOUTES les instances
        log.info('déconnexion partout', { user: s.user });
        return json(res, 204, undefined, { 'Set-Cookie': sessionCookie('', 0) });
      }
      case 'GET /api/me':
        return json(res, 200, await requireSession(req));
      case 'POST /api/ws-ticket': {
        const s = await requireSession(req);
        return json(res, 200, { ticket: await auth.issueTicket(s), expiresIn: cfg.TICKET_TTL_S });
      }
      case 'GET /api/rooms':
        return json(res, 200, cfg.ROOMS);
      default:
        return json(res, 404, { error: 'Introuvable' });
    }
  } catch (e) {
    if (e.status) return json(res, e.status, { error: e.message });
    log.error('erreur HTTP', { path: pathname, message: e.message });
    return json(res, 500, { error: 'Erreur interne' });
  }
}

module.exports = { handle };

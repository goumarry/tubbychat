// Comptes, sessions HTTP et tickets WebSocket. Tout est dans Redis : partagé entre les instances.
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { redis } = require('./redis');
const cfg = require('./config');

const scrypt = promisify(crypto.scrypt);
const USER_RE = /^[a-z0-9_-]{3,20}$/;
const COLORS = ['violet', 'vert', 'jaune', 'rouge'];

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

async function checkPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const computed = await scrypt(password, Buffer.from(salt, 'hex'), 64);
  return crypto.timingSafeEqual(computed, Buffer.from(hash, 'hex')); // comparaison en temps constant
}

async function register({ username, password, color }) {
  if (typeof username !== 'string' || !USER_RE.test(username)) throw new HttpError(400, 'Pseudo : 3 à 20 caractères (a-z, 0-9, _ ou -)');
  if (typeof password !== 'string' || password.length < 6 || password.length > 128) throw new HttpError(400, 'Mot de passe : 6 caractères minimum');
  if (!COLORS.includes(color)) throw new HttpError(400, 'Choisis ton Tubby (violet, vert, jaune ou rouge)');
  const created = await redis.hsetnx(`user:${username}`, 'hash', await hashPassword(password));
  if (!created) throw new HttpError(409, 'Ce pseudo est déjà pris');
  const role = cfg.ADMINS.has(username) ? 'admin' : 'membre';
  await redis.hset(`user:${username}`, 'color', color, 'role', role);
  return { user: username, color, role };
}

async function login({ username, password }) {
  if (typeof username !== 'string' || typeof password !== 'string' || !USER_RE.test(username)) throw new HttpError(401, 'Pseudo ou mot de passe incorrect');
  const u = await redis.hgetall(`user:${username}`);
  if (!u.hash || !(await checkPassword(password, u.hash))) throw new HttpError(401, 'Pseudo ou mot de passe incorrect');
  return { user: username, color: u.color, role: u.role };
}

async function createSession(identity) {
  const sid = crypto.randomBytes(32).toString('base64url');
  await redis.multi()
    .set(`session:${sid}`, JSON.stringify(identity), 'EX', cfg.LOGIN_TTL_S)
    .sadd(`sessions:${identity.user}`, sid)           // index des sessions de l'utilisateur
    .expire(`sessions:${identity.user}`, cfg.LOGIN_TTL_S)
    .exec();
  return sid;
}

async function getSession(sid) {
  if (!sid || sid.length > 100) return null;
  const raw = await redis.get(`session:${sid}`);
  return raw ? JSON.parse(raw) : null;
}

async function destroySessions(user) {
  // « Déconnexion partout » : on supprime toutes les sessions HTTP de l'utilisateur.
  const sids = await redis.smembers(`sessions:${user}`);
  if (sids.length) await redis.del(...sids.map(s => `session:${s}`));
  await redis.del(`sessions:${user}`);
}

async function issueTicket(identity) {
  const ticket = crypto.randomBytes(24).toString('base64url');
  await redis.set(`ticket:${ticket}`, JSON.stringify(identity), 'EX', cfg.TICKET_TTL_S);
  return ticket;
}

// GETDEL : lire ET supprimer en une seule opération atomique. Un ticket rejoué ne vaut plus rien.
async function consumeTicket(ticket) {
  if (typeof ticket !== 'string' || ticket.length < 10 || ticket.length > 100) return null;
  const raw = await redis.getdel(`ticket:${ticket}`);
  return raw ? JSON.parse(raw) : null;
}

module.exports = { HttpError, register, login, createSession, getSession, destroySessions, issueTicket, consumeTicket };

// Présence partagée entre instances.
//   presence:{salon}  sorted set  utilisateur -> horodatage du dernier battement de cœur
//   presconn:{salon}  hash        utilisateur -> nombre de connexions ouvertes (plusieurs onglets)
const { redis } = require('./redis');
const cfg = require('./config');
const { byRoom } = require('./ws/state');
const log = require('./log');

let publish; // injecté par broker.js (évite une dépendance circulaire)
function setPublisher(fn) { publish = fn; }

async function enter(ws, room) {
  const [[, count]] = await redis.multi()
    .hincrby(`presconn:${room}`, ws.user, 1)
    .zadd(`presence:${room}`, Date.now(), ws.user)
    .exec();
  if (count === 1) publish(room, { type: 'presence', room, user: ws.user, color: ws.color, status: 'online' });
}

async function exit(ws, room) {
  const count = await redis.hincrby(`presconn:${room}`, ws.user, -1);
  if (count > 0) return; // l'utilisateur a encore un autre onglet ouvert
  const removed = await redis.multi().hdel(`presconn:${room}`, ws.user).zrem(`presence:${room}`, ws.user).exec();
  if (removed[1][1]) publish(room, { type: 'presence', room, user: ws.user, status: 'offline' });
}

async function members(room) {
  const users = await redis.zrange(`presence:${room}`, 0, -1);
  if (!users.length) return [];
  const pipe = redis.pipeline();
  users.forEach(u => pipe.hget(`user:${u}`, 'color'));
  const colors = await pipe.exec();
  return users.map((user, i) => ({ user, color: colors[i][1] || 'violet' }));
}

// Battement de cœur : toutes les 10 s, chaque instance rafraîchit ses utilisateurs locaux.
async function beat() {
  const pipe = redis.pipeline();
  const now = Date.now();
  for (const [room, set] of byRoom) {
    for (const user of new Set([...set].map(ws => ws.user))) pipe.zadd(`presence:${room}`, now, user);
  }
  if (pipe.length) await pipe.exec();
}

// Nettoyeur : retire les utilisateurs sans battement depuis 30 s (instance plantée, réseau coupé).
async function sweep() {
  const limit = Date.now() - cfg.PRESENCE_STALE_MS;
  for (const { name: room } of cfg.ROOMS) {
    const stale = await redis.zrangebyscore(`presence:${room}`, '-inf', limit);
    for (const user of stale) {
      const removed = await redis.zrem(`presence:${room}`, user);
      await redis.hdel(`presconn:${room}`, user);
      if (removed) {
        log.info('présence expirée', { user, room });
        publish(room, { type: 'presence', room, user, status: 'offline' });
      }
    }
  }
}

function start() {
  setInterval(() => beat().catch(e => log.error('battement', { message: e.message })), cfg.PRESENCE_BEAT_MS).unref();
  setInterval(() => sweep().catch(e => log.error('nettoyage présence', { message: e.message })), 5000).unref();
}

module.exports = { enter, exit, members, start, setPublisher };

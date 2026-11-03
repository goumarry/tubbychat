// Redis pub/sub : chaque instance publie sur room:{salon}, et TOUTES les instances
// reçoivent le message puis le transmettent à LEURS clients locaux membres du salon.
const { redis, sub } = require('./redis');
const { byRoom, byUser } = require('./ws/state');
const { deliver } = require('./ws/send');
const presence = require('./presence');
const metrics = require('./metrics');
const log = require('./log');

function publish(room, obj) {
  return redis.publish(`room:${room}`, JSON.stringify(obj));
}

function revoke(user) {
  return redis.publish(`user:${user}`, JSON.stringify({ type: 'revoke' }));
}

function start() {
  presence.setPublisher(publish);
  sub.psubscribe('room:*', 'user:*');

  sub.on('pmessage', (_pattern, channel, payload) => {
    try {
      if (channel.startsWith('room:')) {
        const set = byRoom.get(channel.slice(5));
        if (!set) return;
        const msg = JSON.parse(payload);
        if (msg.type === 'chat') metrics.latency.observe((Date.now() - msg.at) / 1000);
        for (const ws of set) deliver(ws, payload, msg.type, msg.type === 'typing');
      } else if (channel.startsWith('user:')) {
        const sockets = byUser.get(channel.slice(5));
        if (!sockets) return;
        log.warn('révocation', { user: channel.slice(5), connexions: sockets.size });
        for (const ws of sockets) ws.close(4003, 'Accès révoqué');
      }
    } catch (e) {
      log.error('pub/sub', { channel, message: e.message });
    }
  });
}

module.exports = { publish, revoke, start };

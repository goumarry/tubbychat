// Deux connexions Redis : une connexion en mode « abonné » ne peut plus envoyer d'autres commandes.
const Redis = require('ioredis');
const { REDIS_URL } = require('./config');
const log = require('./log');

const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 2 }); // commandes + PUBLISH
const sub = new Redis(REDIS_URL);                                  // PSUBSCRIBE uniquement

for (const [name, c] of [['commandes', redis], ['abonnement', sub]]) {
  c.on('error', e => log.error('redis', { connexion: name, message: e.message }));
  c.on('ready', () => log.info('redis prêt', { connexion: name }));
}

module.exports = { redis, sub };

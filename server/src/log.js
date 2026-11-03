// Journal JSON, une ligne par événement. Les champs sensibles sont masqués automatiquement.
const { INSTANCE_ID } = require('./config');

const SECRET = /ticket|password|cookie|sid|token|hash/i;

function write(level, event, fields = {}) {
  const line = { t: new Date().toISOString(), level, instance: INSTANCE_ID, event };
  for (const [k, v] of Object.entries(fields)) line[k] = SECRET.test(k) ? '[masqué]' : v;
  console.log(JSON.stringify(line));
}

module.exports = {
  info: (event, fields) => write('info', event, fields),
  warn: (event, fields) => write('warn', event, fields),
  error: (event, fields) => write('error', event, fields),
};

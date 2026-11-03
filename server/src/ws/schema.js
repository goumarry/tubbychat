// Contrat de messages client -> serveur (voir ARCHITECTURE.md §5).
// Validation stricte : type connu, champs attendus, types et formats vérifiés, champs inconnus REFUSÉS.
const ROOM = v => typeof v === 'string' && /^[a-z0-9-]{1,32}$/.test(v);
const STREAM_ID = v => typeof v === 'string' && /^\d{1,15}-\d{1,10}$/.test(v);
const CLIENT_ID = v => typeof v === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v);
const TEXT = v => typeof v === 'string' && v.trim().length >= 1 && v.length <= 1000;
const optional = check => v => v === undefined || check(v);

const SCHEMAS = {
  join:   { room: ROOM, since: optional(STREAM_ID) },
  leave:  { room: ROOM },
  chat:   { room: ROOM, text: TEXT, clientMsgId: CLIENT_ID },
  typing: { room: ROOM },
  read:   { room: ROOM, upTo: STREAM_ID },
  reauth: { ticket: v => typeof v === 'string' && v.length <= 100 },
};

function parse(raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch { return { code: 'invalid_json', message: 'JSON invalide' }; }
  if (typeof msg !== 'object' || msg === null || Array.isArray(msg)) return { code: 'invalid_message', message: 'objet JSON attendu' };
  const schema = Object.hasOwn(SCHEMAS, msg.type) ? SCHEMAS[msg.type] : null;
  if (!schema) return { code: 'invalid_message', message: `type inconnu : ${String(msg.type).slice(0, 20)}` };
  for (const key of Object.keys(msg)) {
    if (key !== 'type' && !Object.hasOwn(schema, key)) return { code: 'invalid_message', message: `champ non autorisé : ${key.slice(0, 20)}` };
  }
  for (const [key, check] of Object.entries(schema)) {
    if (!check(msg[key])) return { code: 'invalid_message', message: `champ invalide : ${key}` };
  }
  return { msg };
}

module.exports = { parse };

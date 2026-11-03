// Registres LOCAUX à l'instance : qui est connecté ICI, et dans quels salons.
// Ce qui doit être partagé entre instances (présence, historique…) est dans Redis.
const sockets = new Set();   // toutes les connexions de l'instance
const byUser = new Map();    // utilisateur -> Set<ws>
const byRoom = new Map();    // salon -> Set<ws>
const byIp = new Map();      // ip -> nombre de connexions

function addTo(map, key, ws) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(ws);
}
function removeFrom(map, key, ws) {
  const set = map.get(key);
  if (!set) return;
  set.delete(ws);
  if (!set.size) map.delete(key);
}

module.exports = { sockets, byUser, byRoom, byIp, addTo, removeFrom };

// Compare deux identifiants de Redis Stream « millisecondes-séquence ».
export function cmpId(a, b) {
  const [am, as] = a.split('-').map(Number);
  const [bm, bs] = b.split('-').map(Number);
  return am - bm || as - bs;
}

// crypto.randomUUID n'existe que dans un contexte sécurisé (https ou localhost) : on prévoit un repli.
export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Délai avant la prochaine tentative : croissant (×2), plafonné (10 s), avec gigue complète.
// Plafond de 10 s : après une panne de 10 s, le client revient en 5 s en moyenne (au lieu de 15 s avec 30 s).
export function nextDelay(attempt) {
  const exp = Math.min(10_000, 500 * 2 ** attempt);
  return Math.round(Math.random() * exp);
}

export const colorVar = c => `var(--${c || 'violet'})`;

export const hhmm = ts => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export const dayLabel = ts => {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'Aujourd\'hui';
  if (d.toDateString() === yesterday.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};

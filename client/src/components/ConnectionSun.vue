<script setup>
// Le soleil = l'état de la connexion temps réel.
//   brille et tourne : connecté   ·   un nuage passe : reconnexion   ·   se couche : hors ligne
import { computed } from 'vue';
import { store } from '../store';
import { retryNow } from '../socket';

const status = computed(() => store.conn.status);
const seconds = computed(() => Math.max(0, Math.ceil((store.conn.retryAt - store.now) / 1000)));

const title = computed(() => ({
  open: 'Le soleil brille',
  connecting: 'Le soleil se lève…',
  reconnecting: 'Un nuage passe…',
  idle: 'Le soleil dort',
}[status.value]));

const subtitle = computed(() => {
  if (status.value === 'open') return `connecté à ${store.conn.instance || '…'}`;
  if (status.value === 'reconnecting') {
    return store.conn.retryAt ? `nouvel essai dans ${seconds.value} s (essai n°${store.conn.attempt})` : 'reconnexion…';
  }
  if (status.value === 'connecting') return 'connexion en cours';
  return 'hors ligne';
});
</script>

<template>
  <div class="sunbox" :class="status" role="status" aria-live="polite">
    <svg class="sun" viewBox="0 0 120 120" aria-hidden="true">
      <g class="rays">
        <line v-for="i in 12" :key="i" :transform="`rotate(${i * 30} 60 60)`" x1="60" y1="5" x2="60" y2="19" stroke="#FFB300" stroke-width="6" stroke-linecap="round" />
      </g>
      <circle cx="60" cy="60" r="31" fill="#FFD54F" stroke="#FFB300" stroke-width="3" />
      <g v-if="status === 'open'" stroke="#6D4C41" stroke-width="3" fill="none" stroke-linecap="round">
        <path d="M46 56 q4 -6 8 0 M66 56 q4 -6 8 0" />
        <path d="M48 67 q12 11 24 0" />
      </g>
      <g v-else stroke="#6D4C41" stroke-width="3" fill="none" stroke-linecap="round">
        <path d="M46 57 h8 M66 57 h8" />
        <path d="M52 70 q8 -4 16 0" />
      </g>
      <circle cx="44" cy="66" r="4" fill="#FF8A65" opacity=".45" />
      <circle cx="76" cy="66" r="4" fill="#FF8A65" opacity=".45" />
      <g class="cloud">
        <ellipse cx="60" cy="78" rx="34" ry="14" fill="#fff" />
        <circle cx="44" cy="70" r="13" fill="#fff" />
        <circle cx="64" cy="64" r="17" fill="#fff" />
        <circle cx="82" cy="72" r="11" fill="#fff" />
      </g>
    </svg>
    <div class="label">
      <b>{{ title }}</b>
      <span>{{ subtitle }}</span>
    </div>
    <button v-if="status === 'reconnecting'" class="btn jaune encore" type="button" @click="retryNow">Encore ! Encore !</button>
  </div>
</template>

<style scoped>
.sunbox { display: flex; align-items: center; gap: 10px; flex: none; }
.sun { width: 58px; height: 58px; flex: none; overflow: visible; transition: transform .6s, filter .6s; }
.rays { transform-origin: 60px 60px; }
.open .rays { animation: spin 18s linear infinite; }
.connecting .rays { animation: spin 3s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.cloud { opacity: 0; transform: translateX(-70px); transition: opacity .5s, transform .8s; }
.reconnecting .cloud { opacity: 1; transform: translateX(0); animation: drift 3s ease-in-out infinite alternate; }
@keyframes drift { from { transform: translateX(-8px); } to { transform: translateX(8px); } }
.idle .sun { transform: translateY(10px); filter: grayscale(.6) brightness(.95); }
.label { display: grid; line-height: 1.2; min-width: 0; }
.label b { font-family: var(--f-title); font-size: 15px; white-space: nowrap; }
.label span { font-size: 13px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.open .label span { color: var(--vert-d); font-weight: 700; }
.encore { padding: 6px 14px; font-size: 14px; white-space: nowrap; animation: bounce 1s ease-in-out infinite; }
@keyframes bounce { 50% { transform: translateY(-3px); } }
</style>

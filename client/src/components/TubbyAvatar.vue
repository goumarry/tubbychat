<script setup>
// Un Tubby dessiné à la main (SVG original) : la forme de l'antenne dépend de la couleur.
// « online » : l'antenne s'allume (présence).
import { computed } from 'vue';

const props = defineProps({
  color: { type: String, default: 'violet' },
  size: { type: Number, default: 48 },
  online: { type: Boolean, default: false },
  happy: { type: Boolean, default: false },
});

const BODY = { violet: '#7E57C2', vert: '#43A047', jaune: '#FDD835', rouge: '#E53935', bleu: '#29B6F6' };
const body = computed(() => BODY[props.color] || BODY.violet);
const label = { violet: 'violet à antenne triangle', vert: 'vert à antenne droite', jaune: 'jaune à antenne bouclée', rouge: 'rouge à antenne ronde', bleu: 'bleu' };
</script>

<template>
  <svg
    class="tubby"
    :class="{ online, happy }"
    :width="size"
    :height="Math.round(size * 1.24)"
    viewBox="0 -4 100 124"
    role="img"
    :aria-label="`Tubby ${label[color] || color}${online ? ', en ligne' : ''}`"
  >
    <g class="antenna" :stroke="body" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <template v-if="color === 'violet'">
        <line x1="50" y1="26" x2="50" y2="15" />
        <polygon points="50,0 38,16 62,16" />
      </template>
      <line v-else-if="color === 'vert'" x1="50" y1="26" x2="50" y2="1" />
      <path v-else-if="color === 'jaune'" d="M50 26 C50 15 63 14 62 6 C61 -2 47 -1 48 6 C49 11 56 10 55 5" />
      <template v-else-if="color === 'rouge'">
        <line x1="50" y1="26" x2="50" y2="17" />
        <circle cx="50" cy="9" r="8" />
      </template>
      <template v-else>
        <line x1="50" y1="26" x2="50" y2="10" />
        <circle cx="50" cy="7" r="4" :fill="body" />
      </template>
    </g>

    <circle cx="22" cy="48" r="7" :fill="body" />
    <circle cx="78" cy="48" r="7" :fill="body" />
    <rect x="18" y="70" width="64" height="48" rx="26" :fill="body" />
    <rect x="35" y="83" width="30" height="21" rx="6" fill="#ECEFF1" stroke="#90A4AE" stroke-width="2.5" />
    <circle cx="50" cy="48" r="28" :fill="body" />
    <ellipse cx="50" cy="51" rx="19" ry="17" fill="#F8D9BC" />
    <template v-if="happy">
      <path d="M40 49 q3 -4 6 0 M54 49 q3 -4 6 0" stroke="#2B2A4C" stroke-width="2.4" fill="none" stroke-linecap="round" />
    </template>
    <template v-else>
      <circle cx="43" cy="48" r="2.7" fill="#2B2A4C" />
      <circle cx="57" cy="48" r="2.7" fill="#2B2A4C" />
    </template>
    <path d="M42 57 Q50 64 58 57" stroke="#2B2A4C" stroke-width="2.4" fill="none" stroke-linecap="round" />
    <circle cx="37" cy="55" r="3.2" fill="#F48FB1" opacity=".55" />
    <circle cx="63" cy="55" r="3.2" fill="#F48FB1" opacity=".55" />
  </svg>
</template>

<style scoped>
.tubby { display: block; flex: none; overflow: visible; }
.antenna { transition: filter .3s; }
.online .antenna { animation: glow 2.2s ease-in-out infinite; }
@keyframes glow {
  0%, 100% { filter: drop-shadow(0 0 2px #FFF59D) drop-shadow(0 0 4px #FFD54F); }
  50% { filter: drop-shadow(0 0 5px #FFF59D) drop-shadow(0 0 10px #FFCA28); }
}
</style>

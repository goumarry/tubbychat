<script setup>
// Le décor : ciel, nuages qui passent, collines, fleurs et un moulin à quatre couleurs.
const flowers = [
  { left: 6, bottom: 9, c: '#E53935' }, { left: 14, bottom: 13, c: '#FDD835' }, { left: 23, bottom: 8, c: '#7E57C2' },
  { left: 37, bottom: 6, c: '#FFFFFF' }, { left: 52, bottom: 11, c: '#E53935' }, { left: 63, bottom: 7, c: '#FDD835' },
  { left: 71, bottom: 12, c: '#29B6F6' }, { left: 88, bottom: 9, c: '#7E57C2' }, { left: 95, bottom: 14, c: '#FFFFFF' },
];
</script>

<template>
  <div class="sky" aria-hidden="true">
    <div class="cloud c1" />
    <div class="cloud c2" />
    <div class="cloud c3" />

    <svg class="hills back" viewBox="0 0 1440 320" preserveAspectRatio="none">
      <path d="M0 170 C 220 70, 460 80, 700 160 C 930 235, 1180 90, 1440 130 L1440 320 L0 320 Z" fill="#AED581" />
    </svg>

    <div class="windmill">
      <div class="pole" />
      <svg class="blades" viewBox="-50 -50 100 100">
        <path d="M0 0 L-8 -44 Q0 -50 8 -44 Z" fill="#7E57C2" />
        <path d="M0 0 L44 -8 Q50 0 44 8 Z" fill="#43A047" />
        <path d="M0 0 L8 44 Q0 50 -8 44 Z" fill="#FDD835" />
        <path d="M0 0 L-44 8 Q-50 0 -44 -8 Z" fill="#E53935" />
        <circle r="6" fill="#fff" stroke="#B0BEC5" stroke-width="2" />
      </svg>
    </div>

    <svg class="hills front" viewBox="0 0 1440 320" preserveAspectRatio="none">
      <path d="M0 230 C 260 150, 520 170, 760 230 C 1000 290, 1220 190, 1440 210 L1440 320 L0 320 Z" fill="#8BC34A" />
    </svg>

    <svg v-for="(f, i) in flowers" :key="i" class="flower" :style="{ left: f.left + '%', bottom: f.bottom + 'vh', animationDelay: i * 0.4 + 's' }" viewBox="-12 -12 24 34">
      <line x1="0" y1="4" x2="0" y2="22" stroke="#558B2F" stroke-width="2.5" />
      <circle v-for="a in 5" :key="a" :cx="Math.cos(a * 1.2566) * 6" :cy="Math.sin(a * 1.2566) * 6" r="4.6" :fill="f.c" />
      <circle r="3.4" fill="#FFB300" />
    </svg>
  </div>
</template>

<style scoped>
.sky {
  position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none;
  background: linear-gradient(180deg, var(--ciel-haut) 0%, var(--ciel-bas) 70%);
}
.cloud { position: absolute; background: #fff; border-radius: 999px; opacity: .9; animation: float linear infinite; }
.cloud::before, .cloud::after { content: ""; position: absolute; background: #fff; border-radius: 50%; }
.cloud::before { width: 55%; height: 160%; left: 15%; bottom: 20%; }
.cloud::after { width: 40%; height: 120%; right: 12%; bottom: 25%; }
.c1 { width: 170px; height: 46px; top: 9%; animation-duration: 95s; animation-delay: -20s; }
.c2 { width: 120px; height: 34px; top: 22%; animation-duration: 120s; animation-delay: -70s; opacity: .75; }
.c3 { width: 210px; height: 54px; top: 4%; animation-duration: 150s; animation-delay: -110s; opacity: .8; }
@keyframes float { from { transform: translateX(-260px); } to { transform: translateX(110vw); } }

.hills { position: absolute; left: 0; width: 100%; }
.hills.back { bottom: 0; height: 34vh; }
.hills.front { bottom: 0; height: 24vh; }

.windmill { position: absolute; right: 9%; bottom: 23vh; width: 90px; height: 150px; }
.pole { position: absolute; left: 50%; bottom: 0; width: 12px; height: 110px; transform: translateX(-50%); background: linear-gradient(90deg, #eceff1, #fff, #cfd8dc); border-radius: 6px 6px 2px 2px; }
.blades { position: absolute; left: 0; top: 0; width: 90px; height: 90px; animation: turn 9s linear infinite; }
@keyframes turn { to { transform: rotate(360deg); } }

.flower { position: absolute; width: 22px; height: 32px; transform-origin: 50% 100%; animation: sway 4s ease-in-out infinite alternate; }
@keyframes sway { from { transform: rotate(-6deg); } to { transform: rotate(6deg); } }

@media (max-width: 700px) { .windmill { display: none; } }
</style>

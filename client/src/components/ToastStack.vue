<script setup>
import { store } from '../store';
</script>

<template>
  <TransitionGroup tag="div" name="toast" class="toasts" aria-live="assertive">
    <div v-for="t in store.toasts" :key="t.id" class="toast" :style="{ '--c': `var(--${t.color})` }">{{ t.text }}</div>
  </TransitionGroup>
</template>

<style scoped>
.toasts { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 50; display: grid; gap: 8px; width: min(92vw, 440px); pointer-events: none; }
.toast { background: white; border-left: 8px solid var(--c); border-radius: 16px; padding: 12px 16px; font-weight: 700; box-shadow: 0 10px 24px -8px rgba(43, 42, 76, .4); }
.toast-enter-active { animation: up .35s cubic-bezier(.3, 1.5, .5, 1); }
.toast-leave-active { transition: opacity .3s, transform .3s; }
.toast-leave-to { opacity: 0; transform: translateY(10px); }
@keyframes up { from { opacity: 0; transform: translateY(30px) scale(.9); } }
</style>

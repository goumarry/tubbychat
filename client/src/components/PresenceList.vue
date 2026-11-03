<script setup>
import { computed } from 'vue';
import { store, roomState } from '../store';
import TubbyAvatar from './TubbyAvatar.vue';

const room = computed(() => store.rooms.find(r => r.name === store.current));
const rs = computed(() => roomState(store.current));
const members = computed(() => Object.entries(rs.value.members)
  .map(([user, color]) => ({ user, color, typing: (rs.value.typing[user]?.until || 0) > store.now }))
  .sort((a, b) => (a.user === store.me?.user ? -1 : b.user === store.me?.user ? 1 : a.user.localeCompare(b.user))));
</script>

<template>
  <aside class="presence panel" aria-label="Qui est en ligne">
    <h2>Qui est là ?</h2>
    <p class="sub">{{ members.length }} Tubby{{ members.length > 1 ? 's' : '' }} dans {{ room?.label || 'le salon' }}</p>
    <TransitionGroup tag="ul" name="tubby">
      <li v-for="m in members" :key="m.user">
        <TubbyAvatar :color="m.color" :size="36" online />
        <span class="name">
          <b>{{ m.user }}</b>
          <small v-if="m.user === store.me?.user">c'est toi !</small>
          <small v-else-if="m.typing" class="typing">écrit…</small>
        </span>
      </li>
    </TransitionGroup>
    <p class="legend">Les antennes s'allument quand un Tubby est en ligne.</p>
  </aside>
</template>

<style scoped>
.presence { padding: 16px 14px; min-width: 0; overflow-y: auto; display: flex; flex-direction: column; }
h2 { font-size: 18px; }
.sub { color: var(--muted); font-size: 13px; margin: 2px 0 12px; }
ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
li { display: flex; align-items: center; gap: 10px; padding: 4px 6px; border-radius: 14px; }
li:hover { background: rgba(126, 87, 194, .07); }
.name { display: grid; line-height: 1.2; min-width: 0; }
.name b { overflow: hidden; text-overflow: ellipsis; }
.name small { color: var(--muted); font-size: 12px; }
.typing { color: var(--vert-d) !important; font-weight: 700; }
.legend { margin-top: auto; padding-top: 16px; font-size: 12px; color: var(--muted); }
.tubby-enter-active { animation: arrive .5s cubic-bezier(.3, 1.6, .5, 1); }
.tubby-leave-active { transition: opacity .4s, transform .4s; }
.tubby-leave-to { opacity: 0; transform: translateX(30px); }
@keyframes arrive { from { opacity: 0; transform: translateY(-20px) scale(.6); } }
@media (max-width: 900px) { .presence { display: none; } }
</style>

<script setup>
import { store, roomState } from '../store';
import { openRoom } from '../socket';

const locked = room => room.adminOnly && store.me?.role !== 'admin';
const count = name => Object.keys(roomState(name).members).length;
</script>

<template>
  <nav class="rooms panel" aria-label="Salons">
    <h2>Les salons</h2>
    <ul>
      <li v-for="r in store.rooms" :key="r.name">
        <button
          type="button"
          class="room"
          :class="{ on: store.current === r.name, locked: locked(r) }"
          :style="{ '--c': `var(--${r.color})` }"
          :aria-current="store.current === r.name"
          @click="openRoom(r.name)"
        >
          <span class="dot" />
          <span class="txt">
            <b>{{ r.label }}</b>
            <small>{{ locked(r) ? '🔒 réservé aux admins' : store.joined.includes(r.name) ? `${count(r.name)} en ligne` : r.description }}</small>
          </span>
          <span v-if="roomState(r.name).unread" class="badge">{{ roomState(r.name).unread }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.rooms { padding: 16px 12px; min-width: 0; overflow-y: auto; }
h2 { font-size: 18px; padding: 0 8px 10px; }
ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.room { width: 100%; display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; gap: 10px; align-items: center; text-align: left; border: 2px solid transparent; background: none; border-radius: 16px; padding: 9px 10px; transition: background .2s, border-color .2s; }
.room:hover { background: color-mix(in srgb, var(--c) 9%, white); }
.room.on { background: color-mix(in srgb, var(--c) 15%, white); border-color: var(--c); }
.room.locked { opacity: .7; }
.dot { width: 18px; height: 18px; border-radius: 50%; background: var(--c); box-shadow: inset 0 -3px 0 rgba(0, 0, 0, .15); }
.txt { display: grid; min-width: 0; line-height: 1.25; }
.txt b { font-family: var(--f-title); font-weight: 600; }
.txt small { color: var(--muted); font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.badge { background: var(--rouge); color: white; font-weight: 800; font-size: 12px; min-width: 22px; height: 22px; border-radius: 999px; display: grid; place-items: center; padding: 0 6px; animation: pop .3s; }
@keyframes pop { from { transform: scale(0); } }

@media (max-width: 900px) {
  .rooms { padding: 8px; overflow-x: auto; overflow-y: hidden; }
  h2 { display: none; }
  ul { display: flex; gap: 6px; }
  .room { width: max-content; grid-template-columns: 14px auto auto; padding: 6px 12px; }
  .dot { width: 14px; height: 14px; }
  .txt small { display: none; }
}
</style>

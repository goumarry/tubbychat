<script setup>
import { store, resetStore, toast } from './store';
import { api } from './api';
import { stop } from './socket';
import SkyBackground from './components/SkyBackground.vue';
import LoginView from './components/LoginView.vue';
import ConnectionSun from './components/ConnectionSun.vue';
import RoomList from './components/RoomList.vue';
import ChatScreen from './components/ChatScreen.vue';
import PresenceList from './components/PresenceList.vue';
import TubbyAvatar from './components/TubbyAvatar.vue';
import ToastStack from './components/ToastStack.vue';

async function logout() {
  stop(); // on ferme nous-mêmes avant que le serveur ne révoque (4003)
  try { await api.logout(); } catch { /* déjà déconnecté */ }
  resetStore();
  toast('À bientôt sur la colline !', 'vert');
}
</script>

<template>
  <SkyBackground />
  <LoginView v-if="!store.me" />
  <div v-else class="app">
    <header class="top">
      <h1 class="logo"><span class="rainbow"><span>T</span><span>u</span><span>b</span><span>b</span><span>y</span></span>Chat</h1>
      <ConnectionSun class="sunslot" />
      <div class="me">
        <TubbyAvatar :color="store.me.color" :size="38" :online="store.conn.status === 'open'" />
        <span class="who"><b>{{ store.me.user }}</b><small>{{ store.me.role === 'admin' ? 'admin' : 'membre' }}</small></span>
        <button class="btn ghost bye" type="button" @click="logout">Au revoir !</button>
      </div>
    </header>
    <main class="layout">
      <RoomList />
      <ChatScreen />
      <PresenceList />
    </main>
  </div>
  <ToastStack />
</template>

<style scoped>
.app { position: relative; z-index: 1; height: 100%; display: flex; flex-direction: column; padding: 12px 16px 16px; gap: 12px; }
.top { display: flex; align-items: center; gap: 16px; background: var(--panel); border-radius: 999px; padding: 6px 10px 6px 22px; box-shadow: 0 8px 24px -14px rgba(43, 42, 76, .5); }
.logo { font-size: 30px; font-weight: 700; color: var(--ink); white-space: nowrap; }
.sunslot { margin-left: auto; }
.me { display: flex; align-items: center; gap: 8px; padding-left: 12px; border-left: 2px dashed #E0E4EE; }
.who { display: grid; line-height: 1.15; }
.who small { color: var(--muted); font-size: 12px; }
.bye { padding: 7px 14px; font-size: 14px; }
.layout { flex: 1; min-height: 0; display: grid; grid-template-columns: 250px minmax(0, 1fr) 230px; gap: 14px; }
@media (max-width: 900px) {
  .app { padding: 8px; gap: 8px; }
  .top { border-radius: 22px; flex-wrap: wrap; padding: 8px 12px; gap: 8px; }
  .logo { font-size: 24px; }
  .sunslot { margin-left: 0; order: 3; width: 100%; flex: 1 1 100%; }
  .me { margin-left: auto; border: 0; padding: 0; }
  .who { display: none; }
  .layout { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
}
</style>

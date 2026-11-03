import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import { api } from './api';
import { store, roomState } from './store';
import { start, openRoom } from './socket';

async function boot() {
  try {
    store.rooms = await api.rooms();
    for (const r of store.rooms) roomState(r.name);
  } catch { /* le serveur n'est pas encore prêt : la page de connexion reste affichée */ }
  try {
    store.me = await api.me(); // déjà connecté (cookie de session) ?
    start();
    openRoom('colline');
  } catch { /* pas de session : écran de connexion */ }
  createApp(App).mount('#app');
}

boot();

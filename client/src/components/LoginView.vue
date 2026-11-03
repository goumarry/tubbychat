<script setup>
import { ref } from 'vue';
import { api } from '../api';
import { store, roomState } from '../store';
import { start, openRoom } from '../socket';
import TubbyAvatar from './TubbyAvatar.vue';

const mode = ref('login');
const username = ref('');
const password = ref('');
const color = ref('violet');
const error = ref('');
const busy = ref(false);

const TUBBIES = [
  { id: 'violet', label: 'Violet', hint: 'antenne triangle' },
  { id: 'vert', label: 'Vert', hint: 'antenne droite' },
  { id: 'jaune', label: 'Jaune', hint: 'antenne bouclée' },
  { id: 'rouge', label: 'Rouge', hint: 'antenne ronde' },
];

async function submit() {
  error.value = '';
  busy.value = true;
  try {
    const body = { username: username.value, password: password.value };
    store.me = mode.value === 'login' ? await api.login(body) : await api.register({ ...body, color: color.value });
    if (!store.rooms.length) {
      store.rooms = await api.rooms();
      for (const r of store.rooms) roomState(r.name);
    }
    start();
    openRoom('colline');
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

const onPseudo = e => { username.value = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''); };
</script>

<template>
  <main class="login-wrap">
    <div class="login panel">
      <h1 class="hello rainbow" aria-label="Eh-oh !"><span>E</span><span>h</span><span>-</span><span>o</span><span>h</span><span> !</span></h1>
      <p class="intro">Bienvenue sur <b>TubbyChat</b>, la messagerie de la colline.</p>

      <div class="tabs" role="tablist">
        <button role="tab" type="button" :aria-selected="mode === 'login'" @click="mode = 'login'; error = ''">Se connecter</button>
        <button role="tab" type="button" :aria-selected="mode === 'register'" @click="mode = 'register'; error = ''">Créer mon Tubby</button>
      </div>

      <form @submit.prevent="submit">
        <label for="pseudo">Pseudo</label>
        <input id="pseudo" :value="username" autocomplete="username" required minlength="3" maxlength="20" placeholder="ex. tinky" @input="onPseudo">
        <label for="mdp">Mot de passe</label>
        <input id="mdp" v-model="password" type="password" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" required minlength="6" placeholder="6 caractères minimum">

        <fieldset v-if="mode === 'register'">
          <legend>Choisis ton Tubby</legend>
          <div class="picker">
            <button v-for="t in TUBBIES" :key="t.id" type="button" class="pick" :class="{ sel: color === t.id }" :style="{ '--c': `var(--${t.id})` }" :aria-pressed="color === t.id" @click="color = t.id">
              <TubbyAvatar :color="t.id" :size="56" :online="color === t.id" :happy="color === t.id" />
              <b>{{ t.label }}</b>
              <small>{{ t.hint }}</small>
            </button>
          </div>
        </fieldset>

        <p v-if="error" class="err" role="alert">{{ error }}</p>
        <button class="btn submit" :class="mode === 'login' ? '' : 'vert'" :disabled="busy">
          {{ busy ? 'Un instant…' : mode === 'login' ? 'Entrer sur la colline' : 'Créer mon Tubby' }}
        </button>
      </form>
      <p class="hint">Astuce : le pseudo <code>admin</code> ouvre le placard de Noo-Noo.</p>
    </div>
  </main>
</template>

<style scoped>
.login-wrap { position: relative; z-index: 1; height: 100%; overflow-y: auto; display: grid; place-items: center; padding: 24px 16px 30vh; }
.login { width: min(100%, 460px); padding: 28px 28px 22px; }
.hello { font-size: 56px; font-weight: 700; text-align: center; letter-spacing: .02em; }
.hello span { display: inline-block; animation: hop 2.4s ease-in-out infinite; }
.hello span:nth-child(2) { animation-delay: .1s; } .hello span:nth-child(3) { animation-delay: .2s; }
.hello span:nth-child(4) { animation-delay: .3s; } .hello span:nth-child(5) { animation-delay: .4s; } .hello span:nth-child(6) { animation-delay: .5s; }
@keyframes hop { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-8px); } }
.intro { text-align: center; color: var(--muted); margin: 6px 0 18px; }
.tabs { display: grid; grid-template-columns: 1fr 1fr; background: #EEF1F7; border-radius: 999px; padding: 4px; margin-bottom: 18px; }
.tabs button { border: 0; background: none; border-radius: 999px; padding: 8px; font-family: var(--f-title); font-weight: 600; color: var(--muted); }
.tabs button[aria-selected="true"] { background: white; color: var(--ink); box-shadow: 0 2px 6px rgba(43, 42, 76, .15); }
form { display: grid; gap: 6px; }
label, legend { font-weight: 800; font-size: 14px; }
input { border: 2px solid #E0E4EE; border-radius: 14px; padding: 10px 14px; background: white; margin-bottom: 8px; }
input:focus { border-color: var(--violet); outline: none; }
fieldset { border: 0; padding: 0; margin: 4px 0 8px; }
.picker { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 6px; }
.pick { border: 2px solid #E0E4EE; background: white; border-radius: 18px; padding: 10px 4px 8px; display: grid; justify-items: center; gap: 2px; transition: transform .15s, border-color .2s, background .2s; }
.pick:hover { transform: translateY(-3px); }
.pick.sel { border-color: var(--c); background: color-mix(in srgb, var(--c) 12%, white); }
.pick.sel :deep(.tubby) { animation: jump .6s ease; }
@keyframes jump { 40% { transform: translateY(-10px) rotate(-5deg); } 70% { transform: translateY(0) rotate(3deg); } }
.pick b { font-family: var(--f-title); font-size: 15px; }
.pick small { font-size: 11px; color: var(--muted); text-align: center; line-height: 1.2; }
.err { color: var(--rouge-d); background: #FFEBEE; border-radius: 12px; padding: 8px 12px; font-weight: 700; margin: 4px 0; }
.submit { margin-top: 8px; font-size: 18px; padding: 12px; }
.hint { margin-top: 14px; text-align: center; font-size: 13px; color: var(--muted); }
@media (max-width: 420px) { .picker { grid-template-columns: repeat(2, minmax(0, 1fr)); } .hello { font-size: 44px; } }
</style>

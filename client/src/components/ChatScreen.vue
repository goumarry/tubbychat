<script setup>
// L'« écran-ventre » : la zone des messages, encadrée de la couleur du salon.
import { computed, nextTick, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { store, roomState } from '../store';
import { sendChat, sendTyping, markRead } from '../socket';
import { cmpId, colorVar, hhmm, dayLabel } from '../util';
import TubbyAvatar from './TubbyAvatar.vue';

const room = computed(() => store.rooms.find(r => r.name === store.current) || { label: '…', color: 'violet' });
const rs = computed(() => roomState(store.current));
const me = computed(() => store.me?.user);
const draft = ref('');
const scroller = ref(null);
const input = ref(null);
let stickToBottom = true;

const sameAuthor = i => {
  const a = rs.value.messages[i], b = rs.value.messages[i - 1];
  return b && a.from === b.from && a.at - b.at < 5 * 60_000 && new Date(a.at).toDateString() === new Date(b.at).toDateString();
};
const newDay = i => i === 0 || new Date(rs.value.messages[i].at).toDateString() !== new Date(rs.value.messages[i - 1].at).toDateString();

// Accusés de lecture : sous MON dernier message confirmé, la liste de ceux qui l'ont lu.
const myLast = computed(() => {
  for (let i = rs.value.messages.length - 1; i >= 0; i--) {
    const m = rs.value.messages[i];
    if (m.from === me.value && !m.pending) return m;
  }
  return null;
});
const readers = computed(() => {
  if (!myLast.value) return [];
  return Object.entries(rs.value.reads)
    .filter(([user, upTo]) => user !== me.value && cmpId(upTo, myLast.value.id) >= 0)
    .map(([user]) => ({ user, color: rs.value.members[user] || colorOf(user) }));
});
const colorOf = user => rs.value.messages.findLast?.(m => m.from === user)?.color || 'violet';

const typers = computed(() => Object.entries(rs.value.typing).filter(([, t]) => t.until > store.now).map(([user, t]) => ({ user, color: t.color })));
const typingText = computed(() => {
  const n = typers.value.map(t => t.user);
  if (!n.length) return '';
  if (n.length === 1) return `${n[0]} écrit…`;
  if (n.length === 2) return `${n[0]} et ${n[1]} écrivent…`;
  return 'Plein de Tubbies écrivent…';
});

function onScroll() {
  const el = scroller.value;
  stickToBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
}
async function scrollDown(force = false) {
  await nextTick();
  if (scroller.value && (force || stickToBottom)) scroller.value.scrollTop = scroller.value.scrollHeight;
}

function send() {
  const text = draft.value.trim();
  if (!text) return;
  sendChat(store.current, text);
  draft.value = '';
  stickToBottom = true;
  scrollDown(true);
}

function onInput() {
  if (draft.value.trim()) sendTyping(store.current);
}

function sayHello() {
  sendChat(store.current, 'Eh-oh ! 👋');
}

function readIfVisible() {
  if (!document.hidden && store.conn.status === 'open') markRead(store.current);
}

watch(() => store.current, () => { stickToBottom = true; scrollDown(true); input.value?.focus(); });
watch(() => rs.value.messages.length, () => scrollDown());
watch([() => rs.value.lastId, () => store.current, () => store.conn.status], readIfVisible);
onMounted(() => { document.addEventListener('visibilitychange', readIfVisible); scrollDown(true); });
onBeforeUnmount(() => document.removeEventListener('visibilitychange', readIfVisible));
</script>

<template>
  <section class="tv" :style="{ '--room': colorVar(room.color) }" aria-label="Messages">
    <header class="tv-head">
      <div>
        <h2>{{ room.label }}</h2>
        <p>{{ room.description }}</p>
      </div>
      <span class="count">{{ Object.keys(rs.members).length }} en ligne</span>
    </header>

    <div ref="scroller" class="screen" @scroll="onScroll">
      <p v-if="rs.incomplete" class="gap">Des messages plus anciens ne sont plus disponibles : l'historique garde les 1000 derniers.</p>

      <div v-if="!rs.messages.length" class="empty">
        <TubbyAvatar :color="store.me?.color" :size="90" happy online />
        <p>C'est tout calme par ici…</p>
        <button class="btn jaune" type="button" @click="sayHello">Dire « Eh-oh ! »</button>
      </div>

      <template v-for="(m, i) in rs.messages" :key="m.clientMsgId || m.id">
        <div v-if="newDay(i)" class="day"><span>{{ dayLabel(m.at) }}</span></div>
        <article class="msg" :class="{ mine: m.from === me, pending: m.pending, cont: sameAuthor(i) }" :style="{ '--c': colorVar(m.color) }">
          <div class="av">
            <TubbyAvatar v-if="!sameAuthor(i)" :color="m.color" :size="34" :online="!!rs.members[m.from]" />
          </div>
          <div class="bubble">
            <header v-if="!sameAuthor(i)">
              <b>{{ m.from }}</b>
              <time :datetime="new Date(m.at).toISOString()">{{ hhmm(m.at) }}</time>
            </header>
            <!-- Interpolation {{ }} : le HTML est échappé, jamais interprété (pas de v-html !) -->
            <p>{{ m.text }}</p>
            <small v-if="m.pending" class="state">envoi…</small>
          </div>
        </article>
        <div v-if="myLast && m.id === myLast.id && readers.length" class="readers">
          <span>Lu par</span>
          <span v-for="r in readers" :key="r.user" class="reader" :title="r.user">
            <TubbyAvatar :color="r.color" :size="18" />{{ r.user }}
          </span>
        </div>
      </template>
    </div>

    <div class="typing" :class="{ on: typers.length }" aria-live="polite">
      <span class="flowers" aria-hidden="true">
        <svg v-for="(t, i) in typers.slice(0, 3).concat(typers.length ? [] : [{}])" :key="i" viewBox="-12 -12 24 34" :style="{ animationDelay: i * 0.25 + 's' }">
          <line x1="0" y1="4" x2="0" y2="22" stroke="#558B2F" stroke-width="2.5" />
          <circle v-for="a in 5" :key="a" :cx="Math.cos(a * 1.2566) * 6" :cy="Math.sin(a * 1.2566) * 6" r="4.6" :fill="`var(--${t.color || 'jaune'})`" />
          <circle r="3.4" fill="#FFB300" />
        </svg>
      </span>
      {{ typingText }}
    </div>

    <form class="composer" @submit.prevent="send">
      <label for="draft" class="sr">Ton message</label>
      <textarea
        id="draft"
        ref="input"
        v-model="draft"
        rows="1"
        maxlength="1000"
        placeholder="Écris un message… (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)"
        @keydown.enter.exact.prevent="send"
        @input="onInput"
      />
      <span class="len" :class="{ warn: draft.length > 900 }">{{ draft.length }}/1000</span>
      <button class="btn" :disabled="!draft.trim()">Envoyer</button>
    </form>
  </section>
</template>

<style scoped>
.tv {
  min-width: 0; min-height: 0; display: flex; flex-direction: column;
  background: var(--room);
  border-radius: 34px;
  padding: 12px 12px 14px;
  box-shadow: 0 14px 34px -14px rgba(43, 42, 76, .45), inset 0 -6px 0 rgba(0, 0, 0, .12);
  transition: background .4s;
}
.tv-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 4px 10px 10px; color: white; }
.tv-head h2 { font-size: 24px; text-shadow: 0 2px 0 rgba(0, 0, 0, .15); }
.tv-head p { font-size: 13.5px; opacity: .92; }
.count { background: rgba(255, 255, 255, .25); border-radius: 999px; padding: 4px 12px; font-weight: 800; white-space: nowrap; }

.screen {
  flex: 1; min-height: 0; overflow-y: auto;
  background: radial-gradient(ellipse at 50% 0%, #FFFFFF 0%, var(--ecran) 70%);
  border: 4px solid var(--ecran-bord);
  border-radius: 24px;
  box-shadow: inset 0 4px 14px rgba(43, 42, 76, .18);
  padding: 16px 14px;
  display: flex; flex-direction: column; gap: 2px;
}
.gap { align-self: center; background: #FFF8E1; border: 1.5px dashed var(--jaune-d); border-radius: 12px; padding: 6px 12px; font-size: 13px; margin-bottom: 10px; }
.empty { margin: auto; display: grid; justify-items: center; gap: 10px; color: var(--muted); font-weight: 700; text-align: center; }
.day { align-self: center; margin: 12px 0 8px; }
.day span { background: white; border-radius: 999px; padding: 3px 12px; font-size: 12px; font-weight: 800; color: var(--muted); box-shadow: 0 1px 4px rgba(0, 0, 0, .08); text-transform: capitalize; }

.msg { display: flex; gap: 8px; align-items: flex-end; max-width: 78%; animation: pop-in .3s cubic-bezier(.3, 1.4, .5, 1); margin-top: 8px; }
.msg.cont { margin-top: 2px; }
@keyframes pop-in { from { opacity: 0; transform: translateY(8px) scale(.97); } }
.av { width: 34px; flex: none; }
.bubble { background: white; border-radius: 18px 18px 18px 6px; padding: 7px 13px 8px; border-left: 5px solid var(--c); box-shadow: 0 2px 6px rgba(43, 42, 76, .1); min-width: 0; }
.bubble header { display: flex; gap: 8px; align-items: baseline; }
.bubble b { font-family: var(--f-title); font-weight: 600; color: color-mix(in srgb, var(--c) 75%, var(--ink)); }
.bubble time { font-size: 11.5px; color: var(--muted); }
.bubble p { margin: 1px 0 0; white-space: pre-wrap; word-break: break-word; }
.msg.mine { align-self: flex-end; flex-direction: row-reverse; }
.msg.mine .bubble { background: color-mix(in srgb, var(--c) 16%, white); border-left: 0; border-right: 5px solid var(--c); border-radius: 18px 18px 6px 18px; }
.msg.pending { opacity: .55; }
.state { font-size: 11px; color: var(--muted); font-style: italic; }

.readers { align-self: flex-end; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); margin: 3px 44px 0 0; animation: pop-in .3s; }
.reader { display: inline-flex; align-items: center; gap: 3px; background: white; border-radius: 999px; padding: 1px 8px 1px 3px; font-weight: 700; }

.typing { height: 30px; display: flex; align-items: center; gap: 8px; padding: 4px 10px 0; color: white; font-weight: 700; font-size: 14px; opacity: 0; transition: opacity .3s; }
.typing.on { opacity: 1; }
.flowers { display: flex; gap: 2px; }
.flowers svg { width: 14px; height: 22px; transform-origin: 50% 100%; animation: grow 1.2s ease-in-out infinite; }
@keyframes grow { 0%, 100% { transform: scaleY(.6); } 50% { transform: scaleY(1.1); } }

.composer { display: flex; gap: 10px; align-items: flex-end; background: white; border-radius: 22px; padding: 8px 8px 8px 16px; margin-top: 4px; }
.composer textarea { flex: 1; border: 0; resize: none; outline: none; padding: 8px 0; max-height: 120px; field-sizing: content; background: none; }
.len { font-size: 12px; color: var(--muted); padding-bottom: 12px; font-variant-numeric: tabular-nums; }
.len.warn { color: var(--rouge); font-weight: 800; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
@media (max-width: 600px) { .msg { max-width: 92%; } .len { display: none; } .tv { border-radius: 24px; padding: 8px; } }
</style>

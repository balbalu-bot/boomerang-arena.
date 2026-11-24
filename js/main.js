// Avvio dell'applicazione: menu, preparazione partita, ciclo principale.

import { View } from './engine/view.js';
import { Particles } from './engine/particles.js';
import { InputManager } from './core/input.js';
import { settings, saveSettings, resetKeys, DEFAULT_KEYS } from './core/settings.js';
import { t, applyI18n } from './core/i18n.js';
import { initAudio, startMusic, applyVolumes, sfx } from './core/audio.js';
import { CFG } from './core/config.js';
import { CHARACTERS } from './game/characters.js';
import { ARENAS } from './data/arenas.js';
import { Match } from './game/match.js';
import { makeThumbnails } from './ui/thumbnails.js';
import * as Nav from './ui/nav.js';

const $ = s => document.querySelector(s);
const canvas = $('#game');

function fatal(msg) { const f = $('#fatal'); f.textContent = msg; f.style.display = 'block'; }

let view;
try { view = new View(canvas); } catch (e) { fatal(t('noWebGL')); throw e; }
const fx = new Particles(view.scene);
fx.budget = view.particleBudget;
const input = new InputManager(canvas);
window.CHAR_THUMBS = makeThumbnails();

let match = null;       // partita reale
let demo = null;        // partita dimostrativa dietro al menu
let screen = 'menu';

// ---------------- AUDIO (sbloccato al primo gesto) ----------------
let audioReady = false;
function unlockAudio() { if (audioReady) return; audioReady = true; initAudio(); startMusic(); }
addEventListener('pointerdown', unlockAudio, { once: false });
addEventListener('keydown', unlockAudio);

// ---------------- SCHERMATE ----------------
function show(name) {
  screen = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'scr-' + name));
  if (name === 'setup') renderSlots();
  if (name === 'settings') renderSettings();
  setTimeout(Nav.focusFirst, 0);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-go]');
  if (b) { sfx('ui'); show(b.dataset.go); }
});

// ---------------- DEMO DI SFONDO ----------------
function randomChars(n) { return [...CHARACTERS].sort(() => Math.random() - 0.5).slice(0, n).map(c => c.id); }
function startDemo() {
  const chars = randomChars(4);
  demo = new Match({
    view, fx, input, demo: true,
    config: { mode: 'classic', roundsToWin: 999, arena: 'random', botLevel: 'difficile',
      players: chars.map((c, i) => ({ id: 'd' + i, name: 'CPU', charId: c, bot: true, level: i % 2 ? 'esperto' : 'difficile', team: i })) },
  });
}

// ---------------- PREPARAZIONE PARTITA ----------------
const isTouch = matchMedia('(pointer: coarse)').matches;
let slots = [
  { kind: isTouch ? 'touch' : 'kb', device: isTouch ? 'touch' : 'kb', char: 0, team: 0 },
  { kind: 'bot', char: 3, team: 1 },
  { kind: 'bot', char: 6, team: 0 },
  { kind: 'bot', char: 19, team: 1 },
];

function slotLabel(s, i) {
  if (s.kind === 'bot') return `${t('bot')} ${i + 1}`;
  const n = slots.filter(x => x.kind !== 'bot').indexOf(s) + 1;
  return (settings.lang === 'it' ? 'G' : 'P') + n;
}
function slotDevLabel(s) {
  if (s.kind === 'kb') return t('keyboard');
  if (s.kind === 'touch') return t('touch');
  if (s.kind === 'pad') { const p = input.pads().find(g => 'pad:' + g.index === s.device); return p ? shortPadName(p.id) : t('controller'); }
  return '';
}
function shortPadName(id) {
  const l = id.toLowerCase();
  if (l.includes('xbox') || l.includes('xinput') || l.includes('045e')) return 'Xbox';
  if (l.includes('dualsense') || l.includes('dualshock') || l.includes('playstation') || l.includes('054c')) return 'PlayStation';
  if (l.includes('pro controller') || l.includes('nintendo') || l.includes('057e') || l.includes('joy-con')) return 'Switch';
  return t('controller');
}

function renderSlots() {
  const box = $('#slots'); box.innerHTML = '';
  const teams = $('#opt-mode').value === 'teams';
  const colors = ['#ff4d6d', '#4dabff', '#5bd96b', '#ffc93c', '#b57cff', '#ff8a3d', '#3de0d0', '#ff7ad9'];
  slots.forEach((s, i) => {
    const c = CHARACTERS[s.char];
    const d = document.createElement('div'); d.className = 'slot';
    d.style.setProperty('--c', teams ? (s.team % 2 ? '#4dabff' : '#ff4d6d') : colors[i % 8]);
    d.innerHTML = `
      <span class="who"></span><div class="dev"></div>
      ${slots.length > 1 ? '<button class="btn x" title="' + t('remove') + '">✕</button>' : ''}
      <img alt="">
      <div class="pick"><button class="btn arrow prev">◀</button><b></b><button class="btn arrow next">▶</button></div>
      ${teams ? `<select class="team"><option value="0">${t('teamRed')}</option><option value="1">${t('teamBlue')}</option></select>` : ''}
      ${s.kind === 'bot' ? `<select class="lvl"><option value="">${t('botLevel')}: —</option>${['facile', 'normale', 'difficile', 'esperto'].map(l => `<option value="${l}">${t(l)}</option>`).join('')}</select>` : ''}`;
    d.querySelector('.who').textContent = slotLabel(s, i);
    d.querySelector('.dev').textContent = slotDevLabel(s);
    d.querySelector('.dev').className = 'hint';
    d.querySelector('img').src = window.CHAR_THUMBS[c.id] || '';
    d.querySelector('.pick b').textContent = c.name[settings.lang];
    d.querySelector('.prev').onclick = () => { s.char = (s.char + CHARACTERS.length - 1) % CHARACTERS.length; sfx('ui'); renderSlots(); refocus(i, 'prev'); };
    d.querySelector('.next').onclick = () => { s.char = (s.char + 1) % CHARACTERS.length; sfx('ui'); renderSlots(); refocus(i, 'next'); };
    const x = d.querySelector('.x'); if (x) x.onclick = () => { slots.splice(i, 1); renderSlots(); };
    const tm = d.querySelector('.team'); if (tm) { tm.value = String(s.team % 2); tm.onchange = () => { s.team = +tm.value; renderSlots(); }; }
    const lv = d.querySelector('.lvl'); if (lv) { lv.value = s.level || ''; lv.onchange = () => { s.level = lv.value || undefined; }; }
    box.appendChild(d);
  });
  $('#add-bot').disabled = slots.length >= CFG.MAX_PLAYERS;
  updatePadsInfo();
}
function refocus(i, cls) { const el = $('#slots').children[i]?.querySelector('.' + cls); el?.focus(); }

$('#add-bot').onclick = () => {
  if (slots.length >= CFG.MAX_PLAYERS) return;
  const used = new Set(slots.map(s => s.char));
  let ch = Math.floor(Math.random() * CHARACTERS.length); while (used.has(ch) && used.size < CHARACTERS.length) ch = (ch + 1) % CHARACTERS.length;
  slots.push({ kind: 'bot', char: ch, team: slots.length % 2 }); sfx('join'); renderSlots();
};
$('#opt-mode').onchange = () => { slots.forEach((s, i) => s.team = s.team ?? i % 2); renderSlots(); };
$('#opt-arena').innerHTML = `<option value="random">${t('randomArena')}</option>` + ARENAS.map(a => `<option value="${a.id}">${a.name[settings.lang]}</option>`).join('');

function padJoin(device) {
  if (slots.some(s => s.device === device)) return false;
  if (slots.length >= CFG.MAX_PLAYERS) { const bi = slots.map(s => s.kind).lastIndexOf('bot'); if (bi < 0) return false; slots.splice(bi, 1); }
  const firstBot = slots.findIndex(s => s.kind === 'bot');
  const used = new Set(slots.map(s => s.char));
  let ch = Math.floor(Math.random() * CHARACTERS.length); while (used.has(ch)) ch = (ch + 1) % CHARACTERS.length;
  const slot = { kind: 'pad', device, char: ch, team: slots.length % 2 };
  if (firstBot < 0) slots.push(slot); else slots.splice(firstBot, 0, slot);
  sfx('join'); renderSlots();
  return true;
}

$('#start-match').onclick = startMatch;
function startMatch() {
  if (!slots.length) return;
  const mode = $('#opt-mode').value;
  if (mode === 'teams') {
    const t0 = slots.filter(s => s.team % 2 === 0).length;
    if (t0 === 0 || t0 === slots.length) slots.forEach((s, i) => s.team = i % 2);
  }
  if (slots.length < 2) $('#add-bot').click();
  const config = {
    mode, roundsToWin: +$('#opt-rounds').value, arena: $('#opt-arena').value, botLevel: $('#opt-bot').value,
    players: slots.map((s, i) => ({
      id: 'p' + i, name: slotLabel(s, i), charId: CHARACTERS[s.char].id,
      bot: s.kind === 'bot', level: s.level, device: s.device, team: mode === 'teams' ? s.team % 2 : i,
    })),
  };
  unlockAudio();
  demo?.dispose(); demo = null;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  screen = 'game';
  document.body.classList.add('ingame');
  input.showTouch(slots.some(s => s.kind === 'touch'));
  input.endFrame(); // il tasto usato per avviare non deve contare come pausa
  match = new Match({ view, fx, input, config });
}

function exitMatch() {
  match?.dispose(); match = null;
  document.body.classList.remove('ingame');
  input.showTouch(false);
  startDemo();
  show('menu');
}
$('#btn-resume').onclick = () => match?.resume();
$('#btn-quit').onclick = exitMatch;
$('#btn-rematch').onclick = () => match?.rematch();
$('#btn-menu').onclick = exitMatch;
$('#tbtn-pause').addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); if (match && match.state !== 'paused') match.pause(); }, { passive: false });

// ---------------- PERSONAGGI ----------------
function renderChars() {
  const g = $('#char-grid'); g.innerHTML = '';
  for (const c of CHARACTERS) {
    const d = document.createElement('div'); d.className = 'char-card'; d.tabIndex = 0;
    d.innerHTML = `<img alt=""><div></div>`;
    d.querySelector('img').src = window.CHAR_THUMBS[c.id] || '';
    d.querySelector('div').textContent = c.name[settings.lang];
    g.appendChild(d);
  }
}

// ---------------- IMPOSTAZIONI ----------------
function renderSettings() {
  $('#set-lang').value = settings.lang;
  $('#set-quality').value = settings.quality;
  $('#set-music').value = settings.music;
  $('#set-sfx').value = settings.sfx;
  $('#set-aim').checked = settings.showAim;
  $('#set-shake').checked = settings.screenShake;
  const k = $('#keys'); k.innerHTML = '';
  for (const a of Object.keys(DEFAULT_KEYS).filter(a => a !== 'interact' && a !== 'special')) { // E e Q arriveranno con oggetti interattivi e abilità
    const row = document.createElement('div'); row.className = 'k';
    row.innerHTML = `<span></span><button class="btn small"></button>`;
    row.querySelector('span').textContent = t('k_' + a);
    const b = row.querySelector('button'); b.textContent = prettyKey(settings.keys[a]);
    b.onclick = () => {
      b.textContent = t('pressKey');
      input.keyCapture = code => { settings.keys[a] = code; saveSettings(); renderSettings(); };
    };
    k.appendChild(row);
  }
}
function prettyKey(code) { return (code || '').replace(/^Key/, '').replace(/^Digit/, '').replace('Space', settings.lang === 'it' ? 'Spazio' : 'Space').replace('Escape', 'Esc'); }
$('#set-lang').onchange = e => { settings.lang = e.target.value; saveSettings(); applyI18n(); renderSettings(); renderChars(); $('#opt-arena').innerHTML = `<option value="random">${t('randomArena')}</option>` + ARENAS.map(a => `<option value="${a.id}">${a.name[settings.lang]}</option>`).join(''); };
$('#set-quality').onchange = e => { settings.quality = e.target.value; saveSettings(); view.applyQuality(); fx.budget = view.particleBudget; };
$('#set-music').oninput = e => { settings.music = +e.target.value; saveSettings(); applyVolumes(); };
$('#set-sfx').oninput = e => { settings.sfx = +e.target.value; saveSettings(); applyVolumes(); };
$('#set-aim').onchange = e => { settings.showAim = e.target.checked; saveSettings(); };
$('#set-shake').onchange = e => { settings.screenShake = e.target.checked; saveSettings(); };
$('#reset-keys').onclick = () => { resetKeys(); renderSettings(); };

// ---------------- CONTROLLER ----------------
function updatePadsInfo() {
  const n = input.pads().length;
  $('#pads-info').textContent = n ? `🎮 ${t('controller')}: ${n}` : '';
}
input.onPadConnected = () => { updatePadsInfo(); if (screen === 'setup') renderSlots(); };
input.onPadDisconnected = g => {
  updatePadsInfo();
  if (screen === 'setup') { slots = slots.filter(s => s.device !== 'pad:' + g.index); renderSlots(); }
};

function handleMenuEvents() {
  const evs = input.takeMenuEvents();
  const inGame = match && !document.querySelector('.overlay.show');
  if (inGame) return;
  for (const e of evs) {
    unlockAudio();
    const joined = slots.find(s => s.device === e.device);
    const focus = document.activeElement;
    if (screen === 'setup') {
      if (e.type === 'confirm' && !joined) { padJoin(e.device); continue; }
      if (e.type === 'back' && joined) { slots = slots.filter(s => s !== joined); renderSlots(); continue; }
      if (e.type === 'start') { startMatch(); return; }
      if ((e.type === 'left' || e.type === 'right') && joined && !(focus && (focus.tagName === 'SELECT' || focus.type === 'range'))) {
        joined.char = (joined.char + (e.type === 'right' ? 1 : CHARACTERS.length - 1)) % CHARACTERS.length;
        sfx('ui'); renderSlots(); continue;
      }
    }
    if (e.type === 'back') {
      if (match && match.state === 'paused') { match.resume(); continue; }
      if (screen !== 'menu' && screen !== 'game') { sfx('ui'); show('menu'); }
      continue;
    }
    if (e.type === 'start') {
      if (screen === 'menu') show('setup');
      continue; // in pausa il tasto Start viene gestito dalla partita stessa
    }
    if (e.type === 'confirm') { sfx('ui'); Nav.confirm(); continue; }
    if (['up', 'down', 'left', 'right'].includes(e.type)) Nav.navigate(e.type);
  }
}

// ---------------- CICLO PRINCIPALE ----------------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  input.poll(now);
  handleMenuEvents();
  if (match) match.frame(dt); else if (demo) demo.frame(dt);
  fx.update(dt);
  view.updateCamera(dt);
  view.render();
  input.endFrame();
  requestAnimationFrame(loop);
}

applyI18n();
renderChars();
startDemo();
show('menu');
requestAnimationFrame(loop);
window.__game = { get match() { return match; }, get demo() { return demo; }, view, input, startMatch, slots: () => slots };

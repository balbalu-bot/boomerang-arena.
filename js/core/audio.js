// Audio interamente sintetizzato con Web Audio API: nessun file esterno, nessun diritto di terzi.
// Bus separati per musica ed effetti (la chat vocale avrà un bus proprio nella fase 7).

import { settings } from './settings.js';

let ctx = null, master, musicBus, sfxBus, noiseBuf;
let musicTimer = null, musicStep = 0, nextNoteTime = 0, musicOn = false;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  applyVolumes();
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function applyVolumes() {
  if (!ctx) return;
  musicBus.gain.value = settings.music * 0.35;
  sfxBus.gain.value = settings.sfx;
}

// Abbassa la musica (usato in futuro quando qualcuno parla in chat vocale)
export function duckMusic(on) {
  if (!ctx) return;
  musicBus.gain.setTargetAtTime(settings.music * 0.35 * (on ? 0.35 : 1), ctx.currentTime, 0.15);
}

function tone({ type = 'sine', f0 = 440, f1 = f0, dur = 0.15, vol = 0.3, attack = 0.005, bus = sfxBus, when = 0 }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + dur + 0.05);
}

function noise({ dur = 0.2, vol = 0.3, f0 = 1000, f1 = f0, q = 1, type = 'bandpass', when = 0, bus = sfxBus }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(bus);
  s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
}

const lastPlayed = {};
export function sfx(name, vol = 1) {
  if (!ctx) return;
  const now = ctx.currentTime;
  if (lastPlayed[name] && now - lastPlayed[name] < 0.03) return; // evita accumuli
  lastPlayed[name] = now;
  switch (name) {
    case 'throw': noise({ dur: 0.22, vol: 0.25 * vol, f0: 600, f1: 2400, q: 2 }); tone({ type: 'triangle', f0: 300, f1: 700, dur: 0.12, vol: 0.08 * vol }); break;
    case 'whoosh': noise({ dur: 0.12, vol: 0.06 * vol, f0: 1800, f1: 900, q: 3 }); break;
    case 'catch': tone({ type: 'square', f0: 880, f1: 1320, dur: 0.07, vol: 0.08 }); break;
    case 'recall': tone({ type: 'triangle', f0: 500, f1: 1000, dur: 0.12, vol: 0.12 }); break;
    case 'melee': noise({ dur: 0.12, vol: 0.25, f0: 3000, f1: 800, q: 1.5 }); break;
    case 'deflect': tone({ type: 'square', f0: 1400, f1: 2200, dur: 0.08, vol: 0.12 }); tone({ type: 'triangle', f0: 2800, f1: 2000, dur: 0.15, vol: 0.08, when: 0.02 }); break;
    case 'clang': tone({ type: 'square', f0: 900, f1: 600, dur: 0.1, vol: 0.1 }); noise({ dur: 0.08, vol: 0.12, f0: 4000, q: 4 }); break;
    case 'wall': tone({ type: 'triangle', f0: 220, f1: 140, dur: 0.08, vol: 0.18 * vol }); break;
    case 'dash': noise({ dur: 0.16, vol: 0.22, f0: 400, f1: 1600, q: 1.2 }); break;
    case 'push': tone({ type: 'sine', f0: 180, f1: 90, dur: 0.15, vol: 0.3 }); break;
    case 'hit': // eliminazione: "splat" cartoon
      tone({ type: 'sawtooth', f0: 520, f1: 90, dur: 0.3, vol: 0.18 });
      noise({ dur: 0.3, vol: 0.35, f0: 900, f1: 200, q: 0.8, type: 'lowpass' });
      tone({ type: 'sine', f0: 1200, f1: 1800, dur: 0.1, vol: 0.12, when: 0.05 });
      break;
    case 'splash': noise({ dur: 0.5, vol: 0.35, f0: 2500, f1: 300, q: 0.7, type: 'lowpass' }); tone({ type: 'sine', f0: 600, f1: 200, dur: 0.25, vol: 0.12 }); break;
    case 'sizzle': noise({ dur: 0.7, vol: 0.3, f0: 5000, f1: 2500, q: 0.6, type: 'highpass' }); tone({ type: 'sawtooth', f0: 300, f1: 60, dur: 0.4, vol: 0.12 }); break;
    case 'fall': tone({ type: 'sine', f0: 900, f1: 120, dur: 0.7, vol: 0.18 }); break;
    case 'crate': noise({ dur: 0.25, vol: 0.35, f0: 700, f1: 200, q: 1, type: 'lowpass' }); tone({ type: 'square', f0: 160, f1: 80, dur: 0.12, vol: 0.12 }); break;
    case 'boom':
      noise({ dur: 0.9, vol: 0.7, f0: 1500, f1: 60, q: 0.5, type: 'lowpass' });
      tone({ type: 'sine', f0: 120, f1: 30, dur: 0.7, vol: 0.5 });
      break;
    case 'pickup': tone({ type: 'triangle', f0: 660, f1: 990, dur: 0.1, vol: 0.12 }); tone({ type: 'triangle', f0: 990, f1: 1320, dur: 0.1, vol: 0.1, when: 0.07 }); break;
    case 'beep': tone({ type: 'square', f0: 660, dur: 0.15, vol: 0.12 }); break;
    case 'go': tone({ type: 'square', f0: 990, f1: 1320, dur: 0.35, vol: 0.14 }); break;
    case 'ui': tone({ type: 'triangle', f0: 700, f1: 900, dur: 0.06, vol: 0.1 }); break;
    case 'join': tone({ type: 'triangle', f0: 523, dur: 0.1, vol: 0.12 }); tone({ type: 'triangle', f0: 784, dur: 0.15, vol: 0.12, when: 0.08 }); break;
    case 'roundWin': [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.16, vol: 0.1, when: i * 0.1 })); break;
    case 'victory':
      [523, 659, 784, 659, 784, 1046, 1046, 1175, 1318].forEach((f, i) =>
        tone({ type: i % 2 ? 'triangle' : 'square', f0: f, dur: 0.22, vol: 0.12, when: i * 0.13 }));
      break;
  }
}

// --- Musica: piccolo sequencer allegro generato al volo ---
const BPM = 128;
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
const PROG = [0, 5, 3, 4]; // gradi degli accordi (I-vi-IV-V)
const DEG = [0, 2, 4, 5, 7, 9, 11];
const melody = [];
(function buildMelody() {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 64; i++) melody.push(rnd() < 0.62 ? SCALE[Math.floor(rnd() * SCALE.length)] : null);
})();

function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

function scheduleStep(step, time) {
  const bar = Math.floor(step / 16) % 4;
  const root = 48 + DEG[PROG[bar]];
  const s16 = step % 16;
  const when = time - ctx.currentTime;
  // basso
  if (s16 % 4 === 0 || s16 % 4 === 3 && s16 > 8) tone({ type: 'triangle', f0: midi(root - 12), dur: 0.22, vol: 0.32, bus: musicBus, when });
  // accordo sincopato
  if (s16 === 2 || s16 === 6 || s16 === 10 || s16 === 14) {
    [0, 4, 7].forEach(iv => tone({ type: 'square', f0: midi(root + 12 + iv), dur: 0.08, vol: 0.035, bus: musicBus, when }));
  }
  // melodia
  const m = melody[step % 64];
  if (m !== null && s16 % 2 === 0) tone({ type: 'square', f0: midi(60 + m + DEG[PROG[bar]] % 5), dur: 0.14, vol: 0.06, bus: musicBus, when });
  // percussioni
  if (s16 % 4 === 0) tone({ type: 'sine', f0: 150, f1: 45, dur: 0.12, vol: 0.45, bus: musicBus, when });
  if (s16 % 8 === 4) noise({ dur: 0.1, vol: 0.18, f0: 2200, q: 0.8, bus: musicBus, when });
  if (s16 % 2 === 1) noise({ dur: 0.03, vol: 0.06, f0: 8000, type: 'highpass', bus: musicBus, when });
}

export function startMusic() {
  if (!ctx || musicOn) return;
  musicOn = true;
  nextNoteTime = ctx.currentTime + 0.1;
  const stepDur = 60 / BPM / 4;
  musicTimer = setInterval(() => {
    while (nextNoteTime < ctx.currentTime + 0.2) {
      scheduleStep(musicStep++, nextNoteTime);
      nextNoteTime += stepDur;
    }
  }, 50);
}

export function stopMusic() {
  musicOn = false;
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}

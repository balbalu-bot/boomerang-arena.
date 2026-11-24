// Gestione della partita: round, punteggi, ciclo a passo fisso, eventi → audio/effetti/HUD.

import * as THREE from 'three';
import { CFG, SLOT_COLORS, TEAM_COLORS } from '../core/config.js';
import { settings } from '../core/settings.js';
import { t } from '../core/i18n.js';
import { sfx, duckMusic } from '../core/audio.js';
import { World } from './world.js';
import { BotBrain } from './ai.js';
import { ARENAS, ARENA_BY_ID } from '../data/arenas.js';
import { CHAR_BY_ID } from './characters.js';

const STEP = 1 / CFG.SIM_HZ;

export class Match {
  constructor({ view, fx, input, config, demo = false, onExit, net = null }) {
    this.net = net;          // NetHost quando questa partita è ospitata online
    this.view = view; this.fx = fx; this.input = input; this.cfg = config; this.demo = demo; this.onExit = onExit;
    this.wins = new Map();
    this.round = 0;
    this.world = null;
    this.state = 'idle';
    this.acc = 0;
    this.pending = new Map();
    this.lastArena = null;
    this.el = {
      hud: document.getElementById('hud'), labels: document.getElementById('labels'), banner: document.getElementById('banner'),
      timer: document.getElementById('timer'), pause: document.getElementById('pause'), end: document.getElementById('matchend'),
    };
    if (!demo) this.buildHud();
    this.startRound();
  }

  get teams() { return this.cfg.mode === 'teams'; }
  scoreKey(p) { return this.teams ? 'team' + (p.team % 2) : p.id; }

  pickArena() {
    let id = this.cfg.arena;
    if (!id || id === 'random') {
      const pool = ARENAS.filter(a => a.id !== this.lastArena);
      id = pool[Math.floor(Math.random() * pool.length)].id;
    }
    this.lastArena = id;
    return ARENA_BY_ID[id] || ARENAS[0];
  }

  startRound() {
    if (this.world) { this.world.dispose(); this.fx.clear(); }
    this.round++;
    this.world = new World({
      view: this.view, fx: this.fx, arenaDef: this.pickArena(),
      players: this.cfg.players, rules: { mode: this.cfg.mode, friendlyFire: false, speedMult: 1 },
    });
    this.brains = new Map();
    for (const p of this.world.players) if (p.isBot) this.brains.set(p.id, new BotBrain(p, p.cfg.level || this.cfg.botLevel));
    this.state = 'countdown';
    this.stateT = this.demo ? 0.8 : CFG.COUNTDOWN;
    this.roundTime = 0;
    this.endDelay = 0;
    this.lastBeep = -1;
    this.view.frame(this.world.players, this.world.arena.W, this.world.arena.H, 1, true);
    this.net?.onRound(this);
    if (!this.demo) {
      this.updateHud();
      this.showBanner(`${t('round')} ${this.round}`, this.world.arena.def.name[settings.lang] || '', 'big');
      this.buildLabels();
    }
  }

  // ---------- HUD ----------
  buildHud() {
    const h = this.el.hud; h.innerHTML = '';
    const entries = this.teams
      ? [0, 1].map(k => ({ key: 'team' + k, name: t(k ? 'teamBlue' : 'teamRed'), color: TEAM_COLORS[k], char: null }))
      : this.cfg.players.map((p, i) => ({ key: p.id, name: p.name, color: SLOT_COLORS[i % SLOT_COLORS.length], char: p.charId }));
    for (const e of entries) {
      const d = document.createElement('div'); d.className = 'chip'; d.dataset.key = e.key;
      d.style.setProperty('--c', '#' + new THREE.Color(e.color).getHexString());
      const thumb = e.char && window.CHAR_THUMBS?.[e.char] ? `<img src="${window.CHAR_THUMBS[e.char]}" alt="">` : '<span class="dot"></span>';
      d.innerHTML = `${thumb}<div><div class="nm"></div><div class="pips">${'<i></i>'.repeat(this.cfg.roundsToWin)}</div></div>`;
      d.querySelector('.nm').textContent = e.name;
      h.appendChild(d);
    }
    h.style.display = 'flex';
  }

  updateHud() {
    for (const chip of this.el.hud.querySelectorAll('.chip')) {
      const w = this.wins.get(chip.dataset.key) || 0;
      chip.querySelectorAll('.pips i').forEach((i, k) => i.classList.toggle('on', k < w));
      if (this.world && !this.teams) {
        const p = this.world.players.find(q => q.id === chip.dataset.key);
        chip.classList.toggle('dead', !!p && !p.alive);
      }
    }
  }

  buildLabels() {
    this.el.labels.innerHTML = '';
    this.labelEls = new Map();
    for (const p of this.world.players) {
      const d = document.createElement('div'); d.className = 'plabel';
      d.style.setProperty('--c', '#' + new THREE.Color(p.color).getHexString());
      d.textContent = p.name;
      this.el.labels.appendChild(d); this.labelEls.set(p.id, d);
    }
  }

  updateLabels() {
    if (!this.labelEls) return;
    const v = new THREE.Vector3(), W = innerWidth, H = innerHeight;
    for (const p of this.world.players) {
      const d = this.labelEls.get(p.id);
      if (!p.alive) { d.style.display = 'none'; continue; }
      v.set(p.x, 1.55, p.z).project(this.view.camera);
      d.style.display = 'block';
      d.style.transform = `translate(${(v.x * 0.5 + 0.5) * W}px, ${(-v.y * 0.5 + 0.5) * H}px) translate(-50%, -100%)`;
      d.style.opacity = p.inBush ? 0.35 : 1;
    }
  }

  showBanner(title, sub = '', cls = '') {
    this.net?.send({ t: 'banner', title, sub, cls });
    const b = this.el.banner;
    b.className = 'show ' + cls;
    b.innerHTML = `<div class="t"></div><div class="s"></div>`;
    b.querySelector('.t').textContent = title; b.querySelector('.s').textContent = sub;
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => { b.className = ''; }, cls === 'stay' ? 999999 : 1400);
  }

  // ---------- CICLO ----------
  frame(dt) {
    if (this.state === 'paused') { this.handlePauseInput(); return; }
    const W = this.world;
    // input umani (con aggancio dei fronti fino al prossimo passo di simulazione)
    for (const p of W.players) {
      if (p.isBot) continue;
      const it = this.input.getIntent(p.cfg.device);
      if (it.pause && !this.demo) { if (this.net) { this.toggleOverlay(); continue; } this.pause(); return; }
      if (it.aimNdc && it.hasAim) {
        const g = this.view.screenToGround(it.aimNdc);
        if (g) { it.ax = g.x - p.x; it.az = g.z - p.z; }
      }
      const pend = this.pending.get(p.id);
      if (pend) { it.melee ||= pend.melee; it.dash ||= pend.dash; }
      this.pending.set(p.id, it);
    }
    if (this.state === 'countdown') {
      this.stateT -= dt;
      const n = Math.ceil(this.stateT);
      if (!this.demo && n !== this.lastBeep && n > 0 && n <= 3) { this.lastBeep = n; sfx('beep'); this.showBanner(String(n), '', 'count'); }
      if (this.stateT <= 0) { this.state = 'fight'; if (!this.demo) { sfx('go'); this.showBanner(t('fight'), '', 'count'); } }
      this.pending.clear();
    } else if (this.state === 'fight' || this.state === 'ending' || this.state === 'roundEnd' || this.state === 'matchEnd') {
      this.acc += Math.min(dt, 0.1);
      while (this.acc >= STEP) {
        this.acc -= STEP;
        if (W.hitStop > 0) { W.hitStop -= STEP; continue; }
        const intents = new Map();
        const acting = this.state === 'fight' || this.state === 'ending';
        if (acting) {
          for (const [id, it] of this.pending) intents.set(id, it);
          for (const [id, b] of this.brains) intents.set(id, b.think(W, STEP));
        }
        W.step(STEP, intents);
        for (const it of this.pending.values()) { it.melee = false; it.dash = false; }
        if (acting) this.roundTime += STEP;
      }
      this.handleEvents();
      this.checkRound(dt);
    }
    W.updateView(dt, settings.showAim);
    W.updateDebris(dt);
    const focus = W.players.filter(p => p.alive);
    for (const b of W.booms) if (b.flying && b.hitter && b.hitter.alive) focus.push(b);
    this.view.frame(focus, W.arena.W, W.arena.H, dt);
    this.net?.tick(this, dt);
    if (!this.demo) {
      this.updateLabels();
      const left = Math.max(0, CFG.ROUND_TIME - this.roundTime);
      this.el.timer.textContent = this.state === 'fight' ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : '';
      this.el.timer.classList.toggle('warn', left < 10);
    }
  }

  handleEvents() {
    const W = this.world, fx = this.fx, demo = this.demo;
    const play = (n, v) => { if (!demo) sfx(n, v); };
    this.net?.onEvents(this, W.events);
    for (const e of W.events) {
      switch (e.type) {
        case 'throw': play('throw', 0.7 + e.charge * 0.5); break;
        case 'catch': play('catch'); break;
        case 'recall': play('recall'); fx.puff(e.p.x, 0.6, e.p.z, e.p.color, 3, 0.2); break;
        case 'melee': {
          play('melee');
          const a0 = Math.atan2(e.p.fx, e.p.fz);
          for (let k = -3; k <= 3; k++) { const a = a0 + k * 0.32; fx.spawn(fx.glow, { x: e.p.x + Math.sin(a) * 0.95, y: 0.5, z: e.p.z + Math.cos(a) * 0.95, g: 0, life: 0.16, size: 0.16, color: 0xffffff }); }
          break;
        }
        case 'deflect': play('deflect'); fx.burst(e.x, 0.55, e.z, { n: 14, colors: [0xffffff, 0xffe066], speed: 6, up: 2, size: 0.07, life: 0.35, pool: 'glow', g: 2 }); this.view.addShake(0.25); break;
        case 'clash': play('clang'); fx.burst(e.x, 0.6, e.z, { n: 18, colors: [0xffffff, 0xffe066], speed: 7, up: 3, size: 0.08, life: 0.4, pool: 'glow', g: 2 }); this.view.addShake(0.3); break;
        case 'clang': play('clang'); fx.burst(e.x, 0.55, e.z, { n: 10, colors: [0xffffff, 0xffd23f], speed: 5, up: 2, size: 0.06, life: 0.3, pool: 'glow', g: 2 }); break;
        case 'wall': play('wall', Math.min(1, e.speed / 15)); fx.burst(e.x, 0.5, e.z, { n: 4, color: 0xdddddd, speed: 2, up: 2, size: 0.06, life: 0.3 }); break;
        case 'dash': play('dash'); break;
        case 'push': play('push'); fx.puff(e.x, 0.4, e.z, 0xffffff, 4, 0.3); this.view.addShake(0.15); break;
        case 'pickup': play('pickup'); fx.puff(e.p.x, 0.4, e.p.z, 0xffe066, 4, 0.2); break;
        case 'bush': play('whoosh', 0.6); fx.burst(e.x, 0.5, e.z, { n: 6, color: W.arena.def.theme.bush, speed: 2, up: 3, size: 0.08, life: 0.6, flat: true }); break;
        case 'crate': play('crate'); fx.burst(e.x, 0.4, e.z, { n: 14, color: e.color, speed: 4, up: 5, size: 0.14, life: 1, pool: 'cube' }); fx.puff(e.x, 0.4, e.z, 0xffffff, 4, 0.35); break;
        case 'explode': play('boom'); fx.explosion(e.x, e.z, CFG.BARREL_RADIUS); this.view.addShake(0.8); break;
        case 'boomSink': play('splash', 0.4); fx.burst(e.x, 0, e.z, { n: 8, colors: [0xffffff, 0x9be7ff], speed: 1.5, up: 4, size: 0.08, life: 0.5, floor: -0.2 }); break;
        case 'boomSpawn': fx.burst(e.x, 0.3, e.z, { n: 10, colors: [0xffffff, 0xffe066], speed: 2, up: 3, size: 0.07, life: 0.5, pool: 'glow', g: 3 }); break;
        case 'kill': {
          const snd = { water: 'splash', lava: 'sizzle', void: 'fall' }[e.cause] || 'hit';
          play(snd); W.spawnDeathFx(e.p);
          this.view.addShake(e.cause === 'void' ? 0.1 : 0.45);
          if (!demo) { this.input.rumble(e.p.cfg.device, 0.9, 260); if (e.killer && !e.killer.isBot) this.input.rumble(e.killer.cfg.device, 0.35, 90); this.updateHud(); }
          break;
        }
      }
    }
    W.events.length = 0;
  }

  aliveSides() {
    const A = this.world.alivePlayers();
    return this.teams ? new Set(A.map(p => p.team % 2)) : new Set(A.map(p => p.id));
  }

  checkRound(dt) {
    const W = this.world;
    if (this.state === 'fight') {
      if (this.aliveSides().size <= 1) { this.state = 'ending'; this.endDelay = 1.0; }
      else if (this.roundTime >= CFG.ROUND_TIME) { this.finishRound(true); }
    } else if (this.state === 'ending') {
      this.endDelay -= dt;
      if (this.endDelay <= 0) this.finishRound(false);
    } else if (this.state === 'roundEnd') {
      this.stateT -= dt;
      if (this.stateT <= 0) {
        const champ = [...this.wins.entries()].find(([, w]) => w >= this.cfg.roundsToWin);
        if (champ && !this.demo) this.endMatch(champ[0]);
        else this.startRound();
      }
    }
  }

  finishRound(timeUp) {
    const W = this.world, A = W.alivePlayers();
    const sides = this.aliveSides();
    let title, sub = '';
    if (timeUp || sides.size !== 1) {
      title = timeUp ? t('timeUp') : t('draw'); if (timeUp) sub = t('draw');
    } else {
      const key = this.scoreKey(A[0]);
      this.wins.set(key, (this.wins.get(key) || 0) + 1);
      this.net?.sendWins(this);
      for (const p of A) p.victory = true;
      if (this.teams) title = `${t(A[0].team % 2 ? 'teamBlue' : 'teamRed')} ${t('teamWins')}`;
      else title = `${A[0].name} ${t('wins')}`;
      sub = this.teams ? '' : (CHAR_BY_ID[A[0].cfg.charId]?.name[settings.lang] || '');
      if (!this.demo) sfx('roundWin');
    }
    if (!this.demo) { this.showBanner(title, sub, 'win'); this.updateHud(); }
    if (this.demo && this.round > 50) { this.round = 0; }
    this.state = 'roundEnd';
    this.stateT = this.demo ? 2 : 3;
  }

  endMatch(key) {
    this.net?.send({ t: 'end', key });
    this.state = 'matchEnd';
    const W = this.world;
    for (const p of W.players) if (this.scoreKey(p) === key && p.alive) p.victory = true;
    sfx('victory');
    duckMusic(true); setTimeout(() => duckMusic(false), 3000);
    const end = this.el.end;
    const rows = this.teams
      ? [0, 1].map(k => ({ name: t(k ? 'teamBlue' : 'teamRed'), w: this.wins.get('team' + k) || 0, c: TEAM_COLORS[k], ch: null }))
      : this.cfg.players.map((p, i) => ({ name: p.name, w: this.wins.get(p.id) || 0, c: SLOT_COLORS[i % SLOT_COLORS.length], ch: p.charId }));
    rows.sort((a, b) => b.w - a.w);
    const win = this.teams ? rows[0].name : (this.cfg.players.find(p => p.id === key)?.name || '');
    end.querySelector('.champ').textContent = `${t('matchWinner')} ${win}`;
    const list = end.querySelector('.rank'); list.innerHTML = '';
    rows.forEach((r, i) => {
      const li = document.createElement('li');
      li.style.setProperty('--c', '#' + new THREE.Color(r.c).getHexString());
      li.innerHTML = `<b>${i + 1}</b>${r.ch && window.CHAR_THUMBS?.[r.ch] ? `<img src="${window.CHAR_THUMBS[r.ch]}" alt="">` : ''}<span></span><em>${r.w}</em>`;
      li.querySelector('span').textContent = r.name;
      list.appendChild(li);
    });
    end.classList.add('show');
    this.el.banner.className = '';
    end.querySelector('button').focus();
  }

  rematch() {
    this.net?.send({ t: 'rematch' });
    this.el.end.classList.remove('show');
    this.wins.clear(); this.round = 0;
    this.buildHud();
    this.startRound();
  }

  // online la partita non si ferma: il menu si apre sopra il gioco
  toggleOverlay() {
    this.overlayPaused = !this.overlayPaused;
    this.el.pause.classList.toggle('show', this.overlayPaused);
    if (this.overlayPaused) this.el.pause.querySelector('button')?.focus();
  }

  pause() {
    if (this.net) { if (!this.overlayPaused) this.toggleOverlay(); return; }
    this.prevState = this.state; this.state = 'paused';
    this.el.pause.classList.add('show');
    this.el.pause.querySelector('button').focus();
  }

  resume() {
    if (this.net) { if (this.overlayPaused) this.toggleOverlay(); return; }
    if (this.state !== 'paused') return;
    this.state = this.prevState; this.el.pause.classList.remove('show');
    this.acc = 0;
  }

  handlePauseInput() {
    for (const p of this.world.players) if (!p.isBot && this.input.getIntent(p.cfg.device).pause) { this.resume(); return; }
  }

  playerLeft(id) {
    const p = this.world?.players.find(q => q.id === id);
    if (p && p.alive) this.world.kill(p, null, 'void');
  }

  dispose() {
    this.world?.dispose(); this.fx.clear();
    clearTimeout(this.bannerTimer);
    if (!this.demo) {
      this.el.hud.style.display = 'none'; this.el.hud.innerHTML = ''; this.el.labels.innerHTML = '';
      this.el.banner.className = ''; this.el.timer.textContent = '';
      this.el.pause.classList.remove('show'); this.el.end.classList.remove('show');
    }
  }
}

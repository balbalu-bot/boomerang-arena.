// Gestione input unificata: tastiera+mouse, fino a 8 controller (Gamepad API), touch.
// Ogni dispositivo produce un "intento" identico, così la simulazione non sa (e non deve sapere)
// da dove arrivano i comandi. Lo stesso formato verrà inviato in rete nella fase multiplayer.

import { settings } from './settings.js';

const DEAD = 0.22;

function emptyIntent() {
  return { mx: 0, mz: 0, ax: 0, az: 0, hasAim: false, aimNdc: null, throwHeld: false, melee: false, dash: false, pause: false };
}

function dz(v) { return Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD); }

export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.keyEdges = new Set();
    this.mouse = { ndcX: 0, ndcY: 0, left: false, rightEdge: false, moved: false };
    this.padPrev = {};          // stato precedente dei pulsanti per ogni controller
    this.padMenuRepeat = {};
    this.menuQueue = [];
    this.touch = { enabled: false, move: { id: null, ox: 0, oy: 0, x: 0, y: 0 }, aim: { id: null, ox: 0, oy: 0, x: 0, y: 0 }, dashEdge: false, meleeEdge: false };
    this.lastDevice = 'kb';
    this.keyCapture = null;     // callback per la riassegnazione dei tasti
    this.remote = new Map();    // comandi dei giocatori online (solo sull'host)

    addEventListener('keydown', e => {
      if (this.keyCapture) { e.preventDefault(); const cb = this.keyCapture; this.keyCapture = null; cb(e.code); return; }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && document.activeElement?.tagName !== 'INPUT') e.preventDefault();
      if (!this.keys.has(e.code)) this.keyEdges.add(e.code);
      this.keys.add(e.code);
      this.lastDevice = 'kb';
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.left = false; });

    canvas.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const r = canvas.getBoundingClientRect();
      this.mouse.ndcX = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.mouse.ndcY = -((e.clientY - r.top) / r.height) * 2 + 1;
      this.mouse.moved = true;
    });
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse') return;
      if (e.button === 0) this.mouse.left = true;
      if (e.button === 2) this.mouse.rightEdge = true;
      this.lastDevice = 'kb';
    });
    addEventListener('pointerup', e => { if (e.pointerType === 'mouse' && e.button === 0) this.mouse.left = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    addEventListener('gamepadconnected', e => { this.onPadConnected?.(e.gamepad); });
    addEventListener('gamepaddisconnected', e => { this.onPadDisconnected?.(e.gamepad); });

    this.setupTouch();
  }

  // ---------- TOUCH ----------
  setupTouch() {
    const layer = document.getElementById('touch-layer');
    if (!layer) return;
    const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.touch.enabled = isTouch;
    const T = this.touch;
    const stickL = document.getElementById('stick-left'), stickR = document.getElementById('stick-right');
    const knobL = stickL.querySelector('.knob'), knobR = stickR.querySelector('.knob');
    const R = 55;

    const place = (stick, knob, s) => {
      stick.style.left = s.ox + 'px'; stick.style.top = s.oy + 'px';
      let dx = s.x - s.ox, dy = s.y - s.oy; const l = Math.hypot(dx, dy);
      if (l > R) { dx *= R / l; dy *= R / l; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    layer.addEventListener('touchstart', e => {
      for (const t of e.changedTouches) {
        const tgt = t.target;
        if (tgt.closest && tgt.closest('.tbtn')) continue;
        const left = t.clientX < innerWidth / 2;
        const s = left ? T.move : T.aim;
        if (s.id !== null) continue;
        s.id = t.identifier; s.ox = s.x = t.clientX; s.oy = s.y = t.clientY;
        const st = left ? stickL : stickR; st.classList.add('active');
        place(st, left ? knobL : knobR, s);
      }
      this.lastDevice = 'touch';
      e.preventDefault();
    }, { passive: false });
    layer.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        for (const [s, st, kn] of [[T.move, stickL, knobL], [T.aim, stickR, knobR]]) {
          if (s.id === t.identifier) { s.x = t.clientX; s.y = t.clientY; place(st, kn, s); }
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) {
        if (T.move.id === t.identifier) { T.move.id = null; stickL.classList.remove('active'); knobL.style.transform = ''; }
        if (T.aim.id === t.identifier) { T.aim.id = null; stickR.classList.remove('active'); knobR.style.transform = ''; }
      }
    };
    layer.addEventListener('touchend', end);
    layer.addEventListener('touchcancel', end);
    const btn = (id, key) => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', e => { T[key] = true; el.classList.add('down'); e.preventDefault(); e.stopPropagation(); }, { passive: false });
      el.addEventListener('touchend', () => el.classList.remove('down'));
    };
    btn('tbtn-dash', 'dashEdge');
    btn('tbtn-melee', 'meleeEdge');
  }

  showTouch(on) {
    const layer = document.getElementById('touch-layer');
    if (layer) layer.style.display = on && this.touch.enabled ? 'block' : 'none';
  }

  // ---------- CONTROLLER ----------
  pads() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    return Array.from(list || []).filter(p => p && p.connected);
  }

  padState(p) {
    const b = i => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.45));
    const ax = i => p.axes[i] || 0;
    // Con mappatura "standard" (Xbox, PlayStation, Switch Pro su Chrome/Edge/Safari) gli indici sono fissi.
    // Per i controller generici Bluetooth la levetta destra è spesso sugli assi 2/3 o 3/4.
    let rx = ax(2), ry = ax(3);
    if (p.mapping !== 'standard' && p.axes.length >= 6 && Math.abs(ax(3)) + Math.abs(ax(4)) > Math.abs(rx) + Math.abs(ry)) { rx = ax(3); ry = ax(4); }
    // controller configurato a mano in Impostazioni → Configura controller
    const map = settings.padMaps?.[p.id];
    if (map) {
      if (map.rx !== undefined) { rx = ax(map.rx); ry = ax(map.ry ?? map.rx + 1); }
      const hb = i => i !== undefined && b(i);
      return {
        lx: dz(ax(0)), ly: dz(ax(1)), rx: dz(rx), ry: dz(ry),
        south: hb(map.throw), east: hb(map.dash), west: hb(map.melee), north: false,
        lb: false, rb: false, lt: false, rt: false, select: hb(map.ptt), start: hb(map.start),
        up: b(12), down: b(13), left: b(14), right: b(15),
        anyBtn: p.buttons.some((x, i) => i < 32 && (x.pressed || x.value > 0.45)),
      };
    }
    return {
      anyBtn: p.buttons.some((x, i) => i < 32 && (x.pressed || x.value > 0.45)),
      lx: dz(ax(0)), ly: dz(ax(1)), rx: dz(rx), ry: dz(ry),
      south: b(0), east: b(1), west: b(2), north: b(3),
      lb: b(4), rb: b(5), lt: b(6), rt: b(7), select: b(8), start: b(9),
      up: b(12), down: b(13), left: b(14), right: b(15),
    };
  }

  rumble(deviceId, strong = 0.6, ms = 180) {
    if (!deviceId || !deviceId.startsWith('pad:')) return;
    const p = this.pads().find(g => 'pad:' + g.index === deviceId);
    try { p?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: strong * 0.6 }); } catch { /* non supportato */ }
  }

  // Da chiamare una volta per fotogramma: aggiorna fronti di salita e coda eventi menu
  poll(now) {
    for (const p of this.pads()) {
      const id = 'pad:' + p.index;
      const s = this.padState(p);
      const prev = this.padPrev[id] || {};
      const edge = k => s[k] && !prev[k];
      s._edge = {};
      for (const k of Object.keys(s)) if (typeof s[k] === 'boolean') s._edge[k] = edge(k);
      // navigazione menu (croce o levetta, con ripetizione)
      const dir = s.up || s.ly < -0.6 ? 'up' : s.down || s.ly > 0.6 ? 'down' : s.left || s.lx < -0.6 ? 'left' : s.right || s.lx > 0.6 ? 'right' : null;
      const rep = this.padMenuRepeat[id] || { dir: null, t: 0 };
      if (dir && (dir !== rep.dir || now - rep.t > (rep.n > 0 ? 130 : 380))) {
        this.menuQueue.push({ type: dir, device: id });
        rep.n = dir === rep.dir ? (rep.n || 0) + 1 : 0; rep.dir = dir; rep.t = now;
      }
      if (!dir) { rep.dir = null; rep.n = 0; }
      this.padMenuRepeat[id] = rep;
      if (s._edge.south) this.menuQueue.push({ type: 'confirm', device: id });
      else if (s._edge.anyBtn) this.menuQueue.push({ type: 'any', device: id });
      if (s._edge.east) this.menuQueue.push({ type: 'back', device: id });
      if (s._edge.start) this.menuQueue.push({ type: 'start', device: id });
      if (Object.values(s._edge).some(Boolean) || Math.abs(s.lx) + Math.abs(s.ly) > 0.5) this.lastDevice = id;
      this.padPrev[id] = s;
    }
  }

  takeMenuEvents() { const q = this.menuQueue; this.menuQueue = []; return q; }

  // ---------- INTENTO per un dispositivo ----------
  getIntent(deviceId) {
    const it = emptyIntent();
    const K = settings.keys;
    if (deviceId.startsWith('net:')) {
      const r = this.remote.get(deviceId);
      if (r) {
        it.mx = r.mx || 0; it.mz = r.mz || 0; it.ax = r.ax || 0; it.az = r.az || 0;
        it.hasAim = !!r.hasAim; it.throwHeld = !!r.throwHeld; it.melee = !!r.melee; it.dash = !!r.dash;
        r.melee = false; r.dash = false;
      }
      return it;
    }
    if (deviceId === 'kb') {
      const k = c => this.keys.has(c);
      it.mx = (k(K.right) || k('ArrowRight') ? 1 : 0) - (k(K.left) || k('ArrowLeft') ? 1 : 0);
      it.mz = (k(K.down) || k('ArrowDown') ? 1 : 0) - (k(K.up) || k('ArrowUp') ? 1 : 0);
      const l = Math.hypot(it.mx, it.mz); if (l > 1) { it.mx /= l; it.mz /= l; }
      it.aimNdc = { x: this.mouse.ndcX, y: this.mouse.ndcY };
      it.hasAim = this.mouse.moved;
      it.throwHeld = this.mouse.left || k(K.throwKey);
      it.melee = this.mouse.rightEdge || this.keyEdges.has(K.melee);
      it.dash = this.keyEdges.has(K.dash);
      it.pause = this.keyEdges.has(K.pause);
    } else if (deviceId === 'touch') {
      const T = this.touch;
      if (T.move.id !== null) {
        let dx = (T.move.x - T.move.ox) / 55, dy = (T.move.y - T.move.oy) / 55;
        const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
        if (l > 0.15) { it.mx = dx; it.mz = dy; }
      }
      if (T.aim.id !== null) {
        const dx = T.aim.x - T.aim.ox, dy = T.aim.y - T.aim.oy;
        if (Math.hypot(dx, dy) > 12) { it.ax = dx; it.az = dy; it.hasAim = true; }
        it.throwHeld = true;
      }
      it.dash = T.dashEdge; it.melee = T.meleeEdge;
    } else if (deviceId.startsWith('pad:')) {
      const s = this.padPrev[deviceId];
      if (s) {
        it.mx = s.lx; it.mz = s.ly;
        if (!it.mx && !it.mz) { it.mx = (s.right ? 1 : 0) - (s.left ? 1 : 0); it.mz = (s.down ? 1 : 0) - (s.up ? 1 : 0); }
        const l = Math.hypot(it.mx, it.mz); if (l > 1) { it.mx /= l; it.mz /= l; }
        if (Math.hypot(s.rx, s.ry) > 0.3) { it.ax = s.rx; it.az = s.ry; it.hasAim = true; }
        it.throwHeld = s.rt || s.south;
        it.melee = s._edge.west || s._edge.rb;
        it.dash = s._edge.lt || s._edge.east || s._edge.lb;
        it.pause = s._edge.start;
      }
    }
    return it;
  }

  // Chiamare a fine fotogramma di simulazione per azzerare i fronti
  endFrame() {
    this.keyEdges.clear();
    this.mouse.rightEdge = false;
    this.touch.dashEdge = false; this.touch.meleeEdge = false;
    for (const id in this.padPrev) { const s = this.padPrev[id]; if (s._edge) for (const k in s._edge) s._edge[k] = false; }
  }
}

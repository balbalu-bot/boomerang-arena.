// Sincronizzazione della partita online.
//  - NetHost: sul browser dell'host. Riceve i comandi dei giocatori, invia istantanee ed eventi.
//  - ClientMatch: sui browser degli altri. Non simula: mostra lo stato dell'host con interpolazione.

import { NET } from './net-config.js';
import { Match } from '../game/match.js';
import { World } from '../game/world.js';
import { TILE } from '../game/arena.js';
import { ARENA_BY_ID, ARENAS } from '../data/arenas.js';
import { settings } from '../core/settings.js';
import { CFG } from '../core/config.js';

const STATES = ['countdown', 'fight', 'ending', 'roundEnd', 'matchEnd', 'idle', 'paused'];
const BSTATES = ['held', 'out', 'return', 'drop', 'ground', 'respawn'];
const r2 = v => Math.round(v * 100);
const num = (v, lo, hi) => (typeof v === 'number' && isFinite(v)) ? Math.max(lo, Math.min(hi, v)) : 0;

// ---------------------------------------------------------------------
export class NetHost {
  constructor(session, input) {
    this.s = session; this.input = input; this.seq = 0;
    this.acc = 0; this.relayAcc = 0;
  }

  onData(from, msg) {
    if (msg.t !== 'i') return;
    const dev = 'net:' + from;
    const st = this.input.remote.get(dev) || { lastMc: msg.mc, lastDc: msg.dc };
    st.mx = num(msg.mx, -1, 1); st.mz = num(msg.mz, -1, 1);
    st.ax = num(msg.ax, -50, 50); st.az = num(msg.az, -50, 50);
    st.hasAim = !!msg.a; st.throwHeld = !!msg.th;
    if (msg.mc !== st.lastMc) { st.melee = true; st.lastMc = msg.mc; }
    if (msg.dc !== st.lastDc) { st.dash = true; st.lastDc = msg.dc; }
    if (msg.pc !== st.lastPc) { st.lastPc = msg.pc; }
    this.input.remote.set(dev, st);
  }

  send(msg, reliable = true) { this.s.sendAll(msg, reliable); }

  onRound(m) { this.send({ t: 'round', round: m.round, arena: m.world.arena.def.id }); }

  sendWins(m) { this.send({ t: 'wins', w: [...m.wins.entries()] }); }

  onEvents(m, events) {
    if (!events.length) return;
    const W = m.world, out = [];
    for (const e of events) {
      const o = {};
      for (const k in e) {
        const v = e[k];
        if (v && typeof v === 'object' && 'rig' in v) o[k] = v.id;     // riferimenti ai giocatori → id
        else if (typeof v !== 'object') o[k] = v;
      }
      if (e.type === 'kill' && e.p.death) { o.dx = e.p.death.dx; o.dz = e.p.death.dz; }
      out.push(o);
    }
    this.send({ t: 'e', e: out });
  }

  snapshot(m) {
    const W = m.world, P = W.players;
    return {
      t: 's', n: ++this.seq, st: STATES.indexOf(m.state), rt: Math.round(m.roundTime * 10) / 10,
      p: P.map(p => [r2(p.x), r2(p.z), r2(p.fx), r2(p.fz),
        (p.alive ? 1 : 0) | (p.dashT > 0 ? 2 : 0) | (p.victory ? 8 : 0) | (p.shield > 0 ? 16 : 0),
        p.chargeT >= 0 ? Math.min(999, r2(p.chargeT)) : -1, Math.round(p.meleeT * 1000), r2(p.throwAnim)]),
      b: W.booms.map(b => [BSTATES.indexOf(b.state), r2(b.x), r2(b.z), b.holder ? P.indexOf(b.holder) : -1, b.owner ? P.indexOf(b.owner) : -1, b.hitter ? P.indexOf(b.hitter) : -1]),
    };
  }

  tick(m, dt) {
    this.acc += dt; this.relayAcc += dt;
    const direct = this.acc >= 1 / NET.SNAPSHOT_HZ, relay = this.relayAcc >= 1 / NET.RELAY_SNAPSHOT_HZ;
    if (!direct && !relay) return;
    const snap = this.snapshot(m);
    for (const p of this.s.peers.values()) {
      if (p.closed) continue;
      if (p.open && direct) p.send(snap, false);
      else if (!p.open && p.relay && relay) this.s.relaySend(p.uid, snap);
    }
    if (direct) this.acc = 0;
    if (relay) this.relayAcc = 0;
  }
}

// ---------------------------------------------------------------------
export class ClientMatch extends Match {
  constructor(opts) {
    super({ ...opts, demo: false });
    this.ready = true;
    this.session = opts.session;
    this.myId = opts.myId;
    this.snaps = [];
    this.inputT = 0; this.mc = 0; this.dc = 0; this.pc = 0;
    this.lastSt = 'countdown'; this.lastRt = 0;
    this.overlayPaused = false;
    this.state = 'waiting';
  }

  startRound() { /* sul client i round arrivano dall'host */ }

  onMsg(msg) {
    switch (msg.t) {
      case 'round': this.beginRound(msg); break;
      case 's': if (Array.isArray(msg.p) && Array.isArray(msg.b)) { this.snaps.push({ time: performance.now(), d: msg }); if (this.snaps.length > 40) this.snaps.shift(); } break;
      case 'e': if (Array.isArray(msg.e) && this.world) this.applyEvents(msg.e); break;
      case 'banner': this.showBanner(String(msg.title ?? '').slice(0, 80), String(msg.sub ?? '').slice(0, 80), String(msg.cls ?? '').replace(/[^a-z ]/g, '')); break;
      case 'wins': if (Array.isArray(msg.w)) { this.wins = new Map(msg.w.filter(x => Array.isArray(x)).map(([k, v]) => [String(k), +v || 0])); this.updateHud(); } break;
      case 'end': this.endMatch(String(msg.key)); break;
      case 'rematch': this.el.end.classList.remove('show'); this.wins.clear(); this.buildHud(); break;
    }
  }

  beginRound(msg) {
    if (this.world) { this.world.dispose(); this.fx.clear(); }
    this.round = +msg.round || 1;
    const def = ARENA_BY_ID[msg.arena] || ARENAS[0];
    this.world = new World({ view: this.view, fx: this.fx, arenaDef: def, players: this.cfg.players, rules: { mode: this.cfg.mode, friendlyFire: false } });
    this.snaps = [];
    this.state = 'countdown';
    this.view.frame(this.world.players, this.world.arena.W, this.world.arena.H, 1, true);
    this.buildLabels(); this.updateHud();
    this.el.end.classList.remove('show');
  }

  applyEvents(list) {
    const W = this.world, byId = id => W.players.find(p => p.id === id);
    for (const e of list) {
      if (!e || typeof e.type !== 'string') continue;
      const ev = { ...e };
      for (const k of ['p', 'killer', 'q']) if (k in ev) ev[k] = byId(ev[k]) || null;
      if (['throw', 'catch', 'recall', 'melee', 'dash', 'pickup'].includes(ev.type) && !ev.p) continue;
      if (ev.type === 'kill') {
        const p = ev.p; if (!p) continue;
        p.alive = false;
        p.death = { cause: ev.cause, t: 0, dx: +ev.dx || 0, dz: +ev.dz || 0, x: +ev.x || p.x, z: +ev.z || p.z };
        p.x = p.death.x; p.z = p.death.z;
      }
      if (ev.type === 'crate' || ev.type === 'explode') this.removeProp(+ev.x, +ev.z);
      W.events.push(ev);
    }
    this.handleEvents();
  }

  removeProp(x, z) {
    const A = this.world.arena, [i, j] = A.toTile(x, z), key = i + ',' + j, p = A.props.get(key);
    if (p && (p.type === 'crate' || p.type === 'barrel')) { A.group.remove(p.mesh); A.props.delete(key); A.grid[j][i] = TILE.FLOOR; }
  }

  myPlayer() { return this.world?.players.find(p => p.id === this.myId); }

  sendInput(dt) {
    const me = this.myPlayer();
    const dev = this.input.lastDevice || 'kb';
    const it = this.input.getIntent(dev);
    if (it.pause) this.toggleOverlay();
    if (it.melee) this.mc++;
    if (it.dash) this.dc++;
    if (!me) return;
    if (it.aimNdc && it.hasAim) {
      const g = this.view.screenToGround(it.aimNdc);
      if (g) { it.ax = g.x - me.x; it.az = g.z - me.z; }
    }
    this.inputT += dt;
    const edge = it.melee || it.dash || it.throwHeld !== this.lastThrow;
    this.lastThrow = it.throwHeld;
    if (this.inputT < 1 / NET.INPUT_HZ && !edge) return;
    this.inputT = 0;
    const msg = { t: 'i', mx: Math.round(it.mx * 100) / 100, mz: Math.round(it.mz * 100) / 100, ax: Math.round(it.ax * 100) / 100, az: Math.round(it.az * 100) / 100, a: it.hasAim ? 1 : 0, th: it.throwHeld ? 1 : 0, mc: this.mc, dc: this.dc };
    this.session.sendHost(msg, false);
  }

  toggleOverlay() {
    this.overlayPaused = !this.overlayPaused;
    this.el.pause.classList.toggle('show', this.overlayPaused);
    if (this.overlayPaused) this.el.pause.querySelector('button')?.focus();
  }
  pause() { if (!this.overlayPaused) this.toggleOverlay(); }
  resume() { if (this.overlayPaused) this.toggleOverlay(); }

  applySnapshot(dt) {
    const S = this.snaps; if (!S.length) return;
    const W = this.world, P = W.players, B = W.booms;
    const peer = this.session.peers.get(this.session.hostId);
    const hz = peer && peer.open ? NET.SNAPSHOT_HZ : NET.RELAY_SNAPSHOT_HZ;
    const rt = performance.now() - 1000 / hz * 2;
    let a = S[0], b = S[S.length - 1];
    for (let i = 0; i < S.length - 1; i++) if (S[i].time <= rt && S[i + 1].time >= rt) { a = S[i]; b = S[i + 1]; break; }
    if (rt > b.time) a = b;
    const k = a === b ? 1 : Math.max(0, Math.min(1, (rt - a.time) / (b.time - a.time)));
    const L = (u, v) => (u + (v - u) * k) / 100;
    const latest = S[S.length - 1].d;
    this.lastSt = STATES[latest.st] || 'fight'; this.lastRt = latest.rt;
    P.forEach((p, i) => {
      const pa = a.d.p[i], pb = b.d.p[i], pl = latest.p[i];
      if (!pa || !pb || !pl) return;
      const ox = p.x, oz = p.z;
      if (p.alive) {
        p.x = L(pa[0], pb[0]); p.z = L(pa[1], pb[1]);
        const fx = L(pa[2], pb[2]), fz = L(pa[3], pb[3]), fl = Math.hypot(fx, fz) || 1;
        p.fx = fx / fl; p.fz = fz / fl;
        p.speedNow = Math.hypot(p.x - ox, p.z - oz) / Math.max(dt, 1e-3);
      }
      const f = pl[4];
      if (!(f & 1) && p.alive) { p.alive = false; p.death = { cause: 'hit', t: 99, dx: 0, dz: 0, x: p.x, z: p.z }; }
      if ((f & 1) && !p.alive && this.lastSt === 'countdown') { p.alive = true; p.death = null; }
      p.dashT = f & 2 ? 0.1 : 0; p.victory = !!(f & 8); p.shield = f & 16 ? 1 : 0;
      p.chargeT = pl[5] >= 0 ? pl[5] / 100 : -1; p.meleeT = pl[6] / 1000; p.throwAnim = pl[7] / 100;
      p.inBush = W.arena.bushAt(p.x, p.z); p.onIce = W.arena.at(p.x, p.z) === TILE.ICE;
    });
    B.forEach((bm, i) => {
      const ba = a.d.b[i], bb = b.d.b[i], bl = latest.b[i];
      if (!ba || !bb || !bl) return;
      const ox = bm.x, oz = bm.z;
      bm.state = BSTATES[bl[0]] || 'ground';
      bm.x = L(ba[1], bb[1]); bm.z = L(ba[2], bb[2]);
      bm.vx = (bm.x - ox) / Math.max(dt, 1e-3); bm.vz = (bm.z - oz) / Math.max(dt, 1e-3);
      bm.holder = bl[3] >= 0 ? P[bl[3]] : null;
      const owner = bl[4] >= 0 ? P[bl[4]] : null;
      if (owner && bm.colorOwner !== owner) { bm.setColor(owner.color); bm.colorOwner = owner; }
      bm.owner = owner; bm.hitter = bl[5] >= 0 ? P[bl[5]] : null;
      if (bm.holder) bm.holder.boom = bm;
      if (bm.flying) bm.spin += dt * 22;
    });
  }

  frame(dt) {
    this.sendInput(dt);
    if (!this.world) return;
    this.applySnapshot(dt);
    const W = this.world;
    W.arena.update(dt, [], this.fx);
    W.updateView(dt, settings.showAim);
    W.updateDebris(dt);
    this.view.frame(W.players, W.arena.W, W.arena.H, dt);
    this.updateLabels();
    const left = Math.max(0, CFG.ROUND_TIME - this.lastRt);
    this.el.timer.textContent = this.lastSt === 'fight' ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : '';
    this.el.timer.classList.toggle('warn', left < 10);
  }

  rematch() { /* decide l'host */ }
}

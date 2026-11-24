// Simulazione di un round: giocatori, boomerang, collisioni, eliminazioni.
// La logica (step) è separata dalla grafica (updateView): nella fase multiplayer l'host eseguirà step()
// e invierà lo stato ai client, che useranno solo updateView() con interpolazione.

import * as THREE from 'three';
import { CFG, SLOT_COLORS, TEAM_COLORS } from '../core/config.js';
import { Arena, TILE } from './arena.js';
import { buildCharacter, buildBoomerangMesh } from './characters.js';
import { toon } from '../engine/view.js';

const v2len = (x, z) => Math.hypot(x, z);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

let NEXT_ID = 1;
const CHAR_SCALE = 1.2;

const throwSpeed = c => CFG.THROW_MIN + (CFG.THROW_MAX - CFG.THROW_MIN) * c;
const throwRange = c => CFG.RANGE_MIN + (CFG.RANGE_MAX - CFG.RANGE_MIN) * c;

class Boomerang {
  constructor(world, owner) {
    this.id = NEXT_ID++;
    this.world = world;
    this.owner = owner; this.hitter = owner; this.holder = owner;
    this.state = 'held';
    this.x = owner.x; this.z = owner.z; this.y = 0.55;
    this.vx = 0; this.vz = 0; this.t = 0; this.outTime = 0; this.decel = 0; this.curve = 0;
    this.recalled = false; this.respawnT = 0; this.spin = 0; this.ghost = false;
    this.mesh = buildBoomerangMesh(owner.color);
    world.scene.add(this.mesh);
  }
  get flying() { return this.state === 'out' || this.state === 'return' || this.state === 'drop'; }
  get speed() { return v2len(this.vx, this.vz); }
  setColor(hex) { this.mesh.children[0].material.color.setHex(hex); }
}

class Player {
  constructor(world, cfg, slotIndex) {
    this.id = cfg.id;
    this.world = world;
    this.cfg = cfg;
    this.slot = slotIndex;
    this.name = cfg.name;
    this.isBot = !!cfg.bot;
    this.team = cfg.team ?? slotIndex;
    this.color = world.rules.mode === 'teams' ? TEAM_COLORS[this.team % 2] : SLOT_COLORS[slotIndex % SLOT_COLORS.length];
    this.x = 0; this.z = 0; this.vx = 0; this.vz = 0; this.fx = 0; this.fz = 1;
    this.alive = true;
    this.chargeT = -1; this.prevThrow = false;
    this.dashT = 0; this.dashCd = 0; this.dashDx = 0; this.dashDz = 1; this.dashHit = new Set();
    this.meleeT = 0; this.meleeCd = 0; this.meleeHit = new Set();
    this.shield = CFG.SPAWN_SHIELD; this.pushT = 0; this.lastPusher = null; this.lastPushTime = -9;
    this.inBush = null; this.onIce = false;
    this.throwAnim = 0; this.runPhase = 0; this.blink = 2 + Math.random() * 3; this.victory = false;
    this.death = null; this.speedNow = 0;
    this.boom = null;
    // grafica
    this.rig = buildCharacter(cfg.charId);
    this.rig.root.scale.setScalar(CHAR_SCALE);
    world.scene.add(this.rig.root);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.9 }));
    ring.position.y = 0.02; this.ring = ring; world.scene.add(ring);
    if (!this.isBot && cfg.local !== false) {
      // anteprima della traiettoria con i rimbalzi (puntini sul pavimento)
      this.aimGroup = new THREE.Group();
      const dotM = new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.9, depthWrite: false });
      const dotG = new THREE.CircleGeometry(0.075, 10).rotateX(-Math.PI / 2);
      for (let i = 0; i < 34; i++) this.aimGroup.add(new THREE.Mesh(dotG, dotM));
      const bounceM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false });
      const bounceG = new THREE.RingGeometry(0.1, 0.17, 14).rotateX(-Math.PI / 2);
      this.bounceDots = [];
      for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(bounceG, bounceM); this.aimGroup.add(r); this.bounceDots.push(r); }
      world.scene.add(this.aimGroup);
    }
  }
  get holding() { return this.boom && this.boom.state === 'held' && this.boom.holder === this; }
}

export class World {
  constructor({ view, fx, arenaDef, players, rules }) {
    this.view = view; this.fx = fx; this.scene = view.scene;
    this.rules = rules;
    this.arena = new Arena(arenaDef, this.scene);
    this.time = 0;
    this.events = [];
    this.hitStop = 0;
    this.players = players.map((p, i) => new Player(this, p, i));
    this.booms = [];
    this.splats = [];
    this.placePlayers();
    for (const p of this.players) { const b = new Boomerang(this, p); p.boom = b; this.booms.push(b); }
  }

  placePlayers() {
    const spawns = [...this.arena.spawns].sort(() => Math.random() - 0.5);
    const used = [];
    for (const p of this.players) {
      const s = spawns.length ? spawns.shift() : this.arena.randomSafePoint(used, 3);
      p.x = s.x; p.z = s.z; used.push(s);
      const l = v2len(-s.x, -s.z) || 1; p.fx = -s.x / l; p.fz = -s.z / l;
    }
  }

  emit(e) { this.events.push(e); }

  enemies(a, b) {
    if (a === b) return false;
    if (this.rules.mode === 'teams' && a.team === b.team && !this.rules.friendlyFire) return false;
    return true;
  }

  alivePlayers() { return this.players.filter(p => p.alive); }

  // ---------------- SIMULAZIONE ----------------
  step(dt, intents) {
    this.time += dt;
    for (const p of this.players) this.stepPlayer(p, intents.get(p.id), dt);
    this.stepDashPush();
    this.separatePlayers();
    for (const b of this.booms) this.stepBoom(b, dt);
    this.boomBoomCollisions();
    this.boomPlayerHits();
    const evs = [];
    this.arena.update(dt, evs, this.fx);
    for (const e of evs) {
      if (e.type === 'explode') this.explode(e.x, e.z, e.by);
      else this.emit(e);
    }
  }

  stepPlayer(p, it, dt) {
    if (!p.alive) return;
    it = it || {};
    p.shield = Math.max(0, p.shield - dt);
    p.dashCd = Math.max(0, p.dashCd - dt); p.meleeCd = Math.max(0, p.meleeCd - dt);
    p.pushT = Math.max(0, p.pushT - dt); p.throwAnim = Math.max(0, p.throwAnim - dt);

    // direzione dello sguardo
    const al = v2len(it.ax || 0, it.az || 0);
    if (it.hasAim && al > 0.05) { p.fx = it.ax / al; p.fz = it.az / al; }
    else if (v2len(it.mx || 0, it.mz || 0) > 0.2 && p.meleeT <= 0) { const ml = v2len(it.mx, it.mz); p.fx = it.mx / ml; p.fz = it.mz / ml; }

    const tile = this.arena.at(p.x, p.z);
    p.onIce = tile === TILE.ICE;

    // scatto
    if (it.dash && p.dashCd <= 0 && p.dashT <= 0) {
      const ml = v2len(it.mx || 0, it.mz || 0);
      if (ml > 0.2) { p.dashDx = it.mx / ml; p.dashDz = it.mz / ml; } else { p.dashDx = p.fx; p.dashDz = p.fz; }
      p.dashT = CFG.DASH_TIME; p.dashCd = CFG.DASH_COOLDOWN; p.dashHit.clear(); p.chargeT = -1;
      this.emit({ type: 'dash', p });
    }

    // movimento
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.dashDx * CFG.DASH_SPEED; p.vz = p.dashDz * CFG.DASH_SPEED;
      if (p.dashT <= 0) { p.vx *= 0.35; p.vz *= 0.35; }
    } else {
      const mult = (p.chargeT >= 0 ? CFG.CHARGE_MOVE_MULT : 1) * (this.rules.speedMult || 1);
      const tx = (it.mx || 0) * CFG.MOVE_SPEED * mult, tz = (it.mz || 0) * CFG.MOVE_SPEED * mult;
      const moving = Math.abs(tx) + Math.abs(tz) > 0.01;
      let acc = p.onIce ? CFG.ICE_ACCEL : moving ? CFG.ACCEL : CFG.FRICTION * 3.5;
      if (p.pushT > 0) acc = p.onIce ? 2 : 10;
      const dx = tx - p.vx, dz = tz - p.vz, dl = v2len(dx, dz), mx = acc * dt;
      if (dl <= mx) { p.vx = tx; p.vz = tz; } else { p.vx += dx / dl * mx; p.vz += dz / dl * mx; }
    }
    const ox = p.x, oz = p.z;
    p.x += p.vx * dt; p.z += p.vz * dt;
    const hit = this.arena.collideCircle(p, CFG.PLAYER_RADIUS);
    if (hit) {
      const vn = p.vx * hit.nx + p.vz * hit.nz;
      if (vn < 0) { p.vx -= vn * hit.nx * (p.onIce || p.pushT > 0 ? 1.5 : 1); p.vz -= vn * hit.nz * (p.onIce || p.pushT > 0 ? 1.5 : 1); }
    }
    p.speedNow = v2len(p.x - ox, p.z - oz) / dt;

    // pericoli ambientali
    const under = this.arena.at(p.x, p.z);
    if (under === TILE.WATER || under === TILE.LAVA || under === TILE.VOID) {
      const killer = this.time - p.lastPushTime < 2 ? p.lastPusher : null;
      this.kill(p, killer, under === TILE.WATER ? 'water' : under === TILE.LAVA ? 'lava' : 'void');
      return;
    }
    const bush = this.arena.bushAt(p.x, p.z);
    if (bush && bush !== p.inBush) { bush.rustle = 0.35; this.emit({ type: 'bush', x: p.x, z: p.z }); }
    p.inBush = bush;

    // lancio con carica
    const throwHeld = !!it.throwHeld;
    if (p.holding) {
      if (throwHeld && !p.prevThrow && p.dashT <= 0) p.chargeT = 0;
      if (throwHeld && p.chargeT >= 0) p.chargeT += dt;
      if (!throwHeld && p.prevThrow && p.chargeT >= 0) this.throwBoom(p, Math.min(1, p.chargeT / CFG.CHARGE_TIME));
    } else {
      p.chargeT = -1;
      if (throwHeld && !p.prevThrow) this.recall(p);
    }
    p.prevThrow = throwHeld;

    // corpo a corpo / richiamo
    if (it.melee) {
      if (p.holding && p.meleeCd <= 0) {
        p.meleeT = CFG.MELEE_TIME; p.meleeCd = CFG.MELEE_COOLDOWN; p.meleeHit.clear(); p.chargeT = -1;
        this.emit({ type: 'melee', p });
      } else if (!p.holding) this.recall(p);
    }
    if (p.meleeT > 0) { p.meleeT -= dt; this.meleeCheck(p); }

    // raccolta di un boomerang a terra
    if (!p.holding) {
      for (const b of this.booms) {
        if (b.state !== 'ground') continue;
        if (v2len(b.x - p.x, b.z - p.z) < CFG.BOOM_CATCH_DIST + 0.1) {
          if (p.boom && p.boom !== b && p.boom.owner === p) p.boom.owner = null; // la vecchia arma resta "orfana"
          b.owner = p; b.hitter = p; b.holder = p; b.state = 'held'; b.setColor(p.color); p.boom = b;
          this.emit({ type: 'pickup', p });
          break;
        }
      }
    }
  }

  throwBoom(p, charge) {
    const b = p.boom;
    const sp = throwSpeed(charge);
    b.state = 'out'; b.t = 0; b.holder = null; b.hitter = p; b.recalled = false; b.ghost = false;
    b.x = p.x; b.z = p.z;
    b.vx = p.fx * sp; b.vz = p.fz * sp;
    b.path = [{ x: b.x, z: b.z }]; b.dist = 0; b.maxDist = throwRange(charge); b.ret = null;
    p.chargeT = -1; p.throwAnim = 0.22;
    this.emit({ type: 'throw', p, charge });
  }

  // Calcola la traiettoria rettilinea con rimbalzi "da biliardo" (usata da anteprima e IA)
  predictPath(x, z, dx, dz, range) {
    const pos = { x, z }; let vx = dx, vz = dz; const pts = [{ x, z }], bounces = [];
    const step = 0.1; let d = 0;
    while (d < range) {
      pos.x += vx * step; pos.z += vz * step; d += step;
      const hit = this.arena.collideCircle(pos, CFG.BOOM_RADIUS);
      if (hit) {
        const vn = vx * hit.nx + vz * hit.nz;
        if (vn < 0) { vx -= 2 * vn * hit.nx; vz -= 2 * vn * hit.nz; }
        bounces.push({ x: pos.x, z: pos.z });
      }
      pts.push({ x: pos.x, z: pos.z });
    }
    return { pts, bounces };
  }

  recall(p) {
    const b = p.boom;
    if (!b || b.owner !== p || !(b.state === 'out' || b.state === 'return' || b.state === 'drop') || b.recalled) return;
    if (b.state === 'out') this.startReturn(b, p);
    b.state = 'return'; b.recalled = true; b.hitter = p;
    this.emit({ type: 'recall', p });
  }

  // Il ritorno ripercorre all'indietro gli stessi rimbalzi dell'andata, poi punta al lanciatore
  startReturn(b, owner) {
    b.state = 'return'; b.t = 0; b.hitter = owner;
    b.ret = b.path ? [...b.path].reverse() : null;
  }

  meleeCheck(p) {
    const fa = Math.atan2(p.fx, p.fz);
    for (const q of this.players) {
      if (!q.alive || q === p || p.meleeHit.has(q) || !this.enemies(p, q) || q.shield > 0) continue;
      const dx = q.x - p.x, dz = q.z - p.z, d = v2len(dx, dz);
      if (d > CFG.MELEE_RANGE + CFG.PLAYER_RADIUS) continue;
      if (Math.abs(angDiff(Math.atan2(dx, dz), fa)) > CFG.MELEE_ARC / 2 && d > CFG.PLAYER_RADIUS * 2) continue;
      p.meleeHit.add(q);
      // scontro di lame: entrambi stanno attaccando uno verso l'altro
      if (q.meleeT > 0 && (q.fx * -dx + q.fz * -dz) / d > 0.3) {
        q.meleeHit.add(p);
        for (const [a, s] of [[p, -1], [q, 1]]) { a.vx = dx / d * 9 * s; a.vz = dz / d * 9 * s; a.pushT = 0.25; }
        this.emit({ type: 'clash', x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 });
        continue;
      }
      this.kill(q, p, 'melee', dx / d, dz / d);
    }
    for (const b of this.booms) {
      if (!b.flying || b.hitter === p || p.meleeHit.has(b)) continue;
      const dx = b.x - p.x, dz = b.z - p.z, d = v2len(dx, dz);
      if (d > CFG.MELEE_RANGE + 0.35) continue;
      if (Math.abs(angDiff(Math.atan2(dx, dz), fa)) > CFG.MELEE_ARC / 2 + 0.3) continue;
      p.meleeHit.add(b);
      b.state = 'out'; b.t = 0; b.hitter = p; b.recalled = false; b.ghost = false;
      b.vx = p.fx * CFG.DEFLECT_SPEED; b.vz = p.fz * CFG.DEFLECT_SPEED;
      b.path = [{ x: b.x, z: b.z }]; b.dist = 0; b.maxDist = 7; b.ret = null;
      this.hitStop = 0.06;
      this.emit({ type: 'deflect', x: b.x, z: b.z, p });
    }
    // casse e barili davanti
    const hx = p.x + p.fx * 0.85, hz = p.z + p.fz * 0.85;
    const [ti, tj] = this.arena.toTile(hx, hz);
    if (!p.meleeHit.has('tile' + ti + ',' + tj)) {
      p.meleeHit.add('tile' + ti + ',' + tj);
      if (this.arena.hitTile(ti, tj, this.events) === 'barrel') this.markBarrel(ti, tj, p);
    }
  }

  markBarrel(i, j, who) { const pr = this.arena.props.get(i + ',' + j); if (pr && pr.type === 'barrel') pr.by = who; }

  stepDashPush() {
    for (const p of this.players) {
      if (!p.alive || p.dashT <= 0) continue;
      for (const q of this.players) {
        if (q === p || !q.alive || p.dashHit.has(q)) continue;
        if (v2len(q.x - p.x, q.z - p.z) < CFG.PLAYER_RADIUS * 2.3) {
          p.dashHit.add(q);
          q.vx = p.dashDx * CFG.DASH_PUSH; q.vz = p.dashDz * CFG.DASH_PUSH; q.pushT = 0.3; q.dashT = 0;
          q.lastPusher = p; q.lastPushTime = this.time;
          p.vx *= 0.3; p.vz *= 0.3; p.dashT = 0;
          this.emit({ type: 'push', x: q.x, z: q.z, p, q });
        }
      }
    }
  }

  separatePlayers() {
    const A = this.alivePlayers(), r2 = CFG.PLAYER_RADIUS * 2;
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      const a = A[i], b = A[j], dx = b.x - a.x, dz = b.z - a.z, d = v2len(dx, dz);
      if (d > 0 && d < r2) { const k = (r2 - d) / 2 / d; a.x -= dx * k; a.z -= dz * k; b.x += dx * k; b.z += dz * k; }
    }
  }

  stepBoom(b, dt) {
    b.spin += dt * (b.flying ? 22 : 0);
    if (b.state === 'held') { if (b.holder) { b.x = b.holder.x; b.z = b.holder.z; } return; }
    if (b.state === 'respawn') {
      b.respawnT -= dt;
      if (b.respawnT <= 0) { const s = this.arena.randomSafePoint(this.alivePlayers(), 2.5); b.x = s.x; b.z = s.z; b.state = 'ground'; b.vx = b.vz = 0; this.emit({ type: 'boomSpawn', x: s.x, z: s.z }); }
      return;
    }
    if (b.state === 'ground') return;
    b.t += dt;
    const owner = b.owner && b.owner.alive ? b.owner : null;
    let sp = b.speed;

    if (b.state === 'out') {
      // andata: linea retta a velocità costante, rimbalzi perfetti sui muri
      this.moveWithBounces(b, dt, true);
      if (b.dist >= b.maxDist) { if (owner) this.startReturn(b, owner); else b.state = 'drop'; }
      this.checkBounds(b, owner);
      return;
    }
    if (b.state === 'return') {
      if (!owner) { b.state = 'drop'; b.ret = null; }
      else {
        if (v2len(owner.x - b.x, owner.z - b.z) < CFG.BOOM_CATCH_DIST) {
          b.state = 'held'; b.holder = owner; b.hitter = owner; b.recalled = false; b.ghost = false; b.vx = b.vz = 0; b.ret = null;
          this.emit({ type: 'catch', p: owner }); return;
        }
        const target = b.recalled ? CFG.BOOM_RECALL_SPEED : CFG.BOOM_RETURN_SPEED;
        sp = Math.max(6, Math.min(target, sp + 40 * dt));
        if (b.ret && b.ret.length) {
          // ripercorre la traiettoria dei rimbalzi
          let left = sp * dt;
          while (left > 0 && b.ret.length) {
            const tg = b.ret[0], dx = tg.x - b.x, dz = tg.z - b.z, d = v2len(dx, dz);
            if (d <= left) { b.x = tg.x; b.z = tg.z; left -= d; b.ret.shift(); if (b.ret.length) this.emit({ type: 'wall', x: b.x, z: b.z, speed: sp * 0.5 }); }
            else { b.vx = dx / d * sp; b.vz = dz / d * sp; b.x += b.vx * left / sp; b.z += b.vz * left / sp; left = 0; }
          }
          return;
        }
        // ultimo tratto: verso il lanciatore
        const dx = owner.x - b.x, dz = owner.z - b.z;
        const cur = Math.atan2(b.vx, b.vz), want = Math.atan2(dx, dz);
        const maxTurn = (8 + b.t * 10) * dt;
        const nd = cur + Math.max(-maxTurn, Math.min(maxTurn, angDiff(want, cur)));
        b.vx = Math.sin(nd) * sp; b.vz = Math.cos(nd) * sp;
        if (b.t > 2.0) b.ghost = true; // attraversa i muri se resta bloccato
        this.moveWithBounces(b, dt, false);
        this.checkBounds(b, owner);
        return;
      }
    }
    if (b.state === 'drop') {
      const ns = Math.max(0, sp - 9 * dt);
      if (sp > 0) { b.vx *= ns / sp; b.vz *= ns / sp; }
      if (ns < 0.8) {
        b.vx = b.vz = 0; b.state = 'ground'; b.ghost = false;
        if (this.arena.isHazardTile(...this.arena.toTile(b.x, b.z))) { b.state = 'respawn'; b.respawnT = 1.5; this.emit({ type: 'boomSink', x: b.x, z: b.z }); }
        return;
      }
      this.moveWithBounces(b, dt, false);
      this.checkBounds(b, owner);
    }
  }

  moveWithBounces(b, dt, record) {
    const sp = b.speed; if (sp < 1e-4) return;
    const n = Math.max(1, Math.ceil(sp * dt / 0.12));
    for (let k = 0; k < n; k++) {
      b.x += b.vx * dt / n; b.z += b.vz * dt / n;
      if (record) b.dist += sp * dt / n;
      if (b.ghost) continue;
      const hit = this.arena.collideCircle(b, CFG.BOOM_RADIUS);
      if (hit) {
        const vn = b.vx * hit.nx + b.vz * hit.nz;
        if (vn < 0) { b.vx -= 2 * vn * hit.nx; b.vz -= 2 * vn * hit.nz; }
        const r = this.arena.hitTile(hit.i, hit.j, this.events);
        if (r === 'barrel') this.markBarrel(hit.i, hit.j, b.hitter);
        if (record && b.path) b.path.push({ x: b.x, z: b.z });
        this.emit({ type: 'wall', x: b.x, z: b.z, speed: sp });
      }
    }
  }

  checkBounds(b, owner) {
    if (Math.abs(b.x) > this.arena.W / 2 + 2 || Math.abs(b.z) > this.arena.H / 2 + 2) {
      if (owner) { b.state = 'return'; b.ret = null; b.ghost = true; b.hitter = owner; } else { b.state = 'respawn'; b.respawnT = 1; }
    }
  }

  boomBoomCollisions() {
    const F = this.booms.filter(b => b.flying);
    for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) {
      const a = F[i], b = F[j], dx = b.x - a.x, dz = b.z - a.z, d = v2len(dx, dz);
      if (d > CFG.BOOM_RADIUS * 2.2 || d === 0) continue;
      const nx = dx / d, nz = dz / d;
      const va = a.vx * nx + a.vz * nz, vb = b.vx * nx + b.vz * nz;
      if (va - vb <= 0) continue;
      a.vx += (vb - va) * nx * 1.1; a.vz += (vb - va) * nz * 1.1;
      b.vx += (va - vb) * nx * 1.1; b.vz += (va - vb) * nz * 1.1;
      for (const x of [a, b]) { if (x.state === 'out' && x.path) x.path.push({ x: x.x, z: x.z }); if (x.state === 'return') x.ret = null; }
      this.emit({ type: 'clang', x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
    }
  }

  boomPlayerHits() {
    for (const b of this.booms) {
      if (!b.flying || !b.hitter || b.speed < CFG.BOOM_KILL_MIN_SPEED) continue;
      for (const p of this.players) {
        if (!p.alive || p === b.hitter || p.shield > 0) continue;
        if (b.hitter && !this.enemies(b.hitter, p)) continue;
        if (v2len(p.x - b.x, p.z - b.z) < CFG.PLAYER_RADIUS + CFG.BOOM_RADIUS) {
          const s = b.speed || 1;
          this.kill(p, b.hitter, 'boomerang', b.vx / s, b.vz / s);
        }
      }
    }
  }

  explode(x, z, by = null) {
    const R = CFG.BARREL_RADIUS;
    for (const p of this.players) {
      if (!p.alive) continue;
      const d = v2len(p.x - x, p.z - z);
      if (d < R) this.kill(p, by, 'explosion', (p.x - x) / (d || 1), (p.z - z) / (d || 1));
    }
    const [ci, cj] = this.arena.toTile(x, z);
    for (let j = cj - 2; j <= cj + 2; j++) for (let i = ci - 2; i <= ci + 2; i++) {
      const c = this.arena.center(i, j);
      if (v2len(c.x - x, c.z - z) < R + 0.3 && this.arena.hitTile(i, j, this.events) === 'barrel') this.markBarrel(i, j, by);
    }
    for (const b of this.booms) if (b.state === 'ground' && v2len(b.x - x, b.z - z) < R) { b.vx = (b.x - x) * 4; b.vz = (b.z - z) * 4; b.state = 'drop'; }
    this.hitStop = 0.08;
    this.emit({ type: 'explode', x, z });
  }

  kill(p, killer, cause, dx = 0, dz = 0) {
    if (!p.alive) return;
    p.alive = false; p.chargeT = -1; p.meleeT = 0; p.dashT = 0;
    p.death = { cause, t: 0, dx, dz, x: p.x, z: p.z };
    if (p.boom && p.boom.state === 'held' && p.boom.holder === p) {
      const b = p.boom; b.holder = null; b.state = 'drop'; b.vx = dx * 3 + (Math.random() - 0.5) * 3; b.vz = dz * 3 + (Math.random() - 0.5) * 3;
      if (!b.vx && !b.vz) b.vx = 2;
      b.owner = null; b.hitter = null;
    } else if (p.boom && p.boom.owner === p) { p.boom.owner = null; }
    if (cause !== 'water' && cause !== 'lava' && cause !== 'void') this.hitStop = Math.max(this.hitStop, 0.07);
    this.emit({ type: 'kill', p, killer: killer && killer !== p ? killer : null, cause, x: p.x, z: p.z });
  }

  // ---------------- GRAFICA ----------------
  updateView(dt, showAim) {
    const T = this.time;
    for (const p of this.players) this.animatePlayer(p, dt, T, showAim);
    for (const b of this.booms) {
      const m = b.mesh;
      if (b.state === 'held') {
        const h = b.holder;
        if (!h || !h.alive) { m.visible = false; continue; }
        m.visible = true;
        const hand = h.rig.handR;
        hand.updateWorldMatrix(true, false);
        const wp = new THREE.Vector3(0, 0.05, 0.12).applyMatrix4(hand.matrixWorld);
        m.position.copy(wp);
        m.rotation.set(-0.3 + (h.chargeT >= 0 ? -0.6 : 0), Math.atan2(h.fx, h.fz) + Math.PI / 2, h.meleeT > 0 ? 1.2 : 0.2);
        m.scale.setScalar(0.75);
      } else if (b.state === 'respawn') {
        m.visible = false;
      } else {
        m.visible = true;
        m.scale.setScalar(b.state === 'ground' ? 0.85 + Math.sin(T * 5) * 0.05 : 0.9);
        const y = b.state === 'ground' ? 0.12 + Math.abs(Math.sin(T * 3)) * 0.12 : 0.55;
        m.position.set(b.x, y, b.z);
        m.rotation.set(b.state === 'ground' ? 0.25 : 0, b.spin, 0);
        if (b.flying && b.speed > 5) this.fx.trail(b.x, 0.55, b.z, b.hitter ? b.hitter.color : 0xffffff, 0.1);
        if (b.ghost) m.rotation.x = Math.sin(T * 20) * 0.2;
      }
    }
    for (let i = this.splats.length - 1; i >= 0; i--) {
      const s = this.splats[i]; s.t += dt;
      s.mesh.material.opacity = Math.max(0, 0.75 - s.t * 0.12);
      if (s.t > 6) { this.scene.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.dispose(); this.splats.splice(i, 1); }
    }
  }

  animatePlayer(p, dt, T, showAim) {
    const R = p.rig;
    if (!p.alive) {
      if (p.aimGroup) p.aimGroup.visible = false;
      p.ring.visible = false;
      const d = p.death; d.t += dt;
      if (d.cause === 'water' || d.cause === 'lava') {
        R.root.position.y = -d.t * 1.6; R.root.rotation.z = Math.sin(d.t * 20) * 0.2;
        R.root.visible = d.t < 0.7;
        if (d.cause === 'lava') for (const m of R.mats) if (m.color) m.color.lerp(new THREE.Color(0x221111), Math.min(1, dt * 6));
      } else if (d.cause === 'void') {
        R.root.position.y = -d.t * d.t * 9; R.root.scale.setScalar(Math.max(0.01, 1 - d.t * 0.8)); R.root.visible = d.t < 1.2;
      } else {
        R.root.visible = false;
      }
      return;
    }
    R.root.visible = true;
    R.root.position.set(p.x, 0, p.z);
    const targetYaw = Math.atan2(p.fx, p.fz);
    const yaw = R.root.rotation.y + angDiff(targetYaw, R.root.rotation.y) * Math.min(1, dt * 22);
    R.root.rotation.y = yaw;
    p.ring.visible = true; p.ring.position.set(p.x, 0.02, p.z);
    p.ring.material.opacity = p.shield > 0 ? 0.4 + Math.sin(T * 30) * 0.4 : 0.9;

    const moving = p.speedNow > 0.6 && p.dashT <= 0;
    if (moving) p.runPhase += dt * (8 + p.speedNow * 1.6);
    const ph = p.runPhase;
    let bob = 0, lean = 0, sx = 1, sy = 1, sz = 1, spin = 0;
    if (p.victory) {
      const j = Math.abs(Math.sin(T * 6)); bob = j * 0.45; sy = 1 + (1 - j) * -0.15 + j * 0.08; spin = T * 4;
      R.handL.position.y = R.handR.position.y = 0.9 + Math.sin(T * 12) * 0.08;
    } else {
      if (moving) { bob = Math.abs(Math.sin(ph)) * 0.08; lean = 0.14; }
      else { bob = Math.sin(T * 3 + p.slot) * 0.015; sy = 1 + Math.sin(T * 3 + p.slot) * 0.02; }
      if (p.dashT > 0) { sz = 1.35; sy = 0.78; sx = 0.85; lean = 0.35; }
      if (p.chargeT >= 0) { const c = Math.min(1, p.chargeT / CFG.CHARGE_TIME); lean = -0.15 * c; sy *= 1 - 0.08 * c; sx *= 1 + 0.06 * c; }
      if (p.throwAnim > 0) { lean = 0.25 * (p.throwAnim / 0.22); }
      if (p.meleeT > 0) spin = (1 - p.meleeT / CFG.MELEE_TIME) * Math.PI * 2;
      if (R.float) bob += 0.12 + Math.sin(T * 4 + p.slot) * 0.06;
    }
    R.pivot.position.y = bob;
    R.pivot.rotation.set(lean, spin, moving ? Math.sin(ph) * 0.06 : 0);
    R.pivot.scale.set(sx, sy, sz);
    if (R.feet.length) {
      const fz = moving ? Math.sin(ph) * 0.16 : 0, fy = moving ? Math.max(0, Math.cos(ph)) * 0.08 : 0;
      R.feet[0].position.z = 0.03 + fz; R.feet[0].position.y = 0.06 + fy;
      R.feet[1].position.z = 0.03 - fz; R.feet[1].position.y = 0.06 + (moving ? Math.max(0, -Math.cos(ph)) * 0.08 : 0);
    }
    if (!p.victory) {
      const base = R.handR.userData.base || (R.handR.userData.base = R.handR.position.clone());
      const baseL = R.handL.userData.base || (R.handL.userData.base = R.handL.position.clone());
      const swing = moving ? Math.sin(ph) * 0.12 : 0;
      R.handL.position.set(baseL.x, baseL.y + (moving ? Math.cos(ph) * 0.03 : 0), baseL.z - swing);
      let hz = base.z + swing, hy = base.y;
      if (p.chargeT >= 0) { hz = base.z - 0.35; hy = base.y + 0.15; }
      if (p.throwAnim > 0) { hz = base.z + 0.3; hy = base.y + 0.1; }
      if (p.meleeT > 0) { hz = base.z + 0.35; }
      R.handR.position.set(base.x, hy, hz);
    }
    // battito di ciglia
    p.blink -= dt;
    R.face.scale.y = p.blink < 0.1 ? 0.15 : 1;
    if (p.blink < 0) p.blink = 2 + Math.random() * 3.5;
    // trasparenza nei cespugli
    const alpha = p.inBush ? 0.35 : 1;
    for (const m of R.mats) {
      const base = m.userData.baseOpacity ?? 1, target = base * alpha;
      if (Math.abs(m.opacity - target) > 0.01) { m.transparent = target < 1 || base < 1; m.opacity += (target - m.opacity) * Math.min(1, dt * 10); }
    }
    // anteprima della traiettoria (sempre visibile mentre si tiene il boomerang)
    if (p.aimGroup) {
      const vis = showAim && p.holding && p.alive;
      p.aimGroup.visible = vis;
      if (vis) {
        const c = p.chargeT >= 0 ? Math.min(1, p.chargeT / CFG.CHARGE_TIME) : 0;
        const { pts, bounces } = this.predictPath(p.x, p.z, p.fx, p.fz, throwRange(c));
        const dots = p.aimGroup.children, nDots = 34, every = Math.max(1, Math.floor(pts.length / nDots));
        const alpha = p.chargeT >= 0 ? 1 : 0.45;
        dots[0].material.opacity = 0.9 * alpha;
        for (let i = 0; i < nDots; i++) {
          const q = pts[3 + i * every]; const d = dots[i];
          if (!q) { d.visible = false; continue; }
          d.visible = true; d.position.set(q.x, 0.03, q.z);
          d.scale.setScalar(p.chargeT >= 0 ? 1.15 - i / nDots * 0.4 : 0.8);
        }
        p.bounceDots.forEach((r, i) => { const q = bounces[i]; r.visible = !!q && p.chargeT >= 0; if (q) r.position.set(q.x, 0.035, q.z); });
      }
    }
    if (p.dashT > 0) this.fx.puff(p.x - p.fx * 0.2, 0.2, p.z - p.fz * 0.2, 0xffffff, 1, 0.22);
    if (p.onIce && p.speedNow > 3 && Math.random() < 0.3) this.fx.trail(p.x, 0.05, p.z, 0xffffff, 0.08);
  }

  // effetto grafico dell'eliminazione per colpo
  spawnDeathFx(p) {
    const d = p.death, c = p.rig.def.color;
    const juice = [c, new THREE.Color(c).lerp(new THREE.Color(0xffffff), 0.4).getHex(), 0xffffff];
    if (d.cause === 'water') { this.fx.burst(p.x, 0, p.z, { n: 26, colors: [0xffffff, 0x9be7ff, 0x4fc3f7], speed: 3, up: 7, size: 0.13, life: 0.8, floor: -0.2 }); return; }
    if (d.cause === 'lava') { this.fx.burst(p.x, 0, p.z, { n: 20, colors: [0xffd23f, 0xff6a1a, 0xff3300], speed: 2.5, up: 6, size: 0.12, life: 0.7, pool: 'glow', floor: -0.2 }); this.fx.puff(p.x, 0.3, p.z, 0x555555, 8, 0.5); return; }
    if (d.cause === 'void') return;
    this.sliceCharacter(p);
    // lampo del taglio
    let hx = d.dx, hz = d.dz; if (!hx && !hz) { hx = p.fx; hz = p.fz; }
    const slash = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false }));
    slash.position.set(p.x, 0.65, p.z); slash.rotation.set(-Math.PI / 2, 0, -Math.atan2(hz, hx)); slash.rotateX(0.5);
    this.scene.add(slash); this.flashes = this.flashes || []; this.flashes.push({ mesh: slash, t: 0 });
    this.fx.burst(p.x, 0.6, p.z, { n: 34, colors: juice, speed: 5.5, up: 6, size: 0.12, life: 0.9 });
    this.fx.puff(p.x, 0.5, p.z, 0xffffff, 6, 0.4);
    const splat = new THREE.Mesh(new THREE.CircleGeometry(0.6 + Math.random() * 0.25, 9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.75, depthWrite: false }));
    splat.position.set(p.x + hx * 0.3, 0.015, p.z + hz * 0.3); splat.rotation.y = Math.random() * 6;
    this.scene.add(splat); this.splats.push({ mesh: splat, t: 0 });
  }

  // Taglia il personaggio in due metà vere con piani di sezione: l'interno mostra la "polpa"
  sliceCharacter(p) {
    const d = p.death;
    let hx = d.dx, hz = d.dz; if (!hx && !hz) { hx = p.fx; hz = p.fz; }
    const hl = Math.hypot(hx, hz) || 1; hx /= hl; hz /= hl;
    // il piano contiene la direzione del colpo ed è leggermente inclinato (taglio in diagonale)
    const n = new THREE.Vector3(-hz, 0.45 * (Math.random() < 0.5 ? 1 : -1), hx).normalize();
    const center = new THREE.Vector3(p.x, 0.55, p.z);
    const flesh = new THREE.Color(p.rig.def.color).lerp(new THREE.Color(0xfff6e0), 0.55);
    this.halves = this.halves || [];
    for (const side of [1, -1]) {
      const rig = buildCharacter(p.cfg.charId);
      rig.root.scale.setScalar(CHAR_SCALE);
      rig.root.position.copy(p.rig.root.position); rig.root.position.y = 0;
      rig.root.rotation.y = p.rig.root.rotation.y;
      rig.pivot.position.copy(p.rig.pivot.position); rig.pivot.rotation.copy(p.rig.pivot.rotation); rig.pivot.scale.copy(p.rig.pivot.scale);
      this.scene.add(rig.root);
      rig.root.updateMatrixWorld(true);
      const nn = n.clone().multiplyScalar(side);
      const worldPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(nn, center);
      const inv = rig.root.matrixWorld.clone().invert();
      const localPlane = worldPlane.clone().applyMatrix4(inv);
      const plane = worldPlane.clone();
      for (const m of rig.mats) {
        m.clippingPlanes = [plane];
        if (m.side === THREE.BackSide) continue; // contorno
        m.side = THREE.DoubleSide;
        m.onBeforeCompile = sh => {
          sh.uniforms.fleshColor = { value: flesh };
          sh.fragmentShader = 'uniform vec3 fleshColor;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n if (!gl_FrontFacing) gl_FragColor.rgb = fleshColor;');
        };
        m.customProgramCacheKey = () => 'slice';
        m.needsUpdate = true;
      }
      // la metà scivola via e si ribalta mostrando la sezione verso l'alto
      const qT = new THREE.Quaternion().setFromUnitVectors(nn.clone().negate(), new THREE.Vector3(0, 1, 0));
      this.halves.push({
        rig, plane, localPlane, t: 0, qT, q0: rig.root.quaternion.clone(),
        off: center.clone().sub(rig.root.position),
        vx: nn.x * 2.2 + hx * 0.8, vz: nn.z * 2.2 + hz * 0.8, hy: 0, vy: 2.4,
      });
    }
  }

  updateDebris(dt) {
    for (const h of this.halves || []) {
      h.t += dt;
      const r = h.rig.root;
      const fr = Math.max(0, 1 - dt * 3.5);
      h.vx *= fr; h.vz *= fr;
      r.position.x += h.vx * dt; r.position.z += h.vz * dt;
      h.vy -= 16 * dt; h.hy += h.vy * dt;
      if (h.hy < 0) { h.hy = 0; h.vy = Math.abs(h.vy) > 1.5 ? -h.vy * 0.3 : 0; }
      let k = Math.min(1, h.t / 0.45); k = 1 - Math.pow(1 - k, 3);
      const qr = new THREE.Quaternion().slerp(h.qT, k);
      r.quaternion.copy(h.q0).premultiply(qr);
      const off = h.off.clone().applyQuaternion(qr);
      const cutH = 0.55 * (1 - k) + 0.4 * k;
      r.position.y = h.hy + cutH - off.y - (h.t > 2.6 ? (h.t - 2.6) * 1.2 : 0);
      r.updateMatrixWorld(true);
      h.plane.copy(h.localPlane).applyMatrix4(r.matrixWorld);
    }
    if (this.halves) this.halves = this.halves.filter(h => { if (h.t > 3.4) { this.scene.remove(h.rig.root); return false; } return true; });
    for (const f of this.flashes || []) { f.t += dt; f.mesh.material.opacity = Math.max(0, 1 - f.t * 5); f.mesh.scale.x = 1 + f.t * 3; }
    if (this.flashes) this.flashes = this.flashes.filter(f => { if (f.t > 0.25) { this.scene.remove(f.mesh); f.mesh.geometry.dispose(); f.mesh.material.dispose(); return false; } return true; });
  }

  dispose() {
    this.arena.dispose();
    for (const p of this.players) { this.scene.remove(p.rig.root); this.scene.remove(p.ring); if (p.aimGroup) this.scene.remove(p.aimGroup); }
    for (const b of this.booms) this.scene.remove(b.mesh);
    for (const s of this.splats) this.scene.remove(s.mesh);
    for (const h of this.halves || []) this.scene.remove(h.rig.root);
    for (const f of this.flashes || []) this.scene.remove(f.mesh);
  }
}

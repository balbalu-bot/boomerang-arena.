// Intelligenza artificiale dei bot. Produce lo stesso "intento" di un giocatore umano.

import { CFG, BOT_LEVELS } from '../core/config.js';

const len = (x, z) => Math.hypot(x, z);
const rnd = (a, b) => a + Math.random() * (b - a);

export class BotBrain {
  constructor(player, level = 'normale') {
    this.p = player;
    this.L = BOT_LEVELS[level] || BOT_LEVELS.normale;
    this.path = []; this.pathGoal = null; this.pathT = 0;
    this.throwCd = rnd(0.6, 1.4); this.charging = false; this.chargeGoal = 0;
    this.meleeCd = 0; this.dashCd = 0;
    this.threats = new Map();  // id boomerang → tempo in cui è stato notato
    this.decided = new Set();
    this.strafe = Math.random() < 0.5 ? 1 : -1; this.strafeT = rnd(0.5, 1.5);
    this.recallAt = 0; this.react = rnd(0.5, 1.1);
    this.memory = new Map();   // ultimo punto in cui ha visto ogni avversario
  }

  think(world, dt) {
    const it = this.decide(world, dt);
    return this.p.alive ? this.sanitize(world, it) : it;
  }

  // Filtro di sicurezza: evita che il bot entri da solo in acqua, lava o nel vuoto
  sanitize(world, it) {
    const A = world.arena, p = this.p;
    const pathSafe = (dx, dz, dist) => {
      for (let d = 0.3; d <= dist; d += 0.3) if (!this.safeAt(A, p.x + dx * d, p.z + dz * d)) return false;
      return true;
    };
    if (it.dash) {
      const ml = len(it.mx, it.mz); const dx = ml > 0.2 ? it.mx / ml : p.fx, dz = ml > 0.2 ? it.mz / ml : p.fz;
      if (!pathSafe(dx, dz, CFG.DASH_SPEED * CFG.DASH_TIME + (p.onIce || A.at(p.x + dx * 2.5, p.z + dz * 2.5) === 8 ? 3 : 0.9))) it.dash = false;
    }
    const ml = len(it.mx, it.mz);
    if (ml > 0.05) {
      const look = p.onIce ? 1.6 : 0.8;
      const base = Math.atan2(it.mx / ml, it.mz / ml);
      let ok = false;
      for (const off of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9]) {
        const a = base + off * this.strafe, dx = Math.sin(a), dz = Math.cos(a);
        if (pathSafe(dx, dz, look)) { it.mx = dx * ml; it.mz = dz * ml; ok = true; break; }
      }
      if (!ok) { it.mx = 0; it.mz = 0; }
    }
    // in scivolata verso un pericolo: frena contro-sterzando
    const sp = len(p.vx, p.vz);
    if (sp > 1.5 && !pathSafe(p.vx / sp, p.vz / sp, Math.min(2.5, sp * (p.onIce ? 0.45 : 0.15)))) {
      it.mx = -p.vx / sp; it.mz = -p.vz / sp; it.dash = false;
    }
    return it;
  }

  decide(world, dt) {
    const p = this.p, it = { mx: 0, mz: 0, ax: 0, az: 0, hasAim: false, throwHeld: false, melee: false, dash: false };
    if (!p.alive) return it;
    const A = world.arena, L = this.L;
    this.throwCd -= dt; this.meleeCd -= dt; this.dashCd -= dt; this.pathT -= dt; this.strafeT -= dt;
    if (this.react > 0) { this.react -= dt; return it; }           // esitazione iniziale del round
    if (this.strafeT < 0) { this.strafe *= -1; this.strafeT = rnd(0.4, 1.6); }

    const enemies = world.players.filter(q => q.alive && world.enemies(p, q));
    // percezione: i nemici nei cespugli sono visibili solo da vicino
    const visible = enemies.filter(q => !q.inBush || len(q.x - p.x, q.z - p.z) < 2.4);
    for (const q of visible) this.memory.set(q.id, { x: q.x, z: q.z, t: world.time });

    // ---- 1. schivata ----
    let dodging = false;
    for (const b of world.booms) {
      if (!b.flying || !b.hitter || b.hitter === p || !world.enemies(b.hitter, p) || b.speed < CFG.BOOM_KILL_MIN_SPEED) { this.threats.delete(b.id); continue; }
      const rx = p.x - b.x, rz = p.z - b.z, vx = b.vx, vz = b.vz, vv = vx * vx + vz * vz;
      const tca = Math.max(0, Math.min(0.65, (rx * vx + rz * vz) / vv));
      const miss = len(rx - vx * tca, rz - vz * tca);
      if (miss > 0.85 || (rx * vx + rz * vz) < 0) { this.threats.delete(b.id); this.decided.delete(b.id); continue; }
      if (!this.threats.has(b.id)) this.threats.set(b.id, world.time);
      if (world.time - this.threats.get(b.id) < L.reaction * 0.7) continue;
      dodging = true;
      if (!this.decided.has(b.id)) {
        this.decided.add(b.id);
        if (Math.random() > L.dodge) continue;     // il bot non se ne accorge
        const d = len(rx, rz);
        if (p.holding && d < 2.0 && Math.random() < L.deflect) {
          it.ax = -rx; it.az = -rz; it.hasAim = true; it.melee = true; return it;
        }
        // scatto perpendicolare verso il lato sicuro
        const s = Math.hypot(vx, vz), px = -vz / s, pz = vx / s;
        const side = this.safeAt(A, p.x + px * 1.8, p.z + pz * 1.8) ? 1 : this.safeAt(A, p.x - px * 1.8, p.z - pz * 1.8) ? -1 : 0;
        if (side) { it.mx = px * side; it.mz = pz * side; if (this.dashCd <= 0 && d < 3.5) { it.dash = true; this.dashCd = 0.8; } return it; }
      } else {
        const s = Math.hypot(vx, vz), px = -vz / s, pz = vx / s;
        const side = this.safeAt(A, p.x + px, p.z + pz) ? 1 : -1;
        it.mx = px * side; it.mz = pz * side;
      }
    }

    // ---- 2. disarmato ----
    if (!p.holding) {
      this.charging = false;
      const mine = p.boom && p.boom.owner === p && p.boom.flying ? p.boom : null;
      if (mine) {
        // richiamo intelligente: se un nemico è vicino alla traiettoria di ritorno
        if (!mine.recalled) {
          let should = mine.t > this.recallAt;
          for (const q of visible) {
            const ax = mine.x - p.x, az = mine.z - p.z, al = len(ax, az) || 1;
            const qx = q.x - p.x, qz = q.z - p.z;
            const proj = (qx * ax + qz * az) / al, perp = Math.abs(qx * az - qz * ax) / al;
            if (proj > 0 && proj < al && perp < 0.8 && Math.random() < L.lead) should = true;
          }
          if (should) it.melee = true;
        }
        if (!dodging) this.kite(world, it, visible);
        return it;
      }
      // cerca un boomerang a terra
      let best = null, bd = 1e9;
      for (const b of world.booms) if (b.state === 'ground') { const d = len(b.x - p.x, b.z - p.z); if (d < bd) { bd = d; best = b; } }
      if (best && !dodging) this.goTo(world, it, best.x, best.z);
      else if (!dodging) this.kite(world, it, visible);
      return it;
    }

    // ---- 3. armato ----
    let target = null, td = 1e9;
    for (const q of visible) { const d = len(q.x - p.x, q.z - p.z); if (d < td) { td = d; target = q; } }
    if (!target) {
      // vai verso l'ultima posizione nota o pattuglia
      let mem = null; for (const m of this.memory.values()) if (!mem || m.t > mem.t) mem = m;
      if (!dodging) { if (mem) this.goTo(world, it, mem.x, mem.z); else this.wander(world, it); }
      return it;
    }
    const dx = target.x - p.x, dz = target.z - p.z;
    const los = A.lineOfSight(p.x, p.z, target.x, target.z);

    // corpo a corpo da vicino
    if (td < CFG.MELEE_RANGE + 0.25 && this.meleeCd <= 0) {
      it.ax = dx; it.az = dz; it.hasAim = true; it.melee = true; this.meleeCd = rnd(0.35, 0.7) + L.reaction; this.charging = false;
      return it;
    }
    // spinta nel pericolo
    if (td < 2.6 && this.dashCd <= 0 && Math.random() < L.push * dt * 6 && this.nearHazard(A, target.x, target.z) && los) {
      it.mx = dx / td; it.mz = dz / td; it.dash = true; this.dashCd = 1.2; return it;
    }

    if (los && td < 11) {
      // mira con anticipo e un errore che dipende dal livello
      const sp = CFG.THROW_MIN + (CFG.THROW_MAX - CFG.THROW_MIN) * this.chargeGoal;
      const tt = td / sp * L.lead;
      let ax = dx + target.vx * tt, az = dz + target.vz * tt;
      const ang = Math.atan2(ax, az) + (Math.sin(world.time * 3.1 + p.slot) * 0.6 + (Math.random() - 0.5)) * L.aimError;
      it.ax = Math.sin(ang); it.az = Math.cos(ang); it.hasAim = true;
      if (!this.charging && this.throwCd <= 0) { this.charging = true; this.chargeGoal = Math.max(0, Math.min(1, (td + 1 - CFG.RANGE_MIN) / (CFG.RANGE_MAX - CFG.RANGE_MIN) + rnd(-0.05, 0.15))); }
      if (this.charging) {
        if (p.chargeT >= 0 && p.chargeT >= this.chargeGoal * CFG.CHARGE_TIME) {
          this.charging = false; it.throwHeld = false;
          this.throwCd = rnd(0.5, 1.4) / L.aggression; this.recallAt = rnd(0.6, 1.3);
        } else it.throwHeld = true;
      }
      if (!dodging) {
        // mantieni una distanza utile e muoviti di lato per non essere prevedibile
        const want = 3.5 + (1 - L.aggression) * 3;
        const k = td > want + 1 ? 1 : td < want - 1 ? -1 : 0;
        const ux = dx / td, uz = dz / td;
        let mx = ux * k + -uz * this.strafe * 0.8, mz = uz * k + ux * this.strafe * 0.8;
        const ml = len(mx, mz) || 1; mx /= ml; mz /= ml;
        if (this.safeAt(A, p.x + mx * 0.9, p.z + mz * 0.9) && !A.isSolidTile(...A.toTile(p.x + mx * 0.6, p.z + mz * 0.6))) { it.mx = mx; it.mz = mz; }
        else { this.strafe *= -1; }
      }
    } else if (!dodging) {
      // tiro di sponda: cerca un angolo che arrivi al bersaglio rimbalzando sui muri
      if (L.lead >= 0.8 && td < 10) {
        this.bankT = (this.bankT || 0) - dt;
        if (this.bankT <= 0 && !(this.bank && this.bank.t > 0)) {
          this.bankT = 0.6; this.bank = null;
          for (let a = 0; a < Math.PI * 2 && !this.bank; a += Math.PI / 18) {
            const { pts } = world.predictPath(p.x, p.z, Math.sin(a), Math.cos(a), CFG.RANGE_MAX);
            if (pts.some((q, i) => i > 15 && len(q.x - target.x, q.z - target.z) < 0.6)) this.bank = { a, t: 0 };
          }
        }
        if (this.bank && this.throwCd <= 0) {
          it.ax = Math.sin(this.bank.a); it.az = Math.cos(this.bank.a); it.hasAim = true;
          this.bank.t += dt;
          if (this.bank.t < CFG.CHARGE_TIME + 0.05) { it.throwHeld = true; return it; }
          this.bank = null; this.throwCd = rnd(0.8, 1.6) / L.aggression; this.recallAt = rnd(0.4, 0.9);
          return it;
        }
      }
      this.charging = false;
      this.goTo(world, it, target.x, target.z);
    }
    return it;
  }

  safeAt(A, x, z) {
    const [i, j] = A.toTile(x, z);
    return A.isWalkable(i, j);
  }

  nearHazard(A, x, z) {
    const [i, j] = A.toTile(x, z);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (A.isHazardTile(i + di, j + dj)) return true;
    return false;
  }

  kite(world, it, visible) {
    const p = this.p;
    let ex = 0, ez = 0;
    for (const q of visible) { const dx = p.x - q.x, dz = p.z - q.z, d = len(dx, dz) || 1; if (d < 5) { ex += dx / d / d; ez += dz / d / d; } }
    if (len(ex, ez) > 0.01) {
      const l = len(ex, ez); let mx = ex / l, mz = ez / l;
      if (!this.safeAt(world.arena, p.x + mx, p.z + mz)) { const t = mx; mx = -mz * this.strafe; mz = t * this.strafe; }
      if (this.safeAt(world.arena, p.x + mx, p.z + mz)) { it.mx = mx; it.mz = mz; }
    }
  }

  wander(world, it) {
    if (!this.wanderPt || len(this.wanderPt.x - this.p.x, this.wanderPt.z - this.p.z) < 0.8) this.wanderPt = world.arena.randomSafePoint();
    this.goTo(world, it, this.wanderPt.x, this.wanderPt.z);
  }

  goTo(world, it, gx, gz) {
    const A = world.arena, p = this.p;
    const [gi, gj] = A.toTile(gx, gz);
    const goalKey = gi + ',' + gj;
    if (this.pathT <= 0 || this.pathGoal !== goalKey || !this.path.length) {
      this.path = bfs(A, ...A.toTile(p.x, p.z), gi, gj); this.pathGoal = goalKey; this.pathT = 0.4;
    }
    while (this.path.length && len(this.path[0].x - p.x, this.path[0].z - p.z) < 0.35) this.path.shift();
    const next = this.path[0] || { x: gx, z: gz };
    const dx = next.x - p.x, dz = next.z - p.z, d = len(dx, dz);
    if (d > 0.05) { it.mx = dx / d; it.mz = dz / d; }
    if (!it.hasAim) { it.ax = it.mx; it.az = it.mz; it.hasAim = d > 0.05; }
  }
}

function bfs(A, si, sj, gi, gj) {
  const W = A.W, H = A.H, N = W * H;
  const prev = new Int32Array(N).fill(-1);
  const start = sj * W + si, goal = gj * W + gi;
  if (si < 0 || sj < 0 || si >= W || sj >= H) return [];
  const q = [start]; prev[start] = start;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let found = -1;
  for (let h = 0; h < q.length; h++) {
    const c = q[h]; if (c === goal) { found = c; break; }
    const ci = c % W, cj = (c / W) | 0;
    for (const [di, dj] of dirs) {
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const n = nj * W + ni;
      if (prev[n] !== -1 || !A.isWalkable(ni, nj)) continue;
      if (di && dj && (!A.isWalkable(ci + di, cj) || !A.isWalkable(ci, cj + dj))) continue;
      prev[n] = c; q.push(n);
    }
  }
  if (found < 0) return [];
  const path = [];
  for (let c = found; c !== start; c = prev[c]) path.push(A.center(c % W, (c / W) | 0));
  return path.reverse();
}

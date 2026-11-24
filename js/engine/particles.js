// Sistema particellare a istanze: un solo draw call per tipo di forma.

import * as THREE from 'three';

const MAX = 900;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
const _c = new THREE.Color();

class Pool {
  constructor(scene, geo, mat) {
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < MAX; i++) this.mesh.setColorAt(i, _c.set(0xffffff));
    scene.add(this.mesh);
    this.list = [];
  }
  add(p) { if (this.list.length < MAX) this.list.push(p); }
  update(dt) {
    const L = this.list;
    let n = 0;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) { L[i] = L[L.length - 1]; L.pop(); continue; }
    }
    for (const p of L) {
      p.vy -= p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.floor !== undefined && p.y < p.floor) { p.y = p.floor; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
      p.vx *= 1 - p.drag * dt; p.vz *= 1 - p.drag * dt;
      p.rx += p.spin * dt; p.ry += p.spin * 0.7 * dt;
      const k = p.life / p.max;
      const sc = p.size * (p.shrink ? Math.max(0.05, k) : p.grow ? 1 + (1 - k) * p.grow : 1);
      _p.set(p.x, p.y, p.z); _q.setFromEuler(_e.set(p.rx, p.ry, 0)); _s.set(sc, sc * (p.flat ? 0.15 : 1), sc);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(n, _m);
      this.mesh.setColorAt(n, _c.setHex(p.color));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  clear() { this.list.length = 0; this.mesh.count = 0; }
}

export class Particles {
  constructor(scene) {
    this.budget = 1;
    this.solid = new Pool(scene, new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    this.glow = new Pool(scene, new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
    this.cube = new Pool(scene, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  }

  _n(n) { return Math.max(1, Math.round(n * this.budget)); }

  spawn(pool, o) {
    pool.add({
      x: o.x, y: o.y ?? 0.4, z: o.z, vx: o.vx ?? 0, vy: o.vy ?? 0, vz: o.vz ?? 0,
      g: o.g ?? 12, drag: o.drag ?? 1, life: o.life ?? 0.6, max: o.life ?? 0.6,
      size: o.size ?? 0.15, color: o.color ?? 0xffffff, spin: o.spin ?? 6,
      rx: Math.random() * 6, ry: Math.random() * 6, shrink: o.shrink ?? true, grow: o.grow, flat: o.flat, floor: o.floor,
    });
  }

  burst(x, y, z, { n = 12, color = 0xffffff, colors, speed = 5, up = 4, size = 0.14, life = 0.7, g = 14, pool = 'solid', floor = 0.05, drag = 1, flat } = {}) {
    const P = this[pool];
    for (let i = 0, N = this._n(n); i < N; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.65);
      this.spawn(P, {
        x, y, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: up * (0.4 + Math.random() * 0.8),
        g, life: life * (0.6 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8),
        color: colors ? colors[i % colors.length] : color, floor, drag, flat,
      });
    }
  }

  puff(x, y, z, color = 0xffffff, n = 6, size = 0.3) {
    for (let i = 0, N = this._n(n); i < N; i++) {
      this.spawn(this.glow, {
        x: x + (Math.random() - 0.5) * 0.3, y, z: z + (Math.random() - 0.5) * 0.3,
        vx: (Math.random() - 0.5) * 1.5, vy: 0.6 + Math.random(), vz: (Math.random() - 0.5) * 1.5,
        g: -0.5, life: 0.45 + Math.random() * 0.3, size: size * (0.7 + Math.random() * 0.6), color, grow: 0.8, shrink: false, drag: 2,
      });
    }
  }

  trail(x, y, z, color, size = 0.12) {
    if (Math.random() > this.budget) return;
    this.spawn(this.glow, { x, y, z, g: 0, life: 0.22, size, color, spin: 0 });
  }

  explosion(x, z, radius) {
    this.burst(x, 0.5, z, { n: 40, colors: [0xffe066, 0xff9f1c, 0xff4d00, 0xffffff], speed: radius * 4, up: 6, size: 0.3, life: 0.8, pool: 'glow', g: 4, drag: 3 });
    this.burst(x, 0.5, z, { n: 18, colors: [0x444444, 0x666666, 0x222222], speed: radius * 3, up: 7, size: 0.22, life: 1.1, pool: 'cube' });
    for (let i = 0; i < this._n(10); i++) this.puff(x + (Math.random() - 0.5) * radius, 0.4, z + (Math.random() - 0.5) * radius, 0x9a9a9a, 1, 0.7);
  }

  update(dt) { this.solid.update(dt); this.glow.update(dt); this.cube.update(dt); }
  clear() { this.solid.clear(); this.glow.clear(); this.cube.clear(); }
}

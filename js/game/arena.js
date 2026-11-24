// Costruzione grafica e logica di collisione di un'arena a griglia.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, gradientBackground } from '../engine/view.js';

export const TILE = { FLOOR: 0, WALL: 1, WATER: 2, LAVA: 3, VOID: 4, CRATE: 5, BARREL: 6, BUSH: 7, ICE: 8, BRIDGE: 9, DECO: 10 };
const CHAR_TO_TILE = { '.': 0, 'S': 0, '#': 1, '~': 2, 'L': 3, '_': 4, ' ': 4, 'C': 5, 'X': 6, 'B': 7, 'I': 8, '=': 9, 'T': 10 };
const SOLID = new Set([TILE.WALL, TILE.CRATE, TILE.BARREL, TILE.DECO]);
const HAZARD = new Set([TILE.WATER, TILE.LAVA, TILE.VOID]);

const OUT = new THREE.MeshBasicMaterial({ color: 0x24182e, side: THREE.BackSide });

function canvasTex(draw, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function waterTex(color) {
  const base = new THREE.Color(color);
  return canvasTex((g, s) => {
    g.fillStyle = '#' + base.getHexString(); g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const y = (i / 7) * s + 8, x = (i * 37) % s;
      g.beginPath(); g.arc(x, y, 9, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      g.beginPath(); g.arc((x + 64) % s, y + 6, 6, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    }
  });
}

function lavaTex(color) {
  return canvasTex((g, s) => {
    g.fillStyle = '#' + new THREE.Color(color).getHexString(); g.fillRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = 4 + Math.random() * 12;
      g.fillStyle = i % 3 ? 'rgba(255,214,64,0.75)' : 'rgba(170,20,0,0.55)';
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) { g.beginPath(); g.arc(x + ox, y + oy, r, 0, Math.PI * 2); g.fill(); }
    }
  });
}

// Texture "piastrella" con bordo smussato: dà rilievo a pavimenti e muri
let tileTex = null;
function getTileTex() {
  if (tileTex) return tileTex;
  tileTex = canvasTex((g, s) => {
    g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.035})`; g.fillRect(Math.random() * s, Math.random() * s, 3, 3); }
    const e = s * 0.07;
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(0, 0, s, e); g.fillRect(0, 0, e, s);
    g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, s - e, s, e); g.fillRect(s - e, 0, e, s);
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2; g.strokeRect(1, 1, s - 2, s - 2);
  }, 64);
  tileTex.wrapS = tileTex.wrapT = THREE.ClampToEdgeWrapping;
  return tileTex;
}

function boxAt(geo, x, y, z, sx, sy, sz, color) {
  const g = geo.clone(); g.scale(sx, sy, sz); g.translate(x, y, z);
  const c = new THREE.Color(color); const n = g.attributes.position.count; const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export class Arena {
  constructor(def, scene) {
    this.def = def;
    this.scene = scene;
    this.H = def.map.length;
    this.W = Math.max(...def.map.map(r => r.length));
    this.grid = [];
    this.spawns = [];
    for (let j = 0; j < this.H; j++) {
      const row = [];
      for (let i = 0; i < this.W; i++) {
        const ch = def.map[j][i] ?? '_';
        row.push(CHAR_TO_TILE[ch] ?? 0);
        if (ch === 'S') this.spawns.push(this.center(i, j));
      }
      this.grid.push(row);
    }
    this.group = new THREE.Group();
    scene.add(this.group);
    this.props = new Map(); // casse, barili, cespugli: chiave "i,j"
    this.anim = [];        // oggetti con oscillazione (vegetazione)
    this.time = 0;
    this.build();
  }

  center(i, j) { return { x: i - this.W / 2 + 0.5, z: j - this.H / 2 + 0.5 }; }
  toTile(x, z) { return [Math.floor(x + this.W / 2), Math.floor(z + this.H / 2)]; }
  get(i, j) { return (i < 0 || j < 0 || i >= this.W || j >= this.H) ? TILE.VOID : this.grid[j][i]; }
  at(x, z) { const [i, j] = this.toTile(x, z); return this.get(i, j); }
  isSolidTile(i, j) { return SOLID.has(this.get(i, j)); }
  isHazardTile(i, j) { return HAZARD.has(this.get(i, j)); }
  isWalkable(i, j) { const t = this.get(i, j); return !SOLID.has(t) && !HAZARD.has(t); }

  build() {
    const th = this.def.theme;
    const unit = new THREE.BoxGeometry(1, 1, 1);
    const floors = [], bases = [], walls = [], tops = [], basins = [];
    const waterPlanes = [], lavaPlanes = [];
    const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    let decoIndex = 0;
    for (let j = 0; j < this.H; j++) for (let i = 0; i < this.W; i++) {
      const t = this.grid[j][i]; const { x, z } = this.center(i, j);
      if (t === TILE.VOID) continue;
      if (t === TILE.WATER || t === TILE.LAVA) {
        basins.push(boxAt(unit, x, -0.75, z, 1, 0.3, 1, t === TILE.LAVA ? 0x3a1208 : 0x1d4e6e));
        bases.push(boxAt(unit, x, -1.25, z, 1, 0.7, 1, th.base));
        const pg = plane.clone(); pg.translate(x, t === TILE.LAVA ? -0.16 : -0.2, z);
        (t === TILE.LAVA ? lavaPlanes : waterPlanes).push(pg);
        continue;
      }
      let col = (i + j) % 2 ? th.floorA : th.floorB;
      if (t === TILE.ICE) col = (i + j) % 2 ? th.ice : new THREE.Color(th.ice).multiplyScalar(0.94).getHex();
      if (t === TILE.BRIDGE) col = th.bridge;
      floors.push(boxAt(unit, x, -0.25, z, 1, 0.5, 1, col));
      bases.push(boxAt(unit, x, -1.05, z, 1, 1.1, 1, th.base));
      if (t === TILE.BRIDGE) {
        for (let k = 0; k < 3; k++) floors.push(boxAt(unit, x, 0.01, z - 0.33 + k * 0.33, 0.98, 0.02, 0.06, new THREE.Color(th.bridge).multiplyScalar(0.7).getHex()));
      }
      if (t === TILE.WALL) {
        walls.push(boxAt(unit, x, 0.45, z, 1, 0.9, 1, th.wall));
        tops.push(boxAt(unit, x, 0.95, z, 1.0, 0.1, 1.0, th.wallTop));
      }
      if (t === TILE.CRATE) this.addCrate(i, j, x, z);
      if (t === TILE.BARREL) this.addBarrel(i, j, x, z);
      if (t === TILE.BUSH) this.addBush(i, j, x, z);
      if (t === TILE.DECO) this.addDeco(x, z, decoIndex++);
    }
    const vc = toon(0xffffff, { vertexColors: true });
    const vcTile = toon(0xffffff, { vertexColors: true, map: getTileTex() });
    const add = (arr, shadowCast, receive = true, mat = vcTile) => {
      if (!arr.length) return null;
      const m = new THREE.Mesh(mergeGeometries(arr), mat);
      m.castShadow = shadowCast; m.receiveShadow = receive; this.group.add(m); return m;
    };
    add(floors, false); add(bases, false, false, vc); add(basins, false, true, vc);
    add(walls, true);
    add(tops, true);
    if (waterPlanes.length) {
      this.waterTex = waterTex(th.water);
      const m = new THREE.Mesh(mergeGeometries(waterPlanes), new THREE.MeshLambertMaterial({ map: this.waterTex, transparent: true, opacity: 0.88 }));
      m.receiveShadow = true; this.group.add(m); this.waterMesh = m;
    }
    if (lavaPlanes.length) {
      this.lavaTex = lavaTex(th.lava || 0xff5a1a);
      const m = new THREE.Mesh(mergeGeometries(lavaPlanes), new THREE.MeshBasicMaterial({ map: this.lavaTex }));
      this.group.add(m); this.lavaMesh = m;
      this.lavaTiles = [];
      for (let j = 0; j < this.H; j++) for (let i = 0; i < this.W; i++) if (this.grid[j][i] === TILE.LAVA) this.lavaTiles.push(this.center(i, j));
    }
    this.bgTex = gradientBackground(new THREE.Color(th.bg).lerp(new THREE.Color(0xffffff), 0.25).getHex(), new THREE.Color(th.bg).multiplyScalar(0.7).getHex());
    this.scene.background = this.bgTex;
  }

  addCrate(i, j, x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const c = this.def.theme.crate;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.8, 0.86), toon(c));
    body.position.y = 0.4; body.castShadow = true; body.receiveShadow = true; g.add(body);
    const ol = new THREE.Mesh(body.geometry, OUT); ol.scale.setScalar(1.05); body.add(ol);
    const dk = toon(new THREE.Color(c).multiplyScalar(0.7).getHex());
    for (const s of [-1, 1]) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.12), dk);
      plank.position.set(0, 0.4, s * 0.38); plank.rotation.z = 0.7; g.add(plank);
      const p2 = plank.clone(); p2.rotation.z = -0.7; g.add(p2);
    }
    this.group.add(g);
    this.props.set(i + ',' + j, { type: 'crate', mesh: g, i, j });
  }

  addBarrel(i, j, x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.8, 18), toon(0xe63946));
    body.position.y = 0.4; body.castShadow = true; g.add(body);
    const ol = new THREE.Mesh(body.geometry, OUT); ol.scale.setScalar(1.06); body.add(ol);
    for (const y of [0.15, 0.65]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.345, 0.03, 6, 20), toon(0x5a5a6a)); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
    const sign = new THREE.Mesh(new THREE.CircleGeometry(0.14, 3), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
    sign.position.set(0, 0.42, 0.345); g.add(sign);
    this.group.add(g);
    this.props.set(i + ',' + j, { type: 'barrel', mesh: g, i, j, fuse: 0 });
  }

  addBush(i, j, x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const mat = toon(this.def.theme.bush, { transparent: true, opacity: 1 });
    const mat2 = toon(new THREE.Color(this.def.theme.bush).multiplyScalar(1.2).getHex(), { transparent: true, opacity: 1 });
    for (const [bx, by, bz, r, m] of [[-0.2, 0.3, 0.1, 0.36, mat], [0.22, 0.32, -0.05, 0.38, mat2], [0, 0.5, -0.12, 0.34, mat], [0.05, 0.28, 0.25, 0.3, mat2]]) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m); s.position.set(bx, by, bz); s.castShadow = true; g.add(s);
    }
    this.group.add(g);
    this.anim.push({ obj: g, amp: 0.05, speed: 2.2, phase: Math.random() * 6, kind: 'bush' });
    this.props.set(i + ',' + j, { type: 'bush', mesh: g, mats: [mat, mat2], rustle: 0 });
  }

  addDeco(x, z, idx) {
    const th = this.def.theme, g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = (idx * 1.7) % 6.28;
    const P = (geo, color, px, py, pz, sx = 1, sy = 1, sz = 1, outline = true) => {
      const m = new THREE.Mesh(geo, toon(color)); m.position.set(px, py, pz); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true;
      if (outline) { const o = new THREE.Mesh(geo, OUT); o.scale.setScalar(1.06); m.add(o); }
      return m;
    };
    let sway = null;
    if (th.deco === 'cherry') {
      if (idx % 2) {
        g.add(P(new THREE.CylinderGeometry(0.13, 0.2, 1.1, 8), 0x6b4226, 0, 0.55, 0));
        sway = new THREE.Group(); sway.position.y = 1.1; g.add(sway);
        for (const [a, b, c, r, col] of [[0, 0.3, 0, 0.6, 0xffb7d0], [0.4, 0.1, 0.2, 0.42, 0xff9ec2], [-0.35, 0.15, -0.2, 0.45, 0xffc8db]]) sway.add(P(new THREE.IcosahedronGeometry(r, 1), col, a, b, c));
      } else {
        g.add(P(new THREE.CylinderGeometry(0.3, 0.38, 0.25, 8), 0xa9a59c, 0, 0.12, 0));
        g.add(P(new THREE.CylinderGeometry(0.12, 0.12, 0.45, 8), 0xb9b5ac, 0, 0.45, 0));
        g.add(P(new THREE.BoxGeometry(0.42, 0.32, 0.42), 0xc8c3b8, 0, 0.82, 0));
        const light = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.44), new THREE.MeshBasicMaterial({ color: 0xffe9a8 })); light.position.y = 0.82; g.add(light);
        g.add(P(new THREE.ConeGeometry(0.42, 0.3, 4), 0x8f8a80, 0, 1.12, 0, 1, 1, 1));
      }
    } else if (th.deco === 'jar') {
      if (idx % 2) {
        g.add(P(new THREE.CylinderGeometry(0.34, 0.38, 1.1, 14), 0x9b6b43, 0, 0.55, 0));
        g.add(P(new THREE.SphereGeometry(0.3, 14, 10), 0x7a5232, 0, 1.15, 0));
      } else {
        const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.9, 16), new THREE.MeshLambertMaterial({ color: 0xcdefff, transparent: true, opacity: 0.5 }));
        jar.position.y = 0.45; g.add(jar);
        g.add(P(new THREE.CylinderGeometry(0.3, 0.3, 0.6, 12), 0xff8c42, 0, 0.32, 0, 1, 1, 1, false));
        g.add(P(new THREE.CylinderGeometry(0.4, 0.4, 0.12, 16), 0xe63946, 0, 0.95, 0));
      }
    } else if (th.deco === 'rock') {
      g.add(P(new THREE.DodecahedronGeometry(0.55, 0), 0x6e6372, 0, 0.4, 0, 1, 1.2, 1));
      g.add(P(new THREE.DodecahedronGeometry(0.3, 0), 0x857a88, 0.25, 0.95, 0.1));
      const crack = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.05), new THREE.MeshBasicMaterial({ color: 0xff7a1a })); crack.position.set(0.3, 0.4, 0.38); crack.rotation.z = 0.4; g.add(crack);
    } else if (th.deco === 'pine') {
      g.add(P(new THREE.CylinderGeometry(0.1, 0.14, 0.4, 8), 0x6b4226, 0, 0.2, 0));
      sway = new THREE.Group(); g.add(sway);
      for (let k = 0; k < 3; k++) {
        sway.add(P(new THREE.ConeGeometry(0.55 - k * 0.13, 0.6, 9), 0x2e7d5b, 0, 0.55 + k * 0.35, 0));
        sway.add(P(new THREE.ConeGeometry(0.3 - k * 0.07, 0.22, 9), 0xffffff, 0, 0.78 + k * 0.35, 0, 1, 1, 1, false));
      }
    } else if (th.deco === 'palm') {
      for (let k = 0; k < 5; k++) g.add(P(new THREE.CylinderGeometry(0.11, 0.13, 0.3, 8), k % 2 ? 0x9c6b3a : 0x8a5a2e, k * 0.05, 0.15 + k * 0.28, 0));
      sway = new THREE.Group(); sway.position.set(0.25, 1.45, 0); g.add(sway);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const leaf = P(new THREE.SphereGeometry(0.5, 10, 6), k % 2 ? 0x2fae55 : 0x46c66a, Math.cos(a) * 0.4, -0.05, Math.sin(a) * 0.4, 1, 0.08, 0.22);
        leaf.rotation.y = -a; leaf.rotation.z = -0.35; sway.add(leaf);
      }
      sway.add(P(new THREE.SphereGeometry(0.1, 8, 6), 0x6b4226, 0.05, -0.12, 0.1));
      sway.add(P(new THREE.SphereGeometry(0.1, 8, 6), 0x6b4226, -0.08, -0.12, -0.05));
    }
    if (sway) this.anim.push({ obj: sway, amp: 0.06, speed: 1.4, phase: idx, kind: 'tree' });
    this.group.add(g);
  }

  // Colpisce una tessera solida (cassa/barile); ritorna il tipo di effetto
  hitTile(i, j, events) {
    const t = this.get(i, j), key = i + ',' + j, p = this.props.get(key);
    if (t === TILE.CRATE && p) {
      this.grid[j][i] = TILE.FLOOR;
      this.group.remove(p.mesh); this.props.delete(key);
      const c = this.center(i, j);
      events.push({ type: 'crate', x: c.x, z: c.z, color: this.def.theme.crate });
      return 'crate';
    }
    if (t === TILE.BARREL && p && !p.fuse) { p.fuse = 0.12; return 'barrel'; }
    return null;
  }

  bushAt(x, z) {
    const [i, j] = this.toTile(x, z);
    return this.get(i, j) === TILE.BUSH ? this.props.get(i + ',' + j) : null;
  }

  // Spinge fuori un cerchio dalle tessere solide. Ritorna la normale dell'ultimo contatto (o null).
  collideCircle(pos, r) {
    let hit = null;
    const [ci, cj] = this.toTile(pos.x, pos.z);
    for (let pass = 0; pass < 2; pass++) {
      for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
        if (!this.isSolidTile(i, j)) continue;
        if (i < 0 || j < 0 || i >= this.W || j >= this.H) continue;
        const c = this.center(i, j);
        const nx = Math.max(c.x - 0.5, Math.min(pos.x, c.x + 0.5));
        const nz = Math.max(c.z - 0.5, Math.min(pos.z, c.z + 0.5));
        let dx = pos.x - nx, dz = pos.z - nz; const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          let d = Math.sqrt(d2);
          if (d < 1e-5) { dx = pos.x - c.x; dz = pos.z - c.z; d = Math.hypot(dx, dz) || 1; const push = r + 0.5; pos.x = c.x + dx / d * push; pos.z = c.z + dz / d * push; }
          else { pos.x = nx + dx / d * r; pos.z = nz + dz / d * r; }
          hit = { nx: dx / d, nz: dz / d, i, j };
        }
      }
    }
    return hit;
  }

  // Linea di vista su griglia (per IA): true se non ci sono muri tra a e b
  lineOfSight(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.25);
    for (let k = 1; k < n; k++) {
      const t = k / n; const [i, j] = this.toTile(ax + (bx - ax) * t, az + (bz - az) * t);
      if (this.isSolidTile(i, j)) return false;
    }
    return true;
  }

  randomSafePoint(avoid = [], minDist = 3) {
    for (let tries = 0; tries < 200; tries++) {
      const i = 1 + Math.floor(Math.random() * (this.W - 2)), j = 1 + Math.floor(Math.random() * (this.H - 2));
      if (!this.isWalkable(i, j)) continue;
      let ok = true;
      for (let dj = -1; dj <= 1 && ok; dj++) for (let di = -1; di <= 1; di++) if (this.isHazardTile(i + di, j + dj)) { ok = false; break; }
      if (!ok) continue;
      const c = this.center(i, j);
      if (avoid.every(a => Math.hypot(a.x - c.x, a.z - c.z) >= minDist)) return c;
    }
    return this.spawns[0] || { x: 0, z: 0 };
  }

  update(dt, events, fx) {
    this.time += dt;
    for (const a of this.anim) {
      const k = a.kind === 'bush' ? 1 : 1;
      a.obj.rotation.z = Math.sin(this.time * a.speed + a.phase) * a.amp * k;
      a.obj.rotation.x = Math.cos(this.time * a.speed * 0.8 + a.phase) * a.amp * 0.6;
    }
    if (this.waterTex) { this.waterTex.offset.x = this.time * 0.05; this.waterTex.offset.y = Math.sin(this.time * 0.6) * 0.05; }
    if (this.lavaTex) {
      this.lavaTex.offset.x = this.time * 0.03; this.lavaTex.offset.y = this.time * 0.02;
      if (fx && this.lavaTiles.length && Math.random() < dt * 6) {
        const c = this.lavaTiles[Math.floor(Math.random() * this.lavaTiles.length)];
        fx.burst(c.x + (Math.random() - 0.5) * 0.6, -0.1, c.z + (Math.random() - 0.5) * 0.6, { n: 3, colors: [0xffd23f, 0xff8c1a], speed: 0.6, up: 3, size: 0.08, life: 0.6, pool: 'glow', floor: -0.2 });
      }
    }
    for (const [key, p] of this.props) {
      if (p.type === 'barrel' && p.fuse > 0) {
        p.fuse -= dt; p.mesh.scale.setScalar(1 + Math.sin(this.time * 60) * 0.06);
        if (p.fuse <= 0) {
          this.grid[p.j][p.i] = TILE.FLOOR; this.group.remove(p.mesh); this.props.delete(key);
          const c = this.center(p.i, p.j); events.push({ type: 'explode', x: c.x, z: c.z, by: p.by || null });
        }
      }
      if (p.type === 'bush' && p.rustle > 0) { p.rustle -= dt; p.mesh.scale.set(1 + p.rustle * 0.3, 1 - p.rustle * 0.2, 1 + p.rustle * 0.3); }
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.waterTex?.dispose(); this.lavaTex?.dispose(); this.bgTex?.dispose();
  }
}

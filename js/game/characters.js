// 24 personaggi originali costruiti proceduralmente con primitive Three.js.
// Ogni personaggio è un "rig" standard: root → pivot (corpo, occhi, mani) + piedi.
// Per aggiungere un personaggio basta aggiungere una voce a CHARACTERS.

import * as THREE from 'three';
import { toon } from '../engine/view.js';

const G = {
  sph: new THREE.SphereGeometry(1, 22, 16),
  sphLo: new THREE.SphereGeometry(1, 10, 8),
  hemi: new THREE.SphereGeometry(1, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 24),
  cone: new THREE.ConeGeometry(1, 1, 20),
  box: new THREE.BoxGeometry(1, 1, 1),
  torus: new THREE.TorusGeometry(1, 0.42, 14, 30),
};
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x24182e, side: THREE.BackSide });
const matCache = new Map();
function M(color, extra) {
  if (extra) return toon(color, extra);
  if (!matCache.has(color)) matCache.set(color, toon(color));
  return matCache.get(color);
}

// Crea una parte del corpo con contorno cartoon
function part(parent, geo, color, o = {}) {
  const m = new THREE.Mesh(geo, o.mat || M(color));
  m.position.set(o.x || 0, o.y || 0, o.z || 0);
  if (o.s !== undefined) m.scale.setScalar(o.s);
  if (o.sx !== undefined || o.sy !== undefined || o.sz !== undefined) m.scale.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1);
  m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
  m.castShadow = o.shadow !== false;
  if (o.outline !== false) {
    const ol = new THREE.Mesh(geo, OUTLINE);
    ol.scale.setScalar(o.ol || 1.07);
    ol.castShadow = false;
    m.add(ol);
  }
  parent.add(m);
  return m;
}

function lathe(points, segs = 26) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segs);
}

function eggGeo(R, H, bottomWide = 0.25, n = 16) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI;
    const y = (1 - Math.cos(t)) / 2 * H;
    const r = Math.max(0.0001, Math.sin(t) * R * (1 + bottomWide * Math.cos(t)));
    pts.push([r, y]);
  }
  return lathe(pts);
}

function wedgeGeo(R, half, depth, bevel = 0.04) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.absarc(0, 0, R, Math.PI / 2 - half, Math.PI / 2 + half, false);
  s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 18 });
  g.translate(0, 0, -depth / 2);
  return g;
}

function addEyes(parent, { y, z, spread = 0.13, size = 0.085, x = 0, count = 2, pupil = 0x1b1025, white = 0xffffff, blush }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const xs = count === 3 ? [-spread * 1.3, 0, spread * 1.3] : count === 1 ? [0] : [-spread, spread];
  xs.forEach((ex, i) => {
    const ey = count === 3 && i === 1 ? size * 1.6 : 0;
    const w = part(g, G.sph, white, { x: ex, y: ey, sx: size, sy: size * 1.25, sz: size * 0.55, ol: 1.18 });
    const p = new THREE.Mesh(G.sph, M(pupil));
    p.scale.set(0.55, 0.6, 0.6); p.position.set(0, -0.05, 0.62); w.add(p);
    const h = new THREE.Mesh(G.sphLo, M(0xffffff));
    h.scale.setScalar(0.22); h.position.set(0.18, 0.28, 0.95); w.add(h);
  });
  if (blush) {
    for (const sx of [-1, 1]) {
      const b = new THREE.Mesh(G.sphLo, M(blush));
      b.scale.set(size * 0.8, size * 0.45, size * 0.25);
      b.position.set(sx * (spread + size * 1.1), -size * 1.5, -0.01);
      g.add(b);
    }
  }
  parent.add(g);
  return g;
}

function dark(hex, k = 0.72) { return new THREE.Color(hex).multiplyScalar(k).getHex(); }

// Ogni definizione disegna il corpo dentro "p" (pivot) e restituisce i parametri del rig
export const CHARACTERS = [
  { id: 'banana', name: { it: 'Banana', en: 'Banana' }, color: 0xffe14d, build(p) {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.14, 0.16, 0), new THREE.Vector3(-0.26, 0.55, 0), new THREE.Vector3(0.12, 1.02, 0));
    part(p, new THREE.TubeGeometry(curve, 24, 0.26, 16, false), 0xffe14d);
    part(p, G.sph, 0xffe14d, { x: 0.14, y: 0.16, s: 0.26 });
    part(p, G.sph, 0x6b4a2b, { x: 0.17, y: 0.1, s: 0.09 });
    part(p, G.sph, 0xffe14d, { x: 0.12, y: 1.02, s: 0.26 });
    part(p, G.cyl, 0x8a6a35, { x: 0.18, y: 1.24, sx: 0.07, sy: 0.22, sz: 0.07, rz: -0.5 });
    return { face: { y: 0.6, z: 0.24, x: -0.06, blush: 0xffa94d }, handY: 0.5, handX: 0.36 };
  } },
  { id: 'avocado', name: { it: 'Avocado', en: 'Avocado' }, color: 0x3f7d20, build(p) {
    part(p, eggGeo(0.42, 1.0, -0.28), 0x3f7d20);
    part(p, G.sph, 0xd5ec8a, { y: 0.42, z: 0.24, sx: 0.32, sy: 0.38, sz: 0.2, outline: false });
    part(p, G.sph, 0x8a5a2b, { y: 0.32, z: 0.38, s: 0.15 });
    return { face: { y: 0.62, z: 0.39, spread: 0.11, size: 0.07, blush: 0xff9e9e }, handY: 0.45, handX: 0.42, foot: 0x2c5a16 };
  } },
  { id: 'anguria', name: { it: 'Anguria', en: 'Watermelon' }, color: 0xff4d5e, build(p) {
    const half = 0.62;
    const g1 = part(p, wedgeGeo(0.95, half, 0.24), 0x3a9e3a); g1.position.y = 0.08;
    const g2 = part(p, wedgeGeo(0.88, half, 0.27), 0xf7fff0, { outline: false }); g2.position.y = 0.08;
    const g3 = part(p, wedgeGeo(0.82, half, 0.3), 0xff4d5e, { outline: false }); g3.position.y = 0.08;
    for (const [x, y] of [[-0.25, 0.62], [0.25, 0.62], [0, 0.38], [-0.12, 0.8], [0.14, 0.82]]) part(p, G.sph, 0x221018, { x, y, z: 0.2, sx: 0.035, sy: 0.055, sz: 0.02, outline: false });
    return { face: { y: 0.6, z: 0.2, spread: 0.12, size: 0.075 }, handY: 0.5, handX: 0.55 };
  } },
  { id: 'fragola', name: { it: 'Fragola', en: 'Strawberry' }, color: 0xff3b4e, build(p) {
    const pts = [[0.001, 0.05], [0.14, 0.11], [0.27, 0.24], [0.37, 0.41], [0.43, 0.6], [0.42, 0.75], [0.33, 0.88], [0.15, 0.95], [0.001, 0.96]];
    part(p, lathe(pts), 0xff3b4e);
    for (let i = 0; i < 16; i++) {
      const a = -1.3 + (i % 5) * 0.65, yy = 0.25 + Math.floor(i / 5) * 0.18 + (i % 2) * 0.05;
      const r = yy < 0.4 ? 0.33 : yy < 0.6 ? 0.42 : 0.4;
      if (yy > 0.5 && yy < 0.72 && Math.abs(a) < 0.5) continue;
      part(p, G.sphLo, 0xffe08a, { x: Math.sin(a) * r, y: yy, z: Math.cos(a) * r, sx: 0.025, sy: 0.04, sz: 0.025, outline: false });
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      part(p, G.cone, 0x37a64a, { x: Math.sin(a) * 0.16, y: 0.95, z: Math.cos(a) * 0.16, sx: 0.09, sy: 0.32, sz: 0.04, rx: Math.cos(a) * 1.9, rz: -Math.sin(a) * 1.9 });
    }
    part(p, G.cyl, 0x2c7a3a, { y: 1.04, sx: 0.04, sy: 0.14, sz: 0.04 });
    return { face: { y: 0.6, z: 0.4, size: 0.075, blush: 0xffb3c1 }, handY: 0.5, handX: 0.45 };
  } },
  { id: 'ananas', name: { it: 'Ananas', en: 'Pineapple' }, color: 0xf6b93b, build(p) {
    part(p, eggGeo(0.4, 0.92, 0.05), 0xf6b93b);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
      const a = (c / 6) * Math.PI * 2 + (r % 2) * 0.52, y = 0.2 + r * 0.17;
      if (Math.abs(Math.sin(a)) < 0.45 && Math.cos(a) > 0 && y > 0.45) continue;
      const rr = Math.sin(Math.PI * y / 0.92) * 0.4 + 0.005;
      part(p, G.sphLo, 0xc97a12, { x: Math.sin(a) * rr, y, z: Math.cos(a) * rr, s: 0.04, outline: false });
    }
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2, tilt = i % 2 ? 0.45 : 0.25;
      part(p, G.cone, i % 2 ? 0x2e9e4a : 0x4cc261, { x: Math.sin(a) * 0.08, y: 1.1, z: Math.cos(a) * 0.08, sx: 0.07, sy: 0.42, sz: 0.03, rx: Math.cos(a) * tilt, rz: -Math.sin(a) * tilt });
    }
    return { face: { y: 0.58, z: 0.39, size: 0.075, blush: 0xff9e7a }, handY: 0.45, handX: 0.43 };
  } },
  { id: 'hamburger', name: { it: 'Hamburger', en: 'Burger' }, color: 0xd99a4e, build(p) {
    part(p, G.cyl, 0xd99a4e, { y: 0.16, sx: 0.42, sy: 0.18, sz: 0.42 });
    part(p, G.cyl, 0x6b3a1f, { y: 0.31, sx: 0.46, sy: 0.14, sz: 0.46 });
    part(p, G.box, 0xffc93c, { y: 0.39, sx: 0.72, sy: 0.04, sz: 0.72, ry: 0.78, outline: false });
    part(p, G.torus, 0x58c447, { y: 0.42, sx: 0.36, sy: 0.36, sz: 0.12, rx: Math.PI / 2, outline: false });
    part(p, G.hemi, 0xe8a75a, { y: 0.44, sx: 0.45, sy: 0.42, sz: 0.45 });
    for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.12 + (i % 3) * 0.08; part(p, G.sphLo, 0xfff3d6, { x: Math.sin(a) * r, y: 0.83 - r * 0.35, z: Math.cos(a) * r - 0.05, sx: 0.035, sy: 0.02, sz: 0.05, outline: false }); }
    return { face: { y: 0.62, z: 0.36, size: 0.075, blush: 0xff9e7a }, handY: 0.35, handX: 0.52, foot: 0x6b3a1f };
  } },
  { id: 'pizza', name: { it: 'Pizza', en: 'Pizza' }, color: 0xffd23f, build(p) {
    const c = part(p, wedgeGeo(1.0, 0.42, 0.22), 0xd38b3c); c.position.y = 0.06;
    const ch = part(p, wedgeGeo(0.86, 0.42, 0.26), 0xffd23f, { outline: false }); ch.position.y = 0.06;
    for (const [x, y] of [[-0.18, 0.75], [0.17, 0.5], [0.0, 0.3], [0.22, 0.8]]) part(p, G.cyl, 0xd62839, { x, y, z: 0.17, sx: 0.08, sy: 0.02, sz: 0.08, rx: Math.PI / 2, outline: false });
    return { face: { y: 0.58, z: 0.17, x: -0.03, spread: 0.1, size: 0.07 }, handY: 0.5, handX: 0.42, foot: 0xa8641f };
  } },
  { id: 'sushi', name: { it: 'Sushi', en: 'Sushi' }, color: 0xff8c5a, build(p) {
    part(p, G.sph, 0xfaf7f0, { y: 0.3, sx: 0.44, sy: 0.3, sz: 0.34 });
    part(p, G.sph, 0xff8c5a, { y: 0.56, sx: 0.5, sy: 0.15, sz: 0.38 });
    for (const x of [-0.24, 0, 0.24]) part(p, G.box, 0xffd2b8, { x, y: 0.67, sx: 0.03, sy: 0.03, sz: 0.55, ry: 0.4, outline: false });
    part(p, G.box, 0x1f3a2a, { y: 0.38, sx: 0.2, sy: 0.62, sz: 0.74 });
    return { face: { y: 0.3, z: 0.34, spread: 0.2, size: 0.07, blush: 0xffb3a7 }, handY: 0.32, handX: 0.48, foot: 0xc9c2b0 };
  } },
  { id: 'patatina', name: { it: 'Patatina', en: 'Fries' }, color: 0xe63946, build(p) {
    const fryC = [0xffd166, 0xffc94a, 0xffdc80];
    for (let i = 0; i < 9; i++) { const x = -0.24 + (i % 5) * 0.12, z = -0.08 + Math.floor(i / 5) * 0.14; part(p, G.box, fryC[i % 3], { x, y: 0.82 + (i % 3) * 0.06, z, sx: 0.08, sy: 0.5, sz: 0.08, rz: (i % 3 - 1) * 0.12 }); }
    part(p, new THREE.CylinderGeometry(0.42, 0.3, 0.68, 4, 1), 0xe63946, { y: 0.4, ry: Math.PI / 4 });
    part(p, G.sph, 0xffffff, { y: 0.32, z: 0.27, sx: 0.12, sy: 0.12, sz: 0.02, outline: false });
    return { face: { y: 0.52, z: 0.28, size: 0.075 }, handY: 0.4, handX: 0.42, foot: 0x9e1f2a };
  } },
  { id: 'ciambella', name: { it: 'Ciambella', en: 'Donut' }, color: 0xff8fc7, build(p) {
    part(p, G.torus, 0xe0a96d, { y: 0.56, s: 0.36, sz: 0.4 });
    part(p, G.torus, 0xff8fc7, { y: 0.56, z: 0.035, sx: 0.37, sy: 0.37, sz: 0.36, outline: false });
    const sc = [0xffffff, 0x6bd6ff, 0xffe14d, 0x7cf08a];
    for (let i = 0; i < 12; i++) { const a = i * 0.52 + 0.2; part(p, G.box, sc[i % 4], { x: Math.cos(a) * 0.36, y: 0.56 + Math.sin(a) * 0.36, z: 0.19, sx: 0.06, sy: 0.018, sz: 0.02, rz: a * 3, outline: false }); }
    return { face: { y: 0.9, z: 0.16, spread: 0.12, size: 0.065, blush: 0xff5c9a }, handY: 0.5, handX: 0.56, foot: 0xb57d40 };
  } },
  { id: 'gelato', name: { it: 'Gelato', en: 'Ice cream' }, color: 0xff9ecf, build(p) {
    part(p, G.cone, 0xe8b86d, { y: 0.32, sx: 0.28, sy: 0.6, sz: 0.28, rx: Math.PI });
    part(p, G.sph, 0xff9ecf, { y: 0.76, s: 0.36 });
    part(p, G.torus, 0xff9ecf, { y: 0.6, sx: 0.31, sy: 0.31, sz: 0.2, rx: Math.PI / 2, outline: false });
    part(p, G.sph, 0xe0102f, { y: 1.15, s: 0.08 });
    part(p, G.cyl, 0x5a3a1f, { y: 1.25, x: 0.03, sx: 0.012, sy: 0.12, sz: 0.012, rz: -0.4, outline: false });
    return { face: { y: 0.78, z: 0.33, size: 0.075, blush: 0xff5c9a }, handY: 0.62, handX: 0.4, foot: 0xb88a45 };
  } },
  { id: 'uovo', name: { it: 'Uovo', en: 'Egg' }, color: 0xfff3dc, build(p) {
    part(p, eggGeo(0.38, 1.0, 0.22), 0xfff3dc);
    const crown = new THREE.CylinderGeometry(0.2, 0.26, 0.12, 8, 1, true);
    part(p, crown, 0xfff8ec, { y: 0.98, mat: toon(0xfff8ec, { side: THREE.DoubleSide }) });
    part(p, G.sph, 0xffc93c, { y: 1.0, sx: 0.14, sy: 0.06, sz: 0.14, outline: false });
    return { face: { y: 0.55, z: 0.38, size: 0.08, blush: 0xffa8a8 }, handY: 0.42, handX: 0.43, foot: 0xd9b48a };
  } },
  { id: 'peperoncino', name: { it: 'Peperoncino', en: 'Chili' }, color: 0xe5283a, build(p) {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.25, 0.08, 0), new THREE.Vector3(-0.35, 0.3, 0), new THREE.Vector3(0.02, 0.95, 0));
    for (let i = 0; i <= 10; i++) { const t = i / 10; const q = curve.getPoint(t); part(p, G.sph, 0xe5283a, { x: q.x, y: q.y, z: q.z, s: 0.06 + 0.25 * Math.pow(t, 0.6), ol: 1.06 }); }
    part(p, G.cyl, 0x2e9e4a, { x: 0.02, y: 1.18, sx: 0.22, sy: 0.07, sz: 0.22 });
    part(p, G.cyl, 0x267a3a, { x: 0.06, y: 1.32, sx: 0.04, sy: 0.22, sz: 0.04, rz: -0.4 });
    return { face: { y: 0.82, z: 0.26, size: 0.07 }, handY: 0.55, handX: 0.36, foot: 0x8a1420 };
  } },
  { id: 'carota', name: { it: 'Carota', en: 'Carrot' }, color: 0xff8c1a, build(p) {
    part(p, G.cone, 0xff8c1a, { y: 0.52, sx: 0.36, sy: 0.98, sz: 0.36, rx: Math.PI });
    for (const y of [0.35, 0.55, 0.75]) part(p, G.torus, 0xe06d00, { y, sx: 0.36 * (y + 0.1), sy: 0.36 * (y + 0.1), sz: 0.02, rx: Math.PI / 2, outline: false });
    for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.4; part(p, G.cone, 0x3fb54a, { x: Math.sin(a) * 0.06, y: 1.18, z: Math.cos(a) * 0.06, sx: 0.08, sy: 0.4, sz: 0.04, rx: Math.cos(a) * 0.4, rz: -Math.sin(a) * 0.4 }); }
    return { face: { y: 0.76, z: 0.28, size: 0.075, blush: 0xff5c3a }, handY: 0.62, handX: 0.36, foot: 0xb85a00 };
  } },
  { id: 'fungo', name: { it: 'Fungo', en: 'Mushroom' }, color: 0xe63946, build(p) {
    part(p, new THREE.CylinderGeometry(0.22, 0.28, 0.5, 20), 0xf3e6cc, { y: 0.3 });
    part(p, G.hemi, 0xe63946, { y: 0.5, sx: 0.55, sy: 0.4, sz: 0.55 });
    part(p, G.cyl, 0xf8f0e0, { y: 0.5, sx: 0.5, sy: 0.02, sz: 0.5, outline: false });
    for (const [a, h] of [[0.3, 0.5], [2.1, 0.45], [4.0, 0.55], [5.2, 0.3], [1.2, 0.2], [3.1, 0.25]]) {
      const r = 0.55 * Math.cos(h), y = 0.5 + 0.4 * Math.sin(h);
      part(p, G.sphLo, 0xffffff, { x: Math.sin(a) * r, y, z: Math.cos(a) * r, sx: 0.09, sy: 0.05, sz: 0.09, ry: a, rx: h - Math.PI / 2, outline: false });
    }
    return { face: { y: 0.3, z: 0.25, spread: 0.1, size: 0.065, blush: 0xffa8a8 }, handY: 0.3, handX: 0.34, foot: 0xc4b08a };
  } },
  { id: 'cocco', name: { it: 'Cocco', en: 'Coconut' }, color: 0x7a4a2a, build(p) {
    part(p, G.sph, 0x7a4a2a, { y: 0.46, s: 0.43 });
    part(p, G.cyl, 0xfdfdf6, { y: 0.8, sx: 0.28, sy: 0.04, sz: 0.28 });
    part(p, G.cyl, 0xff5cab, { x: 0.08, y: 1.0, sx: 0.025, sy: 0.45, sz: 0.025, rz: -0.25 });
    part(p, G.cone, 0x37c3ff, { x: -0.12, y: 1.12, sx: 0.22, sy: 0.08, sz: 0.22, rz: 0.3 });
    part(p, G.cyl, 0xffffff, { x: -0.08, y: 0.98, sx: 0.01, sy: 0.3, sz: 0.01, rz: 0.3, outline: false });
    return { face: { y: 0.5, z: 0.4, size: 0.08, white: 0xfff8ee }, handY: 0.42, handX: 0.46, foot: 0x4a2c18 };
  } },
  { id: 'biscotto', name: { it: 'Biscotto', en: 'Cookie' }, color: 0xd9a15b, build(p) {
    part(p, G.cyl, 0xd9a15b, { y: 0.52, sx: 0.47, sy: 0.2, sz: 0.47, rx: Math.PI / 2 });
    for (const [x, y] of [[-0.25, 0.7], [0.27, 0.62], [-0.18, 0.3], [0.2, 0.3], [0.02, 0.18], [0.0, 0.84]]) part(p, G.sphLo, 0x4a2814, { x, y, z: 0.1, sx: 0.06, sy: 0.05, sz: 0.04, outline: false });
    return { face: { y: 0.55, z: 0.11, size: 0.08, blush: 0xff9e7a }, handY: 0.45, handX: 0.5, foot: 0x9a6a2e };
  } },
  { id: 'formaggio', name: { it: 'Formaggio', en: 'Cheese' }, color: 0xffd23f, build(p) {
    const s = new THREE.Shape(); s.moveTo(-0.45, 0.32); s.lineTo(0.45, 0.32); s.lineTo(0, -0.45); s.lineTo(-0.45, 0.32);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.62, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 });
    g.rotateX(Math.PI / 2); g.translate(0, 0.68, 0);
    part(p, g, 0xffd23f);
    for (const [x, y] of [[-0.25, 0.25], [0.28, 0.5], [0.15, 0.15]]) part(p, G.sphLo, 0xe0a91c, { x, y, z: 0.36, sx: 0.07, sy: 0.07, sz: 0.02, outline: false });
    part(p, G.sphLo, 0xe0a91c, { x: 0.05, y: 0.73, z: 0.05, sx: 0.08, sy: 0.01, sz: 0.08, outline: false });
    return { face: { y: 0.42, z: 0.37, size: 0.075, blush: 0xffa94d }, handY: 0.38, handX: 0.5, foot: 0xc99a1c };
  } },
  { id: 'popcorn', name: { it: 'Popcorn', en: 'Popcorn' }, color: 0xe63946, build(p) {
    const g = new THREE.CylinderGeometry(0.42, 0.32, 0.66, 16, 1).toNonIndexed();
    const pos = g.attributes.position, col = [];
    for (let i = 0; i < pos.count; i += 3) {
      let cx = 0, cz = 0; for (let k = 0; k < 3; k++) { cx += pos.getX(i + k); cz += pos.getZ(i + k); }
      const a = Math.atan2(cx, cz) + Math.PI; const red = Math.floor(a / (Math.PI / 4)) % 2 === 0;
      const c = new THREE.Color(red ? 0xe63946 : 0xffffff);
      for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    part(p, g, 0xffffff, { y: 0.36, mat: toon(0xffffff, { vertexColors: true }) });
    for (let i = 0; i < 14; i++) { const a = i * 2.39, r = (i % 4) * 0.11; part(p, G.sph, i % 3 ? 0xfff6dc : 0xffe08a, { x: Math.sin(a) * r, y: 0.75 + (3 - i % 4) * 0.04 + (i % 2) * 0.05, z: Math.cos(a) * r - 0.04, s: 0.1 + (i % 3) * 0.02, ol: 1.1 }); }
    return { face: { y: 0.42, z: 0.38, size: 0.075 }, handY: 0.36, handX: 0.44, foot: 0x9e1f2a };
  } },
  { id: 'ninja', name: { it: 'Ninja', en: 'Ninja' }, color: 0x2b2d42, build(p) {
    part(p, new THREE.CapsuleGeometry(0.34, 0.34, 8, 18), 0x2b2d42, { y: 0.52 });
    part(p, G.sph, 0xf4c095, { y: 0.72, z: 0.24, sx: 0.27, sy: 0.1, sz: 0.1, outline: false });
    part(p, G.torus, 0xe63946, { y: 0.86, sx: 0.33, sy: 0.33, sz: 0.12, rx: Math.PI / 2 });
    part(p, G.box, 0xe63946, { y: 0.8, z: -0.4, x: 0.08, sx: 0.06, sy: 0.04, sz: 0.3, rx: 0.5, ry: 0.3 });
    part(p, G.box, 0xe63946, { y: 0.78, z: -0.38, x: -0.06, sx: 0.06, sy: 0.04, sz: 0.25, rx: 0.7, ry: -0.3 });
    return { face: { y: 0.72, z: 0.3, size: 0.07, spread: 0.12 }, handY: 0.45, handX: 0.42, foot: 0x1b1c2e, hand: 0x1b1c2e };
  } },
  { id: 'robot', name: { it: 'Robot', en: 'Robot' }, color: 0xb8c4d6, build(p) {
    part(p, G.box, 0xb8c4d6, { y: 0.34, sx: 0.6, sy: 0.46, sz: 0.48 });
    part(p, G.box, 0xff9f1c, { y: 0.38, z: 0.25, sx: 0.22, sy: 0.12, sz: 0.02, outline: false });
    part(p, G.box, 0xd0dbe8, { y: 0.8, sx: 0.54, sy: 0.4, sz: 0.46 });
    part(p, G.box, 0x1d2a3a, { y: 0.8, z: 0.235, sx: 0.44, sy: 0.28, sz: 0.02, outline: false });
    part(p, G.cyl, 0x8a96a8, { y: 1.08, sx: 0.025, sy: 0.18, sz: 0.025 });
    part(p, G.sph, 0xff4d6d, { y: 1.2, s: 0.06, mat: toon(0xff4d6d, { emissive: 0xff2040, emissiveIntensity: 0.8 }) });
    return { face: { y: 0.8, z: 0.24, size: 0.07, spread: 0.11, white: 0x5ef0ff, pupil: 0x0b4f6c }, handY: 0.4, handX: 0.4, foot: 0x6c788a, hand: 0x8a96a8 };
  } },
  { id: 'alieno', name: { it: 'Alieno', en: 'Alien' }, color: 0x7bed9f, build(p) {
    part(p, eggGeo(0.3, 0.55, 0.2), 0x7bed9f);
    part(p, G.sph, 0x7bed9f, { y: 0.78, sx: 0.42, sy: 0.36, sz: 0.38 });
    for (const s of [-1, 1]) {
      part(p, G.cyl, 0x5ccf80, { x: s * 0.16, y: 1.2, sx: 0.02, sy: 0.25, sz: 0.02, rz: -s * 0.35 });
      part(p, G.sph, 0xffe14d, { x: s * 0.21, y: 1.32, s: 0.06, mat: toon(0xffe14d, { emissive: 0xffc400, emissiveIntensity: 0.5 }) });
    }
    return { face: { y: 0.76, z: 0.34, size: 0.075, spread: 0.12, count: 3, pupil: 0x2a0a4a }, handY: 0.32, handX: 0.34, foot: 0x3fa866 };
  } },
  { id: 'fantasma', name: { it: 'Fantasma', en: 'Ghost' }, color: 0xf1f4ff, build(p) {
    const mat = toon(0xf1f4ff, { transparent: true, opacity: 0.92 });
    part(p, G.hemi, 0xf1f4ff, { y: 0.62, s: 0.4, mat });
    part(p, new THREE.CylinderGeometry(0.4, 0.44, 0.42, 22, 1, true), 0xf1f4ff, { y: 0.41, mat: toon(0xf1f4ff, { transparent: true, opacity: 0.92, side: THREE.DoubleSide }) });
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; part(p, G.sph, 0xf1f4ff, { x: Math.sin(a) * 0.36, y: 0.2, z: Math.cos(a) * 0.36, s: 0.12, mat }); }
    return { face: { y: 0.66, z: 0.37, size: 0.08, pupil: 0x2a2a4a, white: 0x2a2a4a, blush: 0xffb3d9 }, handY: 0.42, handX: 0.46, float: true, hand: 0xe0e6ff };
  } },
  { id: 'drago', name: { it: 'Drago', en: 'Dragon' }, color: 0x6ab04c, build(p) {
    part(p, eggGeo(0.4, 0.98, 0.3), 0x6ab04c);
    part(p, G.sph, 0xf9e79f, { y: 0.38, z: 0.25, sx: 0.26, sy: 0.3, sz: 0.16, outline: false });
    for (const s of [-1, 1]) {
      part(p, G.cone, 0xfff3d6, { x: s * 0.17, y: 1.0, sx: 0.06, sy: 0.2, sz: 0.06, rz: -s * 0.3 });
      const w = new THREE.Shape(); w.moveTo(0, 0); w.lineTo(0.5, 0.25); w.lineTo(0.42, -0.05); w.lineTo(0.3, 0.05); w.lineTo(0.2, -0.12); w.lineTo(0, 0);
      const wg = new THREE.ExtrudeGeometry(w, { depth: 0.03, bevelEnabled: false });
      const wing = part(p, wg, 0x8e44ad, { x: s * 0.2, y: 0.6, z: -0.3, mat: toon(0x8e44ad, { side: THREE.DoubleSide }) });
      wing.scale.x = s; wing.rotation.y = s * 0.5;
    }
    for (let i = 0; i < 3; i++) part(p, G.cone, 0x8e44ad, { y: 0.85 - i * 0.22, z: -0.36 + i * 0.02, sx: 0.06, sy: 0.14, sz: 0.06, rx: -0.9 });
    part(p, G.cone, 0x6ab04c, { y: 0.15, z: -0.42, sx: 0.12, sy: 0.4, sz: 0.12, rx: -1.9 });
    return { face: { y: 0.68, z: 0.34, size: 0.08, blush: 0xff9e9e }, handY: 0.45, handX: 0.44, foot: 0x3e7a2a };
  } },
];

export const CHAR_BY_ID = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));

// Mesh del boomerang (condivisa da personaggi e oggetti in volo)
const boomShape = (() => {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0.06);
  s.quadraticCurveTo(-0.1, 0.12, 0, 0.32);
  s.quadraticCurveTo(0.1, 0.12, 0.5, 0.06);
  s.quadraticCurveTo(0.55, -0.05, 0.42, -0.08);
  s.quadraticCurveTo(0.08, -0.04, 0, 0.14);
  s.quadraticCurveTo(-0.08, -0.04, -0.42, -0.08);
  s.quadraticCurveTo(-0.55, -0.05, -0.5, 0.06);
  return s;
})();
const boomGeo = new THREE.ExtrudeGeometry(boomShape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 10 });
boomGeo.translate(0, -0.1, -0.035);
boomGeo.rotateX(-Math.PI / 2);

export function buildBoomerangMesh(color) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(boomGeo, toon(color));
  m.castShadow = true;
  const ol = new THREE.Mesh(boomGeo, OUTLINE); ol.scale.setScalar(1.12); m.add(ol);
  g.add(m);
  const tipMat = toon(0xfff3d6);
  for (const s of [-1, 1]) {
    const tip = new THREE.Mesh(G.sphLo, tipMat);
    tip.scale.set(0.07, 0.05, 0.05); tip.position.set(s * 0.44, 0.0, 0.07); g.add(tip);
  }
  g.scale.setScalar(0.9);
  return g;
}

// Costruisce il rig completo di un personaggio
export function buildCharacter(id) {
  const def = CHAR_BY_ID[id] || CHARACTERS[0];
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);
  const r = def.build(pivot);
  const face = addEyes(pivot, { ...r.face });
  const handColor = r.hand ?? 0xffffff;
  const footColor = r.foot ?? dark(def.color, 0.6);
  const handL = new THREE.Group(), handR = new THREE.Group();
  for (const [h, s] of [[handL, -1], [handR, 1]]) {
    h.position.set(s * r.handX, r.handY, 0.05);
    part(h, G.sph, handColor, { s: 0.09, ol: 1.15 });
    pivot.add(h);
  }
  const feet = [];
  if (!r.float) {
    for (const s of [-1, 1]) {
      const f = part(root, G.sph, footColor, { x: s * 0.16, y: 0.06, z: 0.03, sx: 0.11, sy: 0.07, sz: 0.15, ol: 1.15 });
      feet.push(f);
    }
  }
  // materiali propri dell'istanza (servono per trasparenza nei cespugli e lampeggi)
  const clones = new Map();
  root.traverse(o => {
    if (!o.isMesh) return;
    if (o.material === OUTLINE) { if (!clones.has(OUTLINE)) clones.set(OUTLINE, OUTLINE.clone()); o.material = clones.get(OUTLINE); return; }
    if (!clones.has(o.material)) { const c = o.material.clone(); c.userData.baseOpacity = c.opacity; clones.set(o.material, c); }
    o.material = clones.get(o.material);
  });
  const mats = [...clones.values()];
  return { def, root, pivot, face, handL, handR, feet, float: !!r.float, mats };
}

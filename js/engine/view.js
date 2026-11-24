// Renderer, scena, luci e telecamera dinamica che inquadra tutti i giocatori.

import * as THREE from 'three';
import { settings } from '../core/settings.js';

export const toonGradient = (() => {
  const tex = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();

export function toon(color, extra = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient, ...extra });
}

export class View {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true; // serve per tagliare in due i personaggi
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fd3ff);

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.5, 200);
    this.camTarget = new THREE.Vector3();
    this.camDist = 22;
    this.camPitch = THREE.MathUtils.degToRad(60);
    this.fitKey = '';
    this.shake = 0;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x6a7a99, 1.25);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.1);
    this.sun.position.set(-8, 18, 10);
    this.sun.shadow.camera.left = -16; this.sun.shadow.camera.right = 16;
    this.sun.shadow.camera.top = 14; this.sun.shadow.camera.bottom = -14;
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 50;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    // luce di contorno da dietro: stacca i personaggi dal pavimento
    this.rim = new THREE.DirectionalLight(0xfff0dd, 0.9);
    this.rim.position.set(6, 8, -12);
    this.scene.add(this.rim);

    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.ray = new THREE.Raycaster();

    this.applyQuality();
    addEventListener('resize', () => { this.resize(); this.fitKey = ''; });
    this.resize();
  }

  applyQuality() {
    const q = settings.quality;
    const pr = Math.min(devicePixelRatio || 1, q === 'alta' ? 2 : q === 'media' ? 1.5 : 1);
    this.renderer.setPixelRatio(pr);
    this.renderer.shadowMap.enabled = q !== 'bassa';
    this.sun.castShadow = q !== 'bassa';
    const size = q === 'alta' ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose(); this.sun.shadow.map = null;
    }
    this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    this.particleBudget = q === 'alta' ? 1 : q === 'media' ? 0.7 : 0.4;
    this.resize();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Telecamera fissa: l'arena intera riempie lo schermo (si ricalcola a ogni arena o ridimensionamento)
  frame(points, arenaW, arenaH, dt, instant = false) {
    const key = arenaW + 'x' + arenaH + '@' + innerWidth + 'x' + innerHeight;
    if (key === this.fitKey) return;
    this.fitKey = key;
    const c = this.camera, v = new THREE.Vector3();
    const hw = arenaW / 2, hh = arenaH / 2;
    const corners = [];
    for (const x of [-hw, hw]) for (const z of [-hh, hh]) for (const y of [-0.6, 1.0]) corners.push([x, y, z]);
    const topLimit = innerWidth < 700 ? 0.8 : 0.86;   // spazio per i punteggi in alto
    const fits = (tz, dist) => {
      c.position.set(0, Math.sin(this.camPitch) * dist, tz + Math.cos(this.camPitch) * dist);
      c.lookAt(0, 0, tz); c.updateMatrixWorld(); c.updateProjectionMatrix();
      for (const [x, y, z] of corners) {
        v.set(x, y, z).project(c);
        if (v.x < -0.985 || v.x > 0.985 || v.y < -0.975 || v.y > topLimit) return false;
      }
      return true;
    };
    let best = { d: Infinity, tz: 0 };
    for (let tz = -2; tz <= 3; tz += 0.1) {
      let lo = 4, hi = 120;
      if (!fits(tz, hi)) continue;
      for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (fits(tz, mid)) hi = mid; else lo = mid; }
      if (hi < best.d) best = { d: hi, tz };
    }
    this.camDist = best.d; this.camTarget.set(0, 0, best.tz);
  }

  addShake(a) { if (settings.screenShake) this.shake = Math.min(1, this.shake + a); }

  updateCamera(dt) {
    const c = this.camera, t = this.camTarget;
    c.position.set(t.x, Math.sin(this.camPitch) * this.camDist, t.z + Math.cos(this.camPitch) * this.camDist);
    if (this.shake > 0) {
      const s = this.shake * this.shake * 0.35;
      c.position.x += (Math.random() - 0.5) * s; c.position.y += (Math.random() - 0.5) * s; c.position.z += (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    c.lookAt(t.x, 0, t.z);
    this.sun.target.position.set(t.x, 0, t.z);
    this.sun.position.set(t.x - 8, 18, t.z + 10);
  }

  screenToGround(ndc) {
    this.ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.ground, p) ? p : null;
  }

  render() { this.renderer.render(this.scene, this.camera); }
}

// Sfondo sfumato verticale (cielo) per il tema dell'arena
export function gradientBackground(top, bottom) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#' + new THREE.Color(top).getHexString());
  gr.addColorStop(1, '#' + new THREE.Color(bottom).getHexString());
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

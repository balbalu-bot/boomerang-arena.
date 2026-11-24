// Ritratti dei personaggi generati al volo con un piccolo renderer dedicato.

import * as THREE from 'three';
import { CHARACTERS, buildCharacter } from '../game/characters.js';

export function makeThumbnails(size = 160) {
  const out = {};
  let r;
  try {
    r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch { return out; }
  r.setSize(size, size); r.setPixelRatio(1);
  r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(2, 4, 5); scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  for (const c of CHARACTERS) {
    const rig = buildCharacter(c.id);
    rig.root.rotation.y = -0.35;
    scene.add(rig.root);
    const box = new THREE.Box3().setFromObject(rig.root);
    const h = box.max.y - box.min.y, cy = (box.max.y + box.min.y) / 2;
    cam.position.set(0, cy + h * 0.25, h * 2.6 + 0.6); cam.lookAt(0, cy, 0);
    r.render(scene, cam);
    out[c.id] = r.domElement.toDataURL('image/png');
    scene.remove(rig.root);
  }
  r.dispose();
  r.forceContextLoss?.();
  return out;
}

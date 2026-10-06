import * as THREE from 'three';
import { createKit } from './kit.js';
import { buildTypeModel } from './types/index.js';

// The Treatments page hero: all ten treatments as 3D models on a slowly turning ring.
// The one at the front comes forward, grows a little and comes apart to show its parts;
// the others turn gently as they wait. items: [{ model }] in ring order.

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function buildHubRing(gltf, stage, items, { reduce = false } = {}) {
  const kit = createKit(gltf, stage);
  const root = new THREE.Group();
  const ring = new THREE.Group();
  root.add(ring);
  const N = items.length;
  const step = (Math.PI * 2) / N;

  const slots = items.map((it, i) => {
    const model = buildTypeModel(kit, it.model);
    model.pivot.rotation.set(model.view.rx, model.view.ry, 0);
    // Same size for every model: fit it to a unit box, measured half apart so it has room to open.
    model.explode(0.5);
    model.fit(1, 1, 1);
    model.explode(0);
    const spin = new THREE.Group();
    spin.add(model.root);
    const slot = new THREE.Group();
    slot.add(spin);
    ring.add(slot);
    model.root.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; o.receiveShadow = false; } });
    return { model, spin, slot, k: 0, phase: i * 1.7 };
  });

  let angle = 0;       // current ring angle (front item = -angle / step)
  let target = 0;      // where the ring is heading
  let front = 0;
  const listeners = [];

  const api = {
    root,
    get front() { return front; },
    onFront(fn) { listeners.push(fn); },
    // Turn the ring so that item i is at the front, the short way round.
    go(i) {
      const want = -i * step;
      target = angle + wrap(want - angle);
    },
    next() { api.go((front + 1) % N); },
    prev() { api.go((front - 1 + N) % N); },
    update(presence, time, dt, L, pointer) {
      const portrait = L.portrait;
      const base = portrait ? { ...L.main, y: L.main.y + 0.32 } : { ...L.main, x: L.main.x * 1.12, y: 0.36 };
      root.visible = presence > 0.002;
      if (!root.visible) return;
      const e = 1 - Math.pow(1 - presence, 3);
      const R = portrait ? Math.min(1.45, L.main.s * 1.6) : Math.min(1.85, base.s * 1.8);
      const size = portrait ? Math.min(1.25, L.main.s * 1.45) : Math.min(1.5, base.s * 1.45);
      root.position.set(base.x, base.y - (1 - e) * 0.6, 0);
      root.scale.setScalar(0.6 + 0.4 * e);
      ring.rotation.x = 0.2 + pointer.y * 0.04;
      ring.rotation.y = pointer.x * 0.08;

      // ease the ring towards its target angle
      angle += (target - angle) * (reduce ? 1 : 1 - Math.exp(-dt * 3.2));
      const f = ((Math.round(-angle / step) % N) + N) % N;
      if (f !== front) { front = f; listeners.forEach((fn) => fn(front)); }

      slots.forEach((s, i) => {
        const a = i * step + angle;
        const near = clamp(1 - Math.abs(wrap(a)) / (step * 1.2)); // 1 at the front
        s.slot.position.set(Math.sin(a) * R, -0.05 + near * 0.12, Math.cos(a) * R * 0.85);
        const sc = size * (0.5 + 0.5 * ease(near));
        s.slot.scale.setScalar(sc);
        // the front model opens up once it has arrived; the others close again
        const settled = clamp(1 - Math.abs(wrap(a)) / (step * 0.25));
        const want = reduce ? (i === front ? 0.6 : 0) : ease(settled) * 0.85;
        s.k += (want - s.k) * (1 - Math.exp(-dt * (want > s.k ? 2.4 : 4)));
        s.model.explode(s.k);
        s.spin.rotation.y = reduce ? 0 : Math.sin(time * 0.45 + s.phase) * 0.35 + (1 - near) * time * 0.25;
        s.spin.position.y = reduce ? 0 : Math.sin(time * 0.9 + s.phase) * 0.04;
      });
      root.updateMatrixWorld(true);
      for (const s of slots) s.model.beforeRender?.();
    },
  };
  stage.scene.add(root);
  // Models further back fade into the page's dark background, so the one at the front stands out.
  stage.scene.fog = new THREE.Fog('#1a0d22', 8.4, 13.2);
  return api;
}

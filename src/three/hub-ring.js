import * as THREE from 'three';
import { createKit } from './kit.js';
import { buildTypeModel } from './types/index.js';
import { breathe } from './stage.js';

// The Treatments page hero: all ten treatments as 3D models on a slowly turning ring.
// The one at the front comes forward, grows a little and comes apart to show its parts;
// the others turn gently as they wait. items: [{ model }] in ring order.
//
// The ring turns in fixed steps of 360° / N (36° for ten treatments): it can be dragged, and when
// let go it settles on the nearest treatment. Every model can be picked with the mouse or a tap
// (hit(): an invisible box around each model that follows it as it opens and closes).

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const OPEN = 0.85; // how far the front model comes apart

// Async: the ten models are built one at a time, letting the page draw and respond in between.
export async function buildHubRing(gltf, stage, items, { reduce = false } = {}) {
  const kit = createKit(gltf, stage);
  const root = new THREE.Group();
  const ring = new THREE.Group();
  root.add(ring);
  const N = items.length;
  const step = (Math.PI * 2) / N;

  const hitGeo = new THREE.BoxGeometry(1, 1, 1);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const box = new THREE.Box3();
  const measure = (model, k) => {
    model.explode(k);
    model.root.updateMatrixWorld(true);
    box.setFromObject(model.root);
    const c = box.getCenter(new THREE.Vector3());
    const s = box.getSize(new THREE.Vector3());
    // a little larger than the model, so it is easy to point at, but never huge
    s.set(clamp(s.x * 1.08, 0.5, 1.35), clamp(s.y * 1.08, 0.5, 1.35), clamp(s.z * 1.08, 0.5, 1.35));
    c.clampScalar(-0.35, 0.35);
    return { c, s };
  };

  const slots = [];
  for (const [i, it] of items.entries()) {
    if (i) await breathe();
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
    // the box that catches the pointer, closed and open
    const shut = measure(model, 0);
    const open = measure(model, OPEN);
    model.explode(0);
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.userData.i = i;
    hit.position.copy(shut.c);
    hit.scale.copy(shut.s);
    spin.add(hit);
    slots.push({ model, spin, slot, hit, shut, open, k: 0, h: 0, phase: i * 1.7 });
  }
  const hits = slots.map((s) => s.hit);

  // A thin track under the models with a bead for each treatment and a gold marker at the front:
  // the ten stops the ring clicks into.
  const dial = new THREE.Group();
  ring.add(dial);
  const trackGeo = new THREE.TorusGeometry(1, 0.0055, 6, 160);
  trackGeo.rotateX(Math.PI / 2);
  const track = new THREE.Mesh(trackGeo, new THREE.MeshBasicMaterial({ color: '#cdb3ff', transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false }));
  dial.add(track);
  const beadGeo = new THREE.SphereGeometry(1, 16, 10);
  const beads = slots.map(() => {
    const m = new THREE.Mesh(beadGeo, new THREE.MeshBasicMaterial({ color: '#d9c6ff', transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
    dial.add(m);
    return m;
  });
  const markerGeo = new THREE.TorusGeometry(1, 0.16, 8, 40);
  markerGeo.rotateX(Math.PI / 2);
  const marker = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: '#f0cf86', transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }));
  dial.add(marker);
  const gold = new THREE.Color('#f0cf86'), lilac = new THREE.Color('#d9c6ff');

  let angle = 0;       // current ring angle (front item = -angle / step)
  let target = 0;      // where the ring is heading
  let front = 0;
  let dragging = false;
  let hover = -1;
  const listeners = [];
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  const api = {
    root,
    step,
    get front() { return front; },
    get dragging() { return dragging; },
    onFront(fn) { listeners.push(fn); },
    // Turn the ring so that item i is at the front, the short way round.
    go(i) {
      const want = -i * step;
      target = angle + wrap(want - angle);
    },
    // One stop on from where the ring is heading, so quick repeated clicks add up.
    next() { target = Math.round(target / step) * step - step; },
    prev() { target = Math.round(target / step) * step + step; },
    // Dragging: the ring follows the pointer freely, then settles on the nearest stop.
    grab() { dragging = true; target = angle; },
    dragBy(da) { target += da; },
    release(vel = 0) {
      dragging = false;
      // a quick flick carries on a little further (at most three stops)
      const extra = clamp(vel * 0.22, -step * 3, step * 3);
      target = Math.round((target + extra) / step) * step;
    },
    // Which treatment is under this point of the screen (normalised -1..1), or -1.
    hit(x, y, camera) {
      if (!root.visible) return -1;
      ndc.set(x, y);
      raycaster.setFromCamera(ndc, camera);
      const found = raycaster.intersectObjects(hits, false);
      if (!found.length) return -1;
      if (found.every((f) => f.object === found[0].object)) return found[0].object.userData.i;
      // The boxes overlap where models sit close together: of the models whose box is under the
      // pointer, the one whose actual surface is nearest wins; between parts, the nearest box does.
      let best = -1, bestD = Infinity;
      const seen = new Set();
      for (const f of found) {
        const i = f.object.userData.i;
        if (seen.has(i)) continue;
        seen.add(i);
        for (const h of raycaster.intersectObject(slots[i].model.root, true)) {
          if (!h.object.isMesh || h.object.material?.visible === false) continue;
          if (h.distance < bestD) { bestD = h.distance; best = i; }
          break;
        }
      }
      return best >= 0 ? best : found[0].object.userData.i;
    },
    setHover(i) { hover = i; },
    get angle() { return angle; },
    get target() { return target; },
    // Where item i is on the screen (normalised -1..1); used by the tests.
    where(i, camera) {
      const p = slots[i].slot.getWorldPosition(new THREE.Vector3()).project(camera);
      return { x: p.x, y: p.y };
    },
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

      // ease the ring towards its target angle (closely while it is being dragged)
      angle += (target - angle) * (reduce ? 1 : 1 - Math.exp(-dt * (dragging ? 18 : 3.6)));
      const f = ((Math.round(-angle / step) % N) + N) % N;
      if (f !== front) { front = f; listeners.forEach((fn) => fn(front)); }

      const trackY = -(0.5 * size + 0.08);
      dial.position.y = trackY;
      track.scale.set(R, 1, R * 0.85);
      marker.position.set(0, 0, R * 0.85);
      marker.scale.setScalar(0.05 + 0.012 * Math.sin(time * 2.4));

      slots.forEach((s, i) => {
        const a = i * step + angle;
        const near = clamp(1 - Math.abs(wrap(a)) / (step * 1.2)); // 1 at the front
        s.h += ((i === hover ? 1 : 0) - s.h) * (1 - Math.exp(-dt * 10));
        s.slot.position.set(Math.sin(a) * R, -0.05 + near * 0.12 + s.h * 0.06, Math.cos(a) * R * 0.85);
        const sc = size * (0.5 + 0.5 * ease(near)) * (1 + 0.09 * s.h);
        s.slot.scale.setScalar(sc);
        // the front model opens up once it has arrived; the others close again
        const settled = dragging ? 0 : clamp(1 - Math.abs(wrap(a)) / (step * 0.25));
        const want = reduce ? (i === front ? 0.6 : 0) : ease(settled) * OPEN;
        s.k += (want - s.k) * (1 - Math.exp(-dt * (want > s.k ? 2.4 : 4)));
        s.model.explode(s.k);
        s.spin.rotation.y = reduce ? 0 : Math.sin(time * 0.45 + s.phase) * 0.35 + (1 - near) * time * 0.25;
        s.spin.position.y = reduce ? 0 : Math.sin(time * 0.9 + s.phase) * 0.04;
        // the pointer box follows the model as it opens
        const t = clamp(s.k / OPEN);
        s.hit.position.lerpVectors(s.shut.c, s.open.c, t);
        s.hit.scale.lerpVectors(s.shut.s, s.open.s, t);
        // its bead on the track
        const b = beads[i];
        b.position.set(Math.sin(a) * R, 0, Math.cos(a) * R * 0.85);
        const lit = Math.max(near * near, s.h);
        b.scale.setScalar(0.022 + 0.014 * lit);
        b.material.color.copy(lilac).lerp(gold, lit);
        b.material.opacity = 0.55 + 0.45 * lit;
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

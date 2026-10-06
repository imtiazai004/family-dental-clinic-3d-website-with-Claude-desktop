import * as THREE from 'three';
import { makeXray } from '../kit.js';

// Shared pieces for the treatment-page 3D stories (one module per treatment in this folder).
// A story module exports build(kit) and returns:
//   { group, layout: 'wide' | 'main' | 'arch', labels: [{ group, text, anchor }], state: { labels: {} },
//     update(p, t, pointer, heroK) }
// p is the story's scroll progress (0..1), heroK is 1 while the page hero is on screen.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const seg = (p, a, b) => clamp((p - a) / (b - a));
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const lerp = (a, b, t) => a + (b - a) * t;
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Progress inside step i of n: steps(n, p)(i, a, b) goes 0 -> 1 between fractions a and b of that step.
export const steps = (n, p) => (i, a, b) => seg(p, (i + a) / n, (i + b) / n);

// Camera framing: K[i] = { s: scale, f: height to centre on, ry, rx } per step, HERO for the hero.
// Moves smoothly between neighbouring steps and adds a little pointer parallax.
export function frame(pivot, K, HERO, p, hk, pointer, t, extra = {}) {
  const n = K.length;
  const f = clamp(p * n - 0.5, 0, n - 1);
  const i0 = Math.floor(f), i1 = Math.min(n - 1, i0 + 1);
  const k = ease(seg(f - i0, 0.2, 0.8));
  const A = K[i0], B = K[i1];
  const h = ease(clamp(hk));
  const s = lerp(lerp(A.s, B.s, k), HERO.s, h);
  const focus = lerp(lerp(A.f, B.f, k), HERO.f, h);
  pivot.scale.setScalar(s);
  pivot.position.y = -focus * s;
  pivot.rotation.y = lerp(lerp(A.ry, B.ry, k), HERO.ry, h) + (extra.spin || 0) + pointer.x * 0.12 + Math.sin(t * 0.25) * 0.05;
  pivot.rotation.x = lerp(lerp(A.rx, B.rx, k), HERO.rx, h) + pointer.y * 0.05;
}

// A copy of a group drawn in the see-through X-ray look. matFor(mesh) returns the X-ray material to use.
export function xrayClone(src, matFor) {
  const c = src.clone(true);
  c.traverse((o) => { if (o.isMesh) o.material = matFor(o); });
  return c;
}

// The bright sheet of light used for scans.
export function scanBar(height = 3.2, depth = 1.8) {
  const bar = new THREE.Group();
  const add = (w, color, opacity) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, height, depth), new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    bar.add(m);
  };
  add(0.025, '#cfe6ff', 0.5);
  add(0.22, '#7fb2ff', 0.12);
  return bar;
}

// Left/right split along x for a scan: `right` keeps x > x0 (normal look), `left` keeps x < x0 (X-ray look).
export function scanPlanes(kit) {
  const right = kit.localPlane(1, 0, 0, 5);
  const left = kit.localPlane(-1, 0, 0, -5);
  return {
    right, left,
    set(x, pivot) { right.local.constant = -x; right.sync(pivot); left.local.constant = x; left.sync(pivot); },
  };
}

// A soft glowing ring (numbing, cement line, gum barrier...). Lies flat in the XZ plane.
export function glowRing(radius, tube, color = '#b9a4ff') {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 64), m);
  ring.rotation.x = Math.PI / 2;
  return ring;
}

// A soft round glow (light spots, infection, contact points).
export function glowBall(r, color, opacity = 0) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
}

// See-through look for "planned" or "ghost" shapes.
export const ghost = (color = '#c9b0ff', k = 0.9) => makeXray(color, k);

// Sets visibility and opacity together for an additive/ghost material.
export function fade(obj, mat, a) {
  obj.visible = a > 0.01;
  if (mat.uniforms?.uOpacity) mat.uniforms.uOpacity.value = a;
  else mat.opacity = a;
}

// Colour moving through a list of colours as t goes 0 -> 1.
export function colorPath(out, list, t) {
  const n = list.length - 1;
  const x = clamp(t) * n;
  const i = Math.min(n - 1, Math.floor(x));
  return out.copy(list[i]).lerp(list[i + 1], ease(x - i));
}

// Dashed line from a to b.
export function dashed(a, b, color = '#ffd27a') {
  const l = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([a, b]),
    new THREE.LineDashedMaterial({ color, dashSize: 0.06, gapSize: 0.05, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
  );
  l.computeLineDistances();
  return l;
}

// Shadows for solid meshes only (glows and see-through layers don't cast).
export function enableShadows(group) {
  group.traverse((o) => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
}
export function noCull(group) { group.traverse((o) => { if (o.isMesh) o.frustumCulled = false; }); }

import * as THREE from 'three';
import { makeArchCurve, makeGum } from './procedural.js';

// A full upper arch of teeth on a gum ridge (teeth hanging down), the same layout as the
// home page's smile studio. Used by the braces, whitening, veneer and denture stories.

export const UPPER_TEETH = [
  { name: 'incisor_crown', w: 0.85, mesh: 0.64, top: 0.8, drop: 0.45, depth: 0.16 },
  { name: 'incisor_crown', w: 0.66, mesh: 0.64, sy: 0.9, top: 0.8, drop: 0.42, depth: 0.16 },
  { name: 'canine_crown', w: 0.76, mesh: 0.6, top: 0.92, drop: 0.45, depth: 0.2 },
  { name: 'premolar_crown', w: 0.7, mesh: 0.76, rot: Math.PI / 2, top: 0.62, drop: 0.36, depth: 0.42 },
  { name: 'premolar_crown', w: 0.66, mesh: 0.76, rot: Math.PI / 2, top: 0.62, drop: 0.36, depth: 0.42 },
  { name: 'molar_crown', w: 1.0, mesh: 1.12, top: 0.62, drop: 0.34, depth: 0.5 },
  { name: 'molar_crown', w: 0.92, mesh: 1.12, top: 0.62, drop: 0.34, depth: 0.5 },
];

// opts: teethMat, gumMat, missing (set of "side:index" keys like "1:3"), crooked (random offsets), z (front offset)
export function buildArch(kit, opts = {}) {
  const { part } = kit;
  const teethMat = opts.teethMat || kit.M.archTeeth;
  const gumMat = opts.gumMat || kit.M.archGum;
  const missing = new Set(opts.missing || []);
  const arch = makeArchCurve();
  const inner = new THREE.Group();
  inner.position.z = opts.z ?? 1.7;
  let rng = opts.seed ?? 7;
  const rand = () => { rng = (rng * 16807) % 2147483647; return rng / 2147483647 - 0.5; };
  const teeth = [];
  const bounds = [];
  for (const side of [1, -1]) {
    let s = 0;
    UPPER_TEETH.forEach((t, i) => {
      const c = side * (s + t.w / 2);
      bounds.push(side * s);
      s += t.w + 0.015;
      const { p, t: tan } = arch.at(c);
      const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      const slot = new THREE.Group();
      slot.position.copy(p);
      slot.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tan.clone().negate(), new THREE.Vector3(0, -1, 0), n));
      const tooth = new THREE.Group();
      const mesh = part(t.name, teethMat);
      const sc = t.w / t.mesh;
      mesh.scale.set(sc, sc * (t.sy || 1), sc);
      if (t.rot) mesh.rotation.y = t.rot;
      mesh.position.y = 0.06;
      tooth.add(mesh);
      slot.add(tooth);
      const key = `${side}:${i}`;
      const gone = missing.has(key);
      if (!gone) inner.add(slot);
      const front = i < 3 ? 1 : i < 5 ? 0.6 : 0.3;
      teeth.push({
        key, i, side, c, p: p.clone(), n, tan: tan.clone(), slot, tooth, mesh, spec: t, sc, missing: gone,
        // Where a bracket sits on this tooth (tooth space) and how far it sticks out.
        bracketY: t.top * sc * (t.sy || 1) + 0.06 - t.drop,
        bracketZ: t.depth * sc + 0.02,
        off: opts.crooked
          ? { ry: rand() * 0.55 * front, rz: rand() * 0.22 * front, z: rand() * 0.22 * front, y: rand() * 0.08 * front }
          : { ry: 0, rz: 0, z: 0, y: 0 },
      });
    });
    bounds.push(side * s);
  }
  const papilla = (s) => {
    let best = 1;
    for (const b of bounds) best = Math.min(best, Math.abs(Math.abs(b) - Math.abs(s)));
    return Math.pow(Math.min(1, Math.max(0, 1 - best / 0.35)), 2);
  };
  const gum = makeGum(arch, 5.7, opts.smooth ? () => 0 : papilla, gumMat, { widen: opts.gumWiden || 0 });
  inner.add(gum);
  // Point on a tooth (tooth space) in the arch group's space.
  const onTooth = (t, local) => local.clone().applyQuaternion(t.slot.quaternion).add(t.p).add(inner.position);
  // Apply a 0..1 "crookedness" to every tooth.
  const setCrooked = (k) => {
    for (const t of teeth) {
      t.tooth.rotation.set(0, t.off.ry * k, t.off.rz * k);
      t.tooth.position.set(0, t.off.y * k, t.off.z * k);
    }
  };
  return { group: inner, arch, teeth, gum, onTooth, setCrooked, papilla };
}

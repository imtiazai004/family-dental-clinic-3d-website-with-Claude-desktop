import * as THREE from 'three';
import { makeFixture, makeAbutment, makeArchCurve, makeGum } from './procedural.js';

// 3D models for the implant-type cards. Each model can come apart: explode(k), k from 0 (together) to 1 (apart).
// parts[].label + anchor are the labels shown in the open card.

const TEETH = [
  { name: 'incisor_crown', w: 0.85, mesh: 0.64 },
  { name: 'incisor_crown', w: 0.66, mesh: 0.64, sy: 0.9 },
  { name: 'canine_crown', w: 0.76, mesh: 0.6 },
  { name: 'premolar_crown', w: 0.7, mesh: 0.76, rot: Math.PI / 2 },
  { name: 'premolar_crown', w: 0.66, mesh: 0.76, rot: Math.PI / 2 },
  { name: 'molar_crown', w: 1.0, mesh: 1.12 },
  { name: 'molar_crown', w: 0.92, mesh: 1.12 },
];

// A full arch of teeth on a pink base, built like the smile-studio arch, then turned over to sit as a lower jaw.
function fullArch(kit, teethMat, baseMat) {
  const { part } = kit;
  const arch = makeArchCurve();
  const inner = new THREE.Group();
  const bounds = [];
  for (const side of [1, -1]) {
    let s = 0;
    for (const t of TEETH) {
      const c = side * (s + t.w / 2);
      bounds.push(side * s);
      s += t.w + 0.015;
      const { p, t: tan } = arch.at(c);
      const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      const slot = new THREE.Group();
      slot.position.copy(p);
      slot.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tan.clone().negate(), new THREE.Vector3(0, -1, 0), n));
      const mesh = part(t.name, teethMat);
      const sc = t.w / t.mesh;
      mesh.scale.set(sc, sc * (t.sy || 1), sc);
      if (t.rot) mesh.rotation.y = t.rot;
      mesh.position.y = 0.06;
      slot.add(mesh);
      inner.add(slot);
    }
    bounds.push(side * s);
  }
  const papilla = (s) => {
    let best = 1;
    for (const b of bounds) best = Math.min(best, Math.abs(Math.abs(b) - Math.abs(s)));
    return Math.pow(Math.min(1, Math.max(0, 1 - best / 0.35)), 2);
  };
  inner.add(makeGum(arch, 5.7, papilla, baseMat));
  const g = new THREE.Group();
  g.add(inner);
  g.rotation.z = Math.PI; // teeth up, like a lower jaw
  g.position.z = 2.2;     // centre the horseshoe on the origin
  // Map an arch position (arc length s) to this model's space, at height y.
  const toModel = (s, y) => {
    const { p } = arch.at(s);
    return new THREE.Vector3(-p.x, y, p.z + 2.2);
  };
  return { g, toModel };
}

// An implant (with an optional head piece) standing in the model at `pos`, tilted towards `toward` by `tilt`.
function implantAt(M, pos, tilt = 0, toward = null) {
  const g = new THREE.Group();
  g.add(makeFixture(M));
  g.position.copy(pos);
  if (tilt && toward) {
    const dir = new THREE.Vector3(0, -1, 0).multiplyScalar(Math.cos(tilt)).addScaledVector(toward, Math.sin(tilt)).normalize();
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  }
  return g;
}

export function buildTypeModel(kit, key) {
  const { M, part } = kit;
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);
  const parts = [];
  const add = (obj, out, label = null, anchor = null) => {
    pivot.add(obj);
    parts.push({ obj, rest: obj.position.clone(), out: new THREE.Vector3(...out), label, anchor: anchor && new THREE.Vector3(...anchor) });
  };
  let view = { rx: 0.18, ry: -0.5 };

  if (key === 'single') {
    const fixture = makeFixture(M); fixture.position.y = -0.3;
    const abutment = makeAbutment(M); abutment.position.y = -0.3;
    const crown = part('molar_enamel', M.porcelain);
    add(crown, [0, 1.15, 0], 'Crown', [0.45, 0.45, 0.2]);
    add(abutment, [0, 0.55, 0], 'Abutment', [0.17, 0.3, 0.1]);
    add(fixture, [0, -0.35, 0], 'Implant', [0.2, -0.5, 0.1]);
  } else if (key === 'bridge') {
    const bridge = new THREE.Group();
    for (const x of [-1.0, 0, 1.0]) {
      const c = part('molar_enamel', M.porcelain);
      c.position.x = x;
      c.scale.setScalar(0.98);
      bridge.add(c);
    }
    const abut = new THREE.Group();
    const fix = new THREE.Group();
    for (const x of [-1.0, 1.0]) {
      const a = makeAbutment(M); a.position.set(x, -0.3, 0); abut.add(a);
      const f = makeFixture(M); f.position.set(x, -0.3, 0); fix.add(f);
    }
    add(bridge, [0, 1.2, 0], 'Bridge of three teeth', [0.45, 0.6, 0.2]);
    add(abut, [0, 0.55, 0], 'Abutments', [1.17, 0.3, 0.1]);
    add(fix, [0, -0.35, 0], 'Two implants', [1.2, -0.6, 0.1]);
    view = { rx: 0.2, ry: -0.35 };
  } else if (key === 'overdenture' || key === 'allonx') {
    const fixed = key === 'allonx';
    const { g: arch, toModel } = fullArch(kit, M.porcelain, M.acrylic);
    const front = toModel(0, 0);
    const heads = new THREE.Group();
    const implants = new THREE.Group();
    const spots = fixed ? [-2.4, -0.75, 0.75, 2.4] : [-1.9, -0.65, 0.65, 1.9];
    for (const s of spots) {
      const top = toModel(s, -0.42);
      const back = Math.abs(s) > 2;
      const toward = new THREE.Vector3(front.x - top.x, 0, front.z - top.z).normalize();
      const imp = implantAt(M, top, fixed && back ? 0.52 : 0, toward);
      imp.scale.setScalar(0.85);
      implants.add(imp);
      // Overdenture: ball attachments the denture clips onto. All-on-X: short screw-retained heads.
      const head = fixed
        ? new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.2, 24), M.abutment)
        : new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), M.abutment);
      head.position.copy(top).add(new THREE.Vector3(0, fixed ? 0.1 : 0.08, 0));
      heads.add(head);
    }
    add(arch, [0, 1.5, 0], fixed ? 'Fixed full-arch bridge' : 'Removable denture', [0.3, -0.6, 0.1]);
    add(heads, [0, 0.0, 0], fixed ? 'Screw-in connectors' : 'Clip-on attachments', null);
    add(implants, [0, -0.15, 0], fixed ? 'Back implants angled' : 'Implants', null);
    // Labels sit on specific pieces: the front-right head and the back-right (or right) implant.
    // Labels sit on specific pieces, on opposite sides so they don't overlap.
    parts[1].anchorObj = heads.children[2]; parts[1].anchor = new THREE.Vector3(0.1, 0.05, 0);
    parts[2].anchorObj = implants.children[0]; parts[2].anchor = new THREE.Vector3(0.15, -0.95, 0);
    view = { rx: 0.62, ry: 0.0 };
  }

  pivot.rotation.set(view.rx, view.ry, 0);
  root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });

  const box = new THREE.Box3();
  const sphere = new THREE.Sphere();
  return {
    root, pivot, parts, view,
    explode(k) {
      for (const p of parts) p.obj.position.copy(p.rest).addScaledVector(p.out, k);
    },
    // Scale and centre the model so its on-screen box fills a view of the given visible height and width.
    fit(visH, visW, fill = 0.8) {
      root.scale.setScalar(1);
      root.position.set(0, 0, 0);
      root.updateMatrixWorld(true);
      box.setFromObject(pivot, true);
      const w = box.max.x - box.min.x, h = box.max.y - box.min.y;
      const s = Math.min((visW * fill) / w, (visH * fill) / h);
      box.getCenter(sphere.center);
      root.scale.setScalar(s);
      root.position.copy(sphere.center).multiplyScalar(-s);
    },
    labelPoint(i, out) {
      const p = parts[i];
      const obj = p.anchorObj || p.obj;
      return obj.localToWorld(out.copy(p.anchor || new THREE.Vector3()));
    },
  };
}

import * as THREE from 'three';

// A model for a "type" card that can come apart: explode(k), k from 0 (together) to 1 (apart).
// add(obj, out, label, anchor) registers a piece; out is how far it moves when apart.
export function makeModel(view = { rx: 0.18, ry: -0.5 }) {
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);
  const parts = [];
  const box = new THREE.Box3();
  const c = new THREE.Vector3();
  const model = {
    root, pivot, parts, view,
    add(obj, out, label = null, anchor = null, anchorObj = null) {
      pivot.add(obj);
      parts.push({ obj, rest: obj.position.clone(), out: new THREE.Vector3(...out), label, anchor: anchor && new THREE.Vector3(...anchor), anchorObj });
      return obj;
    },
    explode(k) {
      for (const p of parts) if (p.obj) p.obj.position.copy(p.rest).addScaledVector(p.out, k);
      model.onExplode?.(k);
    },
    fit(visH, visW, fill = 0.8) {
      root.scale.setScalar(1);
      root.position.set(0, 0, 0);
      root.updateMatrixWorld(true);
      box.setFromObject(pivot, true);
      const w = box.max.x - box.min.x, h = box.max.y - box.min.y;
      const s = Math.min((visW * fill) / w, (visH * fill) / h);
      box.getCenter(c);
      root.scale.setScalar(s);
      root.position.copy(c).multiplyScalar(-s);
    },
    // An extra label on a piece that is already registered (it does not move on its own).
    label(text, anchorObj, anchor) {
      parts.push({ obj: null, label: text, anchorObj, anchor: new THREE.Vector3(...anchor) });
    },
    labelPoint(i, out) {
      const p = parts[i];
      return (p.anchorObj || p.obj).localToWorld(out.copy(p.anchor || new THREE.Vector3()));
    },
    finish() {
      pivot.rotation.set(view.rx, view.ry, 0);
      root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
      return model;
    },
  };
  return model;
}

// A small row of front teeth (upper incisors and canines, tips pointing down), centred on the origin.
export function frontTeeth(kit, mat, count = 4) {
  const { part } = kit;
  const specs = [
    { name: 'canine_crown', w: 0.76, mesh: 0.6 },
    { name: 'incisor_crown', w: 0.66, mesh: 0.64, sy: 0.9 },
    { name: 'incisor_crown', w: 0.85, mesh: 0.64 },
    { name: 'incisor_crown', w: 0.85, mesh: 0.64 },
    { name: 'incisor_crown', w: 0.66, mesh: 0.64, sy: 0.9 },
    { name: 'canine_crown', w: 0.76, mesh: 0.6 },
  ];
  const pick = count === 4 ? specs.slice(1, 5) : count === 2 ? specs.slice(2, 4) : specs;
  const total = pick.reduce((a, s) => a + s.w + 0.015, 0);
  let x = -total / 2;
  const teeth = [];
  const g = new THREE.Group();
  for (const s of pick) {
    const cx = x + s.w / 2;
    x += s.w + 0.015;
    const slot = new THREE.Group();
    // a gentle curve so the row looks like the front of an arch
    slot.position.set(cx, 0, -0.18 * cx * cx);
    slot.rotation.set(0, -cx * 0.35, Math.PI);
    const m = part(s.name, mat);
    const sc = s.w / s.mesh;
    m.scale.set(sc, sc * (s.sy || 1), sc);
    slot.add(m);
    g.add(slot);
    teeth.push({ slot, mesh: m, name: s.name, w: s.w, sc, sy: s.sy || 1 });
  }
  // A strip of gum along the tops of the teeth, so they read as teeth in a mouth.
  if (kit.M.archGum) {
    const pts = teeth.map((t) => t.slot.position.clone().add(new THREE.Vector3(0, 0.06, -0.02)));
    pts.unshift(pts[0].clone().add(new THREE.Vector3(-0.32, 0.02, -0.08)));
    pts.push(pts[pts.length - 1].clone().add(new THREE.Vector3(0.32, 0.02, -0.08)));
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.27, 20, false);
    tube.setAttribute('_surf', new THREE.Float32BufferAttribute(new Float32Array(tube.attributes.position.count * 3).fill(1), 3));
    const gum = new THREE.Mesh(tube, kit.M.archGum);
    gum.userData.gum = true;
    gum.scale.set(1, 0.8, 1);
    g.add(gum);
    for (const end of [0, pts.length - 1]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 14), kit.M.archGum);
      cap.geometry.setAttribute('_surf', new THREE.Float32BufferAttribute(new Float32Array(cap.geometry.attributes.position.count * 3).fill(1), 3));
      cap.position.copy(pts[end]);
      cap.userData.gum = true;
      cap.scale.set(1, 0.8, 1);
      g.add(cap);
    }
  }
  return { g, teeth };
}

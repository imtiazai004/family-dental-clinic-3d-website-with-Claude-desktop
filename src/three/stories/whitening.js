import * as THREE from 'three';
import { buildArch } from '../arch.js';
import { frontShell, frontShellGeometry } from '../shells.js';
import { steps, frame, ease, lerp, clamp, V, glowBall, glowRing, colorPath, noCull } from './core.js';

// Teeth whitening, six steps: shade check, gums protected, gel, lifting the stains, result, keeping it white.
const K = [
  { s: 1.0, f: 0.22, ry: 0.0, rx: 0.08 },
  { s: 1.05, f: 0.05, ry: 0.18, rx: 0.1 },
  { s: 1.05, f: 0.08, ry: -0.2, rx: 0.06 },
  { s: 1.05, f: 0.1, ry: 0.0, rx: 0.08 },
  { s: 1.0, f: 0.22, ry: 0.0, rx: 0.08 },
  { s: 0.95, f: 0.1, ry: 0.0, rx: 0.14 },
];
const HERO = { s: 0.88, f: 0.1, x: -0.35, ry: 0.22, rx: 0.1 };
const TABS = ['#fbf6ea', '#f6eedb', '#f1e5c9', '#ecdcb8', '#e6d1a5', '#dfc593', '#d6b882', '#cba874'];
const BEFORE = 6, AFTER = 1;

export function build(kit) {
  const { M } = kit;
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);
  const teethMat = M.fresh('archTeeth');
  const base = teethMat.color.clone();
  const SHADE = [new THREE.Color(TABS[BEFORE]).lerp(new THREE.Color('#c9a46a'), 0.25), base];
  const A = buildArch(kit, { teethMat, gumMat: M.archGum });
  pivot.add(A.group);

  const smile = A.teeth.filter((t) => t.i < 5).sort((a, b) => a.c - b.c);
  const central = A.teeth.find((t) => t.side === 1 && t.i === 0);
  const mid = A.onTooth(central, V(0, 0, 0));

  // Shade guide: a row of small tooth-shaped tabs, light to dark, below the smile.
  const guide = new THREE.Group();
  const tabGeo = frontShellGeometry(kit, 'incisor_crown', { push: 0 });
  TABS.forEach((c, i) => {
    const m = new THREE.Mesh(tabGeo, new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, side: THREE.DoubleSide }));
    m.rotation.z = Math.PI;
    m.scale.setScalar(0.42);
    m.position.set((i - (TABS.length - 1) / 2) * 0.3, 0, 0);
    guide.add(m);
  });
  const pick = glowRing(0.2, 0.014, '#ffd27a');
  pick.rotation.x = 0;
  pick.scale.set(0.8, 1.25, 1);
  guide.add(pick);
  guide.position.set(0, mid.y - 1.18, mid.z + 0.35);
  pivot.add(guide);

  // Gum barrier along the gum line of the smile teeth.
  const pts = smile.map((t) => A.onTooth(t, V(0, 0.1, t.spec.depth * t.sc + 0.13)));
  const barrierGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 160, 0.07, 10, false);
  const barrier = new THREE.Mesh(barrierGeo, new THREE.MeshPhysicalMaterial({ color: '#3fbfae', roughness: 0.38, clearcoat: 0.6, transparent: true }));
  const barrierCount = barrierGeo.index.count;
  pivot.add(barrier);

  // Whitening gel on the front of each smile tooth, and a soft light over the gel.
  const gelMat = new THREE.MeshPhysicalMaterial({ color: '#9ad8ff', roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0, depthWrite: false, emissive: new THREE.Color('#2a88c8'), emissiveIntensity: 0 });
  const gels = smile.map((t) => {
    const g = frontShell(kit, t.spec.name, gelMat, t.mesh, { push: 0.045 });
    g.visible = false;
    t.tooth.add(g);
    return g;
  });
  const arcPts = smile.map((t) => A.onTooth(t, V(0, 0.5, t.spec.depth * t.sc + 0.85)));
  const arc = new THREE.CatmullRomCurve3(arcPts, false, 'centripetal');
  const lampMat = (o) => new THREE.MeshBasicMaterial({ color: '#a8d8ff', transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const lamp = new THREE.Group();
  lamp.add(new THREE.Mesh(new THREE.TubeGeometry(arc, 120, 0.035, 10, false), lampMat(0.7)));
  lamp.add(new THREE.Mesh(new THREE.TubeGeometry(arc, 120, 0.12, 12, false), lampMat(0.18)));
  lamp.add(new THREE.Mesh(new THREE.TubeGeometry(arc, 120, 0.3, 12, false), lampMat(0.06)));
  pivot.add(lamp);

  // Stain specks lifting away from the teeth.
  const specks = new THREE.Group();
  smile.forEach((t, k) => {
    for (let j = 0; j < 3; j++) {
      const s = glowBall(0.045, '#ffbf6a', 0);
      s.userData = { t, k, j, y: 0.25 + j * 0.2, ph: (k * 3 + j) * 0.37 };
      specks.add(s);
    }
  });
  pivot.add(specks);
  const glints = [smile[4], smile[6]].map((t) => {
    const g = glowBall(0.06, '#ffffff', 0);
    g.position.set(0.05, t.bracketY - 0.1, t.bracketZ + 0.06);
    t.tooth.add(g);
    return g;
  });

  const tmp = new THREE.Vector3();
  const state = { labels: {} };
  function update(p, t, pointer, heroK = 0) {
    const at = steps(K.length, p);
    const hk = ease(clamp(heroK));
    frame(pivot, K, HERO, p, heroK, pointer, t, { spin: ease(at(5, 0.5, 1)) * Math.PI * 2 });

    // 1. shade check (and again in 5)
    const g1 = at(0, 0.15, 0.4) * (1 - at(0, 0.85, 1));
    const g5 = at(4, 0.3, 0.5) * (1 - at(4, 0.9, 1));
    const gOn = Math.max(g1, g5);
    guide.visible = gOn > 0.01;
    guide.scale.setScalar(Math.max(0.001, ease(gOn)));
    const idx = g5 > 0 ? lerp(BEFORE, AFTER, ease(at(4, 0.45, 0.7))) : BEFORE;
    pick.position.set((idx - (TABS.length - 1) / 2) * 0.3, -0.17, 0.03);
    pick.material.opacity = gOn * 0.9;

    // 2. gum barrier drawn along the gum line; off in 5
    const draw = ease(at(1, 0.15, 0.75));
    const off = ease(at(4, 0.0, 0.25));
    barrierGeo.setDrawRange(0, Math.floor((draw * barrierCount) / 3) * 3);
    barrier.visible = draw > 0.001 && off < 0.999;
    barrier.material.opacity = 1 - off;

    // 3. gel painted tooth by tooth; 4. working under the light; rinsed off in 5
    gels.forEach((g, k) => {
      const s0 = 0.1 + (k / gels.length) * 0.6;
      const on = ease(at(2, s0, s0 + 0.12));
      g.visible = on > 0.01 && off < 0.999;
      g.children[0].scale.set(1, Math.max(0.001, on), 1);
    });
    gelMat.opacity = 0.55 * (1 - off);
    const work = at(3, 0.05, 0.2) * (1 - at(3, 0.85, 1));
    gelMat.emissiveIntensity = work * (0.5 + 0.25 * Math.sin(t * 4));
    lamp.scale.setScalar(1);
    lamp.children.forEach((m, i) => { m.material.opacity = work * [0.7, 0.2, 0.07][i] * (0.8 + 0.2 * Math.sin(t * 4)); });
    lamp.visible = work > 0.01;

    // 4. stains lift: the teeth turn lighter and specks drift away
    colorPath(teethMat.color, SHADE, at(3, 0.15, 0.9));
    const lift = at(3, 0.1, 0.9);
    specks.children.forEach((s) => {
      const u = s.userData;
      const ph = (lift * 3 + u.ph) % 1;
      const a = lift > 0 && lift < 1 ? Math.sin(ph * Math.PI) * (1 - lift * 0.5) : 0;
      s.position.copy(A.onTooth(u.t, tmp.set(0, u.y, u.t.spec.depth * u.t.sc + 0.06 + ph * 0.7)));
      s.material.opacity = a * 0.8;
      s.visible = a > 0.02;
    });

    // 6. keeping it white
    const shine = at(5, 0.1, 0.2) * (1 - at(5, 0.92, 1));
    glints.forEach((g, i) => {
      const tw = Math.max(0, Math.sin(t * 2.2 + i * 2.1));
      g.material.opacity = shine * tw * tw * 0.9;
      g.visible = g.material.opacity > 0.01;
    });

    const L = state.labels;
    L.hero = hk > 0.5 ? (hk - 0.5) * 2 : 0;
    L.before = at(0, 0.4, 0.5) * (1 - at(0, 0.85, 0.95));
    L.barrier = at(1, 0.6, 0.7) * (1 - at(1, 0.92, 1));
    L.gel = at(2, 0.55, 0.65) * (1 - at(2, 0.92, 1));
    L.lift = at(3, 0.3, 0.4) * (1 - at(3, 0.85, 0.95));
    L.after = at(4, 0.65, 0.75) * (1 - at(4, 0.92, 1));
    L.keep = at(5, 0.15, 0.25) * (1 - at(5, 0.5, 0.6));
  }

  const lat = A.teeth.find((t) => t.side === -1 && t.i === 1);
  const can = A.teeth.find((t) => t.side === -1 && t.i === 2);
  const on = (t, dy = 0, dz = 0.08) => ({ obj: t.tooth, p: V(0, t.bracketY + dy, t.bracketZ + dz) });
  noCull(root);
  return {
    group: root,
    layout: 'arch',
    state,
    update,
    labels: [
      { group: 'hero', text: 'Tea, coffee and smoking stains', anchor: on(central, 0.2) },
      { group: 'before', text: 'Your shade today', anchor: { obj: pick, p: V(0, -0.3, 0) } },
      { group: 'barrier', text: 'Gums protected', anchor: { obj: can.tooth, p: V(0, 0.07, can.spec.depth * can.sc + 0.1) } },
      { group: 'gel', text: 'Whitening gel', anchor: on(lat) },
      { group: 'lift', text: 'Stains lifting', anchor: on(central, 0.1, 0.4) },
      { group: 'after', text: 'Your new shade', anchor: { obj: pick, p: V(0, -0.3, 0) } },
      { group: 'keep', text: 'A brighter, natural smile', anchor: on(central, 0.25) },
    ],
  };
}

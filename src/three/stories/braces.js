import * as THREE from 'three';
import { makeBracket } from '../procedural.js';
import { buildArch } from '../arch.js';
import { steps, frame, ease, lerp, clamp, V, ghost, noCull } from './core.js';

// Braces, seven steps: plan, brackets, wire, months of movement, adjustments, brackets off, retainer.
const K = [
  { s: 1.0, f: 0.05, ry: 0.0, rx: 0.12 },
  { s: 1.25, f: 0.0, ry: 0.42, rx: 0.06 },
  { s: 1.15, f: 0.0, ry: -0.38, rx: 0.06 },
  { s: 1.0, f: 0.05, ry: 0.0, rx: 0.1 },
  { s: 1.45, f: -0.05, ry: 0.18, rx: 0.04 },
  { s: 1.05, f: 0.05, ry: 0.0, rx: 0.1 },
  { s: 1.0, f: 0.05, ry: 0.0, rx: 0.22 },
];
const HERO = { s: 0.95, f: 0.05, ry: 0.25, rx: 0.12 };
const MONTHS = [1, 4, 8, 12, 18];

export function build(kit) {
  const { M } = kit;
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);
  const A = buildArch(kit, { teethMat: M.archTeeth, gumMat: M.archGum, crooked: true });
  pivot.add(A.group);

  // Planned final position: a see-through copy of every tooth where it will end up.
  const planMat = ghost('#ffd27a', 1.5);
  const plan = new THREE.Group();
  for (const t of A.teeth) {
    const g = new THREE.Group();
    g.position.copy(t.slot.position);
    g.quaternion.copy(t.slot.quaternion);
    const m = t.mesh.clone(true);
    m.traverse((o) => { if (o.isMesh) o.material = planMat; });
    g.add(m);
    plan.add(g);
  }
  plan.position.copy(A.group.position);
  pivot.add(plan);

  // Brackets on the front twelve teeth, each with a coloured elastic tie.
  const tieColors = ['#c9a2ff', '#ff9fc0', '#9fd8ff'];
  const front = A.teeth.filter((t) => t.i < 6);
  const brackets = front.map((t, k) => {
    const b = makeBracket(M, 0.75);
    b.position.set(0, t.bracketY, t.bracketZ);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 20), new THREE.MeshPhysicalMaterial({ color: tieColors[k % 3], roughness: 0.35, clearcoat: 0.8 }));
    tie.position.z = 0.05;
    b.add(tie);
    t.tooth.add(b);
    return { b, tie, t, order: (t.side > 0 ? t.i : t.i + 0.5) };
  });
  brackets.sort((a, b) => a.order - b.order);

  // Wire through the bracket slots, drawn from one end to the other.
  const pts = [...front].sort((a, b) => a.c - b.c).map((t) => A.onTooth(t, V(0, t.bracketY, t.bracketZ + 0.045)));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const wireGeo = new THREE.TubeGeometry(curve, 200, 0.014, 8, false);
  const wire = new THREE.Mesh(wireGeo, M.steel);
  const wireCount = wireGeo.index.count;
  pivot.add(wire);

  // Retainer: a clear tray that slides onto the teeth at the end.
  const trayMat = new THREE.MeshPhysicalMaterial({ color: '#e8f4ff', transparent: true, opacity: 0.32, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false });
  const tray = new THREE.Group();
  for (const t of A.teeth) {
    const g = new THREE.Group();
    g.position.copy(t.slot.position);
    g.quaternion.copy(t.slot.quaternion);
    const m = t.mesh.clone(true);
    m.traverse((o) => { if (o.isMesh) o.material = trayMat; });
    m.scale.multiplyScalar(1.07);
    g.add(m);
    tray.add(g);
  }
  tray.position.copy(A.group.position);
  pivot.add(tray);

  const state = { labels: {}, month: 1 };
  function update(p, t, pointer, heroK = 0) {
    const at = steps(K.length, p);
    const hk = ease(clamp(heroK));
    frame(pivot, K, HERO, p, heroK, pointer, t, { spin: ease(at(6, 0.6, 1)) * Math.PI * 2 });

    // 1. the plan
    const planOn = at(0, 0.2, 0.45) * (1 - at(1, 0.0, 0.25));
    plan.visible = planOn > 0.01;
    planMat.uniforms.uOpacity.value = planOn * (0.7 + 0.3 * Math.sin(t * 2.4));

    // 2. brackets bonded one by one; 6. taken off
    const off = ease(at(5, 0.15, 0.6));
    brackets.forEach((b, k) => {
      const start = (k / brackets.length) * 0.75;
      const pop = at(1, 0.1 + start, 0.1 + start + 0.12);
      const s = pop < 1 ? Math.sin(pop * Math.PI * 0.5) * (1 + 0.25 * Math.sin(pop * Math.PI)) : 1;
      b.b.scale.setScalar(Math.max(0.001, s * (1 - off)));
      b.b.visible = s * (1 - off) > 0.01;
      // 5. ties change colour at an adjustment visit
      b.tie.visible = at(4, 0.2, 0.3) > 0 && off < 0.5;
    });

    // 3. wire threads through; gone with the brackets
    const draw = ease(at(2, 0.15, 0.8));
    wireGeo.setDrawRange(0, Math.floor((draw * wireCount) / 3) * 3);
    wire.visible = draw > 0.001 && off < 0.4;

    // 4. teeth move month by month (in small steps), 5. a final adjustment
    const m = at(3, 0.05, 0.95);
    const stepsDone = Math.floor(m * 4) / 4;
    const within = ease(clamp((m * 4 - Math.floor(m * 4)) / 0.6));
    const align = Math.min(1, stepsDone + within / 4) * 0.85 + ease(at(4, 0.3, 0.8)) * 0.15;
    A.setCrooked(1 - align);
    state.month = MONTHS[Math.min(MONTHS.length - 1, Math.floor(m * 4 + (at(4, 0.3, 0.5) > 0 ? 1 : 0)))];

    // 7. retainer slides up onto the teeth
    const tr = ease(at(6, 0.05, 0.45));
    tray.visible = tr > 0.001;
    tray.position.y = A.group.position.y - (1 - tr) * 1.2;
    trayMat.opacity = 0.32 * tr;

    const L = state.labels;
    L.hero = hk > 0.5 ? (hk - 0.5) * 2 : 0;
    L.plan = at(0, 0.4, 0.55) * (1 - at(0, 0.92, 1));
    L.brackets = at(1, 0.6, 0.75) * (1 - at(1, 0.95, 1));
    L.wire = at(2, 0.7, 0.8) * (1 - at(2, 0.95, 1));
    L.month = at(3, 0.08, 0.15) * (1 - at(4, 0.6, 0.7));
    L.adjust = at(4, 0.25, 0.35) * (1 - at(4, 0.9, 1));
    L.off = at(5, 0.5, 0.6) * (1 - at(5, 0.92, 1));
    L.tray = at(6, 0.4, 0.5) * (1 - at(6, 0.85, 0.95));
  }

  const incisor = A.teeth.find((t) => t.side === 1 && t.i === 0);
  const canine = A.teeth.find((t) => t.side === -1 && t.i === 2);
  noCull(root);
  return {
    group: root,
    layout: 'arch',
    state,
    update,
    labels: [
      { group: 'hero', text: 'Crowded, crooked teeth', anchor: { obj: incisor.tooth, p: V(0, -0.3, 0.3) } },
      { group: 'plan', text: 'Planned final position', anchor: { obj: canine.tooth, p: V(0, -0.2, 0.3) } },
      { group: 'brackets', text: 'Brackets bonded to each tooth', anchor: { obj: canine.tooth, p: V(0, 0.1, 0.35) } },
      { group: 'wire', text: 'The wire', anchor: { obj: incisor.tooth, p: V(0, 0.15, 0.35) } },
      { group: 'month', text: () => `Month ${state.month}`, anchor: { obj: incisor.tooth, p: V(0, -0.35, 0.3) } },
      { group: 'adjust', text: 'Adjusted every few weeks', anchor: { obj: canine.tooth, p: V(0, 0.1, 0.35) } },
      { group: 'off', text: 'Brackets off', anchor: { obj: incisor.tooth, p: V(0, -0.3, 0.3) } },
      { group: 'tray', text: 'Retainer keeps them straight', anchor: { obj: canine.tooth, p: V(0, -0.25, 0.35) } },
    ],
  };
}

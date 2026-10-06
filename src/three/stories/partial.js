import * as THREE from 'three';
import { buildArch } from '../arch.js';
import { buildPartial } from '../partial-kit.js';
import { makePalate } from '../procedural.js';
import { steps, frame, ease, lerp, clamp, V, ghost, glowBall, glowRing, noCull } from './core.js';

// Removable partial denture, six steps: the gaps, planning, the framework, replacement teeth, fitted,
// taking it out to clean. Upper jaw seen from the front.
// Seen from below (looking up at the upper teeth), so the gaps and the framework across the palate show.
const K = [
  { s: 0.78, f: -0.75, ry: 0.0, rx: -1.15 },
  { s: 0.84, f: -0.7, ry: 0.25, rx: -1.05 },
  { s: 0.8, f: -0.75, ry: 0.0, rx: -1.2 },
  { s: 0.84, f: -0.7, ry: -0.25, rx: -1.1 },
  { s: 0.84, f: -0.6, ry: 0.2, rx: -0.95 },
  { s: 0.75, f: -0.5, ry: 0.0, rx: -0.75 },
];
const HERO = { s: 0.7, f: -0.65, x: -0.35, ry: 0.3, rx: -0.95 };
const MISSING = ['1:3', '1:4', '-1:5'];

export function build(kit) {
  const { M } = kit;
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);
  const A = buildArch(kit, { teethMat: M.archTeeth, gumMat: M.archGum, missing: MISSING });
  pivot.add(A.group);
  // The roof of the mouth.
  A.group.add(makePalate(A.arch, 5.2, M.fresh('archGum')));
  const gaps = A.teeth.filter((t) => t.missing);
  // Teeth either side of a gap carry the clasps.
  const anchors = [];
  for (const g of gaps) {
    for (const di of [-1, 1]) {
      const n = A.teeth.find((t) => t.side === g.side && t.i === g.i + di && !t.missing);
      if (n && !anchors.some((a) => a.t === n)) anchors.push({ t: n, gapSign: Math.sign(g.c - n.c) });
    }
  }

  // 2. the plan: new teeth shown in the gaps, the clasp teeth marked
  const planMat = ghost('#c9b0ff', 1.5);
  const plan = new THREE.Group();
  for (const g of gaps) {
    const s = new THREE.Group();
    s.position.copy(g.slot.position);
    s.quaternion.copy(g.slot.quaternion);
    const m = g.mesh.clone(true);
    m.traverse((o) => { if (o.isMesh) o.material = planMat; });
    s.add(m);
    plan.add(s);
  }
  A.group.add(plan);
  const marks = anchors.map(({ t }) => {
    const r = glowRing(Math.max(t.spec.w * t.sc * 0.62, 0.36), 0.025, '#ffd27a');
    r.position.copy(A.onTooth(t, V(0, 0.25, 0))).sub(A.group.position);
    A.group.add(r);
    return r;
  });

  // The partial denture itself, in its own group so it can come and go as one piece.
  const P = buildPartial(kit, A, 'metal');
  const partial = new THREE.Group();
  partial.position.copy(A.group.position);
  partial.add(P.base, P.teeth);
  pivot.add(partial);
  const { strap, strapGeo, strapCurve, clasps, saddles, saddleMat, newTeeth } = P;
  const strapCount = strapGeo.index.count;

  const sparks = anchors.map(({ t }) => {
    const g = glowBall(0.06, '#ffe3a3', 0);
    g.position.copy(A.onTooth(t, V(0, 0.3, t.spec.depth * t.sc + 0.08)));
    pivot.add(g);
    return g;
  });

  const state = { labels: {} };
  function update(p, t, pointer, heroK = 0) {
    const at = steps(K.length, p);
    const hk = ease(clamp(heroK));
    frame(pivot, K, HERO, p, heroK, pointer, t, { spin: ease(at(5, 0.55, 1)) * Math.PI * 2 });

    // 2. plan
    const pl = at(1, 0.15, 0.35) * (1 - at(3, 0.2, 0.45));
    planMat.uniforms.uOpacity.value = pl * (0.7 + 0.3 * Math.sin(t * 2.4));
    plan.visible = pl > 0.01;
    const mk = at(1, 0.4, 0.55) * (1 - at(2, 0.6, 0.8));
    marks.forEach((r) => { r.material.opacity = mk * (0.55 + 0.25 * Math.sin(t * 3)); r.visible = mk > 0.01; });

    // 3. the framework draws in, below the jaw; 4. saddles and teeth; 5. it goes up into place; 6. out to clean
    const fw = ease(at(2, 0.1, 0.75));
    partial.visible = fw > 0.001;
    strapGeo.setDrawRange(0, Math.floor((fw * strapCount) / 6) * 6);
    clasps.forEach((c) => c.geo.setDrawRange(0, Math.floor((ease(at(2, 0.35, 0.9)) * c.count) / 3) * 3));
    const teeth = ease(at(3, 0.15, 0.6));
    saddles.forEach((s) => { s.visible = teeth > 0.01; s.scale.setScalar(1); });
    saddleMat.opacity = teeth;
    newTeeth.forEach((s, i) => {
      const k = ease(at(3, 0.3 + i * 0.1, 0.55 + i * 0.1));
      s.visible = k > 0.01;
      s.children[0].scale.setScalar(Math.max(0.001, k));
    });
    const fit = ease(at(4, 0.1, 0.55));
    const out = ease(at(5, 0.1, 0.45));
    partial.position.y = A.group.position.y - 1.15 * (1 - fit) - out * 1.0;
    const flash = at(4, 0.5, 0.56) * (1 - at(4, 0.64, 0.76));
    sparks.forEach((s) => { s.material.opacity = flash * (0.6 + 0.4 * Math.sin(t * 12)); s.visible = flash > 0.01; });

    const L = state.labels;
    L.hero = hk > 0.5 ? (hk - 0.5) * 2 : 0;
    L.gaps = at(0, 0.3, 0.45) * (1 - at(0, 0.9, 1));
    L.plan = at(1, 0.3, 0.4) * (1 - at(1, 0.9, 1));
    L.clasp = at(1, 0.55, 0.65) * (1 - at(1, 0.95, 1));
    L.frame = at(2, 0.6, 0.7) * (1 - at(2, 0.93, 1));
    L.teeth = at(3, 0.6, 0.7) * (1 - at(3, 0.93, 1));
    L.fit = at(4, 0.55, 0.65) * (1 - at(4, 0.93, 1));
    L.out = at(5, 0.3, 0.4) * (1 - at(5, 0.55, 0.65));
  }

  const gapR = gaps.find((g) => g.side === 1);
  const anchorL = anchors.find((a) => a.t.side === -1).t;
  noCull(root);
  return {
    group: root,
    layout: 'arch',
    state,
    update,
    labels: [
      { group: 'hero', text: 'A few missing teeth', anchor: { obj: A.group, p: gapR.p.clone().setY(-0.35).addScaledVector(gapR.n, 0.3) } },
      { group: 'gaps', text: 'Gaps where teeth are missing', anchor: { obj: A.group, p: gapR.p.clone().setY(-0.35).addScaledVector(gapR.n, 0.3) } },
      { group: 'plan', text: 'New teeth planned for each gap', anchor: { obj: plan, p: gapR.p.clone().setY(-0.45).addScaledVector(gapR.n, 0.3) } },
      { group: 'clasp', text: 'These teeth will hold it', anchor: { obj: marks[0], p: V(0.4, 0, 0) } },
      { group: 'frame', text: 'A thin metal framework', anchor: { obj: strap, p: strapCurve.getPoint(0.5) } },
      { group: 'teeth', text: 'New teeth on gum-coloured bases', anchor: { obj: newTeeth[0], p: V(0, 0.4, 0.4) } },
      { group: 'fit', text: 'Clasps hold it in place', anchor: { obj: anchorL.tooth, p: V(0, 0.3, anchorL.spec.depth * anchorL.sc + 0.1) } },
      { group: 'out', text: 'Take it out to clean', anchor: { obj: strap, p: strapCurve.getPoint(0.5) } },
    ],
  };
}

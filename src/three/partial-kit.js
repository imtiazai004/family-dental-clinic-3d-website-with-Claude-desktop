import * as THREE from 'three';
import { makeGum, makePalate } from './procedural.js';
import { projector } from './shells.js';

// A removable partial denture for an arch from buildArch() with some teeth missing.
// kind: 'metal' (thin metal framework and clasps), 'acrylic' (gum-coloured plate, wire clasps)
// or 'flexible' (soft gum-coloured base and clasps). Everything is in the arch's own space.
export function buildPartial(kit, A, kind = 'metal') {
  const { M } = kit;
  const gaps = A.teeth.filter((t) => t.missing);
  const anchors = [];
  for (const g of gaps) {
    for (const di of [-1, 1]) {
      const n = A.teeth.find((t) => t.side === g.side && t.i === g.i + di && !t.missing);
      if (n && !anchors.some((a) => a.t === n)) anchors.push({ t: n, gapSign: Math.sign(g.c - n.c) });
    }
  }

  const steel = new THREE.MeshPhysicalMaterial({ color: '#d3d8df', metalness: 0.7, roughness: 0.3, clearcoat: 0.4, side: THREE.DoubleSide });
  const acrylic = M.fresh('acrylic');
  acrylic.transparent = true;
  acrylic.side = THREE.DoubleSide;
  const soft = new THREE.MeshPhysicalMaterial({ color: '#f29aae', roughness: 0.25, clearcoat: 1, transparent: true, opacity: 0.82, side: THREE.DoubleSide });
  const baseMat = kind === 'metal' ? steel : kind === 'flexible' ? soft : acrylic;
  const claspMat = kind === 'flexible' ? soft : steel;

  const base = new THREE.Group();
  // What joins the two sides: a thin metal strap, or a plate over the roof of the mouth.
  let strap = null, strapGeo = null, strapCurve = null;
  // The strap lies just under the roof of the mouth: heights are read off a palate surface.
  const roofMesh = makePalate(A.arch, 5.2, new THREE.MeshBasicMaterial());
  const roof = projector(roofMesh, new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1));
  const under = (p) => { const h = roof.hit(-p.x, -p.z); return p.setY((h ? h.y : 0.3) - 0.035); };
  const inner = (t, k) => under(t.p.clone().addScaledVector(t.n, -k));
  const left = gaps.filter((g) => g.side === -1), right = gaps.filter((g) => g.side === 1);
  if (kind === 'metal' && left.length && right.length) {
    const L0 = left[left.length - 1], R0 = right[right.length - 1];
    const ends = [inner(L0, 0.5), inner(R0, 0.5)];
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const u = i / 12;
      const p = ends[0].clone().lerp(ends[1], u);
      p.z -= Math.sin(u * Math.PI) * 0.35;
      pts.push(under(p));
    }
    strapCurve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    strapGeo = ribbon(strapCurve, 0.5, 120);
    strap = new THREE.Mesh(strapGeo, baseMat);
    base.add(strap);
  } else {
    strap = makePalate(A.arch, 4.6, baseMat);
    strap.material.side = THREE.DoubleSide;
    strap.position.y = 0.02;
    base.add(strap);
  }
  // Clasps around the teeth next to each gap.
  const clasps = anchors.map(({ t, gapSign }) => {
    const rx = (t.spec.w * t.sc) / 2 + 0.03, rz = t.spec.depth * t.sc + 0.05;
    const c = t.p.clone().setY(-0.28);
    const pts = [c.clone().addScaledVector(t.tan, rx * gapSign * 1.05).addScaledVector(t.n, -0.4).setY(-0.05)];
    for (let i = 0; i <= 24; i++) {
      const th = (i / 24) * Math.PI * 0.85;
      pts.push(c.clone().addScaledVector(t.tan, Math.cos(th) * rx * gapSign).addScaledVector(t.n, Math.sin(th) * rz));
    }
    const r = kind === 'flexible' ? 0.05 : kind === 'acrylic' ? 0.016 : 0.022;
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 60, r, 8, false);
    const m = new THREE.Mesh(geo, claspMat);
    base.add(m);
    return { m, geo, count: geo.index.count, t };
  });
  // Gum-coloured saddles over the gaps, carrying the new teeth.
  const saddleMat = kind === 'flexible' ? soft : acrylic;
  const saddles = groupRuns(gaps).map((run) => {
    const s0 = Math.min(...run.map((g) => g.c)) - 0.45, s1 = Math.max(...run.map((g) => g.c)) + 0.45;
    const m = makeGum(A.arch, 5.7, () => 0, saddleMat, { widen: 0.06, from: s0, to: s1 });
    base.add(m);
    return m;
  });
  const teeth = new THREE.Group();
  const newTeeth = gaps.map((g) => { teeth.add(g.slot); return g.slot; });
  return { base, teeth, strap, strapGeo, strapCurve, clasps, saddles, saddleMat, newTeeth, anchors, gaps };
}

// Neighbouring gaps on the same side share one saddle.
function groupRuns(gaps) {
  const sorted = [...gaps].sort((a, b) => a.c - b.c);
  const runs = [];
  for (const g of sorted) {
    const last = runs[runs.length - 1];
    if (last && last[0].side === g.side && Math.abs(last[last.length - 1].i - g.i) === 1) last.push(g);
    else runs.push([g]);
  }
  return runs;
}

// A flat band along a curve, widened front-to-back as it crosses the palate.
function ribbon(curve, width, n) {
  const pos = [], idx = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const p = curve.getPoint(u), t = curve.getTangent(u);
    const side = new THREE.Vector3().crossVectors(t, up).normalize();
    const w = width * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, Math.max(0, u * 1.1 - 0.05))));
    const across = new THREE.Vector3(side.x * 0.3, 0, side.z).normalize();
    pos.push(...p.clone().addScaledVector(across, w / 2).toArray(), ...p.clone().addScaledVector(across, -w / 2).toArray());
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

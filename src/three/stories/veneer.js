import * as THREE from 'three';
import { buildArch } from '../arch.js';
import { frontShell } from '../shells.js';
import { makeXray } from '../kit.js';
import { steps, frame, ease, lerp, clamp, V, ghost, glowBall, colorPath, noCull } from './core.js';

// Veneers, six steps: your smile today, planning, preparing, shade, bonding, your new smile.
const K = [
  { s: 1.02, f: 0.15, ry: 0.0, rx: 0.08 },
  { s: 1.1, f: 0.15, ry: 0.22, rx: 0.06 },
  { s: 1.2, f: 0.12, ry: -0.24, rx: 0.04 },
  { s: 0.92, f: 0.48, ry: 0.0, rx: 0.06 },
  { s: 1.1, f: 0.15, ry: 0.16, rx: 0.05 },
  { s: 0.95, f: 0.1, ry: 0.0, rx: 0.12 },
];
const HERO = { s: 0.9, f: 0.1, x: -0.15, ry: 0.24, rx: 0.1 };
const GAP = 0.035;

export function build(kit) {
  const { M } = kit;
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);
  const A = buildArch(kit, { teethMat: M.archTeeth, gumMat: M.archGum });
  pivot.add(A.group);

  // The six front teeth: stained, one chipped, a small gap between the two front teeth.
  const frontMat = M.fresh('archTeeth');
  const base = frontMat.color.clone();
  const STAIN = [new THREE.Color('#e4cfa2'), base];
  const veneerMat = M.fresh('veneer');
  veneerMat.side = THREE.DoubleSide;
  const vBase = veneerMat.color.clone();
  const SHADES = [new THREE.Color('#e4cf9f'), new THREE.Color('#fbfaf6'), new THREE.Color('#efe2c6'), vBase];
  const ghostMat = ghost('#b48cff', 3.0);
  const prepMat = makeXray('#ffe2a8', 2.4);

  const front = A.teeth.filter((t) => t.i < 3).sort((a, b) => a.i - b.i || b.side - a.side);
  const items = front.map((t) => {
    t.mesh.traverse((o) => { if (o.isMesh) o.material = frontMat; });
    const rest = { pos: t.mesh.position.clone(), scale: t.mesh.scale.clone() };
    const central = t.i === 0;
    // Tooth space: x runs against the arch direction, so this moves a front tooth away from the midline.
    const gapX = central ? -t.side * GAP : 0;
    const shell = frontShell(kit, t.spec.name, veneerMat, t.mesh);
    if (central) { shell.scale.x *= 1.06; }
    const shellRest = shell.position.clone().add(V(-gapX * 0.8, 0, 0));
    shell.visible = false;
    t.tooth.add(shell);
    const g = frontShell(kit, t.spec.name, ghostMat, t.mesh, { push: 0.03 });
    g.position.x -= gapX * 0.8;
    if (central) g.scale.x *= 1.06;
    g.visible = false;
    t.tooth.add(g);
    const prep = frontShell(kit, t.spec.name, prepMat, t.mesh, { push: 0.02 });
    prep.visible = false;
    t.tooth.add(prep);
    const flash = glowBall(0.11, '#8ab8ff', 0);
    flash.position.set(-gapX * 0.8, t.bracketY, t.bracketZ + 0.08);
    t.tooth.add(flash);
    t.tooth.position.x = gapX;
    return { t, rest, shell, shellRest, ghost: g, prep, flash, chip: t.side === -1 && central ? 0.88 : 1 };
  });

  // A glint of light across the finished smile.
  const glints = [items[0], items[3]].map((it) => {
    const g = glowBall(0.06, '#ffffff', 0);
    g.position.set(0.08, it.t.bracketY - 0.12, it.t.bracketZ + 0.06);
    it.t.tooth.add(g);
    return g;
  });

  const state = { labels: {} };
  function update(p, t, pointer, heroK = 0) {
    const at = steps(K.length, p);
    const hk = ease(clamp(heroK));
    frame(pivot, K, HERO, p, heroK, pointer, t, { spin: ease(at(5, 0.5, 1)) * Math.PI * 2 });

    // 2. the planned shape, shown over the teeth
    const plan = at(1, 0.15, 0.4) * (1 - at(1, 0.85, 1));
    ghostMat.uniforms.uOpacity.value = plan * (0.75 + 0.25 * Math.sin(t * 2.6));

    items.forEach((it, k) => {
      const { t: tooth } = it;
      it.ghost.visible = plan > 0.01;

      // 3. a very thin layer polished from the front, tooth by tooth
      const s0 = 0.1 + k * 0.12;
      const glow = at(2, s0, s0 + 0.06) * (1 - at(2, s0 + 0.12, s0 + 0.2));
      it.prep.visible = glow > 0.01;
      const thin = ease(at(2, s0 + 0.04, s0 + 0.16));
      tooth.mesh.scale.set(it.rest.scale.x, it.rest.scale.y * it.chip, it.rest.scale.z * (1 - 0.04 * thin));

      // 4. veneers appear in front of the smile while the shade is matched; 5. bonded one by one
      const appear = ease(at(3, 0.08 + k * 0.04, 0.32 + k * 0.04));
      const b0 = 0.06 + k * 0.12;
      const fly = ease(at(4, b0, b0 + 0.13));
      it.shell.visible = appear > 0.001;
      it.shell.position.copy(it.shellRest).add(V(0, 0.95 * (1 - fly), 0.6 * (1 - fly)));
      const sc = Math.max(0.001, appear);
      it.shell.children[0].scale.setScalar(sc);
      it.shell.children[0].rotation.y = (1 - fly) * Math.sin(t * 1.2 + k) * 0.25;
      const fl = at(4, b0 + 0.11, b0 + 0.14) * (1 - at(4, b0 + 0.18, b0 + 0.26));
      it.flash.material.opacity = fl * 0.5;
      it.flash.visible = fl > 0.01;
    });
    prepMat.uniforms.uOpacity.value = 0.6 + 0.4 * Math.sin(t * 9);
    colorPath(veneerMat.color, SHADES, at(3, 0.35, 0.92));
    colorPath(frontMat.color, STAIN, at(4, 0.8, 0.98));

    // 6. your new smile
    const shine = at(5, 0.1, 0.2) * (1 - at(5, 0.9, 1));
    glints.forEach((g, i) => {
      const tw = Math.max(0, Math.sin(t * 2.2 + i * 2.1));
      g.material.opacity = shine * tw * tw * 0.9;
      g.visible = g.material.opacity > 0.01;
    });

    const L = state.labels;
    L.hero = hk > 0.5 ? (hk - 0.5) * 2 : 0;
    L.today = at(0, 0.3, 0.45) * (1 - at(0, 0.9, 1));
    L.plan = at(1, 0.35, 0.45) * (1 - at(1, 0.85, 0.95));
    L.prep = at(2, 0.3, 0.4) * (1 - at(2, 0.9, 1));
    L.shade = at(3, 0.5, 0.6) * (1 - at(3, 0.92, 1));
    L.bond = at(4, 0.2, 0.3) * (1 - at(4, 0.9, 1));
    L.smile = at(5, 0.15, 0.25) * (1 - at(5, 0.5, 0.6));
  }

  const c = items[0].t, lat = items.find((it) => it.t.i === 1 && it.t.side === -1).t, can = items.find((it) => it.t.i === 2 && it.t.side === -1).t;
  const on = (t, dy = 0, dz = 0.08) => ({ obj: t.tooth, p: V(0, t.bracketY + dy, t.bracketZ + dz) });
  noCull(root);
  return {
    group: root,
    layout: 'arch',
    state,
    update,
    labels: [
      { group: 'hero', text: 'Chipped, stained front teeth', anchor: on(c, 0.2) },
      { group: 'today', text: 'Chips, stains and a small gap', anchor: on(c, 0.2) },
      { group: 'plan', text: 'Planned shape and length', anchor: on(lat, 0.1) },
      { group: 'prep', text: 'A very thin layer polished away', anchor: on(can) },
      { group: 'shade', text: 'Shade matched to your smile', anchor: { obj: items[0].shell, p: V(0, 0.5, 0.3) } },
      { group: 'bond', text: 'Bonded, then set with a blue light', anchor: on(lat) },
      { group: 'smile', text: 'Your new smile', anchor: on(c, 0.25) },
    ],
  };
}

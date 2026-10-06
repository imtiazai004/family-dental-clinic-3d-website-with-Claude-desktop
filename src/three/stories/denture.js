import * as THREE from 'three';
import { buildArch } from '../arch.js';
import { makeArchCurve, makeGum, makePalate } from '../procedural.js';
import { steps, frame, ease, lerp, clamp, V, ghost, glowBall, colorPath, noCull } from './core.js';

// Complete denture, seven steps: gums today, impressions, bite record, try-in, made, fitted, looking after it.
// Upper jaw seen from the front, as on the braces page.
const K = [
  { s: 0.72, f: -0.75, ry: 0.0, rx: -1.1 },
  { s: 0.75, f: -0.6, ry: 0.3, rx: -0.85 },
  { s: 1.05, f: 0.05, ry: -0.28, rx: 0.1 },
  { s: 1.1, f: 0.1, ry: 0.2, rx: 0.08 },
  { s: 0.95, f: 0.45, ry: 0.0, rx: 0.2 },
  { s: 1.05, f: 0.1, ry: -0.2, rx: 0.1 },
  { s: 0.95, f: 0.35, ry: 0.0, rx: 0.2 },
];
const HERO = { s: 0.68, f: -0.65, x: -0.35, ry: 0.25, rx: -0.95 };
const WAX = new THREE.Color('#e9a07f');

export function build(kit) {
  const { M } = kit;
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);
  const arch = makeArchCurve();
  const space = (g) => { g.position.z = 1.7; pivot.add(g); return g; };

  // Your gums with no teeth: a smooth ridge and the roof of the mouth.
  const ridge = space(new THREE.Group());
  const ridgeGum = makeGum(arch, 5.7, () => 0, M.fresh('archGum'));
  const roof = makePalate(arch, 5.2, M.fresh('archGum'));
  roof.position.y = 0.06;
  ridge.add(ridgeGum, roof);

  // Impression: a metal tray of soft lilac material pressed up over the gums.
  const tray = space(new THREE.Group());
  const lilac = new THREE.MeshPhysicalMaterial({ color: '#b9a6ea', roughness: 0.55, clearcoat: 0.3, side: THREE.DoubleSide });
  const imp = makeGum(arch, 5.7, () => 0, lilac, { widen: 0.12 });
  const trayMetal = new THREE.MeshPhysicalMaterial({ color: '#d3d8df', metalness: 0.7, roughness: 0.3, clearcoat: 0.4, side: THREE.DoubleSide });
  const steelTray = makeGum(arch, 5.7, () => 0, trayMetal, { widen: 0.3 });
  steelTray.position.y = -0.04;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 1.0), trayMetal);
  handle.position.set(0, -0.12, 0.85);
  tray.add(imp, steelTray, handle);

  // Bite record: a wax rim on a base, with the midline and smile line marked.
  const rim = space(new THREE.Group());
  const waxMat = new THREE.MeshPhysicalMaterial({ color: WAX, roughness: 0.45, clearcoat: 0.4, transparent: true });
  const pts = [];
  for (let i = 0; i <= 60; i++) { const s = -5.2 + (10.4 * i) / 60; pts.push(arch.at(s).p.clone().setY(-0.42)); }
  const rimBar = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.3, 16, false), waxMat);
  rimBar.scale.y = 1.25;
  const rimBase = makeGum(arch, 5.7, () => 0, waxMat, { widen: 0.05 });
  const lineMat = new THREE.MeshBasicMaterial({ color: '#5a2c2a', transparent: true });
  const smilePts = [];
  for (let i = 0; i <= 30; i++) {
    const s = -2.2 + (4.4 * i) / 30;
    const { p, t } = arch.at(s);
    const n = new THREE.Vector3(-t.z, 0, t.x).normalize();
    smilePts.push(p.clone().addScaledVector(n, 0.305).setY(-0.36));
  }
  const smileLine = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(smilePts), 60, 0.008, 6, false), lineMat);
  const n0 = (() => { const { t } = arch.at(0); return new THREE.Vector3(-t.z, 0, t.x).normalize(); })();
  const midLine = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.62, 6), lineMat);
  midLine.position.copy(arch.at(0).p).addScaledVector(n0, 0.36).setY(-0.42);
  rim.add(rimBase, rimBar, smileLine, midLine);

  // The denture: teeth set first in wax for the try-in, then made in gum-coloured acrylic.
  const baseMat = M.fresh('acrylic');
  const pink = baseMat.color.clone();
  const D = buildArch(kit, { teethMat: M.fresh('archTeeth'), gumMat: baseMat, smooth: false, gumWiden: 0.05 });
  const denture = space(D.group);
  const plate = makePalate(arch, 5.2, baseMat);
  plate.position.y = 0.02;
  denture.add(plate);
  const shapeMat = ghost('#c9b0ff', 1.6);
  const shapes = space(new THREE.Group());
  for (const t of D.teeth) {
    const g = new THREE.Group();
    g.position.copy(t.slot.position);
    g.quaternion.copy(t.slot.quaternion);
    const m = t.mesh.clone(true);
    m.traverse((o) => { if (o.isMesh) o.material = shapeMat; });
    g.add(m);
    shapes.add(g);
  }

  // Fit sparkles and cleaning bubbles.
  const sparks = [-2.4, 0, 2.4].map((s) => {
    const g = glowBall(0.07, '#ffe3a3', 0);
    g.position.copy(arch.at(s).p).setY(0.0);
    g.position.z += 1.7;
    pivot.add(g);
    return g;
  });
  const bubbles = [];
  for (let i = 0; i < 18; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.05 + (i % 3) * 0.02, 16, 10), new THREE.MeshPhysicalMaterial({
      color: '#dff3ff', transparent: true, opacity: 0, roughness: 0.05, clearcoat: 1, depthWrite: false,
    }));
    const s = -4.5 + (9 * (i % 9)) / 8;
    const { p } = arch.at(s);
    b.userData = { x: p.x, z: p.z + 1.7 + (i < 9 ? 0.45 : -0.45), ph: (i * 0.37) % 1 };
    pivot.add(b);
    bubbles.push(b);
  }

  const state = { labels: {} };
  function update(p, t, pointer, heroK = 0) {
    const at = steps(K.length, p);
    const hk = ease(clamp(heroK));
    frame(pivot, K, HERO, p, heroK, pointer, t, { spin: ease(at(6, 0.55, 1)) * Math.PI * 2 });

    // 2. impression tray rises, presses, comes away
    const up = ease(at(1, 0.1, 0.4)), down = ease(at(1, 0.65, 0.92));
    tray.visible = up > 0.001 && down < 0.999;
    tray.position.y = lerp(-2.2, -0.06, up) - down * 2.2;

    // 3. wax rim on the gums, with the lines drawn on
    const rIn = ease(at(2, 0.05, 0.35)), rOut = ease(at(3, 0.05, 0.3));
    rim.visible = rIn > 0.001 && rOut < 0.999;
    rim.position.y = lerp(-1.6, 0, rIn) - rOut * 1.6;
    waxMat.opacity = 1;
    lineMat.opacity = at(2, 0.45, 0.65);
    smileLine.visible = midLine.visible = lineMat.opacity > 0.01;
    // the shape and shade of the teeth chosen, shown over the rim
    const sh = at(2, 0.65, 0.8) * (1 - at(3, 0.05, 0.25));
    shapeMat.uniforms.uOpacity.value = sh * (0.7 + 0.3 * Math.sin(t * 2.4));
    shapes.visible = sh > 0.01;

    // 4. try-in: teeth set in wax; 5. made in acrylic (lowered while it is made); 6. fitted; 7. out to clean
    const tIn = ease(at(3, 0.15, 0.45));
    const made = ease(at(4, 0.1, 0.4)), back = ease(at(5, 0.1, 0.5));
    const outC = ease(at(6, 0.1, 0.4));
    denture.visible = tIn > 0.001;
    denture.position.y = lerp(-1.6, 0, tIn) - (made - back) * 1.25 - outC * 0.9;
    colorPath(baseMat.color, [WAX, pink], ease(at(4, 0.35, 0.8)));
    plate.visible = at(4, 0.4, 0.6) > 0;
    plate.material.opacity = 1;
    // the gums are hidden under whatever sits on them
    const covered = (rIn > 0.999 && rOut < 0.001) || (tIn > 0.999 && made < 0.001) || (back > 0.999 && outC < 0.001);
    ridge.visible = !covered;

    const fitFlash = at(5, 0.45, 0.52) * (1 - at(5, 0.6, 0.72));
    sparks.forEach((s) => { s.material.opacity = fitFlash * (0.6 + 0.4 * Math.sin(t * 12)); s.visible = fitFlash > 0.01; });
    const clean = at(6, 0.3, 0.45) * (1 - at(6, 0.85, 0.95));
    bubbles.forEach((b) => {
      const u = b.userData;
      const k = (t * 0.25 + u.ph) % 1;
      b.position.set(u.x, lerp(-1.9, -0.6, k), u.z);
      b.material.opacity = clean * Math.sin(k * Math.PI) * 0.6;
      b.visible = b.material.opacity > 0.01;
    });

    const L = state.labels;
    L.hero = hk > 0.5 ? (hk - 0.5) * 2 : 0;
    L.gums = at(0, 0.3, 0.45) * (1 - at(0, 0.9, 1));
    L.imp = at(1, 0.35, 0.45) * (1 - at(1, 0.65, 0.75));
    L.bite = at(2, 0.55, 0.65) * (1 - at(2, 0.92, 1));
    L.tryin = at(3, 0.5, 0.6) * (1 - at(3, 0.92, 1));
    L.made = at(4, 0.6, 0.7) * (1 - at(4, 0.92, 1));
    L.fit = at(5, 0.5, 0.6) * (1 - at(5, 0.92, 1));
    L.care = at(6, 0.35, 0.45) * (1 - at(6, 0.6, 0.7));
  }

  const front = D.teeth.find((t) => t.side === -1 && t.i === 1);
  const on = (dy = 0) => ({ obj: front.tooth, p: V(0, front.bracketY + dy, front.bracketZ + 0.06) });
  noCull(root);
  return {
    group: root,
    layout: 'arch',
    state,
    update,
    labels: [
      { group: 'hero', text: 'Upper gums with no teeth', anchor: { obj: ridgeGum, p: arch.at(-1.2).p.clone().setY(0.0).add(V(0, 0, 0.4)) } },
      { group: 'gums', text: 'Gums with no teeth', anchor: { obj: ridgeGum, p: arch.at(-1.2).p.clone().setY(0.0).add(V(0, 0, 0.4)) } },
      { group: 'imp', text: 'An impression of your gums', anchor: { obj: imp, p: arch.at(-1.6).p.clone().setY(-0.05).add(V(0, 0, 0.5)) } },
      { group: 'bite', text: 'Bite and smile line recorded', anchor: { obj: smileLine, p: smilePts[8].clone() } },
      { group: 'tryin', text: 'Teeth set in wax to try in', anchor: on() },
      { group: 'made', text: 'Made in acrylic, coloured like gums', anchor: on(-0.55) },
      { group: 'fit', text: 'Fitted and adjusted', anchor: on() },
      { group: 'care', text: 'Clean it every day', anchor: on() },
    ],
  };
}

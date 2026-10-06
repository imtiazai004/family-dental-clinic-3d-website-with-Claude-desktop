import * as THREE from 'three';
import { makeXray } from '../kit.js';
import { steps, frame, ease, lerp, clamp, V, glowRing, glowBall, colorPath, noCull, gumCuff, onSurface } from './core.js';

// Crown, seven steps: check-up, shaping, an exact copy, temporary crown, crown made, fitted, bite check.
// x: the copy and the new crown are shown beside the tooth, so those steps centre between the two.
const K = [
  { s: 1.15, f: -0.05, ry: -0.45, rx: 0.3 },
  { s: 1.2, f: 0.0, ry: -0.2, rx: 0.32 },
  { s: 0.95, f: -0.15, x: 0.62, ry: -0.1, rx: 0.22 },
  { s: 1.0, f: -0.1, x: 0.5, ry: -0.3, rx: 0.25 },
  { s: 0.95, f: -0.05, x: 0.62, ry: -0.12, rx: 0.2 },
  { s: 1.05, f: 0.05, ry: -0.3, rx: 0.25 },
  { s: 0.85, f: 0.45, ry: -0.3, rx: 0.12 },
];
const HERO = { s: 1.05, f: -0.1, ry: -0.45, rx: 0.28 };
const SIDE = 1.3;

export function build(kit) {
  const { M, part } = kit;
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);

  // A molar in a soft cuff of gum.
  const cuff = gumCuff(M.gum);
  const enamel = M.fresh('enamel');
  enamel.transparent = true;
  const tooth = new THREE.Group();
  const dentin = part('molar_dentin', M.dentin);
  const shell = part('molar_enamel', enamel);
  tooth.add(dentin, shell);
  pivot.add(cuff, tooth);

  // An old, large metal filling and a hairline crack: the reasons the tooth needs a crown.
  const amalgamMat = new THREE.MeshPhysicalMaterial({ color: '#8d929b', metalness: 0.9, roughness: 0.32, transparent: true });
  const old = part('molar_enamel', amalgamMat);
  old.scale.set(0.5, 0.3, 0.42);
  old.position.y = 0.5;
  pivot.add(old);
  const crackPts = onSurface(shell, [[1.02, 0.5], [1.1, 0.42], [1.05, 0.33], [1.14, 0.24], [1.08, 0.15], [1.15, 0.06], [1.11, -0.02]]);
  const crackCurve = new THREE.CatmullRomCurve3(crackPts);
  const crack = new THREE.Group();
  const crackMat = new THREE.MeshBasicMaterial({ color: '#5b3a26', transparent: true });
  const crackGlowMat = new THREE.MeshBasicMaterial({ color: '#ff9a5a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  crack.add(
    new THREE.Mesh(new THREE.TubeGeometry(crackCurve, 48, 0.007, 6, false), crackMat),
    new THREE.Mesh(new THREE.TubeGeometry(crackCurve, 48, 0.03, 8, false), crackGlowMat),
  );
  pivot.add(crack);

  // Dust while the tooth is shaped.
  const dust = new THREE.Group();
  for (let i = 0; i < 18; i++) {
    const d = glowBall(0.022, '#ffffff', 0);
    const a = (i / 18) * Math.PI * 2;
    d.userData = { a, r: 0.75 + (i % 3) * 0.12, y: 0.3 + (i % 5) * 0.08 };
    dust.add(d);
  }
  pivot.add(dust);

  // A ring of light sweeps down the shaped tooth, and a digital copy appears beside it.
  const scan = new THREE.Group();
  const scanRing = glowRing(0.82, 0.018, '#bfe0ff');
  const scanDisc = new THREE.Mesh(new THREE.CircleGeometry(0.82, 64), new THREE.MeshBasicMaterial({
    color: '#7fb2ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  }));
  scanDisc.rotation.x = -Math.PI / 2;
  scan.add(scanRing, scanDisc);
  scan.scale.z = 0.88;
  pivot.add(scan);
  const copyMat = makeXray('#8fd0ff', 1.2);
  const copy = part('molar_dentin', copyMat);
  copy.position.x = SIDE;
  pivot.add(copy);

  // Temporary crown, then the real one.
  const tempMat = new THREE.MeshStandardMaterial({ color: '#efe6d6', roughness: 0.75 });
  const temp = part('molar_enamel', tempMat);
  temp.scale.setScalar(1.03);
  pivot.add(temp);
  const crownMat = M.fresh('porcelain');
  const crownBase = crownMat.color.clone();
  const crown = part('molar_enamel', crownMat);
  crown.scale.setScalar(1.03);
  pivot.add(crown);
  const cement = glowRing(0.6, 0.022, '#ffe0a0');
  cement.scale.y = 0.88;
  cement.position.y = -0.1;
  pivot.add(cement);

  // Bite check: the opposite tooth, in its own gum, comes down to meet the crown.
  const upper = new THREE.Group();
  upper.add(part('molar_enamel', M.enamel), gumCuff(M.gum));
  upper.rotation.z = Math.PI;
  upper.rotation.y = 0.4;
  pivot.add(upper);
  const sparks = [[-0.2, 0.1], [0.2, -0.1], [0.02, 0.2]].map(([x, z]) => {
    const s = glowBall(0.05, '#ffe3a3', 0);
    s.position.set(x, 0.7, z);
    pivot.add(s);
    return s;
  });

  const SHADES = [new THREE.Color('#dcc48f'), new THREE.Color('#ffffff'), crownBase];
  const state = { labels: {} };
  function update(p, t, pointer, heroK = 0) {
    const at = steps(K.length, p);
    const hk = ease(clamp(heroK));
    frame(pivot, K, HERO, p, heroK, pointer, t, { spin: ease(at(6, 0.6, 1)) * Math.PI * 2 });

    // 2. shaping: the enamel and the old filling go, leaving the shaped core
    const shape = ease(at(1, 0.2, 0.8));
    enamel.opacity = 1 - shape;
    shell.visible = shape < 0.99;
    amalgamMat.opacity = 1 - shape;
    old.visible = shape < 0.99;
    old.position.y = 0.5 + shape * 0.25;
    crackMat.opacity = 1 - shape;
    crack.visible = shape < 0.99;

    // 1. the crack glows softly while the weak tooth is shown
    const weak = Math.max(hk, at(0, 0.15, 0.35)) * (1 - at(1, 0.0, 0.3));
    crackGlowMat.opacity = weak * (0.35 + 0.2 * Math.sin(t * 3));

    const dustOn = at(1, 0.15, 0.3) * (1 - at(1, 0.75, 0.95));
    dust.children.forEach((d, i) => {
      const u = d.userData;
      const a = u.a + t * 0.8;
      d.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * 2 + i) * 0.05, Math.sin(a) * u.r);
      d.material.opacity = dustOn * 0.8;
      d.visible = dustOn > 0.01;
    });

    // 3. scan, and the digital copy appears
    const sc = ease(at(2, 0.1, 0.6));
    const scanOn = at(2, 0.05, 0.12) * (1 - at(2, 0.55, 0.65));
    scan.visible = scanOn > 0.01;
    scan.position.y = lerp(0.85, -0.12, sc);
    scanRing.material.opacity = scanOn * 0.9;
    scanDisc.material.opacity = scanOn * 0.14;
    const copyOn = at(2, 0.4, 0.7) * (1 - at(4, 0.2, 0.5));
    copy.visible = copyOn > 0.01;
    copyMat.uniforms.uOpacity.value = copyOn;
    copy.rotation.y = t * 0.6;

    // 4. temporary crown on, 5. off again
    const tIn = ease(at(3, 0.15, 0.6)), tOut = ease(at(4, 0.05, 0.4));
    temp.visible = tIn > 0.001 && tOut < 0.999;
    temp.position.y = lerp(1.4, 0, tIn) + tOut * 1.6;

    // 5. the crown is made beside the tooth, shade matched; 6. fitted
    const made = ease(at(4, 0.3, 0.65));
    const fit = ease(at(5, 0.1, 0.65));
    crown.visible = made > 0.001;
    crown.scale.setScalar(1.03 * Math.max(0.001, made));
    crown.position.set(lerp(SIDE, 0, fit), lerp(0.1, 0, fit) + Math.sin(fit * Math.PI) * 0.9, 0);
    crown.rotation.y = (1 - fit) * t * 0.6;
    colorPath(crownMat.color, SHADES, at(4, 0.4, 0.95));
    const cem = at(5, 0.6, 0.75) * (1 - at(5, 0.9, 1));
    cement.material.opacity = cem * 0.8;
    cement.visible = cem > 0.01;

    // 7. bite check
    const down = ease(at(6, 0.05, 0.3)) * (1 - ease(at(6, 0.45, 0.6)));
    upper.visible = at(6, 0.0, 0.05) > 0 && at(6, 0.6, 0.75) < 1;
    upper.position.set(0, lerp(3.0, 1.42, down) + ease(at(6, 0.6, 0.75)) * 1.2, 0);
    const flash = at(6, 0.22, 0.32) * (1 - at(6, 0.4, 0.5));
    for (const s of sparks) { s.material.opacity = flash * (0.6 + 0.4 * Math.sin(t * 12)); s.visible = flash > 0.01; }

    const L = state.labels;
    L.hero = hk > 0.5 ? (hk - 0.5) * 2 : 0;
    L.weak = at(0, 0.3, 0.45) * (1 - at(0, 0.9, 1));
    L.crack = at(0, 0.4, 0.55) * (1 - at(0, 0.9, 1));
    L.shaped = at(1, 0.7, 0.8) * (1 - at(1, 0.95, 1));
    L.copy = at(2, 0.6, 0.7) * (1 - at(2, 0.95, 1));
    L.temp = at(3, 0.55, 0.65) * (1 - at(3, 0.95, 1));
    L.made = at(4, 0.6, 0.7) * (1 - at(4, 0.95, 1));
    L.fit = at(5, 0.65, 0.75) * (1 - at(5, 0.95, 1));
    L.bite = at(6, 0.3, 0.38) * (1 - at(6, 0.55, 0.65));
  }

  const crackMid = crackPts[Math.floor(crackPts.length / 2)] || V(0.4, 0.3, 0.4);
  noCull(root);
  return {
    group: root,
    layout: 'main',
    state,
    update,
    labels: [
      { group: 'hero', text: 'Weak, heavily filled tooth', anchor: { obj: old, p: V(0.5, 0.2, 0.3) } },
      { group: 'weak', text: 'Large old filling', anchor: { obj: old, p: V(0.5, 0.2, 0.3) } },
      { group: 'crack', text: 'A crack', anchor: { obj: pivot, p: crackMid.clone() } },
      { group: 'shaped', text: 'Shaped to make room', anchor: { obj: dentin, p: V(0.55, 0.3, 0.2) } },
      { group: 'copy', text: 'An exact copy of your tooth', anchor: { obj: copy, p: V(0.4, 0.5, 0.1) } },
      { group: 'temp', text: 'Temporary crown', anchor: { obj: temp, p: V(0.5, 0.45, 0.2) } },
      { group: 'made', text: 'Your crown, shade matched', anchor: { obj: crown, p: V(0.5, 0.45, 0.2) } },
      { group: 'fit', text: 'Fixed in place', anchor: { obj: cement, p: V(0.6, 0, 0) } },
      { group: 'bite', text: 'Bite checked', anchor: { obj: crown, p: V(0.4, 0.95, 0.2) } },
    ],
  };
}

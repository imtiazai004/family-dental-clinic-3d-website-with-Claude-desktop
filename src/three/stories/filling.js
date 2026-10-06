import * as THREE from 'three';
import { makeXray } from '../kit.js';
import { surfaceDecal } from '../shells.js';
import {
  steps, frame, ease, lerp, clamp, V, glowRing, glowBall, noCull, gumCuff,
  decayTexture, cavityTexture, growMaterial,
} from './core.js';

// Filling, six steps: check-up and X-ray, numbing, decay removed, filled in layers, shaped and polished, done.
// The camera looks down onto the biting surface for the close steps.
const K = [
  { s: 1.15, f: 0.0, ry: -0.4, rx: 0.42 },
  { s: 1.1, f: -0.1, ry: -0.25, rx: 0.32 },
  { s: 1.55, f: 0.3, ry: -0.2, rx: 0.72 },
  { s: 1.35, f: 0.5, ry: 0.15, rx: 0.68 },
  { s: 1.45, f: 0.28, ry: -0.35, rx: 0.62 },
  { s: 1.05, f: -0.05, ry: -0.3, rx: 0.3 },
];
const HERO = { s: 1.1, f: 0.0, ry: -0.45, rx: 0.45 };
const C = [0.04, 0.03];
const R = 0.27;

export function build(kit) {
  const { M, part } = kit;
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);

  // A molar in its gum, which turns see-through for the X-ray.
  const enamelMat = M.fresh('enamel');
  enamelMat.transparent = true;
  const dentinMat = M.fresh('dentin');
  dentinMat.transparent = true;
  const shell = part('molar_enamel', enamelMat);
  const core = part('molar_dentin', dentinMat);
  const tooth = new THREE.Group();
  tooth.add(core, shell);
  pivot.add(gumCuff(M.gum), tooth);
  const xE = makeXray('#e6f1ff', 1.0), xD = makeXray('#cfe0ff', 0.45);
  const xray = new THREE.Group();
  xray.add(part('molar_enamel', xE), part('molar_dentin', xD));
  pivot.add(xray);

  // Decay: a dark spot on the biting surface, and how far it reaches inside.
  const decalGeo = surfaceDecal(shell, C[0], C[1], R);
  const spotMat = (map, off) => new THREE.MeshStandardMaterial({
    map, transparent: true, roughness: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: off, polygonOffsetUnits: off,
  });
  const decayMat = spotMat(decayTexture(7), -2);
  const decay = new THREE.Mesh(decalGeo, decayMat);
  const cavityMat = spotMat(cavityTexture(), -3);
  const cavity = new THREE.Mesh(decalGeo, cavityMat);
  pivot.add(decay, cavity);
  const deepMat = new THREE.MeshBasicMaterial({ color: '#4a2a18', transparent: true, opacity: 0, depthTest: false, depthWrite: false });
  const deep = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), deepMat);
  deep.scale.set(0.2, 0.15, 0.17);
  deep.position.set(C[0], 0.4, C[1]);
  deep.renderOrder = 10;
  pivot.add(deep);

  // The filling: tooth-coloured, built up from the middle out in three layers.
  const fillMat = growMaterial(new THREE.MeshPhysicalMaterial({
    color: '#efe3c9', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5,
  }));
  const toothColor = enamelMat.color.clone();
  const fresh = new THREE.Color('#efe3c9');
  const filling = new THREE.Mesh(surfaceDecal(shell, C[0], C[1], R, { lift: 0.011 }), fillMat);
  pivot.add(filling);

  // Scan ring, numbing ring, dust, curing light, polish glint.
  const scan = glowRing(0.82, 0.018, '#bfe0ff');
  scan.scale.z = 0.88;
  pivot.add(scan);
  const numb = glowRing(0.74, 0.05, '#b9a4ff');
  numb.position.y = -0.1;
  numb.scale.z = 0.88;
  pivot.add(numb);
  const dust = new THREE.Group();
  for (let i = 0; i < 16; i++) {
    const d = glowBall(0.02, '#ffffff', 0);
    d.userData = { a: (i / 16) * Math.PI * 2, r: 0.3 + (i % 3) * 0.08, y: 0.62 + (i % 4) * 0.05 };
    dust.add(d);
  }
  pivot.add(dust);
  const coneMat = new THREE.MeshBasicMaterial({ color: '#7fb2ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 40, 1, true), coneMat);
  cone.position.set(C[0], 0.98, C[1]);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.5, 24), new THREE.MeshPhysicalMaterial({ color: '#2d3e8f', roughness: 0.3, clearcoat: 1, transparent: true }));
  tip.position.set(C[0], 1.58, C[1]);
  const lightGlow = glowBall(0.22, '#8fbfff', 0);
  lightGlow.position.set(C[0], 0.58, C[1]);
  pivot.add(cone, tip, lightGlow);
  const glint = glowRing(0.3, 0.012, '#ffffff');
  glint.position.set(C[0], 0.6, C[1]);
  pivot.add(glint);
  const sparkles = [[-0.12, 0.06], [0.14, -0.08], [0.02, 0.15]].map(([x, z]) => {
    const s = glowBall(0.035, '#ffffff', 0);
    s.position.set(C[0] + x, 0.6, C[1] + z);
    pivot.add(s);
    return s;
  });

  const state = { labels: {} };
  function update(p, t, pointer, heroK = 0) {
    const at = steps(K.length, p);
    const hk = ease(clamp(heroK));
    frame(pivot, K, HERO, p, heroK, pointer, t, { spin: ease(at(5, 0.5, 1)) * Math.PI * 2 });

    // 1. a ring sweeps down and the tooth turns see-through: the decay goes deeper than the spot
    const sc = ease(at(0, 0.1, 0.5));
    const scanOn = at(0, 0.05, 0.12) * (1 - at(0, 0.45, 0.55));
    scan.visible = scanOn > 0.01;
    scan.position.y = lerp(0.85, -0.12, sc);
    scan.material.opacity = scanOn * 0.9;
    const xr = at(0, 0.25, 0.45) * (1 - at(0, 0.82, 0.97));
    enamelMat.opacity = 1 - 0.82 * xr;
    dentinMat.opacity = 1 - 0.85 * xr;
    enamelMat.depthWrite = xr < 0.05;
    dentinMat.depthWrite = xr < 0.05;
    xray.visible = xr > 0.01;
    xE.uniforms.uOpacity.value = xr;
    xD.uniforms.uOpacity.value = xr;

    // 2. numbing
    const nOn = at(1, 0.1, 0.35) * (1 - at(2, 0.05, 0.25));
    numb.material.opacity = nOn * (0.45 + 0.25 * Math.sin(t * 4));
    numb.visible = nOn > 0.01;

    // 3. decay removed, leaving a clean, shaped cavity
    const gone = ease(at(2, 0.2, 0.7));
    decayMat.opacity = 1 - gone;
    decay.visible = gone < 0.99;
    deepMat.opacity = xr * 0.75 * (1 - gone);
    deep.visible = deepMat.opacity > 0.01;
    cavityMat.opacity = ease(at(2, 0.3, 0.75));
    const dustOn = at(2, 0.15, 0.3) * (1 - at(2, 0.7, 0.9));
    dust.children.forEach((d, i) => {
      const u = d.userData;
      const a = u.a + t * 1.1;
      d.position.set(C[0] + Math.cos(a) * u.r, u.y + Math.sin(t * 2 + i) * 0.04, C[1] + Math.sin(a) * u.r);
      d.material.opacity = dustOn * 0.8;
      d.visible = dustOn > 0.01;
    });

    // 4. three layers, each set hard with a blue light
    const g1 = ease(at(3, 0.06, 0.22)) * 0.45, g2 = ease(at(3, 0.36, 0.5)) * 0.3, g3 = ease(at(3, 0.64, 0.78)) * 0.3;
    const grow = g1 + g2 + g3;
    fillMat.userData.grow.value = grow;
    filling.visible = grow > 0.01;
    cavity.visible = cavityMat.opacity > 0.01 && grow < 1.04;
    const flash = Math.max(
      at(3, 0.24, 0.28) * (1 - at(3, 0.3, 0.34)),
      at(3, 0.52, 0.56) * (1 - at(3, 0.58, 0.62)),
      at(3, 0.8, 0.84) * (1 - at(3, 0.88, 0.94)),
    );
    const toolOn = at(3, 0.2, 0.24) * (1 - at(3, 0.92, 0.98));
    coneMat.opacity = flash * 0.35;
    cone.visible = flash > 0.01;
    tip.visible = toolOn > 0.01;
    tip.material.opacity = toolOn;
    lightGlow.material.opacity = flash * 0.5;
    lightGlow.visible = flash > 0.01;

    // 5. shaped and polished: the filling takes on the tooth's own colour
    fillMat.color.copy(fresh).lerp(toothColor, ease(at(4, 0.2, 0.7)));
    const pol = at(4, 0.15, 0.3) * (1 - at(4, 0.75, 0.9));
    glint.visible = pol > 0.01;
    glint.material.opacity = pol * 0.6;
    glint.rotation.z = t * 2;
    glint.scale.setScalar(1 + 0.15 * Math.sin(t * 5));
    sparkles.forEach((s, i) => {
      const tw = Math.max(0, Math.sin(t * 3 + i * 2.1));
      s.material.opacity = pol * tw * tw;
      s.visible = s.material.opacity > 0.01;
    });

    const L = state.labels;
    L.hero = hk > 0.5 ? (hk - 0.5) * 2 : 0;
    L.deep = at(0, 0.5, 0.6) * (1 - at(0, 0.85, 0.95));
    L.numb = at(1, 0.3, 0.45) * (1 - at(1, 0.9, 1));
    L.clean = at(2, 0.7, 0.8) * (1 - at(2, 0.95, 1));
    L.layers = at(3, 0.15, 0.25) * (1 - at(3, 0.92, 1));
    L.polish = at(4, 0.35, 0.45) * (1 - at(4, 0.9, 1));
    L.done = at(5, 0.15, 0.25) * (1 - at(5, 0.5, 0.6));
  }

  noCull(root);
  return {
    group: root,
    layout: 'main',
    state,
    update,
    labels: [
      { group: 'hero', text: 'Decay on the biting surface', anchor: { obj: decay, p: V(C[0] + 0.12, 0.58, C[1] + 0.1) } },
      { group: 'deep', text: 'It goes deeper than it looks', anchor: { obj: deep, p: V(0.9, 0, 0.4) } },
      { group: 'numb', text: 'Area numbed', anchor: { obj: numb, p: V(0.74, 0, 0) } },
      { group: 'clean', text: 'Decay removed, cavity cleaned', anchor: { obj: cavity, p: V(C[0] + 0.15, 0.56, C[1] + 0.12) } },
      { group: 'layers', text: 'Filled in layers, each set with a blue light', anchor: { obj: filling, p: V(C[0] + 0.15, 0.58, C[1] + 0.12) } },
      { group: 'polish', text: 'Shaped to your bite and polished', anchor: { obj: filling, p: V(C[0] + 0.15, 0.58, C[1] + 0.12) } },
      { group: 'done', text: 'Looks like your own tooth', anchor: { obj: shell, p: V(0.5, 0.4, 0.3) } },
    ],
  };
}

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { withCutFace } from '../materials.js';
import { makeFixture } from '../procedural.js';
import { makeXray } from '../kit.js';
import { surfaceDecal } from '../shells.js';
import {
  steps, frame, ease, lerp, clamp, V, scanBar, glowRing, glowBall, ghost, noCull, withSurf,
  decayTexture, canvasTexture, colorPath,
} from './core.js';

// Tooth extraction, six steps: check-up and X-ray, numbing, loosening, removal, healing, replacing the tooth.
// Shown calmly, in a cut-away jaw: no blood, the socket heals over.
const K = [
  { s: 0.95, f: -0.45, ry: -0.3, rx: 0.1 },
  { s: 1.0, f: -0.2, ry: -0.4, rx: 0.3 },
  { s: 1.0, f: -0.5, ry: -0.2, rx: 0.1 },
  { s: 0.85, f: 0.2, ry: -0.3, rx: 0.15 },
  { s: 1.05, f: -0.45, ry: -0.25, rx: 0.3 },
  { s: 0.95, f: -0.4, ry: -0.42, rx: 0.14 },
];
const HERO = { s: 0.92, f: -0.35, ry: -0.35, rx: 0.12 };
const GUM_TOP = -0.15;

export function build(kit) {
  const { M, CUT, part, localPlane } = kit;
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);
  const cut = localPlane(0, 0, -1, 0.02);
  // Keeps only what is below the gum line (for the socket and the ligament glow).
  const below = localPlane(0, -1, 0, GUM_TOP + 0.01);
  const clip = (m) => { m.clippingPlanes = [cut.plane]; return m; };

  const mats = {
    bone: clip(withCutFace(M.fresh('bone'), CUT.bone, cut.plane, 1)),
    gum: clip(withCutFace(M.fresh('gum'), CUT.gum, cut.plane)),
    enamel: clip(withCutFace(M.fresh('enamel'), CUT.enamel, cut.plane)),
    dentin: clip(withCutFace(M.fresh('dentin'), CUT.dentin, cut.plane)),
    pulp: clip(withCutFace(M.fresh('pulp'), '#d9667c', cut.plane)),
  };
  const jaw = new THREE.Group();
  jaw.add(part('jaw_bone', mats.bone), part('jaw_gum', mats.gum));
  jaw.scale.set(0.52, 1, 1);
  const enamel = part('molar_enamel', mats.enamel);
  const tooth = new THREE.Group();
  tooth.add(part('molar_dentin', mats.dentin), part('molar_pulp', mats.pulp), enamel);
  pivot.add(jaw, tooth);

  // Heavy decay on top: the reason the tooth cannot be saved.
  const decayMat = clip(new THREE.MeshStandardMaterial({ map: decayTexture(11), transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  const decay = new THREE.Mesh(surfaceDecal(enamel, 0.0, 0.0, 0.42), decayMat);
  tooth.add(decay);

  // The ligament that holds the root, glowing as it is gently loosened.
  const ligMat = makeXray('#ffc35a', 2.6);
  ligMat.clippingPlanes = [cut.plane, below.plane];
  const lig = part('molar_dentin', ligMat);
  lig.scale.setScalar(1.03);
  tooth.add(lig);

  // The empty socket left in the bone, seen through the cut, and its opening in the gum.
  const socketMat = new THREE.MeshStandardMaterial({ color: '#c06478', roughness: 0.7, side: THREE.BackSide });
  socketMat.clippingPlanes = [cut.plane, below.plane];
  const socket = part('molar_dentin', socketMat);
  socket.scale.setScalar(1.015);
  pivot.add(socket);
  const healMat = makeXray('#ffe7a6', 1.6);
  healMat.clippingPlanes = [cut.plane, below.plane];
  const heal = part('molar_dentin', healMat);
  heal.scale.setScalar(0.98);
  pivot.add(heal);
  const openingTex = canvasTexture((g, n) => {
    const c = n / 2;
    const gr = g.createRadialGradient(c, c, 0, c, c, c);
    gr.addColorStop(0, 'rgba(150, 52, 74, 1)');
    gr.addColorStop(0.55, 'rgba(182, 80, 100, 0.95)');
    gr.addColorStop(0.85, 'rgba(214, 120, 138, 0.5)');
    gr.addColorStop(1, 'rgba(230, 150, 165, 0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, n, n);
  });
  const openingMat = clip(new THREE.MeshStandardMaterial({ map: openingTex, transparent: true, roughness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  const opening = new THREE.Mesh(withSurf(new THREE.CircleGeometry(0.5, 48)), openingMat);
  opening.rotation.x = -Math.PI / 2;
  opening.scale.set(1, 0.85, 1);
  opening.position.y = GUM_TOP + 0.003;
  pivot.add(opening);

  // X-ray light, numbing ring, gauze pad, healing sparkles.
  const bar = scanBar(3.4, 1.6);
  bar.position.y = -0.4;
  pivot.add(bar);
  const numb = glowRing(0.82, 0.06, '#b9a4ff');
  numb.position.y = -0.12;
  pivot.add(numb);
  const gauze = new THREE.Mesh(new RoundedBoxGeometry(0.95, 0.26, 0.8, 4, 0.11), new THREE.MeshPhysicalMaterial({
    color: '#fbfaf7', roughness: 0.95, sheen: 1, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.8, transparent: true,
  }));
  pivot.add(gauze);
  const sparks = [];
  for (let i = 0; i < 10; i++) {
    const s = glowBall(0.03, '#ffe7a6', 0);
    s.userData = { x: (i % 5 - 2) * 0.14, z: (i < 5 ? -0.12 : -0.3), ph: i * 0.37 };
    pivot.add(s);
    sparks.push(s);
  }

  // A planned replacement in the healed gap: implant and crown, shown as a see-through outline.
  const planMat = ghost('#c9b0ff', 1.3);
  const plan = new THREE.Group();
  const fixture = makeFixture(M);
  fixture.traverse((o) => { if (o.isMesh) o.material = planMat; });
  fixture.scale.setScalar(1.25);
  fixture.position.y = -0.32;
  const planCrown = part('molar_enamel', planMat);
  planCrown.position.y = 0.0;
  plan.add(fixture, planCrown);
  pivot.add(plan);

  const SOCKET = [new THREE.Color('#c06478'), new THREE.Color('#e3b9a0'), new THREE.Color('#eed6b8')];
  const state = { labels: {} };
  function update(p, t, pointer, heroK = 0) {
    const at = steps(K.length, p);
    const hk = ease(clamp(heroK));
    frame(pivot, K, HERO, p, heroK, pointer, t);
    root.updateMatrixWorld(true);
    cut.sync(pivot);
    below.sync(pivot);

    // 1. X-ray light sweeps across and back
    const sIn = ease(at(0, 0.2, 0.6)), sOut = ease(at(0, 0.75, 1.0));
    bar.visible = (sIn > 0.001 && sIn < 0.999) || (sOut > 0.001 && sOut < 0.999);
    bar.position.x = lerp(-1.6, 1.6, sIn * (1 - sOut));

    // 2. numbing
    const nOn = at(1, 0.1, 0.35) * (1 - at(2, 0.1, 0.3));
    numb.material.opacity = nOn * (0.45 + 0.25 * Math.sin(t * 4));
    numb.visible = nOn > 0.01;

    // 3. loosening: a gentle rocking while the ligament lets go
    const loose = at(2, 0.1, 0.3) * (1 - at(3, 0.1, 0.3));
    ligMat.uniforms.uOpacity.value = loose * (0.65 + 0.35 * Math.sin(t * 5)) * (1 - at(2, 0.75, 1) * 0.6);
    lig.visible = loose > 0.01;
    const rock = at(2, 0.25, 0.4) * (1 - at(2, 0.85, 1));

    // 4. lifted out
    const out = ease(at(3, 0.1, 0.65));
    tooth.position.y = out * 2.8 + at(2, 0.4, 1) * 0.04;
    tooth.rotation.z = Math.sin(t * 6) * 0.035 * rock + out * 0.15;
    tooth.visible = out < 0.999;
    const empty = at(3, 0.1, 0.25);
    socket.visible = empty > 0;
    opening.visible = empty > 0;

    // 5. gauze, then healing: the socket fills with new bone and the gum closes over
    const gIn = ease(at(4, 0.0, 0.18)), gOut = ease(at(4, 0.32, 0.48));
    gauze.visible = gIn > 0.001 && gOut < 0.999;
    gauze.position.y = lerp(1.4, GUM_TOP + 0.12, gIn) + gOut * 1.2;
    gauze.material.opacity = 1 - gOut;
    const healK = ease(at(4, 0.4, 0.95));
    colorPath(socketMat.color, SOCKET, healK);
    openingMat.opacity = empty * (1 - healK);
    opening.scale.set(1 - healK * 0.7, 0.85 * (1 - healK * 0.7), 1);
    const glow = at(4, 0.4, 0.55) * (1 - at(4, 0.9, 1));
    healMat.uniforms.uOpacity.value = glow * (0.55 + 0.3 * Math.sin(t * 3));
    heal.visible = glow > 0.01;
    sparks.forEach((s) => {
      const u = s.userData;
      const k = (t * 0.35 + u.ph) % 1;
      s.position.set(u.x, lerp(-1.2, GUM_TOP, k), u.z);
      s.material.opacity = glow * Math.sin(k * Math.PI) * 0.9;
      s.visible = s.material.opacity > 0.01;
    });

    // 6. a replacement can go in the healed gap
    const pOn = at(5, 0.25, 0.45) * (1 - at(5, 0.9, 1));
    planMat.uniforms.uOpacity.value = pOn * (0.75 + 0.25 * Math.sin(t * 2.4));
    plan.visible = pOn > 0.01;

    const L = state.labels;
    L.hero = hk > 0.5 ? (hk - 0.5) * 2 : 0;
    L.xray = at(0, 0.45, 0.6) * (1 - at(0, 0.9, 1));
    L.numb = at(1, 0.3, 0.45) * (1 - at(1, 0.9, 1));
    L.loose = at(2, 0.35, 0.45) * (1 - at(2, 0.9, 1));
    L.out = at(3, 0.55, 0.65) * (1 - at(3, 0.92, 1));
    L.gauze = at(4, 0.05, 0.15) * (1 - at(4, 0.32, 0.4));
    L.heal = at(4, 0.6, 0.7) * (1 - at(4, 0.92, 1));
    L.plan = at(5, 0.4, 0.5) * (1 - at(5, 0.85, 0.95));
  }

  noCull(root);
  return {
    group: root,
    layout: 'main',
    state,
    update,
    labels: [
      { group: 'hero', text: 'A tooth that cannot be saved', anchor: { obj: decay, p: V(0.3, 0.55, 0.0) } },
      { group: 'xray', text: 'Roots and bone checked', anchor: { obj: jaw, p: V(0.55, -1.0, 0) } },
      { group: 'numb', text: 'Area numbed', anchor: { obj: numb, p: V(0.82, 0, 0) } },
      { group: 'loose', text: 'Gently loosened', anchor: { obj: lig, p: V(0.45, -0.7, 0) } },
      { group: 'out', text: 'Lifted out whole', anchor: { obj: enamel, p: V(0.5, 0.3, 0) } },
      { group: 'gauze', text: 'Gauze pad to bite on', anchor: { obj: gauze, p: V(0.48, 0, 0) } },
      { group: 'heal', text: 'The socket heals over the next weeks', anchor: { obj: socket, p: V(0.45, -0.6, 0) } },
      { group: 'plan', text: 'An implant, bridge or denture can fill the gap', anchor: { obj: planCrown, p: V(0.5, 0.35, 0) } },
    ],
  };
}

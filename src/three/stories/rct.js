import * as THREE from 'three';
import { withCutFace, makePulpRCT } from '../materials.js';
import { makeFile } from '../procedural.js';
import { makeXray } from '../kit.js';
import { steps, frame, ease, lerp, clamp, V, scanBar, scanPlanes, xrayClone, glowRing, glowBall, fade, noCull } from './core.js';

// Root canal treatment, seven steps: X-ray, numbing, opening, cleaning, rinsing, filling, crown.
const K = [
  { s: 0.95, f: -0.45, ry: -0.3, rx: 0.08 },
  { s: 1.0, f: -0.15, ry: -0.4, rx: 0.3 },
  { s: 1.25, f: 0.25, ry: -0.3, rx: 0.4 },
  { s: 1.0, f: -0.45, ry: -0.25, rx: 0.08 },
  { s: 1.05, f: -0.5, ry: -0.12, rx: 0.08 },
  { s: 1.0, f: -0.45, ry: -0.25, rx: 0.1 },
  { s: 0.95, f: -0.15, ry: -0.35, rx: 0.15 },
];
const HERO = { s: 0.92, f: -0.35, ry: -0.35, rx: 0.1 };

export function build(kit) {
  const { M, CUT, molar, part, localPlane } = kit;
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);
  const cut = localPlane(0, 0, -1, 0.02);
  const scan = scanPlanes(kit);
  const clip = (m, cutFace = true) => { m.clippingPlanes = [cut.plane, scan.right.plane]; return m; };

  // ---- normal view (cut open)
  const mats = {
    bone: clip(withCutFace(M.fresh('bone'), CUT.bone, cut.plane, 1)),
    gum: clip(withCutFace(M.fresh('gum'), CUT.gum, cut.plane)),
    enamel: clip(withCutFace(M.fresh('enamel'), CUT.enamel, cut.plane)),
    dentin: clip(withCutFace(M.fresh('dentin'), CUT.dentin, cut.plane)),
  };
  const pulp = makePulpRCT(cut.plane);
  pulp.clippingPlanes = [cut.plane, scan.right.plane];
  const jaw = new THREE.Group();
  jaw.add(part('jaw_bone', mats.bone), part('jaw_gum', mats.gum));
  jaw.scale.set(0.52, 1, 1);
  const tooth = molar({ enamel: mats.enamel, dentin: mats.dentin, pulp });
  pivot.add(jaw, tooth.g);

  // ---- X-ray view
  const xr = (c, k) => { const m = makeXray(c, k); m.clippingPlanes = [cut.plane, scan.left.plane]; return m; };
  const X = { bone: xr('#bcd4ff', 0.42), gum: xr('#bcd4ff', 0.08), enamel: xr('#eef5ff', 1.0), dentin: xr('#d6e6ff', 0.55), pulp: xr('#8fb4ff', 0.12) };
  const xray = new THREE.Group();
  xray.add(xrayClone(jaw, (o) => (o.material === mats.bone ? X.bone : X.gum)));
  xray.add(xrayClone(tooth.g, (o) => (o.material === mats.enamel ? X.enamel : o.material === mats.dentin ? X.dentin : X.pulp)));
  pivot.add(xray);
  const bar = scanBar(3.4, 1.6);
  bar.position.y = -0.4;
  pivot.add(bar);

  // Infection at the root tip.
  const abscess = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 20), new THREE.MeshBasicMaterial({ color: '#b3223f', transparent: true, opacity: 0, depthWrite: false }));
  abscess.position.set(-0.34, -1.62, 0.05);
  pivot.add(abscess);

  // Numbing: a soft ring around the tooth at the gum.
  const numb = glowRing(0.82, 0.06, '#b9a4ff');
  numb.position.y = -0.12;
  pivot.add(numb);

  // A small opening on top of the tooth.
  const holeMat = new THREE.MeshBasicMaterial({ color: '#2a1020', transparent: true, opacity: 0 });
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), holeMat);
  hole.rotation.x = -Math.PI / 2;
  hole.scale.set(1.3, 0.8, 1);
  hole.position.y = 0.66;
  pivot.add(hole);
  // ... closed again with a tooth-coloured filling.
  const plug = part('molar_enamel', clip(withCutFace(M.fresh('porcelain'), CUT.enamel, cut.plane)));
  plug.scale.set(0.42, 0.25, 0.32);
  plug.position.y = 0.52;
  pivot.add(plug);

  // Files, one canal after the other.
  const files = [{ x: -0.32, tilt: -0.136 }, { x: 0.3, tilt: 0.13 }].map((c) => {
    const f = makeFile(M);
    f.rotation.z = c.tilt;
    pivot.add(f);
    return { f, ...c };
  });

  // Rinse: a blue flow running down the canals.
  const rinseMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uOn: { value: 0 } },
    vertexShader: `#include <common>
      #include <clipping_planes_pars_vertex>
      varying float vY;
      void main(){ vec4 mvPosition = modelViewMatrix * vec4(position,1.0); vY = (modelMatrix * vec4(position,1.0)).y;
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <clipping_planes_pars_fragment>
      uniform float uT; uniform float uOn; varying float vY;
      void main(){
        #include <clipping_planes_fragment>
        float s = 0.5 + 0.5 * sin(vY * 22.0 + uT * 9.0);
        float a = (0.25 + 0.75 * s) * uOn;
        gl_FragColor = vec4(vec3(0.45, 0.75, 1.0) * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  rinseMat.clipping = true;
  rinseMat.toneMapped = false;
  rinseMat.clippingPlanes = [cut.plane];
  const rinse = part('molar_pulp', rinseMat);
  rinse.scale.setScalar(1.01);
  pivot.add(rinse);

  // The crown that protects the tooth at the end.
  const crownMat = clip(withCutFace(M.fresh('porcelain'), CUT.enamel, cut.plane));
  const crown = part('molar_enamel', crownMat);
  crown.scale.setScalar(1.035);
  pivot.add(crown);

  const tmp = V();
  const state = { labels: {} };
  function update(p, t, pointer, heroK = 0) {
    const at = steps(K.length, p);
    const hk = ease(clamp(heroK));
    frame(pivot, K, HERO, p, heroK, pointer, t, { spin: ease(at(6, 0.6, 1)) * Math.PI * 2 });
    root.updateMatrixWorld(true);
    // the cut-away closes at the end so the finished tooth can be seen whole
    cut.sync(pivot, lerp(0.02, 5, ease(at(6, 0.5, 0.62))));

    // 1. X-ray sweeps across and back
    const sIn = ease(at(0, 0.2, 0.6)), sOut = ease(at(0, 0.75, 1.0));
    const sx = lerp(-1.6, 1.6, sIn * (1 - sOut));
    scan.set(sx, pivot);
    bar.visible = (sIn > 0.001 && sIn < 0.999) || (sOut > 0.001 && sOut < 0.999);
    bar.position.x = sx;
    xray.visible = sx > -1.55;

    // the infection: visible in the hero and on the X-ray, settles once the tooth is treated
    const heal = ease(at(6, 0.4, 0.9));
    abscess.material.opacity = Math.max(hk, at(0, 0.3, 0.5)) * (1 - heal) * (0.6 + 0.15 * Math.sin(t * 3));
    abscess.visible = abscess.material.opacity > 0.01;
    abscess.scale.setScalar(1 - heal * 0.6);

    // 2. numbing
    const nOn = at(1, 0.1, 0.35) * (1 - at(2, 0.1, 0.3));
    numb.material.opacity = nOn * (0.45 + 0.25 * Math.sin(t * 4));
    numb.visible = nOn > 0.01;
    numb.scale.setScalar(1 + 0.06 * Math.sin(t * 2));

    // 3. opening; 6. sealed with a filling
    const open = at(2, 0.25, 0.6);
    const seal = ease(at(5, 0.6, 0.9));
    fade(hole, holeMat, open * (1 - seal) * 0.85);
    plug.visible = seal > 0.01;
    plug.scale.set(0.42, 0.25 * seal + 0.001, 0.32);

    // 4. cleaning, one canal then the other; infection fades
    const u = pulp.userData.u;
    u.uTime.value = t;
    u.uInfect.value = 1 - ease(at(3, 0.2, 0.95));
    files.forEach((f, i) => {
      const a = i === 0 ? [0.05, 0.25, 0.42, 0.52] : [0.48, 0.65, 0.85, 0.95];
      const din = ease(at(3, a[0], a[1])), dout = ease(at(3, a[2], a[3]));
      const depth = din * (1 - dout);
      f.f.visible = at(3, a[0] - 0.02, a[0]) > 0 && at(3, a[3], a[3] + 0.02) < 1;
      const pump = Math.sin(t * 9) * 0.04 * at(3, a[1] - 0.02, a[1]) * (1 - dout);
      f.f.position.set(lerp(f.x * 0.4, f.x, depth), lerp(2.1, -1.05, depth) + pump + dout * 1.4, 0.04);
    });

    // 5. rinse
    const rOn = at(4, 0.1, 0.3) * (1 - at(4, 0.75, 0.95));
    rinseMat.uniforms.uOn.value = rOn;
    rinseMat.uniforms.uT.value = t;
    rinse.visible = rOn > 0.01;

    // 6. filling rises up the canals
    const fillLocal = lerp(-1.55, 0.36, ease(at(5, 0.05, 0.55)));
    tooth.g.localToWorld(tmp.set(0, fillLocal, 0));
    u.uFill.value = at(5, 0.0, 0.05) > 0 ? tmp.y : -100;

    // 7. crown
    const cIn = ease(at(6, 0.05, 0.45));
    crown.visible = cIn > 0.001;
    crown.position.y = lerp(1.7, 0, cIn);
    tooth.e.visible = cIn < 0.98;

    const L = state.labels;
    L.heroPulp = hk > 0.5 ? (hk - 0.5) * 2 : 0;
    L.xray = at(0, 0.45, 0.6) * (1 - at(0, 0.9, 1));
    L.numb = at(1, 0.3, 0.45) * (1 - at(1, 0.9, 1));
    L.open = at(2, 0.55, 0.7) * (1 - at(2, 0.92, 1));
    L.clean = at(3, 0.3, 0.4) * (1 - at(3, 0.92, 1));
    L.rinse = at(4, 0.3, 0.4) * (1 - at(4, 0.85, 0.95));
    L.fill = at(5, 0.6, 0.7) * (1 - at(5, 0.93, 1));
    L.crown = at(6, 0.45, 0.55) * (1 - at(6, 0.85, 0.95));
  }

  noCull(root);
  return {
    group: root,
    layout: 'main',
    state,
    update,
    labels: [
      { group: 'heroPulp', text: 'Infected pulp', anchor: { obj: tooth.p, p: V(0.18, 0.15, 0.1) } },
      { group: 'heroPulp', text: 'Infection at the root tip', anchor: { obj: abscess, p: V(0.15, 0, 0) } },
      { group: 'xray', text: 'Infection shows on the X-ray', anchor: { obj: abscess, p: V(0.15, 0, 0) } },
      { group: 'numb', text: 'Area numbed', anchor: { obj: numb, p: V(0.8, 0, 0) } },
      { group: 'open', text: 'Small opening', anchor: { obj: hole, p: V(0.15, 0, 0) } },
      { group: 'clean', text: 'Each canal cleaned', anchor: { obj: tooth.p, p: V(0.3, -0.6, 0.1) } },
      { group: 'rinse', text: 'Rinsed and disinfected', anchor: { obj: tooth.p, p: V(0.3, -0.5, 0.1) } },
      { group: 'fill', text: 'Filled and sealed', anchor: { obj: tooth.p, p: V(0.3, -0.3, 0.1) } },
      { group: 'crown', text: 'A crown protects it', anchor: { obj: crown, p: V(0.5, 0.45, 0.2) } },
    ],
  };
}

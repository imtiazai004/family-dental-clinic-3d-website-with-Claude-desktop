import * as THREE from 'three';
import { withCutFace } from './materials.js';
import { makeFixture, makeAbutment } from './procedural.js';
import { makeXray } from './kit.js';

// The implant page's "how it works" story, seven steps long:
// X-ray, planning, placement, healing, abutment, matching crown, bite check.
// Separate from the home page's implant chapter so the two can differ.

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;

export const IMPLANT_STEPS = 7;

// Camera framing per step: scale, the local height to centre on, turn and tilt.
const K = [
  { s: 0.9, f: -0.35, ry: 0.0, rx: 0.16 },
  { s: 1.05, f: -0.45, ry: 0.0, rx: 0.1 },
  { s: 0.95, f: -0.4, ry: -0.42, rx: 0.16 },
  { s: 1.4, f: -0.8, ry: -0.32, rx: 0.08 },
  { s: 1.1, f: -0.45, ry: -0.36, rx: 0.14 },
  { s: 1.05, f: -0.1, ry: -0.2, rx: 0.18 },
  { s: 0.92, f: -0.05, ry: 0.0, rx: 0.2 },
];
// Hero (before the story starts): the three parts float above the gap, taken apart.
const HERO = { s: 0.72, f: 0.55, ry: -0.38, rx: 0.16 };

export function buildImplantStory(kit) {
  const { M, CUT, molar, part, localPlane } = kit;
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);

  // Clipping: the jaw is cut open from step 3; the X-ray scan divides "normal" from "X-ray" along x.
  const cut = localPlane(0, 0, -1, 5);
  const scanR = localPlane(1, 0, 0, 5);   // keeps x > scanX (normal view)
  const scanL = localPlane(-1, 0, 0, -5); // keeps x < scanX (X-ray view)

  // ---------------------------------------------------------------- normal view
  const bone = withCutFace(M.fresh('bone'), CUT.bone, cut.plane, 1);
  const gum = withCutFace(M.fresh('gum'), CUT.gum, cut.plane);
  bone.clippingPlanes = [cut.plane, scanR.plane];
  gum.clippingPlanes = [cut.plane, scanR.plane];
  const enamel = M.fresh('enamel'); enamel.clippingPlanes = [scanR.plane];
  const dentin = M.fresh('dentin'); dentin.clippingPlanes = [scanR.plane];
  const jaw = new THREE.Group();
  jaw.add(part('jaw_bone', bone), part('jaw_gum', gum));
  pivot.add(jaw);
  const neighbors = [-1.2, 1.2].map((x) => {
    const m = molar({ enamel, dentin }, false);
    m.g.position.x = x;
    m.g.rotation.y = x < 0 ? 0.1 : -0.1;
    pivot.add(m.g);
    return m;
  });

  // ---------------------------------------------------------------- X-ray view (same shapes, see-through)
  const xr = {
    bone: makeXray('#bcd4ff', 0.42), gum: makeXray('#bcd4ff', 0.08),
    enamel: makeXray('#eef5ff', 1.0), dentin: makeXray('#d6e6ff', 0.55),
  };
  for (const m of Object.values(xr)) m.clippingPlanes = [scanL.plane];
  const xray = new THREE.Group();
  xray.add(part('jaw_bone', xr.bone), part('jaw_gum', xr.gum));
  for (const n of neighbors) {
    const c = molar({ enamel: xr.enamel, dentin: xr.dentin }, false);
    c.g.position.copy(n.g.position);
    c.g.rotation.copy(n.g.rotation);
    xray.add(c.g);
  }
  pivot.add(xray);

  // Scan bar: a bright sheet of light that sweeps across the jaw.
  const barMat = new THREE.MeshBasicMaterial({ color: '#cfe6ff', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const glowMat = new THREE.MeshBasicMaterial({ color: '#7fb2ff', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const bar = new THREE.Group();
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.025, 3.2, 1.8), barMat);
  const halo = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.3, 1.9), glowMat);
  bar.add(sheet, halo);
  bar.position.y = -0.35;
  pivot.add(bar);

  // The missing tooth, drawn as a faint outline in the gap.
  const ghostMat = makeXray('#c9b0ff', 0.9);
  const ghostTooth = molar({ enamel: ghostMat, dentin: ghostMat }, false);
  pivot.add(ghostTooth.g);

  // ---------------------------------------------------------------- planning: see-through implant and guide line
  const planMat = makeXray('#ffd27a', 1.4);
  const plan = new THREE.Group();
  const planFixture = makeFixture({ titanium: planMat, socket: planMat });
  plan.add(planFixture);
  const guide = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.9, 0), new THREE.Vector3(0, -1.35, 0)]),
    new THREE.LineDashedMaterial({ color: '#ffd27a', dashSize: 0.06, gapSize: 0.05, transparent: true, depthWrite: false, toneMapped: false }),
  );
  guide.computeLineDistances();
  const tickGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.28, 0, 0), new THREE.Vector3(0.28, 0, 0)]);
  const tickMat = new THREE.LineBasicMaterial({ color: '#ffd27a', transparent: true, depthWrite: false, toneMapped: false });
  const tickTop = new THREE.Line(tickGeo, tickMat);
  const tickBot = new THREE.Line(tickGeo, tickMat);
  tickBot.position.y = -1.1;
  plan.add(guide, tickTop, tickBot);
  plan.position.y = -0.3;
  pivot.add(plan);

  // ---------------------------------------------------------------- the real parts
  const fixture = makeFixture(M);
  const abutment = makeAbutment(M);
  const crownMat = M.fresh('porcelain');
  const crownBase = crownMat.color.clone();
  const crown = part('molar_enamel', crownMat);
  pivot.add(fixture, abutment, crown);

  // Healing: a glow that climbs the implant threads as the bone grows onto them.
  const healMat = new THREE.ShaderMaterial({
    uniforms: { uGrow: { value: 0 }, uTime: { value: 0 }, uOn: { value: 0 } },
    vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = position.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = -mv.xyz; gl_Position = projectionMatrix*mv; }',
    fragmentShader: `uniform float uGrow; uniform float uTime; uniform float uOn; varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ float level = mix(-1.15, 0.02, uGrow); float below = 1.0 - smoothstep(level - 0.02, level + 0.06, vY);
        float edge = exp(-pow((vY - level) * 9.0, 2.0));
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.4);
        float a = (below * (0.55 + 1.1 * rim) * (0.85 + 0.15 * sin(uTime * 3.0)) + edge * 1.6) * uOn;
        gl_FragColor = vec4(vec3(1.0, 0.74, 0.32) * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  healMat.toneMapped = false;
  const heal = new THREE.Group();
  fixture.traverse((o) => {
    if (o.isMesh && o.geometry.type !== 'CircleGeometry') {
      for (const sc of [1.1, 1.32]) {
        const h = new THREE.Mesh(o.geometry, healMat);
        h.scale.set(sc, 1.0, sc);
        heal.add(h);
      }
    }
  });
  pivot.add(heal);

  // Bite check: the upper tooth comes down to meet the new crown.
  const upper = molar({}, false);
  upper.g.rotation.z = Math.PI;
  upper.g.rotation.y = 0.35;
  pivot.add(upper.g);
  const sparkMat = new THREE.MeshBasicMaterial({ color: '#ffe3a3', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const sparks = [[-0.22, 0.12], [0.2, -0.1], [0.02, 0.22]].map(([x, z]) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), sparkMat);
    s.position.set(x, 0.86, z);
    pivot.add(s);
    return s;
  });

  const TRY_A = new THREE.Color('#dcc48f'), TRY_B = new THREE.Color('#ffffff');
  const anchors = {
    heroCrown: { obj: crown, p: new THREE.Vector3(0.45, 0.4, 0.2) },
    heroAbutment: { obj: abutment, p: new THREE.Vector3(0.17, 0.3, 0.1) },
    heroImplant: { obj: fixture, p: new THREE.Vector3(0.2, -0.5, 0.1) },
    gap: { obj: ghostTooth.g, p: new THREE.Vector3(0.0, 0.85, 0.2) },
    plan: { obj: plan, p: new THREE.Vector3(0.25, -0.55, 0.1) },
    implant: { obj: fixture, p: new THREE.Vector3(0.22, -0.55, 0.15) },
    month: { obj: fixture, p: new THREE.Vector3(0.3, -0.2, 0.15) },
    abutment: { obj: abutment, p: new THREE.Vector3(0.18, 0.3, 0.1) },
    crown: { obj: crown, p: new THREE.Vector3(0.48, 0.45, 0.2) },
    bite: { obj: crown, p: new THREE.Vector3(0.4, 0.95, 0.2) },
  };

  // Per-step label visibility (0..1) and the month counter, read by the page after update().
  const state = { labels: {}, month: 1 };

  // heroK: 1 while the page hero is on screen, 0 once the story has taken over.
  function update(p, t, pointer, heroK = 0) {
    const n = IMPLANT_STEPS;
    const at = (i, a, b) => seg(p, (i + a) / n, (i + b) / n); // progress inside step i

    // ---- framing between step keyframes
    const f = clamp(p * n - 0.5, 0, n - 1);
    const i0 = Math.floor(f), i1 = Math.min(n - 1, i0 + 1);
    const k = ease(seg(f - i0, 0.2, 0.8));
    const A = K[i0], B = K[i1];
    const hk = ease(clamp(heroK));
    const s = lerp(lerp(A.s, B.s, k), HERO.s, hk);
    const focus = lerp(lerp(A.f, B.f, k), HERO.f, hk);
    const spin = ease(at(6, 0.45, 1)) * Math.PI * 2;
    pivot.scale.setScalar(s);
    pivot.position.y = -focus * s;
    pivot.rotation.y = lerp(lerp(A.ry, B.ry, k), HERO.ry, hk) + spin + pointer.x * 0.12 + Math.sin(t * 0.25) * 0.05;
    pivot.rotation.x = lerp(lerp(A.rx, B.rx, k), HERO.rx, hk) + pointer.y * 0.05;
    root.updateMatrixWorld(true);

    // ---- 1. X-ray scan sweeps across; 3. sweeps back as the implant goes in
    const scanIn = ease(at(0, 0.3, 0.85));
    const scanOut = ease(at(2, 0.05, 0.4));
    const scanX = lerp(-2.3, 2.3, scanIn * (1 - scanOut));
    const sweeping = (scanIn > 0.001 && scanIn < 0.999) || (scanOut > 0.001 && scanOut < 0.999);
    bar.visible = sweeping;
    bar.position.x = scanX;
    scanR.local.constant = -scanX; scanR.sync(pivot);
    scanL.local.constant = scanX; scanL.sync(pivot);
    xray.visible = scanX > -2.25;

    // ---- the jaw opens (front half cut away) when the implant goes in
    const open = ease(at(2, 0.25, 0.55));
    cut.sync(pivot, lerp(5, 0, open));

    // ---- missing tooth outline (step 1 and 2)
    const ghostOn = Math.max(at(0, 0.05, 0.25), hk * 0.8) * (1 - at(2, 0.0, 0.3));
    ghostTooth.g.visible = ghostOn > 0.01;
    ghostMat.uniforms.uOpacity.value = ghostOn * (0.75 + 0.25 * Math.sin(t * 2.4));

    // ---- 2. planning
    const planOn = ease(at(1, 0.15, 0.5)) * (1 - ease(at(2, 0.4, 0.7)));
    plan.visible = planOn > 0.01;
    planMat.uniforms.uOpacity.value = planOn;
    guide.material.opacity = planOn; tickMat.opacity = planOn;
    plan.rotation.z = lerp(0.18, 0.0, ease(at(1, 0.4, 0.85)));

    // ---- 3. implant placement: down and screwed in
    const place = ease(at(2, 0.35, 0.85));
    fixture.visible = at(2, 0.3, 0.35) > 0;
    fixture.position.y = lerp(1.25, -0.3, place);
    fixture.rotation.y = -place * Math.PI * 6;
    fixture.scale.setScalar(1);

    // ---- 4. healing
    const grow = at(3, 0.15, 0.85);
    healMat.uniforms.uGrow.value = ease(grow);
    healMat.uniforms.uTime.value = t;
    const healOn = at(3, 0.05, 0.15) * (1 - at(4, 0.0, 0.2));
    healMat.uniforms.uOn.value = healOn;
    heal.visible = healOn > 0.01;
    heal.position.copy(fixture.position);
    heal.rotation.copy(fixture.rotation);
    state.month = grow < 0.34 ? 1 : grow < 0.67 ? 3 : 6;

    // ---- 5. abutment
    const ab = ease(at(4, 0.2, 0.75));
    abutment.visible = at(4, 0.1, 0.2) > 0;
    abutment.position.y = lerp(0.95, -0.3, ab);
    abutment.rotation.y = (1 - ab) * 2.4;
    abutment.scale.setScalar(1);

    // ---- 6. crown: shade is matched, then it seats
    crown.visible = at(5, 0.05, 0.12) > 0;
    const seat = ease(at(5, 0.6, 0.92));
    crown.position.y = lerp(1.45, 0, seat);
    crown.rotation.y = (1 - seat) * (0.6 + Math.sin(t * 0.8) * 0.15);
    crown.scale.setScalar(1);
    if (crown.visible) {
      const sh = at(5, 0.12, 0.55) * 2;
      crownMat.color.copy(sh < 1 ? TRY_A.clone().lerp(TRY_B, ease(sh)) : TRY_B.clone().lerp(crownBase, ease(sh - 1)));
    } else crownMat.color.copy(crownBase);

    // ---- hero: the parts float above the gap, and drift up and away as the story begins
    if (hk > 0.001 && p < 2.3 / n) {
      const away = 1 - hk;
      const bob = (o) => Math.sin(t * 1.4 + o) * 0.05;
      const parts = [[fixture, 1.05, 0], [abutment, 1.95, 1], [crown, 2.8, 2]];
      for (const [obj, y, o] of parts) {
        obj.visible = true;
        obj.position.y = y + bob(o) + away * 1.6;
        obj.scale.setScalar(Math.max(0.001, hk));
        obj.rotation.y = t * 0.4 + o;
      }
      crownMat.color.copy(crownBase);
    }

    // ---- 7. bite check, then a slow turn
    const down = ease(at(6, 0.05, 0.3)) * (1 - ease(at(6, 0.45, 0.6)));
    upper.g.visible = at(6, 0.0, 0.05) > 0 && at(6, 0.6, 0.75) < 1;
    upper.g.position.set(0, lerp(3.2, 1.62, down) + ease(at(6, 0.6, 0.75)) * 1.2, 0);
    const flash = at(6, 0.22, 0.32) * (1 - at(6, 0.4, 0.5));
    sparkMat.opacity = flash * (0.6 + 0.4 * Math.sin(t * 12));

    // ---- labels
    const L = state.labels;
    L.heroParts = hk > 0.5 ? (hk - 0.5) * 2 : 0;
    L.gap = at(0, 0.1, 0.25) * (1 - at(0, 0.8, 0.95));
    L.plan = at(1, 0.4, 0.55) * (1 - at(1, 0.9, 1));
    L.implant = at(2, 0.8, 0.9) * (1 - at(3, 0.0, 0.1));
    L.month = at(3, 0.12, 0.2) * (1 - at(3, 0.92, 1));
    L.abutment = at(4, 0.7, 0.8) * (1 - at(5, 0.0, 0.1));
    L.crown = at(5, 0.85, 0.95) * (1 - at(6, 0.0, 0.1));
    L.bite = at(6, 0.3, 0.38) * (1 - at(6, 0.55, 0.65));
  }

  root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  return { group: root, pivot, anchors, state, update };
}

import * as THREE from 'three';
import { makeMaterials, withCutFace, makePulpRCT } from './materials.js';
import {
  makeFixture, makeAbutment, makeFile, makeBracket, makeArchCurve, makeGum, makePalate, makeTube, makeDust,
} from './procedural.js';
import { makeGlossKit, addToothFace } from './gloss.js';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const seg = (p, a, b) => clamp((p - a) / (b - a));
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// Local clipping plane that follows a group (removes the front half, z > 0 in group space).
function followPlane() {
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  const local = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.0);
  return { plane, sync(group, offset = 0) { local.constant = offset; plane.copy(local).applyMatrix4(group.matrixWorld); } };
}

export function buildScenes(gltf, stage) {
  const { scene } = stage;
  const gloss = stage.look === 'gloss';
  const M = makeMaterials(stage.tier, stage.look);
  // Cross-section colours (lighter and cleaner in the gloss look).
  const CUT = gloss
    ? { bone: '#eed6b8', gum: '#ef9aab', enamel: '#ffffff', dentin: '#fdf7ee' }
    : { bone: '#f0e0c0', gum: '#c25a6e', enamel: '#f8f3ea', dentin: '#ebd197' };
  const src = (name) => gltf.scene.getObjectByName(name);
  const part = (name, mat) => {
    const n = src(name).clone();
    n.traverse((o) => { if (o.isMesh) { o.material = mat; o.frustumCulled = true; } });
    const g = new THREE.Group();
    g.add(n);
    return g;
  };
  const molar = (mats = {}, withPulp = true) => {
    const g = new THREE.Group();
    const d = part('molar_dentin', mats.dentin || M.dentin);
    const p = withPulp ? part('molar_pulp', mats.pulp || M.pulp) : new THREE.Group();
    const e = part('molar_enamel', mats.enamel || M.enamel);
    g.add(d, p, e);
    return { g, d, p, e };
  };

  const root = new THREE.Group();
  scene.add(root);
  const dust = makeDust(stage.tier === 0 ? 70 : 140);
  scene.add(dust);

  // ------------------------------------------------------------------ hero + anatomy
  const hero = new THREE.Group();
  const heroPivot = new THREE.Group();
  const heroTooth = molar();
  heroTooth.g.position.y = 0.48;
  heroPivot.add(heroTooth.g);
  hero.add(heroPivot);
  root.add(hero);
  const anatomyAnchors = {
    enamel: { obj: heroTooth.e, p: new THREE.Vector3(0.0, 0.66, 0.15) },
    dentin: { obj: heroTooth.d, p: new THREE.Vector3(0.5, 0.15, 0.25) },
    pulp: { obj: heroTooth.p, p: new THREE.Vector3(0.18, 0.18, 0.1) },
    roots: { obj: heroTooth.d, p: new THREE.Vector3(0.33, -1.25, 0.1) },
  };

  // ------------------------------------------------------------------ generations
  const gen = new THREE.Group();
  root.add(gen);
  const genItems = [];
  let kidTooth = null, teenTooth = null, adultTooth = null, seniorCrown = null;
  {
    const kid = new THREE.Group();
    if (gloss) {
      // A smiling milk tooth, like a children's dental illustration.
      kidTooth = molar({ enamel: M.milk, dentin: M.milk }, false);
      kidTooth.g.position.y = 0.42;
      kidTooth.g.scale.setScalar(0.88);
      kid.add(kidTooth.g);
    } else {
      const k = part('incisor_crown', M.milk);
      k.scale.setScalar(1.15);
      k.position.y = -0.45;
      kid.add(k);
    }
    const teen = new THREE.Group();
    const t = part('incisor_crown', M.enamel);
    t.scale.setScalar(1.35);
    t.position.y = -0.55;
    const br = makeBracket(M, 1.25);
    br.position.set(0, 0.0, 0.2);
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.5, 10), M.steel);
    wire.rotation.z = Math.PI / 2;
    wire.position.set(0, 0.0, 0.27);
    teen.add(t, br, wire);
    teenTooth = t;
    const adult = new THREE.Group();
    const am = molar({}, false);
    am.g.position.y = 0.48;
    am.g.scale.setScalar(0.95);
    adult.add(am.g);
    adultTooth = am;
    const senior = new THREE.Group();
    const fx = makeFixture(M);
    fx.position.y = -0.3;
    const ab = makeAbutment(M);
    ab.position.y = -0.3;
    const cr = part('molar_enamel', M.porcelain);
    const sg = new THREE.Group();
    sg.add(fx, ab, cr);
    sg.position.y = 0.55;
    sg.scale.setScalar(1.1);
    senior.add(sg);
    seniorCrown = cr;
    for (const it of [kid, teen, adult, senior]) { gen.add(it); genItems.push(it); }
  }

  // ------------------------------------------------------------------ implant
  const imp = new THREE.Group();
  const impPivot = new THREE.Group();
  imp.add(impPivot);
  root.add(imp);
  const impClip = followPlane();
  const impMats = {
    bone: withCutFace(M.fresh('bone'), CUT.bone, impClip.plane, 1),
    gum: withCutFace(M.fresh('gum'), CUT.gum, impClip.plane),
  };
  const impJaw = new THREE.Group();
  impJaw.add(part('jaw_bone', impMats.bone), part('jaw_gum', impMats.gum));
  impPivot.add(impJaw);
  const neighbors = [-1.2, 1.2].map((x) => {
    const m = molar({}, false);
    m.g.position.x = x;
    m.g.rotation.y = x < 0 ? 0.1 : -0.1;
    impPivot.add(m.g);
    return m;
  });
  const fixture = makeFixture(M);
  const abutment = makeAbutment(M);
  const implantCrown = part('molar_enamel', M.porcelain);
  impPivot.add(fixture, abutment, implantCrown);
  const implantAnchors = {
    fixture: { obj: fixture, p: new THREE.Vector3(0.2, -0.5, 0.1) },
    abutment: { obj: abutment, p: new THREE.Vector3(0.17, 0.3, 0.1) },
    crown: { obj: implantCrown, p: new THREE.Vector3(0.45, 0.4, 0.2) },
  };

  // ------------------------------------------------------------------ root canal
  const rct = new THREE.Group();
  const rctPivot = new THREE.Group();
  rct.add(rctPivot);
  root.add(rct);
  const rctClip = followPlane();
  const pulpRCT = makePulpRCT(rctClip.plane);
  const rctMats = {
    enamel: withCutFace(M.fresh('enamel'), CUT.enamel, rctClip.plane),
    dentin: withCutFace(M.fresh('dentin'), CUT.dentin, rctClip.plane),
    bone: withCutFace(M.fresh('bone'), CUT.bone, rctClip.plane, 1),
    gum: withCutFace(M.fresh('gum'), CUT.gum, rctClip.plane),
  };
  const rctJaw = new THREE.Group();
  rctJaw.add(part('jaw_bone', rctMats.bone), part('jaw_gum', rctMats.gum));
  rctJaw.scale.set(0.52, 1, 1);
  const rctTooth = molar({ enamel: rctMats.enamel, dentin: rctMats.dentin, pulp: pulpRCT });
  const file = makeFile(M);
  file.rotation.z = -0.136;
  rctPivot.add(rctJaw, rctTooth.g, file);

  // ------------------------------------------------------------------ crown + veneer
  const restore = new THREE.Group();
  root.add(restore);
  const crownSet = new THREE.Group();
  const prepped = part('molar_dentin', M.dentin);
  const newCrown = part('molar_enamel', M.porcelain);
  crownSet.add(prepped, newCrown);
  const crownPivot = new THREE.Group();
  crownPivot.add(crownSet);
  crownSet.position.y = 0.45;
  const arch = makeArchCurve();
  const veneerSet = new THREE.Group();
  const veneers = [];
  {
    const VT = [{ w: 0.85, mesh: 0.64 }, { w: 0.66, mesh: 0.64, sy: 0.9 }];
    const vb = [];
    for (const side of [1, -1]) {
      let s0 = 0;
      VT.forEach((t, i) => {
        const c = side * (s0 + t.w / 2);
        vb.push(side * s0);
        s0 += t.w + 0.015;
        const { p, t: tan } = arch.at(c);
        const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
        const basis = new THREE.Matrix4().makeBasis(tan.clone().negate(), new THREE.Vector3(0, -1, 0), n);
        const slot = new THREE.Group();
        slot.position.copy(p);
        slot.quaternion.setFromRotationMatrix(basis);
        const sc = t.w / t.mesh;
        const tooth = part('incisor_crown', M.stained);
        const ven = part('incisor_veneer', M.veneer);
        for (const m of [tooth, ven]) { m.scale.set(sc, sc * (t.sy || 1), sc); m.position.y = 0.06; }
        slot.add(tooth, ven);
        veneerSet.add(slot);
        veneers.push({ m: ven, delay: i * 0.1 + (side > 0 ? 0 : 0.05) });
      });
      vb.push(side * s0);
    }
    const pap = (s) => { let best = 1; for (const b of vb) best = Math.min(best, Math.abs(Math.abs(b) - Math.abs(s))); return Math.pow(clamp(1 - best / 0.35), 2); };
    veneerSet.add(makeGum(arch, 1.62, pap, M.gum));
  }
  veneerSet.position.set(0, 0.55, 0.3);
  const veneerPivot = new THREE.Group();
  veneerPivot.add(veneerSet);
  restore.add(crownPivot, veneerPivot);

  // ------------------------------------------------------------------ smile studio (upper arch)
  const studio = new THREE.Group();
  const studioPivot = new THREE.Group();
  studio.add(studioPivot);
  root.add(studio);
  const archInner = new THREE.Group();
  archInner.position.z = 1.7;
  studioPivot.add(archInner);
  const TEETH = [
    { name: 'incisor_crown', w: 0.85, mesh: 0.64, top: 0.8, drop: 0.45, depth: 0.16 },
    { name: 'incisor_crown', w: 0.66, mesh: 0.64, sy: 0.9, top: 0.8, drop: 0.42, depth: 0.16 },
    { name: 'canine_crown', w: 0.76, mesh: 0.6, top: 0.92, drop: 0.45, depth: 0.2 },
    { name: 'premolar_crown', w: 0.7, mesh: 0.76, rot: Math.PI / 2, top: 0.62, drop: 0.36, depth: 0.42 },
    { name: 'premolar_crown', w: 0.66, mesh: 0.76, rot: Math.PI / 2, top: 0.62, drop: 0.36, depth: 0.42 },
    { name: 'molar_crown', w: 1.0, mesh: 1.12, top: 0.62, drop: 0.34, depth: 0.5 },
    { name: 'molar_crown', w: 0.92, mesh: 1.12, top: 0.62, drop: 0.34, depth: 0.5 },
  ];
  const wireAnchors = [];
  const archTeeth = [];
  const bounds = [];
  const brackets = [];
  let rng = 7;
  const rand = () => { rng = (rng * 16807) % 2147483647; return rng / 2147483647 - 0.5; };
  for (const side of [1, -1]) {
    let s = 0;
    TEETH.forEach((t, i) => {
      const c = side * (s + t.w / 2);
      bounds.push(side * s);
      s += t.w + 0.015;
      const { p, t: tan } = arch.at(c);
      const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      const X = tan.clone().negate();
      const basis = new THREE.Matrix4().makeBasis(X, new THREE.Vector3(0, -1, 0), n);
      const slot = new THREE.Group();
      slot.position.copy(p);
      slot.quaternion.setFromRotationMatrix(basis);
      const tooth = new THREE.Group();
      const mesh = part(t.name, M.archTeeth);
      const sc = t.w / t.mesh;
      mesh.scale.set(sc, sc * (t.sy || 1), sc);
      if (t.rot) mesh.rotation.y = t.rot;
      mesh.position.y = 0.06;
      tooth.add(mesh);
      const by = t.top * sc * (t.sy || 1) + 0.06 - t.drop;
      const bz = t.depth * sc + 0.02;
      if (i < 6) {
        const b = makeBracket(M, 0.75);
        b.position.set(0, by, bz);
        tooth.add(b);
        brackets.push(b);
        wireAnchors.push({ s: c, p: new THREE.Vector3(0, by, bz + 0.045).applyQuaternion(slot.quaternion).add(p) });
      }
      slot.add(tooth);
      archInner.add(slot);
      const front = i < 3 ? 1 : i < 5 ? 0.6 : 0.3;
      archTeeth.push({
        tooth, slot, mesh,
        off: { ry: rand() * 0.55 * front, rz: rand() * 0.22 * front, z: rand() * 0.22 * front, y: rand() * 0.08 * front },
      });
    });
    bounds.push(side * s);
  }
  const extent = 5.5 + 0.2;
  const papilla = (s) => {
    const a = Math.abs(s);
    let best = 1;
    for (const b of bounds) best = Math.min(best, Math.abs(Math.abs(b) - a));
    return Math.pow(clamp(1 - best / 0.35), 2);
  };
  const archGum = makeGum(arch, extent, papilla, M.archGum);
  archInner.add(archGum);
  const palate = makePalate(arch, 5.2, M.acrylic);
  archInner.add(palate);
  wireAnchors.sort((a, b) => a.s - b.s);
  const wire = makeTube(wireAnchors.map((w) => w.p), 0.014, M.steel);
  archInner.add(wire);
  const shadeA = new THREE.Color('#e2cd9f');
  const shadeB = new THREE.Color(gloss ? '#ffffff' : '#f6f3ee');
  const gumA = new THREE.Color(gloss ? '#f6a2af' : '#e07a8a');
  const gumB = new THREE.Color(gloss ? '#f9b4c0' : '#e88f9c');

  // ------------------------------------------------------------------ gloss extras (glints, glow pads, kids' face)
  const gs = { ex: 0, crown: 0, newCrown: 0, ven: 0, shade: 0, den: 0 };
  let kit = null;
  const glossPads = {};
  if (gloss) {
    kit = makeGlossKit(stage);
    root.updateMatrixWorld(true);
    const bottom = (o, space) => {
      space.updateWorldMatrix(true, true);
      const b = new THREE.Box3().setFromObject(o);
      return b.min.y - space.getWorldPosition(new THREE.Vector3()).y;
    };
    kit.glint(heroTooth.e, heroTooth.e, 0.7, 0.86, 0.6, () => 1, 0.4);
    kit.glint(heroTooth.e, heroTooth.e, 0.26, 0.6, 0.32, () => 1, 2.9);
    kit.glint(kidTooth.e, kidTooth.g, 0.74, 0.92, 0.42, () => 1, 1.3);
    kit.glint(teenTooth, teenTooth, 0.66, 0.8, 0.38, () => 1, 3.7);
    kit.glint(adultTooth.e, adultTooth.e, 0.7, 0.86, 0.45, () => 1, 5.1);
    kit.glint(seniorCrown, seniorCrown, 0.68, 0.86, 0.45, () => 1, 2.2);
    kit.glint(implantCrown, implantCrown, 0.7, 0.86, 0.5, () => gs.crown, 0.9);
    kit.glint(newCrown, newCrown, 0.7, 0.86, 0.5, () => gs.newCrown, 4.4);
    veneers.slice(0, 2).forEach((v, i) => kit.glint(v.m, v.m, 0.6, 0.55, 0.36, () => gs.ven, 1.7 + i * 2.3));
    [archTeeth[0], archTeeth[7]].forEach((a, i) => kit.glint(a.mesh, a.mesh, 0.6, 0.55, 0.5, () => seg(gs.shade, 0.6, 0.95) * (1 - gs.den), 0.6 + i * 3));
    addToothFace(kit, kidTooth.e, kidTooth.g);
    glossPads.hero = kit.pad(hero, { y: bottom(heroTooth.g, hero) - 0.05, w: 2.6, halo: 0.2, haloY: 0.1 });
    glossPads.gen = kit.pad(gen, { y: bottom(adultTooth.g, gen) - 0.05, w: 2.3, halo: 0.16, haloY: 0.1 });
    glossPads.restore = kit.pad(restore, { y: bottom(crownSet, restore) - 0.05, w: 2.4, halo: 0.16, haloY: 0.1 });
    glossPads.imp = kit.pad(imp, { floor: 0, halo: 0.14, w: 3.4, haloY: 0.4 });
    glossPads.rct = kit.pad(rct, { floor: 0, halo: 0.14, w: 2.6, haloY: 0.3 });
    glossPads.studio = kit.pad(studio, { floor: 0, halo: 0.12, w: 4.2, haloY: 0.2 });
  }

  // ------------------------------------------------------------------ update
  const tmp = new THREE.Vector3();
  const show = (g, presence, layout, base = {}) => {
    const v = presence > 0.002;
    g.visible = v;
    if (!v) return;
    const e = easeOut(presence);
    const s = layout.s * (base.s ?? 1) * (0.55 + 0.45 * e);
    g.scale.setScalar(s);
    g.position.set(layout.x + (base.x ?? 0) * layout.s, layout.y + (base.y ?? 0) * layout.s - (1 - e) * 0.8 * (base.dir ?? 1), 0);
  };

  let manualShade = null;
  Object.entries({ hero, gen, imp, rct, restore, studio }).forEach(([k, g]) => { g.name = k; });
  if (stage.shadows) root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const api = {
    anatomyAnchors, implantAnchors,
    setShade(v) { manualShade = v; },
    clearShade() { manualShade = null; },
    shade: 0,
    update(ch, t, pointer, L) {
      stage.fitShadow?.(L.main.x, L.main.y);
      dust.material.uniforms.uTime.value = t;
      dust.material.uniforms.uPx.value = stage.renderer.getPixelRatio() * 60;
      const anyHero = Math.max(ch.hero.presence, ch.anatomy.presence);
      dust.material.uniforms.uAmount.value = 0.4 + 0.6 * anyHero;

      // hero + anatomy
      const A = ch.anatomy;
      const ex = ease(seg(A.progress, 0.08, 0.5)) * (A.presence > 0.01 ? 1 : 0);
      const heroIntro = ch.ready;
      show(hero, anyHero * heroIntro, L.main, L.portrait
        ? { s: 0.98 - 0.26 * ex, y: 0.22 - 0.05 * ex }
        : { s: 1.18 - 0.12 * ex, y: -0.02 - 0.12 * ex });
      if (hero.visible) {
        const sway = Math.sin(t * 0.35) * 0.55;
        heroPivot.rotation.y = lerp(sway + pointer.x * 0.4 - 0.2, -0.45 + pointer.x * 0.1, ex);
        heroPivot.rotation.x = lerp(0.18 + pointer.y * 0.18, 0.1, ex);
        heroPivot.position.y = Math.sin(t * 0.8) * 0.05 * (1 - ex);
        const xs = L.portrait ? 0.8 : 1;
        heroTooth.e.position.set(-1.0 * ex * xs, (L.portrait ? 0.62 : 0.8) * ex, 0.25 * ex);
        heroTooth.e.rotation.z = 0.25 * ex;
        heroTooth.p.position.set(1.15 * ex * xs, 0.35 * ex, 0.45 * ex);
        heroTooth.d.position.set(0.05 * ex, -0.15 * ex, 0);
      }

      // generations
      const G = ch.generations;
      show(gen, G.presence, L.main, { s: 1.05 });
      if (gen.visible) {
        const f = G.progress * 4;
        genItems.forEach((it, i) => {
          let d = Math.abs(f - (i + 0.5));
          if ((i === 0 && f < 0.5) || (i === 3 && f > 3.5)) d = 0;
          const pr = 1 - seg(d, 0.3, 0.62);
          it.visible = pr > 0.01;
          it.scale.setScalar(0.4 + 0.6 * easeOut(pr));
          it.position.x = (i + 0.5 - f) * 1.6 * (1 - pr * 0.6);
          if (gloss && i === 0) {
            // The smiling tooth sways and hops instead of spinning, so its face stays visible.
            it.rotation.y = Math.sin(t * 0.9) * 0.38 + pointer.x * 0.3;
            it.rotation.z = Math.sin(t * 1.8) * 0.05;
            it.rotation.x = 0.05 + pointer.y * 0.1;
            it.position.y = Math.abs(Math.sin(t * 1.8)) * 0.07;
          } else {
            it.rotation.y = t * 0.45 + i + pointer.x * 0.3;
            it.rotation.x = 0.15 + pointer.y * 0.1;
          }
        });
      }

      // implant
      const I = ch.implant;
      show(imp, I.presence, L.wide, {});
      if (imp.visible) {
        const p = I.progress;
        const a = ease(seg(p, 0.12, 0.38)), b = ease(seg(p, 0.42, 0.6)), c = ease(seg(p, 0.64, 0.82)), fin = ease(seg(p, 0.84, 1));
        const zoom = L.portrait ? ease(seg(p, 0.6, 0.95)) : ease(seg(p, 0.1, 0.9));
        const s = lerp(0.74, 1.0, zoom);
        impPivot.scale.setScalar(s);
        impPivot.position.y = L.portrait ? lerp(-0.95, 0.15, zoom) : lerp(-0.55, 0.42, zoom);
        impPivot.rotation.y = -0.38 + Math.sin(t * 0.25) * 0.08 + pointer.x * 0.12 - 0.22 * fin;
        impPivot.rotation.x = 0.16 + pointer.y * 0.05;
        const hover = (k) => Math.sin(t * 1.4 + k) * 0.04;
        fixture.position.y = lerp(1.05 + hover(0), -0.3, a);
        fixture.rotation.y = -a * Math.PI * 6;
        abutment.position.y = lerp(1.95 + hover(1), -0.3, b);
        abutment.rotation.y = (1 - b) * t * 0.6;
        implantCrown.position.y = lerp(2.8 + hover(2), 0, c);
        implantCrown.rotation.y = (1 - c) * (0.8 + t * 0.4);
        gs.crown = seg(c, 0.85, 1);
        imp.updateMatrixWorld(true);
        impClip.sync(impPivot, 0.0);
      }

      // root canal
      const R = ch.rct;
      show(rct, R.presence, L.main, { s: 1.0 });
      if (rct.visible) {
        const p = R.progress;
        rctPivot.position.y = 0.55;
        rctPivot.rotation.y = -0.3 + Math.sin(t * 0.3) * 0.06 + pointer.x * 0.1 + 0.15 * seg(p, 0.8, 1);
        rctPivot.rotation.x = 0.08 + pointer.y * 0.05;
        const fileIn = ease(seg(p, 0.26, 0.4));
        const fileOut = ease(seg(p, 0.46, 0.54));
        const pump = Math.sin(t * 9) * 0.05 * seg(p, 0.36, 0.4) * (1 - fileOut);
        const depth = fileIn * (1 - fileOut);
        file.visible = depth > 0.001 || (p > 0.24 && p < 0.56);
        file.position.set(lerp(0.12, -0.32, depth) + fileOut * 0.2, lerp(2.2, -1.05, depth) + pump + fileOut * 1.5, 0.05);
        const u = pulpRCT.userData.u;
        u.uTime.value = t;
        u.uInfect.value = 1 - ease(seg(p, 0.3, 0.5));
        const fillLocal = lerp(-1.55, 0.36, ease(seg(p, 0.54, 0.76)));
        rct.updateMatrixWorld(true);
        rctTooth.g.localToWorld(tmp.set(0, fillLocal, 0));
        u.uFill.value = seg(p, 0.53, 0.55) > 0 ? tmp.y : -100;
        rctClip.sync(rctPivot, 0.02);
      }

      // crown + veneer
      const S = ch.restore;
      show(restore, S.presence, L.main, {});
      if (restore.visible) {
        const p = S.progress;
        const swap = ease(seg(p, 0.44, 0.58));
        const drop = ease(seg(p, 0.12, 0.4));
        crownPivot.visible = swap < 0.999;
        crownPivot.scale.setScalar(1 - swap * 0.6);
        crownPivot.position.x = -swap * 2.2;
        crownPivot.rotation.y = -0.4 + Math.sin(t * 0.3) * 0.15 + pointer.x * 0.2;
        crownPivot.rotation.x = 0.2 + pointer.y * 0.1;
        newCrown.position.y = lerp(1.6, 0, drop);
        newCrown.rotation.y = (1 - drop) * 1.6;
        gs.newCrown = seg(drop, 0.85, 1) * (1 - seg(swap, 0, 0.3));
        veneerPivot.visible = swap > 0.001;
        veneerPivot.scale.setScalar((0.4 + 0.6 * swap) * (L.portrait ? 0.82 : 1.15));
        veneerPivot.position.x = (1 - swap) * 2.2;
        veneerPivot.rotation.y = lerp(0.75, 0.12, ease(seg(p, 0.56, 0.98))) + pointer.x * 0.15;
        veneerPivot.rotation.x = 0.12 + pointer.y * 0.08;
        for (const v of veneers) {
          const k = ease(seg(p, 0.62 + v.delay, 0.8 + v.delay));
          v.m.position.z = lerp(1.2, 0, k);
          v.m.position.x = lerp(0.25, 0, k);
        }
        gs.ven = seg(p, 0.86, 0.96);
      }

      // smile studio
      const T = ch.studio;
      show(studio, T.presence, L.arch, {});
      if (studio.visible) {
        const p = T.progress;
        const align = ease(seg(p, 0.05, 0.26));
        const off = 1 - ease(seg(p, 0.29, 0.35));
        const autoShade = ease(seg(p, 0.42, 0.6));
        const shade = manualShade ?? autoShade;
        api.shade = shade;
        const den = ease(seg(p, 0.7, 0.88));
        gs.shade = shade;
        gs.den = den;
        for (const at of archTeeth) {
          const k = 1 - align;
          at.tooth.rotation.set(0, at.off.ry * k, at.off.rz * k);
          at.tooth.position.set(0, at.off.y * k, at.off.z * k);
        }
        for (const b of brackets) { b.visible = off > 0.01; b.scale.setScalar(off); }
        wire.visible = off > 0.01;
        M.archTeeth.color.copy(shadeA).lerp(shadeB, shade);
        M.archGum.color.copy(gumA).lerp(gumB, den);
        palate.visible = den > 0.01;
        palate.scale.set(1, Math.max(0.001, den), 1);
        studioPivot.rotation.x = lerp(0.1, -1.0, den) + pointer.y * 0.06;
        studioPivot.rotation.y = pointer.x * 0.25 + Math.sin(t * 0.25) * 0.05 + den * 0.35 * Math.sin(t * 0.4);
        studioPivot.position.set(0, lerp(0.15, -0.35, den), lerp(0, -1.4, den));
      }

      if (kit) {
        kit.fade(glossPads.hero, 1 - 0.45 * ex);
        kit.fade(glossPads.gen, 1);
        kit.fade(glossPads.restore, 1);
        kit.fade(glossPads.imp, 1);
        kit.fade(glossPads.rct, 1);
        kit.fade(glossPads.studio, 1 - gs.den * 0.5);
        kit.update(t);
      }
    },
  };
  return api;
}

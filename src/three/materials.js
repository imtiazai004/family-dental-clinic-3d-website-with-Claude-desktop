import * as THREE from 'three';

const physical = (o) => new THREE.MeshPhysicalMaterial(o);

// Several shader patches can stack on one material.
function patch(mat, key, fn) {
  const list = mat.userData.patches || (mat.userData.patches = []);
  list.push({ key, fn });
  mat.onBeforeCompile = (sh) => { for (const p of list) p.fn(sh); };
  mat.customProgramCacheKey = () => list.map((p) => p.key).join('|');
  mat.needsUpdate = true;
  return mat;
}

const NOISE = /* glsl */ `
float fhash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fhash(i), fhash(i + vec3(1,0,0)), f.x), mix(fhash(i + vec3(0,1,0)), fhash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(fhash(i + vec3(0,0,1)), fhash(i + vec3(1,0,1)), f.x), mix(fhash(i + vec3(0,1,1)), fhash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float cells(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); float d = 1.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 o = vec3(x, y, z); vec3 r = o + vec3(fhash(i + o), fhash(i + o + 17.3), fhash(i + o + 41.7)) - f;
    d = min(d, dot(r, r));
  }
  return sqrt(d);
}`;

// Baked surface data (_surf: occlusion, thickness, height) drives ambient occlusion,
// warmer enamel near the gum, translucent thin edges, fine colour variation and bump.
export function surface(mat, o = {}) {
  const u = {
    uAO: { value: o.ao ?? 0.9 },
    uCerv: { value: new THREE.Color(o.cervical ?? '#ffffff') },
    uThinCol: { value: new THREE.Color(o.thinColor ?? '#ffffff') },
    uThin: { value: o.thin ?? 0 },
    uTrans: { value: new THREE.Color(o.trans ?? '#000000') },
    uBump: { value: o.bump ?? 0 },
    uFreq: { value: o.freq ?? 40 },
    uRough: { value: o.roughVar ?? 0 },
    uVary: { value: o.vary ?? 0.05 },
  };
  mat.userData.surf = u;
  return patch(mat, `surf${o.bump ? 'b' : ''}`, (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 _surf;\nvarying vec3 vSurf;\nvarying vec3 vObjP;\nvarying mat3 vNM;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurf = _surf;\nvObjP = position;\nvNM = normalMatrix;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vSurf; varying vec3 vObjP; varying mat3 vNM;
        uniform float uAO; uniform vec3 uCerv; uniform vec3 uThinCol; uniform float uThin; uniform vec3 uTrans;
        uniform float uBump; uniform float uFreq; uniform float uRough; uniform float uVary;
        ${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float hgt = vSurf.z;
        float thinv = 1.0 - vSurf.y;
        float nz = vnoise(vObjP * uFreq);
        float nz2 = vnoise(vObjP * uFreq * 0.23 + 7.0);
        diffuseColor.rgb *= mix(uCerv, vec3(1.0), smoothstep(0.0, 0.65, hgt));
        diffuseColor.rgb = mix(diffuseColor.rgb, uThinCol, uThin * thinv * thinv);
        diffuseColor.rgb *= 1.0 - uVary + uVary * 2.0 * (0.6 * nz2 + 0.4 * nz);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor * (1.0 + uRough * (nz - 0.5)), 0.05, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (uBump > 0.0) {
          vec3 q = vObjP * uFreq * 2.0;
          float e = 0.2;
          float n0 = vnoise(q);
          vec3 g = vec3(vnoise(q + vec3(e, 0.0, 0.0)) - n0, vnoise(q + vec3(0.0, e, 0.0)) - n0, vnoise(q + vec3(0.0, 0.0, e)) - n0) / e;
          vec3 gv = vNM * g;
          normal = normalize(normal - uBump * (gv - dot(gv, normal) * normal));
        }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        float aoV = mix(1.0, vSurf.x, uAO);
        reflectedLight.indirectDiffuse *= aoV;
        reflectedLight.indirectSpecular *= mix(1.0, aoV * aoV, 0.9);
        reflectedLight.directDiffuse *= mix(1.0, aoV, 0.5);
        reflectedLight.directSpecular *= mix(1.0, aoV, 0.7);
        float rim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0);
        totalEmissiveRadiance += uTrans * thinv * thinv * (0.3 + 0.7 * rim) * aoV;`);
  });
}

// Back faces of a clipped, closed mesh are painted as a solid cross-section.
// mode 1 = bone (porous cancellous pattern with a dense cortical rim look).
export function withCutFace(mat, cutHex, plane, mode = 0) {
  mat.side = THREE.DoubleSide;
  mat.clippingPlanes = [plane];
  mat.clipShadows = true;
  const uCut = { value: new THREE.Color(cutHex) };
  return patch(mat, `cut${mode}`, (sh) => {
    sh.uniforms.uCut = uCut;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    if (!sh.fragmentShader.includes('float vnoise(')) sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${NOISE}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uCut; varying vec3 vWorldP;')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        if (!gl_FrontFacing) {
          vec3 c = uCut;
          ${mode === 1
            ? `float cc = cells(vWorldP * 9.0) * 0.6 + cells(vWorldP * 21.0 + 3.1) * 0.4;
               float solid = smoothstep(0.3, 0.4, cc);
               float fine = vnoise(vWorldP * 70.0);
               c = mix(c * vec3(0.72, 0.5, 0.42), c, solid) * (0.93 + 0.07 * fine);`
            : 'c *= 0.97 + 0.03 * vnoise(vWorldP * 50.0);'}
          gl_FragColor = linearToOutputTexel(vec4(c * 0.9, 1.0));
        }`);
  });
}

// Pulp that can show infection (pulsing glow) and a rising root-canal filling.
export function makePulpRCT(plane) {
  const u = {
    uInfect: { value: 1 },
    uFill: { value: -10 },
    uTime: { value: 0 },
    uSick: { value: new THREE.Color('#6e1028') },
    uClean: { value: new THREE.Color('#efc9c9') },
    uGutta: { value: new THREE.Color('#e2763f') },
    uGlow: { value: new THREE.Color('#ff2d55') },
  };
  const m = physical({ color: '#ffffff', roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2, side: THREE.DoubleSide });
  m.clippingPlanes = [plane];
  m.clipShadows = true;
  patch(m, 'pulp', (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldQ;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWorldQ = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uInfect; uniform float uFill; uniform float uTime;
        uniform vec3 uSick; uniform vec3 uClean; uniform vec3 uGutta; uniform vec3 uGlow;
        varying vec3 vWorldQ;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float filled = 1.0 - smoothstep(uFill - 0.02, uFill + 0.02, vWorldQ.y);
        diffuseColor.rgb = mix(mix(uClean, uSick, uInfect), uGutta, filled);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uGlow * uInfect * (0.3 + 0.28 * sin(uTime * 3.2)) * (1.0 - filled);`);
  });
  m.userData.u = u;
  return m;
}

// Material recipes. fresh(name) returns a new, independent instance (clones lose shader patches).
export function makeMaterials(tier, look = 'natural', tune = {}) {
  const lite = tier === 0;
  const extra = (o) => (lite ? { ...o, sheen: 0 } : o);
  const enamel = { ao: 0.95, cervical: '#ffeacb', thinColor: '#cbd5e4', thin: 0.45, trans: '#323c52', freq: 55, roughVar: 0.6, vary: 0.03 };
  const R = {
    enamel: [() => physical(extra({ color: '#faf6ee', roughness: 0.26, clearcoat: 0.85, clearcoatRoughness: 0.12, sheen: 0.15, sheenColor: new THREE.Color('#f2ecff') })), enamel],
    dentin: [() => physical(extra({ color: '#e7cf9c', roughness: 0.6, sheen: 0.25, sheenColor: new THREE.Color('#fff0d0') })), { ao: 0.95, freq: 45, roughVar: 0.5, bump: 0.06, vary: 0.06, trans: '#2a1a08' }],
    pulp: [() => physical({ color: '#b8344f', roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15, emissive: new THREE.Color('#4a0816'), emissiveIntensity: 0.5 }), { ao: 0.85, freq: 30, bump: 0.08, trans: '#5a0a1c', vary: 0.08 }],
    gum: [() => physical(extra({ color: '#e07a8a', roughness: 0.45, clearcoat: 0.7, clearcoatRoughness: 0.18, sheen: 0.6, sheenColor: new THREE.Color('#ffc4cf'), sheenRoughness: 0.45 })), { ao: 0.95, cervical: '#e6a7b1', bump: 0.32, freq: 34, roughVar: 0.7, trans: '#4a0c18', vary: 0.07 }],
    bone: [() => physical({ color: '#e8d8b8', roughness: 0.82 }), { ao: 0.95, bump: 0.22, freq: 18, roughVar: 0.3, vary: 0.08 }],
    porcelain: [() => physical(extra({ color: '#f7f3eb', roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.25, sheenColor: new THREE.Color('#f0e6ff') })), { ...enamel, cervical: '#fff3e2', thin: 0.4, vary: 0.02 }],
    stained: [() => physical(extra({ color: '#e0cb9e', roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.25 })), { ...enamel, cervical: '#e9c78f', vary: 0.07 }],
    veneer: [() => physical(extra({ color: '#faf7f0', roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.25, sheenColor: new THREE.Color('#f3ecff') })), { ...enamel, cervical: '#fff6ea', thin: 0.55, vary: 0.02 }],
    archTeeth: [() => physical(extra({ color: '#faf6ee', roughness: 0.26, clearcoat: 0.85, clearcoatRoughness: 0.12, sheen: 0.15, sheenColor: new THREE.Color('#f2ecff') })), enamel],
    archGum: [() => physical(extra({ color: '#e07a8a', roughness: 0.42, clearcoat: 0.75, clearcoatRoughness: 0.16, sheen: 0.6, sheenColor: new THREE.Color('#ffc4cf'), sheenRoughness: 0.45 })), { ao: 0.95, cervical: '#e6a7b1', bump: 0.3, freq: 30, roughVar: 0.7, trans: '#4a0c18', vary: 0.07 }],
    acrylic: [() => physical(extra({ color: '#df7d8e', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 })), { ao: 0.9, bump: 0.12, freq: 9, vary: 0.05 }],
    milk: [() => physical(extra({ color: '#fbf8f2', roughness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.1, sheen: 0.35, sheenColor: new THREE.Color('#e7d9ff') })), { ...enamel, cervical: '#fff6ea' }],
  };
  if (look === 'gloss') Object.assign(R, glossRecipes(extra, tune));
  const fresh = (name) => { const [make, o] = R[name]; return surface(make(), o); };
  const M = { fresh };
  for (const name of Object.keys(R)) M[name] = fresh(name);
  Object.assign(M, {
    titanium: physical({ color: '#bcc1ca', metalness: 1, roughness: 0.22 }),
    abutment: physical({ color: '#d9c39a', metalness: 1, roughness: 0.26 }),
    steel: physical({ color: '#d4d8de', metalness: 1, roughness: 0.18 }),
    socket: physical({ color: '#2f2a35', metalness: 0.6, roughness: 0.6 }),
    handle: physical(extra({ color: '#3f6fd6', roughness: 0.32, clearcoat: 0.6 })),
    stopper: physical({ color: '#ffb347', roughness: 0.5 }),
  });
  if (look === 'gloss') {
    Object.assign(M, {
      titanium: physical({ color: '#eef1f5', metalness: 1, roughness: 0.2, envMapIntensity: 2.2 }),
      abutment: physical({ color: '#e6e9ee', metalness: 1, roughness: 0.18, envMapIntensity: 2.2 }),
      steel: physical({ color: '#eef1f5', metalness: 1, roughness: 0.12, envMapIntensity: 2 }),
    });
  }
  return M;
}

// Bright, glossy "dental advert" look: pure white enamel, candy-pink translucent gums, chrome metal.
function glossRecipes(extra, tune = {}) {
  const white = () => physical(extra({
    color: tune.teeth || '#ffffff', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04,
    sheen: 0.25, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.35,
  }));
  const whiteSurf = { ao: 0.55, cervical: '#ffffff', thinColor: '#eef2f8', thin: 0.15, trans: '#2a3242', vary: 0, roughVar: 0.05, freq: 40 };
  const pink = (hex) => () => physical(extra({
    color: hex, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.1,
    sheen: 0.6, sheenColor: new THREE.Color('#ffd3db'), sheenRoughness: 0.4,
    emissive: new THREE.Color('#ff6f86'), emissiveIntensity: 0.1,
  }));
  const pinkSurf = { ao: 0.7, cervical: '#ffffff', trans: '#9a1631', vary: 0.02, freq: 30 };
  return {
    enamel: [white, whiteSurf],
    porcelain: [white, whiteSurf],
    veneer: [white, { ...whiteSurf, thin: 0.25 }],
    archTeeth: [white, whiteSurf],
    milk: [white, whiteSurf],
    stained: [() => physical(extra({ color: '#efe1c3', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 })), { ...whiteSurf, cervical: '#f4e2b8' }],
    dentin: [() => physical(extra({ color: tune.dentin || '#f7eedf', roughness: 0.26, clearcoat: 0.8, clearcoatRoughness: 0.1, sheen: 0.3, sheenColor: new THREE.Color('#fff6e8') })), { ao: 0.6, vary: 0, trans: '#3a2a12', freq: 40 }],
    pulp: [() => physical({ color: '#ee4d69', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06, emissive: new THREE.Color('#ff3d63'), emissiveIntensity: 0.35 }), { ao: 0.6, trans: '#7a0e26', vary: 0, freq: 30 }],
    gum: [pink('#f6a2af'), pinkSurf],
    archGum: [pink('#f6a2af'), pinkSurf],
    acrylic: [pink('#f39aab'), { ...pinkSurf, bump: 0.05, freq: 9 }],
    bone: [() => physical({ color: '#f5ecdc', roughness: 0.55, clearcoat: 0.3 }), { ao: 0.75, bump: 0.05, freq: 18, vary: 0.03 }],
  };
}

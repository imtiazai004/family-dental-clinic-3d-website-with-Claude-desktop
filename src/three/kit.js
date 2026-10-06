import * as THREE from 'three';
import { makeMaterials } from './materials.js';

// Shared building blocks for the treatment-page scenes (the home page keeps its own copy in scenes.js,
// so changes here never affect it).
export function createKit(gltf, stage) {
  const gloss = stage.look === 'gloss';
  const M = makeMaterials(stage.tier, stage.look, stage.tune);
  const CUT = gloss
    ? { bone: '#eed6b8', gum: '#ef9aab', enamel: '#ffffff', dentin: '#fdf7ee' }
    : { bone: '#f0e0c0', gum: '#c25a6e', enamel: '#f8f3ea', dentin: '#ebd197' };
  const src = (name) => gltf.scene.getObjectByName(name);

  // A clone of a model node wrapped in a group (the node keeps its own quantisation transform).
  const part = (name, mat) => {
    const n = src(name).clone();
    n.traverse((o) => { if (o.isMesh) o.material = mat; });
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
  // A clipping plane defined in a group's local space and kept in world space each frame.
  const localPlane = (nx, ny, nz, c = 0) => {
    const local = new THREE.Plane(new THREE.Vector3(nx, ny, nz), c);
    const plane = local.clone();
    return {
      plane, local,
      sync(group, constant = local.constant) { local.constant = constant; plane.copy(local).applyMatrix4(group.matrixWorld); },
    };
  };
  return { M, CUT, gloss, part, molar, localPlane, src };
}

// See-through "X-ray" look: bright rims, dim centres, added together so dense overlaps glow.
export function makeXray(color = '#cfe3ff', strength = 1) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uK: { value: strength }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */ `
      #include <common>
      #include <clipping_planes_pars_vertex>
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <clipping_planes_pars_fragment>
      uniform vec3 uColor; uniform float uK; uniform float uOpacity;
      varying vec3 vN; varying vec3 vV;
      void main() {
        #include <clipping_planes_fragment>
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float a = (0.16 + 0.84 * pow(f, 2.2)) * uK * uOpacity;
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  m.clipping = true;
  m.toneMapped = false;
  return m;
}

import * as THREE from 'three';
import { withCutFace } from '../materials.js';
import { surfaceDecal } from '../shells.js';
import { cavityTexture, canvasTexture, glowBall } from '../stories/core.js';
import { makeModel } from './model.js';

// Type cards for fillings and tooth extraction.

// An oval mask matching the cleaned cavity, used to cut filling layers to shape.
const mask = () => canvasTexture((g, n) => {
  g.fillStyle = '#fff';
  g.beginPath();
  g.ellipse(n / 2, n / 2, n * 0.31, n * 0.28, 0, 0, Math.PI * 2);
  g.fill();
});

// A molar with a cleaned cavity on top, and the patch that covers it.
function toothWithCavity(kit, model) {
  const { part, M } = kit;
  const tooth = new THREE.Group();
  const enamel = part('molar_enamel', M.enamel);
  tooth.add(part('molar_dentin', M.dentin), enamel);
  const cavity = new THREE.Mesh(surfaceDecal(enamel, 0.04, 0.03, 0.27), new THREE.MeshStandardMaterial({
    map: cavityTexture(), transparent: true, roughness: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  }));
  tooth.add(cavity);
  model.add(tooth, [0, -0.5, 0], 'Your tooth, cavity cleaned', [0.55, 0.25, 0.3]);
  const top = (color, rough = 0.3) => new THREE.Mesh(surfaceDecal(enamel, 0.04, 0.03, 0.27, { lift: 0.012 }), new THREE.MeshPhysicalMaterial({
    color, roughness: rough, clearcoat: 1 - rough, alphaMap: mask(), alphaTest: 0.5, side: THREE.DoubleSide,
  }));
  return { tooth, enamel, top };
}

// A rounded lens of filling material that sits inside the cavity.
function lens(color, r, h, y, rough = 0.35) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), new THREE.MeshPhysicalMaterial({ color, roughness: rough, clearcoat: 1 - rough }));
  m.scale.set(r, h, r * 0.9);
  m.position.set(0.04, y, 0.03);
  return m;
}

export const FILLING_TYPES = {
  'filling-composite'(kit) {
    const model = makeModel({ rx: 0.55, ry: -0.5 });
    const { top } = toothWithCavity(kit, model);
    model.add(lens('#e9d9bb', 0.19, 0.06, 0.44), [0, 0.42, 0], 'First layer', [0.19, 0, 0]);
    model.add(lens('#efe3cb', 0.24, 0.06, 0.48), [0, 0.78, 0], 'Second layer', [0.24, 0, 0]);
    const t = top(kit.M.enamel.color.getStyle());
    model.add(t, [0, 1.1, 0], 'Final layer, shaped to your bite', [0.3, 0.56, 0.05]);
    return model.finish();
  },
  'filling-gic'(kit) {
    const model = makeModel({ rx: 0.55, ry: -0.5 });
    const { top } = toothWithCavity(kit, model);
    const fill = new THREE.Group();
    fill.add(lens('#e8e2d4', 0.24, 0.07, 0.46, 0.6), top('#ece6d8', 0.6));
    // Fluoride released around the filling.
    [[-0.28, 0.62, 0.1], [0.3, 0.66, -0.05], [0.05, 0.72, 0.3], [-0.1, 0.7, -0.28], [0.22, 0.6, 0.26]].forEach(([x, y, z]) => {
      const s = glowBall(0.04, '#7fe3d4', 0.75);
      s.position.set(x, y, z);
      fill.add(s);
    });
    model.add(fill, [0, 0.75, 0], 'Glass ionomer filling', [0.3, 0.56, 0.05]);
    model.label('Releases fluoride', fill, [0.3, 0.66, -0.05]);
    return model.finish();
  },
};

// ---------------------------------------------------------------- extraction
// A cut-away piece of jaw (bone and gum), cut open down the middle like the page's story.
function cutJaw(kit, model, sx = 0.52) {
  const { part, M, CUT } = kit;
  const jaw = new THREE.Group();
  const cut = model.plane(jaw, 0, 0, -1, 0.02);
  jaw.add(part('jaw_bone', withCutFace(M.fresh('bone'), CUT.bone, cut, 1)), part('jaw_gum', withCutFace(M.fresh('gum'), CUT.gum, cut)));
  jaw.scale.set(sx, 1, 1);
  return { jaw, cut };
}
// A molar, cut open the same way.
function cutTooth(kit, model) {
  const { part, M, CUT } = kit;
  const tooth = new THREE.Group();
  const cut = model.plane(tooth, 0, 0, -1, 0.02);
  tooth.add(
    part('molar_dentin', withCutFace(M.fresh('dentin'), CUT.dentin, cut)),
    part('molar_pulp', withCutFace(M.fresh('pulp'), '#d9667c', cut)),
    part('molar_enamel', withCutFace(M.fresh('enamel'), CUT.enamel, cut)),
  );
  return tooth;
}

export const EXTRACTION_TYPES = {
  'extract-simple'(kit) {
    const { part } = kit;
    const model = makeModel({ rx: 0.16, ry: -0.42 });
    const { jaw, cut } = cutJaw(kit, model);
    // The socket left behind, healing (seen through the cut).
    const below = model.plane(jaw, 0, -1, 0, -0.14);
    const socketMat = new THREE.MeshStandardMaterial({ color: '#d79a8f', roughness: 0.7, side: THREE.BackSide });
    socketMat.clippingPlanes = [cut, below];
    const socket = part('molar_dentin', socketMat);
    socket.scale.set(1.015 / 0.52, 1.015, 1.015);
    jaw.add(socket);
    model.add(jaw, [0, -0.55, 0], 'The socket heals over', [0.45, -0.7, 0]);
    model.add(cutTooth(kit, model), [0, 1.55, 0], 'Tooth lifted out whole', [0.55, 0.25, 0]);
    return model.finish();
  },
  'extract-surgical'(kit) {
    const model = makeModel({ rx: 0.16, ry: -0.42 });
    const { jaw } = cutJaw(kit, model, 0.62);
    model.add(jaw, [0, -0.55, 0], 'Bone around the tooth', [0.55, -1.2, 0]);
    // A wisdom tooth lying on its side, under the gum.
    const tooth = cutTooth(kit, model);
    tooth.scale.setScalar(0.72);
    tooth.rotation.z = -1.15;
    tooth.position.set(-0.08, -0.82, 0);
    model.add(tooth, [0.15, 1.45, 0], 'Wisdom tooth lying sideways', [0.45, 0.35, 0]);
    // The gum is gently opened over it, then closed with a few stitches.
    const flap = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 40, 1, false, 0, Math.PI), kit.M.fresh('gum'));
    flap.geometry.setAttribute('_surf', new THREE.Float32BufferAttribute(new Float32Array(flap.geometry.attributes.position.count * 3).fill(1), 3));
    flap.scale.set(1, 1, 0.7);
    flap.position.set(0, -0.11, 0);
    model.add(flap, [-0.45, 0.75, -0.3], 'Gum gently opened', [0.0, 0.05, -0.35]);
    const stitches = new THREE.Group();
    const thread = new THREE.MeshPhysicalMaterial({ color: '#2d3e8f', roughness: 0.4, clearcoat: 0.6 });
    for (const x of [-0.3, 0, 0.3]) {
      const st = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.016, 8, 24), thread);
      st.position.set(x, -0.06, 0);
      st.rotation.y = Math.PI / 2;
      stitches.add(st);
    }
    model.add(stitches, [0, 2.35, 0.1], 'Stitches help it heal', [0.42, 0, 0]);
    return model.finish();
  },
};

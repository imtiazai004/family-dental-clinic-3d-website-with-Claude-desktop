import * as THREE from 'three';
import { frontShell } from '../shells.js';
import { makeModel, frontTeeth } from './model.js';

// Type cards for crowns, veneers and teeth whitening.

// ---------------------------------------------------------------- crowns
// The shaped tooth, then one or two crown layers above it.
function crownModel(kit, layers) {
  const { part, M } = kit;
  const model = makeModel({ rx: 0.24, ry: -0.5 });
  const tooth = part('molar_dentin', M.dentin);
  model.add(tooth, [0, -0.55, 0], 'Your tooth, shaped', [0.55, -0.1, 0.25]);
  let lift = 0.75;
  layers.forEach((l, i) => {
    const c = part('molar_enamel', l.mat);
    c.scale.setScalar(l.scale);
    model.add(c, [0, lift, 0], l.label, l.anchor);
    lift += i === 0 && layers.length > 1 ? 0.8 : 0.85;
  });
  return model.finish();
}

export const CROWN_TYPES = {
  'crown-ceramic'(kit) {
    const glass = kit.M.fresh('porcelain');
    return crownModel(kit, [{ mat: glass, scale: 1.04, label: 'All-ceramic crown', anchor: [0.5, 0.45, 0.25] }]);
  },
  'crown-zirconia'(kit) {
    const zr = new THREE.MeshPhysicalMaterial({ color: '#eceff3', roughness: 0.72, clearcoat: 0.1, sheen: 0.4, sheenColor: new THREE.Color('#ffffff') });
    return crownModel(kit, [
      { mat: zr, scale: 0.99, label: 'Zirconia base, very strong', anchor: [0.55, 0.35, 0.2] },
      { mat: kit.M.fresh('porcelain'), scale: 1.05, label: 'Tooth-coloured outer layer', anchor: [0.5, 0.5, 0.25] },
    ]);
  },
  'crown-pfm'(kit) {
    const metal = new THREE.MeshPhysicalMaterial({ color: '#cdd1d8', metalness: 0.75, roughness: 0.4, clearcoat: 0.3 });
    return crownModel(kit, [
      { mat: metal, scale: 0.99, label: 'Metal base', anchor: [0.55, 0.35, 0.2] },
      { mat: kit.M.fresh('porcelain'), scale: 1.05, label: 'Porcelain layer', anchor: [0.5, 0.5, 0.25] },
    ]);
  },
};

// ---------------------------------------------------------------- front-tooth shells
// One shell per tooth of a frontTeeth() row, grouped so they can move together.
function shells(kit, teeth, mat, push) {
  const g = new THREE.Group();
  for (const t of teeth) {
    const slot = new THREE.Group();
    slot.position.copy(t.slot.position);
    slot.rotation.copy(t.slot.rotation);
    slot.add(frontShell(kit, t.name, mat, t.mesh, { push }));
    g.add(slot);
  }
  return g;
}

export const VENEER_TYPES = {
  'veneer-porcelain'(kit) {
    const model = makeModel({ rx: 0.1, ry: -0.42 });
    const { g, teeth } = frontTeeth(kit, kit.M.fresh('stained'), 4);
    model.add(g, [0, 0, -0.3], 'Your teeth', [0.95, -0.55, 0.2]);
    const bond = shells(kit, teeth, new THREE.MeshPhysicalMaterial({ color: '#f2d79c', roughness: 0.3, clearcoat: 0.6, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }), 0.01);
    // Shell anchors are in tooth-slot space, where +y runs from the gum towards the biting edge.
    model.add(bond, [0, -1.0, 0.45], 'Thin bonding layer', [0, 0.45, 0.25], bond.children[1]);
    const veneers = shells(kit, teeth, kit.M.fresh('veneer'), 0.02);
    model.add(veneers, [0, -2.0, 0.9], 'Porcelain veneers', [0, 0.5, 0.3], veneers.children[2]);
    return model.finish();
  },
  'veneer-composite'(kit) {
    const model = makeModel({ rx: 0.1, ry: -0.42 });
    const { g, teeth } = frontTeeth(kit, kit.M.fresh('stained'), 4);
    model.add(g, [0, 0, -0.3], 'Your teeth', [0.95, -0.55, 0.2]);
    const inner = new THREE.MeshPhysicalMaterial({ color: '#efdfc2', roughness: 0.45, clearcoat: 0.3 });
    const l1 = shells(kit, teeth, inner, 0.012);
    model.add(l1, [0, -1.0, 0.45], 'First composite layer', [0, 0.45, 0.25], l1.children[1]);
    const l2 = shells(kit, teeth, kit.M.fresh('veneer'), 0.03);
    model.add(l2, [0, -2.0, 0.9], 'Final layer, shaped and polished', [0, 0.5, 0.3], l2.children[2]);
    return model.finish();
  },
};

// ---------------------------------------------------------------- whitening
function gumBarrier(teeth) {
  const pts = teeth.map((t) => t.slot.position.clone().add(new THREE.Vector3(0, -0.04, 0.2)));
  pts.unshift(pts[0].clone().add(new THREE.Vector3(-0.25, 0.02, -0.08)));
  pts.push(pts[pts.length - 1].clone().add(new THREE.Vector3(0.25, 0.02, -0.08)));
  const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.075, 12, false);
  return new THREE.Mesh(tube, new THREE.MeshPhysicalMaterial({ color: '#3fbfae', roughness: 0.38, clearcoat: 0.6 }));
}
const gelMat = () => new THREE.MeshPhysicalMaterial({
  color: '#9ad8ff', roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.6, depthWrite: false,
  emissive: new THREE.Color('#2a88c8'), emissiveIntensity: 0.25,
});

export const WHITENING_TYPES = {
  'whitening-clinic'(kit) {
    const model = makeModel({ rx: 0.12, ry: -0.4 });
    const { g, teeth } = frontTeeth(kit, kit.M.archTeeth, 4);
    model.add(g, [0, 0, -0.3], 'Your teeth', [0.95, -0.55, 0.2]);
    const barrier = gumBarrier(teeth);
    model.add(barrier, [0, 0.55, 0.35], 'Gum barrier', [0.6, 0.0, 0.25]);
    const gel = shells(kit, teeth, gelMat(), 0.04);
    model.add(gel, [0, -1.1, 0.6], 'Whitening gel', [0, 0.5, 0.3], gel.children[2]);
    return model.finish();
  },
  'whitening-home'(kit) {
    const model = makeModel({ rx: 0.12, ry: -0.4 });
    const { g, teeth } = frontTeeth(kit, kit.M.archTeeth, 4);
    model.add(g, [0, 0, -0.3], 'Your teeth', [0.95, -0.55, 0.2]);
    const trayMat = new THREE.MeshPhysicalMaterial({ color: '#d8ecff', transparent: true, opacity: 0.45, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false });
    const tray = g.clone(true);
    for (const c of [...tray.children]) if (c.userData.gum) tray.remove(c);
    tray.traverse((o) => { if (o.isMesh) o.material = trayMat; });
    tray.children.forEach((slot) => slot.children[0]?.scale.multiplyScalar(1.08));
    model.add(tray, [0, -2.1, 0.8], 'Tray made for your teeth', [-0.95, -0.5, 0.25]);
    const gel = shells(kit, teeth, gelMat(), 0.03);
    model.add(gel, [0, -1.05, 0.4], 'Whitening gel', [0, 0.5, 0.3], gel.children[1]);
    // A small syringe of gel.
    const syringe = new THREE.Group();
    const clear = new THREE.MeshPhysicalMaterial({ color: '#f4f8ff', transparent: true, opacity: 0.4, roughness: 0.1, clearcoat: 1, depthWrite: false });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.1, 24), clear);
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.75, 20), gelMat());
    fill.position.y = -0.12;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 20), clear);
    tip.position.y = -0.69;
    tip.rotation.z = Math.PI;
    const plunger = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 12), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.4 }));
    plunger.position.y = 0.75;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 24), plunger.material);
    cap.position.y = 1.0;
    syringe.add(body, fill, tip, plunger, cap);
    syringe.rotation.z = Math.PI / 2 + 0.15;
    syringe.position.set(0.1, -0.85, 0.2);
    syringe.visible = true;
    model.add(syringe, [1.2, -2.1, 0.5], 'Gel to use at home', [0, 0.3, 0.12]);
    return model.finish();
  },
};

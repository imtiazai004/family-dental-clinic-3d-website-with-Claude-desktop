import * as THREE from 'three';
import { makeBracket } from '../procedural.js';
import { makeXray } from '../kit.js';
import { makeModel, frontTeeth } from './model.js';

// Type cards for root canal treatment and braces.

// A see-through tooth with its sealed (orange) canals, plus what goes on top.
function treatedTooth(kit, model, top) {
  const { part, M } = kit;
  const shellMat = makeXray('#eaf2ff', 0.9);
  const dentinMat = makeXray('#d9e6ff', 0.45);
  const gutta = new THREE.MeshPhysicalMaterial({ color: '#e2763f', roughness: 0.35, clearcoat: 0.6 });
  const tooth = new THREE.Group();
  tooth.add(part('molar_dentin', dentinMat), part('molar_enamel', shellMat), part('molar_pulp', gutta));
  model.add(tooth, [0, -0.25, 0], 'Your own tooth, kept', [0.6, -0.6, 0.2]);
  model.label('Sealed canals', tooth, [0.3, -0.9, 0.15]);
  return { tooth, gutta, M };
}

export const RCT_TYPES = {
  'rct-filling'(kit) {
    const model = makeModel({ rx: 0.22, ry: -0.45 });
    treatedTooth(kit, model);
    const plug = kit.part('molar_enamel', kit.M.porcelain);
    plug.scale.set(0.42, 0.25, 0.32);
    plug.position.y = 0.52;
    model.add(plug, [0, 0.9, 0], 'Tooth-coloured filling', [0.3, 0.6, 0.2]);
    return model.finish();
  },
  'rct-crown'(kit) {
    const model = makeModel({ rx: 0.22, ry: -0.45 });
    treatedTooth(kit, model);
    const crown = kit.part('molar_enamel', kit.M.porcelain);
    crown.scale.setScalar(1.04);
    model.add(crown, [0, 1.25, 0], 'Crown', [0.5, 0.45, 0.2]);
    return model.finish();
  },
};

// Three front teeth with brackets, ties and a wire, or a clear aligner.
function bracesSet(kit, bracketMat, tieColor, label) {
  const model = makeModel({ rx: 0.1, ry: -0.35 });
  const { g, teeth } = frontTeeth(kit, kit.M.archTeeth, 4);
  model.add(g, [0, 0, -0.35], 'Your teeth', [0.95, -0.55, 0.2]);
  const brackets = new THREE.Group();
  const ties = new THREE.Group();
  const pts = [];
  for (const t of teeth) {
    const p = new THREE.Vector3(0, 0.42 * t.sc, 0.2).applyEuler(t.slot.rotation).add(t.slot.position);
    const b = makeBracket({ steel: bracketMat }, 0.95);
    b.position.copy(p);
    b.rotation.y = t.slot.rotation.y;
    brackets.add(b);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 20), new THREE.MeshPhysicalMaterial({ color: tieColor, roughness: 0.35, clearcoat: 0.8 }));
    tie.position.copy(p).add(new THREE.Vector3(0, 0, 0.05));
    tie.rotation.y = t.slot.rotation.y;
    ties.add(tie);
    pts.push(p.clone().add(new THREE.Vector3(0, 0, 0.045)));
  }
  const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.016, 8, false), kit.M.steel);
  // Apart: the pieces step down and forward in rows below the teeth.
  model.add(brackets, [0, -0.6, 0.55], label, [0.14, 0.0, 0.05], brackets.children[3]);
  model.add(ties, [0, -1.1, 0.95], 'Elastic ties', [0.1, 0.0, 0.02], ties.children[0]);
  model.add(wire, [0, -1.55, 1.3], 'Wire', [pts[3].x + 0.12, pts[3].y, pts[3].z]);
  return model.finish();
}

export const BRACES_TYPES = {
  'braces-metal'(kit) {
    return bracesSet(kit, kit.M.steel, '#c9a2ff', 'Metal brackets');
  },
  'braces-ceramic'(kit) {
    const ceramic = new THREE.MeshPhysicalMaterial({ color: '#f4efe8', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, transmission: 0, sheen: 0.3 });
    return bracesSet(kit, ceramic, '#f2eadf', 'Tooth-coloured brackets');
  },
  aligner(kit) {
    const model = makeModel({ rx: 0.12, ry: -0.35 });
    const { g, teeth } = frontTeeth(kit, kit.M.archTeeth, 4);
    model.add(g, [0, 0, 0], 'Your teeth', [0.95, -0.55, 0.2]);
    const trayMat = new THREE.MeshPhysicalMaterial({ color: '#d8ecff', transparent: true, opacity: 0.5, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false });
    const tray = g.clone(true);
    for (const c of [...tray.children]) if (c.userData.gum) tray.remove(c);
    tray.traverse((o) => { if (o.isMesh) o.material = trayMat; });
    tray.children.forEach((slot) => slot.children[0]?.scale.multiplyScalar(1.08));
    model.add(tray, [0, -1.05, 0.25], 'Clear aligner', [-0.9, -0.5, 0.25]);
    return model.finish();
  },
};

import * as THREE from 'three';
import { buildArch } from '../arch.js';
import { makePalate } from '../procedural.js';
import { buildPartial } from '../partial-kit.js';
import { makeModel } from './model.js';

// Type cards for complete and partial dentures.

export const DENTURE_TYPES = {
  // An upper and a lower denture: teeth on a gum-coloured acrylic base.
  'denture-complete'(kit) {
    const { M } = kit;
    const model = makeModel({ rx: 0.38, ry: -0.5 });
    const acrylic = M.fresh('acrylic');
    const upper = buildArch(kit, { teethMat: M.archTeeth, gumMat: acrylic });
    const plate = makePalate(upper.arch, 5.2, acrylic);
    plate.position.y = 0.02;
    upper.group.add(plate);
    upper.group.position.set(0, 0, 0);
    const lower = buildArch(kit, { teethMat: M.archTeeth, gumMat: acrylic });
    lower.group.position.set(0, 0, 0);
    const lowerWrap = new THREE.Group();
    lowerWrap.add(lower.group);
    lowerWrap.rotation.z = Math.PI;
    lowerWrap.scale.setScalar(0.95);
    lowerWrap.position.y = -1.55;
    const front = upper.teeth.find((t) => t.side === -1 && t.i === 1);
    model.add(upper.group, [0, 0.75, 0], 'Upper denture', [front.p.x, -0.35, front.p.z + 0.35]);
    model.label('Gum-coloured acrylic base', upper.group, [upper.arch.at(2.6).p.x, 0.25, upper.arch.at(2.6).p.z + 0.5]);
    const lf = lower.teeth.find((t) => t.side === 1 && t.i === 2);
    model.add(lowerWrap, [0, -0.75, 0], 'Lower denture', [lf.p.x, -0.35, lf.p.z + 0.35]);
    return model.finish();
  },
};

// The jaw with its gaps on top, the partial denture below it.
function partialModel(kit, kind, labels) {
  const { M } = kit;
  const model = makeModel({ rx: -1.0, ry: 0.2 });
  const A = buildArch(kit, { teethMat: M.archTeeth, gumMat: M.archGum, missing: ['1:3', '1:4', '-1:5'] });
  A.group.position.set(0, 0, 0);
  const P = buildPartial(kit, A, kind);
  const gapR = P.gaps.find((g) => g.side === 1);
  model.add(A.group, [0, 1.3, 0], 'Your teeth, with gaps', [gapR.p.x + 0.9, -0.2, gapR.p.z + 0.5]);
  model.add(P.base, [0, 0, 0], labels.base, labels.baseAnchor(P));
  model.add(P.teeth, [0, -0.9, 0], 'New teeth', [gapR.p.x, -0.6, gapR.p.z + 0.4]);
  const clasp = P.clasps[0];
  model.label(labels.clasp, P.base, clasp.t.p.clone().setY(-0.28).addScaledVector(clasp.t.n, clasp.t.spec.depth * clasp.t.sc + 0.06).toArray());
  return model.finish();
}

export const PARTIAL_TYPES = {
  'partial-metal'(kit) {
    return partialModel(kit, 'metal', {
      base: 'Thin metal framework', clasp: 'Metal clasps',
      baseAnchor: (P) => P.strapCurve.getPoint(0.5).toArray(),
    });
  },
  'partial-acrylic'(kit) {
    return partialModel(kit, 'acrylic', {
      base: 'Gum-coloured acrylic plate', clasp: 'Wire clasps',
      baseAnchor: (P) => [0, 0.6, -2.2],
    });
  },
  'partial-flexible'(kit) {
    return partialModel(kit, 'flexible', {
      base: 'Soft, flexible base', clasp: 'Gum-coloured clasps',
      baseAnchor: (P) => [0, 0.6, -2.2],
    });
  },
};

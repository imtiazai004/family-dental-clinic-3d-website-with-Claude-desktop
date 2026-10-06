// Generates every sculpted model for the site from signed-distance functions,
// meshes them with surface nets, simplifies, and writes one compressed GLB.
// Run: node tools/build-models.mjs
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { quantize, meshopt, reorder } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import { mkdirSync } from 'node:fs';
import {
  clamp, mix, smoothstep, smin, smax, sdSphere, sdEllipsoid, sdRoundBox, sdCapsule, sdRoundCone,
} from './sdf.mjs';
import { meshSDF } from './mesher.mjs';

// ---------------------------------------------------------------- molar (lower first molar)
// Units: 1 = 10 mm. y up, crown on top, mesial = -x, buccal = +z.
const Y_CEJ = -0.12;
const T_ENAMEL = 0.075;

function crownSDF(x, y, z, o) {
  const t = clamp((0.1 - y) / 0.45, 0, 1);
  const sc = 1 + 0.38 * t * t; // narrows toward the neck
  const qx = x * sc, qz = z * sc;
  const box = sdRoundBox(qx, y - 0.2, qz, o.w - 0.24, 0.12, o.d - 0.24, 0.24);
  const ell = sdEllipsoid(qx, y - 0.16, qz, o.w, 0.44, o.d);
  let d = mix(box, ell, 0.45) / sc;
  for (const [cx, cz, r, cy] of o.cusps) d = smin(d, sdSphere(x - cx, y - cy, z - cz, r), 0.13);
  for (const g of o.grooves) d = smax(d, -sdCapsule(x, y, z, ...g, 0.042), 0.05);
  return d;
}

const MOLAR = {
  w: 0.56, d: 0.5,
  cusps: [
    [-0.27, 0.2, 0.2, 0.42], [0.06, 0.23, 0.19, 0.41], [0.36, 0.1, 0.15, 0.38],
    [-0.25, -0.2, 0.2, 0.44], [0.22, -0.2, 0.2, 0.43],
  ],
  grooves: [
    [-0.42, 0.6, 0.0, 0.42, 0.6, 0.0],
    [-0.1, 0.6, 0.0, -0.12, 0.58, 0.5],
    [0.2, 0.6, 0.0, 0.24, 0.58, 0.45],
    [0.0, 0.6, 0.0, 0.02, 0.6, -0.5],
  ],
};

function chain(x, y, z, sx, sz, pts, k) {
  const X = x * sx, Z = z * sz;
  let d = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay, az, ar] = pts[i], [bx, by, bz, br] = pts[i + 1];
    const s = sdRoundCone(X, y, Z, ax * sx, ay, az * sz, bx * sx, by, bz * sz, ar, br);
    d = i === 0 ? s : smin(d, s, k);
  }
  return d;
}

const ROOT_M = [[-0.24, -0.38, 0, 0.27], [-0.34, -1.0, 0, 0.18], [-0.27, -1.5, 0.02, 0.06]];
const ROOT_D = [[0.24, -0.38, 0, 0.26], [0.3, -1.0, 0, 0.17], [0.36, -1.46, -0.02, 0.06]];
const CANAL_M = [[-0.2, -0.04, 0, 0.085], [-0.33, -1.0, 0, 0.045], [-0.27, -1.43, 0.02, 0.018]];
const CANAL_D = [[0.2, -0.04, 0, 0.085], [0.3, -1.0, 0, 0.045], [0.35, -1.4, -0.02, 0.018]];

function molarSDF(x, y, z) {
  let d = crownSDF(x, y, z, MOLAR);
  d = smin(d, sdRoundCone(x, y, z * 1.12, 0, 0.0, 0, 0, -0.5, 0, 0.44, 0.36), 0.12);
  const roots = smin(chain(x, y, z, 1.15, 0.72, ROOT_M, 0.05), chain(x, y, z, 1.15, 0.72, ROOT_D, 0.05), 0.02);
  return smin(d, roots, 0.1);
}
function pulpSDF(x, y, z) {
  let d = sdRoundBox(x, y - 0.06, z, 0.2, 0.05, 0.15, 0.07);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) d = smin(d, sdSphere(x - 0.2 * sx, y - 0.2, z - 0.15 * sz, 0.065), 0.07);
  const canals = Math.min(chain(x, y, z, 1.0, 0.85, CANAL_M, 0.04), chain(x, y, z, 1.0, 0.85, CANAL_D, 0.04));
  return smin(d, canals, 0.06);
}
const crownMask = (y) => smoothstep(Y_CEJ - 0.03, Y_CEJ + 0.12, y);
const dentinSolid = (x, y, z) => molarSDF(x, y, z) + T_ENAMEL * crownMask(y);

const molarEnamel = (x, y, z) => Math.max(molarSDF(x, y, z), -(dentinSolid(x, y, z) - 0.006), Y_CEJ - 0.04 - y);
const molarDentin = (x, y, z) => Math.max(dentinSolid(x, y, z), -(pulpSDF(x, y, z) - 0.006));
const molarPulp = pulpSDF;
const enamelNormal = (x, y, z) => { const t = molarSDF(x, y, z); return (-(t + T_ENAMEL) > t) ? -t : t; };
const dentinNormal = (x, y, z) => {
  const p = pulpSDF(x, y, z);
  return (-(p - 0.006) > dentinSolid(x, y, z)) ? -p : molarSDF(x, y, z);
};
const molarCrown = (x, y, z) => Math.max(molarSDF(x, y, z), Y_CEJ - 0.06 - y);

// ---------------------------------------------------------------- premolar crown
const PREMOLAR = {
  w: 0.37, d: 0.44,
  cusps: [[0, 0.17, 0.21, 0.42], [0, -0.17, 0.17, 0.37]],
  grooves: [[-0.3, 0.58, 0, 0.3, 0.58, 0]],
};
function premolarSDF(x, y, z) {
  let d = crownSDF(x, y, z, PREMOLAR);
  d = smin(d, sdRoundCone(x, y, z * 1.05, 0, 0.0, 0, 0, -0.5, 0, 0.3, 0.24), 0.1);
  return Math.max(d, Y_CEJ - 0.06 - y);
}

// ---------------------------------------------------------------- incisor & canine (crown up, labial = +z)
function sdEllipse2(x, z, a, b) {
  const k0 = Math.hypot(x / a, z / b), k1 = Math.hypot(x / (a * a), z / (b * b));
  return (k0 * (k0 - 1)) / k1;
}
const lerpProfile = (pts, y) => {
  if (y <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (y <= pts[i][0]) {
    const t = (y - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
    const s = t * t * (3 - 2 * t);
    return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * s;
  }
  return pts[pts.length - 1][1];
};
function incisorSDF(x, y, z, o) {
  const W = lerpProfile(o.width, y), T = lerpProfile(o.thick, y);
  const zb = z + o.curve * x * x - 0.02;
  let d = sdEllipse2(x, zb, W, T);
  if (o.canine) d = smax(d, y - o.top + 0.42 * Math.abs(x), 0.08);
  else d = smax(d, y - o.top + 0.9 * x * x, 0.06);
  d = smax(d, -0.4 - y, 0.1);
  const root = sdRoundCone(x, y, z * 0.85, 0, 0.0, -0.01, 0, -o.rootLen, -0.06, o.rootR, 0.045);
  return smin(d, root, 0.12);
}
const INCISOR = {
  width: [[-0.35, 0.15], [-0.05, 0.19], [0.2, 0.25], [0.5, 0.31], [0.8, 0.32]],
  thick: [[-0.35, 0.15], [-0.05, 0.17], [0.15, 0.15], [0.45, 0.095], [0.8, 0.03]],
  top: 0.8, curve: 0.45, rootLen: 1.25, rootR: 0.17,
};
const CANINE = {
  width: [[-0.35, 0.16], [-0.05, 0.2], [0.3, 0.29], [0.6, 0.28], [0.9, 0.2]],
  thick: [[-0.35, 0.17], [-0.05, 0.2], [0.2, 0.19], [0.5, 0.13], [0.9, 0.05]],
  top: 0.86, curve: 0.55, rootLen: 1.55, rootR: 0.19, canine: true,
};
const incisor = (x, y, z) => incisorSDF(x, y, z, INCISOR);
const incisorCrown = (x, y, z) => Math.max(incisor(x, y, z), -0.02 - y);
const canineCrown = (x, y, z) => Math.max(incisorSDF(x, y, z, CANINE), -0.02 - y);
function veneerSDF(x, y, z) {
  const i = incisor(x, y, z);
  const shell = Math.max(i - 0.022, -(i - 0.003));
  const zb = z + INCISOR.curve * x * x - 0.02;
  return Math.max(shell, -zb + 0.005, -0.05 - y);
}
const veneerNormal = (x, y, z) => {
  const i = incisor(x, y, z);
  return (-(i - 0.003) > i - 0.022) ? -i : i;
};

// ---------------------------------------------------------------- jaw segment (bone + gum)
function boneSDF(x, y, z, hw) {
  return sdRoundBox(x, y + 1.25, z, hw - 0.3, 0.65, 0.35, 0.3);
}
function gumSDF(x, y, z, hw) {
  const outer = sdRoundBox(x, y + 1.25, z, hw - 0.3, 0.65, 0.35, 0.45);
  return Math.max(outer, -(boneSDF(x, y, z, hw) - 0.012), -0.85 - y);
}

// ---------------------------------------------------------------- build
const bone = (x, y, z) => boneSDF(x, y, z, 1.75);
const gum = (x, y, z) => gumSDF(x, y, z, 1.75);
const canine = (x, y, z) => incisorSDF(x, y, z, CANINE);
// ao: surface used for occlusion, th: solid used for thickness, h: [y0, y1] range mapped to 0..1 "height"
const MODELS = [
  { name: 'molar_enamel', sdf: molarEnamel, nsdf: enamelNormal, ao: molarSDF, th: molarSDF, h: [Y_CEJ, 0.62], b: [-0.72, Y_CEJ - 0.1, -0.66, 0.72, 0.72, 0.66], cell: 0.0095, tris: 26000 },
  { name: 'molar_dentin', sdf: molarDentin, nsdf: dentinNormal, ao: dentinSolid, th: molarSDF, h: [-1.6, 0.5], b: [-0.72, -1.62, -0.66, 0.72, 0.62, 0.66], cell: 0.011, tris: 20000 },
  { name: 'molar_pulp', sdf: molarPulp, ao: pulpSDF, th: pulpSDF, h: [-1.5, 0.3], b: [-0.5, -1.5, -0.32, 0.5, 0.34, 0.32], cell: 0.008, tris: 6000 },
  { name: 'molar_crown', sdf: molarCrown, ao: molarSDF, th: molarSDF, h: [Y_CEJ, 0.62], b: [-0.72, -0.25, -0.66, 0.72, 0.72, 0.66], cell: 0.012, tris: 7000 },
  { name: 'premolar_crown', sdf: premolarSDF, ao: premolarSDF, th: premolarSDF, h: [Y_CEJ, 0.62], b: [-0.5, -0.25, -0.58, 0.5, 0.72, 0.58], cell: 0.012, tris: 5000 },
  { name: 'incisor', sdf: incisor, ao: incisor, th: incisor, h: [0.0, 0.8], b: [-0.42, -1.35, -0.34, 0.42, 0.85, 0.34], cell: 0.009, tris: 10000 },
  { name: 'incisor_crown', sdf: incisorCrown, ao: incisor, th: incisor, h: [0.0, 0.8], b: [-0.42, -0.1, -0.32, 0.42, 0.85, 0.32], cell: 0.01, tris: 5000 },
  { name: 'canine_crown', sdf: canineCrown, ao: canine, th: canine, h: [0.0, 0.86], b: [-0.4, -0.1, -0.34, 0.4, 0.95, 0.34], cell: 0.01, tris: 5000 },
  { name: 'incisor_veneer', sdf: veneerSDF, nsdf: veneerNormal, ao: (x, y, z) => incisor(x, y, z) - 0.022, th: incisor, h: [0.0, 0.8], b: [-0.42, -0.08, -0.08, 0.42, 0.85, 0.32], cell: 0.0045, tris: 6000 },
  { name: 'jaw_bone', sdf: bone, ao: bone, th: bone, h: [-2.2, -0.3], b: [-1.85, -2.3, -0.8, 1.85, -0.2, 0.8], cell: 0.02, tris: 5000 },
  { name: 'jaw_gum', sdf: gum, ao: gum, th: gum, h: [-0.85, -0.15], b: [-2.0, -0.95, -0.95, 2.0, -0.05, 0.95], cell: 0.015, tris: 9000 },
];

// Per-vertex surface data: x = ambient occlusion, y = local thickness, z = height in the tooth.
function bakeSurface(pos, nrm, m) {
  const out = new Float32Array(pos.length);
  for (let v = 0; v < pos.length / 3; v++) {
    const px = pos[3 * v], py = pos[3 * v + 1], pz = pos[3 * v + 2];
    const nx = nrm[3 * v], ny = nrm[3 * v + 1], nz = nrm[3 * v + 2];
    let occ = 0, sca = 1;
    for (let i = 0; i < 5; i++) {
      const h = 0.012 + 0.045 * i;
      const d = m.ao(px + nx * h, py + ny * h, pz + nz * h);
      occ += (h - d) * sca;
      sca *= 0.8;
    }
    const ao = clamp(1 - 2.4 * occ, 0, 1);
    let th = 0;
    for (const depth of [0.07, 0.14]) th += clamp(-m.th(px - nx * depth, py - ny * depth, pz - nz * depth) / depth, 0, 1);
    out[3 * v] = ao;
    out[3 * v + 1] = th / 2;
    out[3 * v + 2] = clamp((py - m.h[0]) / (m.h[1] - m.h[0]), 0, 1);
  }
  return out;
}

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

function simplifyMesh({ positions, normals, indices }, tris) {
  let idx = indices;
  if (indices.length / 3 > tris) {
    [idx] = MeshoptSimplifier.simplify(indices, positions, 3, tris * 3, 0.02, []);
  }
  const remap = new Int32Array(positions.length / 3).fill(-1);
  let n = 0;
  for (const i of idx) if (remap[i] < 0) remap[i] = n++;
  const p = new Float32Array(n * 3), nn = new Float32Array(n * 3);
  for (let v = 0; v < remap.length; v++) {
    const r = remap[v];
    if (r < 0) continue;
    p.set(positions.subarray(v * 3, v * 3 + 3), r * 3);
    nn.set(normals.subarray(v * 3, v * 3 + 3), r * 3);
  }
  const out = n < 65536 ? new Uint16Array(idx.length) : new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) out[i] = remap[idx[i]];
  return { positions: p, normals: nn, indices: out };
}

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('teeth');
const mat = doc.createMaterial('default');
for (const m of MODELS) {
  const t0 = Date.now();
  const raw = meshSDF(m.sdf, m.b, m.cell, { nsdf: m.nsdf });
  const s = simplifyMesh(raw, m.tris);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(s.positions).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(s.normals).setBuffer(buffer))
    .setAttribute('_SURF', doc.createAccessor().setType('VEC3').setNormalized(true)
      .setArray(Uint8Array.from(bakeSurface(s.positions, s.normals, m), (x) => Math.round(x * 255))).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(s.indices).setBuffer(buffer))
    .setMaterial(mat);
  scene.addChild(doc.createNode(m.name).setMesh(doc.createMesh(m.name).addPrimitive(prim)));
  console.log(`${m.name.padEnd(16)} raw ${String(raw.indices.length / 3).padStart(7)} tris -> ${String(s.indices.length / 3).padStart(6)}  (${Date.now() - t0} ms)`);
}
await doc.transform(reorder({ encoder: MeshoptEncoder }), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
mkdirSync('public/models', { recursive: true });
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await io.write('public/models/teeth.glb', doc);
console.log('wrote public/models/teeth.glb');

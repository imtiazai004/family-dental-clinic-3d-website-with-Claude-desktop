import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Indexed parametric surface of revolution r(u, v), wrapped in u (no seam).
function revolve(segU, segV, fn) {
  const pos = [];
  const idx = [];
  for (let v = 0; v <= segV; v++) {
    for (let u = 0; u < segU; u++) {
      const a = (u / segU) * Math.PI * 2;
      const [r, y] = fn(a, v / segV);
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
    }
  }
  for (let v = 0; v < segV; v++) {
    for (let u = 0; u < segU; u++) {
      const a = v * segU + u, b = v * segU + ((u + 1) % segU);
      const c = a + segU, d = b + segU;
      idx.push(a, b, d, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Threaded titanium implant body. Top platform at y = 0, apex at y = -1.1.
export function makeFixture(M) {
  const H = 1.1, pitch = 0.1, depth = 0.042;
  const body = revolve(80, 220, (a, t) => {
    let rc = 0.165 - 0.05 * t;
    if (t > 0.86) rc *= Math.sqrt(Math.max(0, 1 - ((t - 0.86) / 0.14) ** 2)) * 0.9 + 0.1 * (1 - (t - 0.86) / 0.14);
    const fade = smooth(0.05, 0.12, t) * (1 - smooth(0.82, 0.95, t));
    const y = -t * H;
    const phase = ((a / (Math.PI * 2) + -y / pitch) % 1 + 1) % 1;
    const tri = 1 - Math.abs(2 * phase - 1);
    return [Math.max(0, rc + depth * fade * Math.pow(tri, 0.75)), y];
  });
  // Flip winding so normals face outward (revolve builds them inward for this direction).
  body.index.array.reverse();
  body.computeVertexNormals();
  const g = new THREE.Group();
  g.add(new THREE.Mesh(body, M.titanium));
  const cap = new THREE.Mesh(new THREE.CircleGeometry(0.165, 48), M.titanium);
  cap.rotation.x = -Math.PI / 2;
  const hex = new THREE.Mesh(new THREE.CircleGeometry(0.07, 6), M.socket);
  hex.rotation.x = -Math.PI / 2;
  hex.position.y = 0.002;
  g.add(cap, hex);
  return g;
}

// Abutment: seats into the implant, flares through the gum, post carries the crown.
export function makeAbutment(M) {
  const pts = [
    [0.0, -0.18], [0.07, -0.18], [0.075, -0.05], [0.09, 0.0], [0.15, 0.02], [0.185, 0.09], [0.18, 0.13],
    [0.15, 0.16], [0.14, 0.4], [0.125, 0.48], [0.08, 0.515], [0.0, 0.525],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.Mesh(new THREE.LatheGeometry(pts, 56), M.abutment);
}

// Endodontic file: fluted steel shaft, stopper and colour-coded handle. Tip at origin, pointing down.
export function makeFile(M) {
  const L = 1.05;
  const shaft = revolve(16, 120, (a, t) => {
    const y = t * L;
    const r = (0.006 + 0.016 * t) * (1 + 0.32 * Math.sin(4 * a + y * 70));
    return [t === 0 ? 0 : r, y];
  });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(shaft, M.steel));
  const stop = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.025, 24), M.stopper);
  stop.position.y = L * 0.62;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.32, 24), M.handle);
  handle.position.y = L + 0.16;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.handle);
  cap.position.y = L + 0.32;
  g.add(stop, handle, cap);
  return g;
}

export function makeBracket(M, s = 1) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new RoundedBoxGeometry(0.2 * s, 0.17 * s, 0.05 * s, 2, 0.015 * s), M.steel);
  const slot = new THREE.Mesh(new RoundedBoxGeometry(0.13 * s, 0.07 * s, 0.05 * s, 2, 0.01 * s), M.steel);
  slot.position.z = 0.04 * s;
  g.add(base, slot);
  return g;
}

// Upper dental arch centre-line in the XZ plane (front tooth at origin, arch curving back).
export function makeArchCurve(halfLength) {
  const half = [
    [0, 0], [0.75, -0.17], [1.42, -0.6], [1.9, -1.24], [2.22, -2.0], [2.48, -2.9], [2.66, -3.9], [2.8, -4.8],
  ];
  const pts = [...half.slice(1).reverse().map(([x, z]) => new THREE.Vector3(-x, 0, z)), ...half.map(([x, z]) => new THREE.Vector3(x, 0, z))];
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const total = curve.getLength();
  const mid = total / 2;
  // arc length s (signed from midline, + = right side) -> point/tangent
  const at = (s) => {
    const u = Math.min(1, Math.max(0, (mid + s) / total));
    return { p: curve.getPointAt(u), t: curve.getTangentAt(u) };
  };
  return { curve, total, at, maxHalf: Math.min(mid, halfLength ?? mid) };
}

// Gum ridge that follows the arch: an inverted-U cross-section with papillae between teeth.
// opts.widen grows the cross-section (for things that fit over the gum); opts.from/to build only part
// of the arch (s from..to), tapered at both ends.
export function makeGum(arch, extent, papilla, mat, opts = {}) {
  const segS = 220, segC = 40;
  const widen = opts.widen || 0;
  const from = opts.from ?? -extent, to = opts.to ?? extent;
  const part = opts.from !== undefined || opts.to !== undefined;
  const pos = [];
  const surf = [];
  const idx = [];
  for (let i = 0; i <= segS; i++) {
    const s = from + ((to - from) * i) / segS;
    const { p, t } = arch.at(s);
    const n = new THREE.Vector3(-t.z, 0, t.x).normalize();
    const end = part ? Math.min(smooth(from, from + 0.3, s), smooth(to, to - 0.3, s)) : smooth(extent, extent - 0.45, Math.abs(s));
    const pap = papilla(s);
    for (let j = 0; j < segC; j++) {
      const th = (j / segC) * Math.PI * 2;
      const c = Math.cos(th), sn = Math.sin(th);
      let w = 0.6 * Math.sign(c) * Math.pow(Math.abs(c), 0.55);
      let y = 0.2 + 0.26 * Math.sign(sn) * Math.pow(Math.abs(sn), 0.6);
      if (sn < 0) y -= -sn * (0.26 * pap - 0.03);
      w *= (0.25 + 0.75 * end) * (1 + widen);
      y = 0.2 + (y - 0.2) * (0.25 + 0.75 * end) * (1 + widen);
      pos.push(p.x + n.x * w, y, p.z + n.z * w);
      const low = sn < 0 ? -sn : 0;
      surf.push(Math.max(0, 1 - low * (0.28 + 0.3 * pap)), 0.75 + 0.25 * (1 - low), Math.min(1, Math.max(0, (y + 0.1) / 0.55)));
    }
  }
  for (let i = 0; i < segS; i++) for (let j = 0; j < segC; j++) {
    const a = i * segC + j, b = i * segC + ((j + 1) % segC), c = a + segC, d = b + segC;
    idx.push(a, d, b, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('_surf', new THREE.Float32BufferAttribute(surf, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

// Palate plate for a complete denture: fills the inside of the arch with a vaulted roof.
export function makePalate(arch, extent, mat) {
  const ring = [];
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const s = -extent + (2 * extent * i) / steps;
    const { p, t } = arch.at(s);
    const n = new THREE.Vector3(-t.z, 0, t.x).normalize();
    ring.push(new THREE.Vector2(p.x - n.x * 0.45, p.z - n.z * 0.45));
  }
  const shape = new THREE.Shape(ring.map((v) => new THREE.Vector2(v.x, -v.y)));
  const geo = new THREE.ShapeGeometry(shape, 24);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  let minZ = Infinity, maxZ = -Infinity, maxX = 0;
  for (let i = 0; i < pos.count; i++) { minZ = Math.min(minZ, pos.getZ(i)); maxZ = Math.max(maxZ, pos.getZ(i)); maxX = Math.max(maxX, Math.abs(pos.getX(i))); }
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / maxX, z = (pos.getZ(i) - maxZ) / (minZ - maxZ);
    const vault = Math.max(0, 1 - x * x) * Math.sin(Math.min(1, z * 1.15) * Math.PI * 0.85);
    pos.setY(i, 0.22 + 0.55 * vault);
  }
  geo.computeVertexNormals();
  geo.setAttribute('_surf', new THREE.Float32BufferAttribute(new Float32Array(pos.count * 3).fill(1), 3));
  const m = new THREE.Mesh(geo, mat);
  m.material.side = THREE.DoubleSide;
  return m;
}

export function makeTube(points, radius, mat) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 160, radius, 8, false), mat);
}

// Soft floating particles for ambience.
export function makeDust(count = 140) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3), s = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    p[i * 3] = (Math.random() - 0.5) * 14;
    p[i * 3 + 1] = (Math.random() - 0.5) * 8;
    p[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
    s[i] = Math.random();
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(s, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uAmount: { value: 1 } },
    vertexShader: `attribute float seed; uniform float uTime; uniform float uPx; varying float vA;
      void main(){ vec3 p = position; p.y += sin(uTime*0.25 + seed*20.0)*0.35; p.x += cos(uTime*0.18 + seed*11.0)*0.25;
        vec4 mv = modelViewMatrix * vec4(p,1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.6 + seed*3.6) * uPx / -mv.z; vA = 0.25 + 0.75*fract(seed*7.0); }`,
    fragmentShader: `uniform float uAmount; varying float vA; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.15,d);
      gl_FragColor = vec4(vec3(0.97,0.88,0.95), a*vA*0.6*uAmount); }`,
  });
  return new THREE.Points(g, mat);
}

import * as THREE from 'three';

// Thin shells that sit on the front (lip side) of a tooth: veneers, whitening gel, composite layers,
// shade tabs. The front surface is sampled with rays on a grid whose rows follow the tooth's own
// outline, so the shell has clean, smooth edges. Results are cached per tooth model and direction.
const cache = new Map();

// Casts parallel rays (along -fwd) at an object, fast: its triangles are bucketed by where they fall
// on the (right, up) plane. hit(u, v) returns the nearest surface point (object space) or null.
export function projector(obj, fwd, up = new THREE.Vector3(0, 1, 0)) {
  obj.updateMatrixWorld(true);
  const inv = obj.matrixWorld.clone().invert();
  const right = up.clone().cross(fwd).normalize();
  const tri = [];
  const v = new THREE.Vector3();
  const m4 = new THREE.Matrix4();
  obj.traverse((m) => {
    if (!m.isMesh) return;
    m4.multiplyMatrices(inv, m.matrixWorld);
    const pos = m.geometry.attributes.position;
    const idx = m.geometry.index;
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(m4);
      tri.push(v.x, v.y, v.z);
    }
  });
  const T = tri.length / 9;
  const U = (i) => tri[i] * right.x + tri[i + 1] * right.y + tri[i + 2] * right.z;
  const W = (i) => tri[i] * up.x + tri[i + 1] * up.y + tri[i + 2] * up.z;
  let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
  for (let i = 0; i < tri.length; i += 3) {
    const u = U(i), w = W(i);
    umin = Math.min(umin, u); umax = Math.max(umax, u); vmin = Math.min(vmin, w); vmax = Math.max(vmax, w);
  }
  const G = 40;
  const cu = (u) => Math.min(G - 1, Math.max(0, Math.floor(((u - umin) / (umax - umin)) * G)));
  const cv = (w) => Math.min(G - 1, Math.max(0, Math.floor(((w - vmin) / (vmax - vmin)) * G)));
  const cells = Array.from({ length: G * G }, () => []);
  for (let t = 0; t < T; t++) {
    const i = t * 9;
    const us = [U(i), U(i + 3), U(i + 6)], ws = [W(i), W(i + 3), W(i + 6)];
    for (let a = cu(Math.min(...us)); a <= cu(Math.max(...us)); a++) {
      for (let b = cv(Math.min(...ws)); b <= cv(Math.max(...ws)); b++) cells[b * G + a].push(i);
    }
  }
  const reach = Math.max(umax - umin, vmax - vmin) + 4;
  const ray = new THREE.Ray(new THREE.Vector3(), fwd.clone().negate());
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), out = new THREE.Vector3();
  const hit = (u, w) => {
    if (u < umin || u > umax || w < vmin || w > vmax) return null;
    ray.origin.copy(right).multiplyScalar(u).addScaledVector(up, w).addScaledVector(fwd, reach);
    let best = null, bestD = Infinity;
    for (const i of cells[cv(w) * G + cu(u)]) {
      A.fromArray(tri, i); B.fromArray(tri, i + 3); C.fromArray(tri, i + 6);
      if (ray.intersectTriangle(A, B, C, false, out)) {
        const d = out.distanceToSquared(ray.origin);
        if (d < bestD) { bestD = d; best = out.clone(); }
      }
    }
    return best;
  };
  return { hit, right, up, umin, umax, vmin, vmax };
}

// A small patch that lies on top of an object (rays cast straight down), centred on (cx, cz), radius r.
// Has uv (0..1 across the patch) for a round texture. Built in the object's own space.
export function surfaceDecal(obj, cx, cz, r, { n = 26, lift = 0.006 } = {}) {
  const P = projector(obj, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1));
  const pos = [], uv = [];
  let last = null;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = cx - r + (2 * r * i) / (n - 1), z = cz - r + (2 * r * j) / (n - 1);
      const h = P.hit(x, -z) || last || new THREE.Vector3(x, 0, z);
      last = h;
      pos.push(h.x, h.y + lift, h.z);
      uv.push(i / (n - 1), 1 - j / (n - 1));
    }
  }
  const index = [];
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

// Front surface of a tooth model as a grid of points (cached; the slow part).
function sampleFront(kit, name, fwd, rows, cols, y0) {
  const key = `${name}|${fwd.toArray().map((v) => v.toFixed(3))}|${rows}|${cols}|${y0}`;
  if (cache.has(key)) return cache.get(key);
  const node = kit.src(name).clone();
  const wrap = new THREE.Group();
  wrap.add(node);
  const up = new THREE.Vector3(0, 1, 0);
  const right = up.clone().cross(fwd).normalize();
  const { hit: hit0, umin, umax, vmin: ymin, vmax: ymax } = projector(wrap, fwd, up);
  const hit = (u, y) => hit0(u, y);
  // Where the tooth is, across one row: first and last hit, refined by halving the gap.
  const span = (y) => {
    const n = 24, W0 = umin - 0.01, W1 = umax + 0.01, step = (W1 - W0) / n;
    let a = -1, b = -1;
    for (let i = 0; i <= n; i++) if (hit(W0 + step * i, y)) { if (a < 0) a = i; b = i; }
    if (a < 0) return null;
    const edge = (inside, outside) => {
      for (let k = 0; k < 12; k++) {
        const m = (inside + outside) / 2;
        if (hit(m, y)) inside = m; else outside = m;
      }
      return inside;
    };
    const ua = W0 + step * a, ub = W0 + step * b;
    return [edge(ua, ua - step), edge(ub, ub + step)];
  };
  // The highest row that still crosses the tooth.
  let yTop = ymax;
  while (yTop > y0 && !span(yTop)) yTop -= 0.006;
  yTop -= 0.003;

  const pos = [];
  for (let r = 0; r < rows; r++) {
    const y = y0 + ((yTop - y0) * r) / (rows - 1);
    const s = span(y) || [0, 0];
    const inset = Math.min(0.005, (s[1] - s[0]) * 0.04);
    let last = null;
    for (let c = 0; c < cols; c++) {
      const u = s[0] + inset + ((s[1] - s[0] - 2 * inset) * c) / (cols - 1);
      const p = hit(u, y) || last || right.clone().multiplyScalar(u).addScaledVector(up, y);
      last = p;
      pos.push(p.x, p.y, p.z);
    }
  }
  cache.set(key, pos);
  return pos;
}

export function frontShellGeometry(kit, name, { push = 0.014, dir = [0, 0, 1], rows = 34, cols = 22, y0 = 0.03 } = {}) {
  const fwd = new THREE.Vector3(...dir).normalize();
  const pos = sampleFront(kit, name, fwd, rows, cols, y0);
  const index = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      index.push(a, b, d, b, e, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos.slice(), 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  // Push the shell out along its normals so it sits on top of the tooth surface.
  const p = geo.attributes.position, nr = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, p.getX(i) + nr.getX(i) * push, p.getY(i) + nr.getY(i) * push, p.getZ(i) + nr.getZ(i) * push);
  }
  // Tooth materials read baked surface data (occlusion, thickness, height); a shell is open and thin.
  geo.setAttribute('_surf', new THREE.Float32BufferAttribute(new Float32Array(p.count * 3).fill(1), 3));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

// A shell placed like a tooth mesh (same position, rotation and scale as `like`). The shell faces the
// tooth's front (+z in the tooth's own space), whatever way the model is turned inside `like`.
export function frontShell(kit, name, mat, like, opts = {}) {
  const g = new THREE.Group();
  const dir = like ? new THREE.Vector3(0, 0, 1).applyQuaternion(like.quaternion.clone().invert()).toArray() : [0, 0, 1];
  const m = new THREE.Mesh(frontShellGeometry(kit, name, { dir, ...opts }), mat);
  m.frustumCulled = false;
  g.add(m);
  if (like) {
    g.position.copy(like.position);
    g.rotation.copy(like.rotation);
    g.scale.copy(like.scale);
  }
  return g;
}

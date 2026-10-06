// Naive surface nets with vertex projection and analytic (gradient) normals.
// sdf(x, y, z) -> signed distance (negative inside).
export function meshSDF(sdf, bounds, cell, { project = 2, nsdf = null } = {}) {
  const [x0, y0, z0, x1, y1, z1] = bounds;
  const nx = Math.ceil((x1 - x0) / cell), ny = Math.ceil((y1 - y0) / cell), nz = Math.ceil((z1 - z0) / cell);
  const px = nx + 1, py = ny + 1, pz = nz + 1;
  const vals = new Float32Array(px * py * pz);
  for (let k = 0; k < pz; k++) {
    const z = z0 + k * cell;
    for (let j = 0; j < py; j++) {
      const y = y0 + j * cell;
      let o = px * (j + py * k);
      for (let i = 0; i < px; i++) vals[o++] = sdf(x0 + i * cell, y, z);
    }
  }
  const P = (i, j, k) => i + px * (j + py * k);
  const cellIndex = new Int32Array(nx * ny * nz).fill(-1);
  const pos = [];
  const corners = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
    [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
  ];
  const edges = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const cv = new Float32Array(8);
  let vcount = 0;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const v = vals[P(i + corners[c][0], j + corners[c][1], k + corners[c][2])];
      cv[c] = v;
      if (v < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      const va = cv[a], vb = cv[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      sx += corners[a][0] + (corners[b][0] - corners[a][0]) * t;
      sy += corners[a][1] + (corners[b][1] - corners[a][1]) * t;
      sz += corners[a][2] + (corners[b][2] - corners[a][2]) * t;
      n++;
    }
    pos.push(x0 + (i + sx / n) * cell, y0 + (j + sy / n) * cell, z0 + (k + sz / n) * cell);
    cellIndex[i + nx * (j + ny * k)] = vcount++;
  }
  const C = (i, j, k) => cellIndex[i + nx * (j + ny * k)];
  const quads = [];
  for (let k = 0; k < pz; k++) for (let j = 0; j < py; j++) for (let i = 0; i < px; i++) {
    const v0 = vals[P(i, j, k)] < 0;
    // x-edge
    if (i < nx && j > 0 && k > 0 && j < ny && k < nz && v0 !== (vals[P(i + 1, j, k)] < 0))
      quads.push(C(i, j - 1, k - 1), C(i, j, k - 1), C(i, j, k), C(i, j - 1, k));
    // y-edge
    if (j < ny && i > 0 && k > 0 && i < nx && k < nz && v0 !== (vals[P(i, j + 1, k)] < 0))
      quads.push(C(i - 1, j, k - 1), C(i, j, k - 1), C(i, j, k), C(i - 1, j, k));
    // z-edge
    if (k < nz && i > 0 && j > 0 && i < nx && j < ny && v0 !== (vals[P(i, j, k + 1)] < 0))
      quads.push(C(i - 1, j - 1, k), C(i, j - 1, k), C(i, j, k), C(i - 1, j, k));
  }
  const positions = new Float32Array(pos);
  const normals = new Float32Array(positions.length);
  const e = cell * 0.5;
  const grad = (x, y, z, out) => {
    out[0] = sdf(x + e, y, z) - sdf(x - e, y, z);
    out[1] = sdf(x, y + e, z) - sdf(x, y - e, z);
    out[2] = sdf(x, y, z + e) - sdf(x, y, z - e);
    const l = Math.hypot(out[0], out[1], out[2]) || 1;
    out[0] /= l; out[1] /= l; out[2] /= l;
  };
  const ngrad = (x, y, z, out) => {
    out[0] = nsdf(x + e, y, z) - nsdf(x - e, y, z);
    out[1] = nsdf(x, y + e, z) - nsdf(x, y - e, z);
    out[2] = nsdf(x, y, z + e) - nsdf(x, y, z - e);
    const l = Math.hypot(out[0], out[1], out[2]) || 1;
    out[0] /= l; out[1] /= l; out[2] /= l;
  };
  const g = [0, 0, 0];
  for (let v = 0; v < vcount; v++) {
    let x = positions[3 * v], y = positions[3 * v + 1], z = positions[3 * v + 2];
    for (let it = 0; it < project; it++) {
      const d = sdf(x, y, z);
      grad(x, y, z, g);
      const step = Math.max(-cell * 0.75, Math.min(cell * 0.75, d));
      x -= g[0] * step; y -= g[1] * step; z -= g[2] * step;
    }
    positions[3 * v] = x; positions[3 * v + 1] = y; positions[3 * v + 2] = z;
    if (nsdf) ngrad(x, y, z, g); else grad(x, y, z, g);
    normals[3 * v] = g[0]; normals[3 * v + 1] = g[1]; normals[3 * v + 2] = g[2];
  }
  // Triangulate quads, orienting each triangle along the SDF gradient.
  const idx = new Uint32Array((quads.length / 4) * 6);
  let w = 0;
  const tri = (a, b, c) => {
    const ax = positions[3 * a], ay = positions[3 * a + 1], az = positions[3 * a + 2];
    const ux = positions[3 * b] - ax, uy = positions[3 * b + 1] - ay, uz = positions[3 * b + 2] - az;
    const vx = positions[3 * c] - ax, vy = positions[3 * c + 1] - ay, vz = positions[3 * c + 2] - az;
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const nxs = normals[3 * a] + normals[3 * b] + normals[3 * c];
    const nys = normals[3 * a + 1] + normals[3 * b + 1] + normals[3 * c + 1];
    const nzs = normals[3 * a + 2] + normals[3 * b + 2] + normals[3 * c + 2];
    if (fx * nxs + fy * nys + fz * nzs >= 0) { idx[w++] = a; idx[w++] = b; idx[w++] = c; }
    else { idx[w++] = a; idx[w++] = c; idx[w++] = b; }
  };
  for (let q = 0; q < quads.length; q += 4) {
    const a = quads[q], b = quads[q + 1], c = quads[q + 2], d = quads[q + 3];
    if (a < 0 || b < 0 || c < 0 || d < 0) continue;
    tri(a, b, c); tri(a, c, d);
  }
  return { positions, normals, indices: idx.subarray(0, w) };
}

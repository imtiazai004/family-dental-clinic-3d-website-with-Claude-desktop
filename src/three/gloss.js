import * as THREE from 'three';
// Extras used only by the 'gloss' look: star glints, soft glow pads and the kids' tooth face.
// The 'natural' look never imports anything from here at runtime.

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Four-point star with a soft core, like a photographer's glint.
const starTex = () => canvasTex(256, (g, S) => {
  const c = S / 2;
  const core = g.createRadialGradient(c, c, 0, c, c, c * 0.42);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = core;
  g.fillRect(0, 0, S, S);
  const ray = (len, wid, ang, a) => {
    g.save();
    g.translate(c, c);
    g.rotate(ang);
    const gr = g.createLinearGradient(-len, 0, len, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.5, `rgba(255,255,255,${a})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(-len, 0); g.quadraticCurveTo(0, -wid, len, 0); g.quadraticCurveTo(0, wid, -len, 0);
    g.fill();
    g.restore();
  };
  ray(c * 0.98, c * 0.07, 0, 1);
  ray(c * 0.98, c * 0.07, Math.PI / 2, 1);
  ray(c * 0.5, c * 0.04, Math.PI / 4, 0.55);
  ray(c * 0.5, c * 0.04, -Math.PI / 4, 0.55);
});

const glowTex = () => canvasTex(128, (g, S) => {
  const c = S / 2;
  const gr = g.createRadialGradient(c, c, 0, c, c, c);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
});

export function makeGlossKit(stage) {
  const star = starTex();
  const glow = glowTex();
  const glints = [];
  const pads = [];
  const ray = new THREE.Raycaster();
  const v = new THREE.Vector3(), n = new THREE.Vector3(), cam = new THREE.Vector3();
  const q = new THREE.Quaternion();

  // Finds a point on the front of `target` (meshes), returned in `anchor` space.
  // x, y are fractions of the anchor's bounding box; the ray goes along -z from the front.
  function surfacePoint(target, anchor, fx, fy) {
    anchor.updateWorldMatrix(true, true);
    target.updateWorldMatrix(true, true);
    const meshes = [];
    target.traverse((o) => { if (o.isMesh && !o.userData.fx) meshes.push(o); });
    const box = new THREE.Box3();
    for (const m of meshes) box.expandByObject(m);
    const o = new THREE.Vector3(
      THREE.MathUtils.lerp(box.min.x, box.max.x, fx),
      THREE.MathUtils.lerp(box.min.y, box.max.y, fy),
      box.max.z + 2,
    );
    ray.set(o, new THREE.Vector3(0, 0, -1));
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit) return null;
    const inv = new THREE.Matrix4().copy(anchor.matrixWorld).invert();
    const p = hit.point.clone().applyMatrix4(inv);
    const nn = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).transformDirection(inv);
    return { p, n: nn };
  }

  return {
    surfacePoint,

    // A twinkling star on a surface. gate() returns 0..1 (when the glint is allowed to show).
    glint(target, anchor, fx, fy, size = 0.4, gate = () => 1, phase = Math.random() * 6) {
      const sp = surfacePoint(target, anchor, fx, fy);
      if (!sp) return null;
      const mat = new THREE.SpriteMaterial({
        map: star, color: '#ffffff', transparent: true, depthWrite: false, depthTest: false,
        blending: THREE.AdditiveBlending, toneMapped: false,
      });
      const s = new THREE.Sprite(mat);
      s.position.copy(sp.p).addScaledVector(sp.n, 0.03);
      s.renderOrder = 20;
      anchor.add(s);
      const g = { s, n: sp.n, size, gate, phase };
      glints.push(g);
      return g;
    },

    // Soft halo behind and a pool of light under an object group (both camera-facing).
    pad(group, { y = -1, w = 2.4, halo = 0, haloY = 0, color = '#c9b0ff', floor = 0.55 } = {}) {
      const mk = (op) => {
        const m = new THREE.SpriteMaterial({ map: glow, color, transparent: true, depthWrite: false, opacity: op, toneMapped: false });
        const s = new THREE.Sprite(m);
        s.renderOrder = -5;
        s.userData.base = op;
        group.add(s);
        return s;
      };
      const p = { group, items: [] };
      if (floor) {
        const f = mk(floor);
        f.position.set(0, y, -0.4);
        f.scale.set(w, w * 0.2, 1);
        p.items.push(f);
        const core = mk(floor * 0.9);
        core.material.color.set('#ffffff');
        core.position.set(0, y + 0.02, -0.39);
        core.scale.set(w * 0.45, w * 0.06, 1);
        p.items.push(core);
      }
      if (halo) {
        const h = mk(halo);
        h.position.set(0, haloY, -2.2);
        h.scale.setScalar(w * 1.5);
        p.items.push(h);
      }
      pads.push(p);
      return p;
    },

    update(t) {
      cam.copy(stage.camera.position);
      for (const g of glints) {
        let vis = g.s.parent && g.s.parent.visible;
        for (let o = g.s.parent; vis && o; o = o.parent) if (!o.visible) vis = false;
        if (!vis) { g.s.visible = false; continue; }
        g.s.getWorldPosition(v);
        g.s.parent.getWorldQuaternion(q);
        n.copy(g.n).applyQuaternion(q);
        const facing = smooth(0.45, 0.85, n.dot(cam.clone().sub(v).normalize()));
        const k = facing * g.gate();
        g.s.visible = k > 0.01;
        if (!g.s.visible) continue;
        const tw = Math.pow(0.5 + 0.5 * Math.sin(t * 1.7 + g.phase), 4);
        g.s.scale.setScalar(g.size * k * (0.35 + 0.75 * tw));
        g.s.material.opacity = k * (0.55 + 0.45 * tw);
        g.s.material.rotation = 0.25 * Math.sin(t * 0.5 + g.phase);
      }
    },

    // Fade pads with the group's presence (0..1).
    fade(pad, k) {
      for (const s of pad.items) s.material.opacity = s.userData.base * k;
    },
  };
}

// Small cartoon face for the children's tooth: two glossy eyes with catch-lights,
// a smile and pink cheeks, each sitting on the enamel surface.
export function addToothFace(kit, target, anchor) {
  const face = new THREE.Group();
  anchor.add(face);
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: '#2a1630', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 });
  const shine = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
  const smileMat = new THREE.MeshPhysicalMaterial({ color: '#3a1a3c', roughness: 0.3, clearcoat: 0.8 });
  const cheekMat = new THREE.MeshBasicMaterial({ color: '#ff8fa8', transparent: true, opacity: 0.55, depthWrite: false });
  const place = (obj, fx, fy, lift = 0) => {
    const sp = kit.surfacePoint(target, anchor, fx, fy);
    if (!sp) return;
    obj.position.copy(sp.p).addScaledVector(sp.n, lift);
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), sp.n);
    obj.traverse((o) => { o.userData.fx = true; });
    face.add(obj);
  };
  const eyeGeo = new THREE.SphereGeometry(0.092, 24, 16);
  const shineGeo = new THREE.SphereGeometry(0.027, 12, 8);
  for (const fx of [0.36, 0.64]) {
    const eye = new THREE.Group();
    const ball = new THREE.Mesh(eyeGeo, eyeMat);
    ball.scale.set(0.85, 1.2, 0.45);
    const hl = new THREE.Mesh(shineGeo, shine);
    hl.position.set(0.026, 0.05, 0.036);
    eye.add(ball, hl);
    place(eye, fx, 0.5, 0.0);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 10, 32, Math.PI * 0.75), smileMat);
  smile.rotation.z = -Math.PI / 2 - Math.PI * 0.375;
  const sw = new THREE.Group();
  sw.add(smile);
  place(sw, 0.5, 0.4, 0.014);
  const cheekGeo = new THREE.CircleGeometry(0.07, 24);
  for (const fx of [0.26, 0.74]) {
    const c = new THREE.Mesh(cheekGeo, cheekMat);
    c.scale.set(1.25, 0.8, 1);
    place(c, fx, 0.38, 0.02);
  }
  return face;
}

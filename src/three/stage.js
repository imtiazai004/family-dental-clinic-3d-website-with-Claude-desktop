import * as THREE from 'three';
// Photo-studio environment: a large overhead softbox, two strip lights and a warm floor bounce
// inside a dark plum room. Gives enamel, wet gums and metal believable reflections.
function studio() {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color('#2a1a2e').multiplyScalar(0.9), side: THREE.BackSide }));
  s.add(room);
  const panel = (w, h, hex, k, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  panel(9, 6, '#fff6ee', 7, 0, 8, 5);
  panel(2.2, 10, '#ffeef3', 4, -8, 1, 3);
  panel(2.2, 10, '#efe8ff', 2.6, 8, 0.5, -1);
  panel(5, 5, '#fff2e6', 2.2, 4, 2, 9);
  panel(12, 3, '#ffb8c6', 0.9, 0, -7, 2);
  return s;
}

export function detectTier() {
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const small = Math.min(screen.width, screen.height) < 520;
  if (mem <= 3 || cores <= 4) return 0;
  return small ? 1 : 2;
}

export function createStage(canvas, tier) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.localClippingEnabled = true;
  const dprCap = tier === 2 ? 1.75 : tier === 1 ? 1.5 : 1.25;

  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(studio(), 0.03).texture;
  scene.environmentIntensity = 1.0;
  pm.dispose();

  const shadows = tier === 2;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const key = new THREE.DirectionalLight('#fff1e6', 2.2);
  key.position.set(3, 4.5, 5);
  const keyDir = key.position.clone().normalize();
  if (shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 30 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.025;
    key.shadow.radius = 3;
    scene.add(key.target);
  }
  const fitShadow = (x, y) => {
    if (!shadows) return;
    key.target.position.set(x, y, 0);
    key.position.set(x, y, 0).addScaledVector(keyDir, 12);
  };
  const rim = new THREE.DirectionalLight('#c58cff', 3.2);
  rim.position.set(-4.5, 2.5, -3.5);
  const rim2 = new THREE.DirectionalLight('#ffb3c4', 1.4);
  rim2.position.set(4.5, -1, -3);
  const fill = new THREE.DirectionalLight('#ffd9e0', 0.5);
  fill.position.set(0, -4, 3);
  scene.add(key, rim, rim2, fill);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);

  const view = { w: 1, h: 1, visW: 1, visH: 1, portrait: false };
  let lastW = 0, lastH = 0;
  function resize(force = false) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    // Ignore small height-only changes from mobile browser toolbars.
    if (!force && w === lastW && Math.abs(h - lastH) < 120) return false;
    lastW = w; lastH = h;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    view.w = w; view.h = h;
    view.visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    view.visW = view.visH * camera.aspect;
    view.portrait = w / h < 0.9;
    return true;
  }
  resize(true);

  return { renderer, scene, camera, view, resize, tier, shadows, fitShadow };
}

// Where 3D content sits: right of the copy on wide screens, above it on phones.
export function computeLayout(view) {
  const { visW, visH, portrait } = view;
  if (portrait) {
    const y = visH * 0.17;
    return {
      portrait: true,
      main: { x: 0, y, s: Math.min(1, (visW * 0.9) / 2.6) },
      wide: { x: 0, y: y + 0.12, s: Math.min(1, (visW * 0.95) / 3.7) },
      arch: { x: 0, y: y + 0.1, s: Math.min(0.75, (visW * 1.1) / 5.6) },
    };
  }
  const right = visW * 0.2;
  return {
    portrait: false,
    main: { x: right, y: -0.05, s: Math.min(1.08, visH / 5.2) },
    wide: { x: right * 0.95, y: -0.05, s: Math.min(1.0, (visW * 0.55) / 3.8, visH / 5.4) },
    arch: { x: right * 0.95, y: 0.05, s: Math.min(0.78, (visW * 0.56) / 5.8) },
  };
}

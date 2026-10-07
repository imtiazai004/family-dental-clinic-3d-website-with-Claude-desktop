import * as THREE from 'three';
// Photo-studio environment: a large overhead softbox, two strip lights and a warm floor bounce
// inside a dark plum room. Gives enamel, wet gums and metal believable reflections.
function studio(look) {
  const gloss = look === 'gloss';
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(gloss ? '#36343e' : '#2a1a2e').multiplyScalar(0.9), side: THREE.BackSide }));
  s.add(room);
  const panel = (w, h, hex, k, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  if (gloss) {
    panel(10, 6, '#ffffff', 9, 0, 8, 5);
    panel(2.4, 11, '#eef3ff', 6, -8, 1, 3);
    panel(2.4, 11, '#fff0f6', 4.5, 8, 0.5, -1);
    panel(5, 5, '#ffffff', 3.5, 4, 2, 9);
    panel(4, 4, '#dfe9ff', 2.5, -5, -1, 8);
    panel(12, 3, '#ffe8ee', 1.1, 0, -7, 2);
    return s;
  }
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

export function createStage(canvas, tier, look = 'natural') {
  const gloss = look === 'gloss';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = gloss ? 1.1 : 1.04;
  renderer.localClippingEnabled = true;
  const dprCap = tier === 2 ? 1.75 : tier === 1 ? 1.5 : 1.25;

  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(studio(look), 0.03).texture;
  scene.environmentIntensity = gloss ? 1.2 : 1.0;
  pm.dispose();

  const shadows = tier === 2;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const key = new THREE.DirectionalLight(gloss ? '#ffffff' : '#fff1e6', gloss ? 2.4 : 2.2);
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
  const rim = new THREE.DirectionalLight(gloss ? '#efeaff' : '#c58cff', gloss ? 2.2 : 3.2);
  rim.position.set(-4.5, 2.5, -3.5);
  const rim2 = new THREE.DirectionalLight(gloss ? '#dcefff' : '#ffb3c4', gloss ? 1.6 : 1.4);
  rim2.position.set(4.5, -1, -3);
  const fill = new THREE.DirectionalLight(gloss ? '#ffeef2' : '#ffd9e0', gloss ? 0.7 : 0.5);
  fill.position.set(0, -4, 3);
  scene.add(key, rim, rim2, fill);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);

  const view = { w: 1, h: 1, visW: 1, visH: 1, portrait: false };
  let lastW = 0, lastH = 0;
  // Render resolution: the screen's own (up to the tier's cap), lowered a little by the frame-rate
  // governor below only while the device cannot keep up.
  let dprScale = 1;
  const fullDpr = () => Math.min(window.devicePixelRatio || 1, dprCap);
  const minDpr = () => Math.min(fullDpr(), Math.max(0.8, fullDpr() * 0.6));
  const targetDpr = () => Math.max(minDpr(), fullDpr() * dprScale);
  function resize(force = false) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    // Ignore small height-only changes from mobile browser toolbars.
    if (!force && w === lastW && Math.abs(h - lastH) < 120) return false;
    lastW = w; lastH = h;
    renderer.setPixelRatio(targetDpr());
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

  // ---------------------------------------------------------------- frame-rate governor
  // Call frame(now) after each rendered frame. Every 30 frames it looks at the average time between
  // frames: below ~48 fps it lowers the render resolution one small step (never below 60% of the
  // screen's); when frames are comfortably fast again it tries one step back up. The first moments
  // after the page shows (uploads, first draws) and one-off hitches are not counted.
  const gov = { last: 0, n: 0, sum: 0, worst: 0, lastChange: 0, settleUntil: 0, noUpUntil: 0, upTried: false, period: 16.7 };
  function setScale(s, now) {
    const before = renderer.getPixelRatio();
    dprScale = s;
    gov.lastChange = now;
    gov.n = gov.sum = gov.worst = 0;
    const want = targetDpr();
    if (Math.abs(want - before) < 0.01) return;
    renderer.setPixelRatio(want);
    renderer.setSize(lastW, lastH, false);
  }
  let shadowHalf = false, frameNo = 0;
  function frame(now) {
    // last resort on a struggling device: shadows are redrawn every other frame
    if (shadowHalf) renderer.shadowMap.needsUpdate = (++frameNo & 1) === 0;
    const dt = gov.last ? now - gov.last : 0;
    gov.last = now;
    // a pause (nothing to draw, tab in the background) or the settling time after load is not counted
    if (!dt || dt > 250 || document.hidden || now < gov.settleUntil) return;
    // the screen's refresh interval (16.7 ms at 60 Hz, 8.3 at 120 Hz): follows the fastest frames
    gov.period = Math.min(17.5, Math.max(6, Math.min(gov.period * 1.002, dt)));
    gov.n++; gov.sum += dt; gov.worst = Math.max(gov.worst, dt);
    if (gov.n < 30) return;
    const avg = (gov.sum - gov.worst) / (gov.n - 1); // one slow frame in 30 is not a trend
    const slow = avg > Math.max(21, gov.period * 1.35);
    if (slow && renderer.getPixelRatio() <= minDpr() + 0.01 && shadows && !shadowHalf && now - gov.lastChange > 3000) {
      shadowHalf = true;
      renderer.shadowMap.autoUpdate = false;
      gov.lastChange = now;
      gov.n = gov.sum = gov.worst = 0;
    } else if (slow && renderer.getPixelRatio() > minDpr() + 0.01) {
      // slow again right after trying a sharper picture: stay at this level for a while
      if (gov.upTried && now - gov.lastChange < 5000) gov.noUpUntil = now + 45000;
      gov.upTried = false;
      setScale(Math.max(minDpr() / fullDpr(), dprScale * 0.85), now);
    } else if (dprScale < 1 && avg < Math.max(15.5, gov.period * 1.1) && now - gov.lastChange > 6000 && now > gov.noUpUntil) {
      gov.upTried = true;
      setScale(Math.min(1, dprScale / 0.9), now);
    } else {
      gov.n = gov.sum = gov.worst = 0;
    }
  }
  // Ignore the next ms (a page that has just shown its 3D is still uploading and drawing for the first time).
  const settle = (ms = 1500) => { gov.settleUntil = performance.now() + ms; gov.last = 0; gov.n = gov.sum = gov.worst = 0; };
  settle(2000);

  return { renderer, scene, camera, view, resize, tier, shadows, fitShadow, look, frame, settle, get dprScale() { return dprScale; } };
}

// Gets a scene ready to draw without freezing the page: shaders compile in the background where the
// browser supports it (otherwise all at once, as before). Then everything is drawn once into a
// single pixel, so geometry, textures and shadow shaders are on the graphics card before the first
// scroll, rather than the first time each object comes into view.
export async function prepareStage(stage, { warm = true } = {}) {
  const { renderer, scene, camera } = stage;
  try {
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
  } catch {
    try { renderer.compile(scene, camera); } catch { /* drawn on first use instead */ }
  }
  if (!warm) return;
  const undo = [];
  scene.traverse((o) => {
    if (!o.visible) { o.visible = true; undo.push(() => { o.visible = false; }); }
    if (o.frustumCulled && (o.isMesh || o.isPoints || o.isLine || o.isSprite)) { o.frustumCulled = false; undo.push(() => { o.frustumCulled = true; }); }
  });
  try {
    scene.updateMatrixWorld(true);
    // any shader variant only met now (for example for shadows) compiles here, before the page is shown
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera).catch(() => {});
    renderer.setScissorTest(true);
    renderer.setScissor(0, 0, 1, 1);
    renderer.render(scene, camera);
  } catch { /* not essential */ } finally {
    renderer.setScissorTest(false);
    undo.forEach((f) => f());
    stage.settle?.();
  }
}

// Lets the browser draw a frame and handle input between pieces of heavy setup work.
export const breathe = () => new Promise((ok) => {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => ok(), { timeout: 60 });
  else setTimeout(ok, 0);
});

// Where 3D content sits: right of the copy on wide screens, above it on phones.
// size > 1 enlarges the objects; wide scenes (jaw, arch) grow a little less so they stay clear of the copy.
export function computeLayout(view, size = 1) {
  const { visW, visH, portrait } = view;
  const g = size - 1;
  if (portrait) {
    const y = visH * 0.17;
    return {
      portrait: true,
      size,
      main: { x: 0, y, s: Math.min(1, (visW * 0.9) / 2.6) * (1 + g * 0.45) },
      wide: { x: 0, y: y + 0.12, s: Math.min(1, (visW * 0.95) / 3.7) * (1 + g * 0.4) },
      arch: { x: 0, y: y + 0.1, s: Math.min(0.75, (visW * 1.1) / 5.6) * (1 + g * 0.3) },
    };
  }
  const right = visW * 0.2;
  return {
    portrait: false,
    size,
    main: { x: right, y: -0.05, s: Math.min(1.08, visH / 5.2) * (1 + g) },
    wide: { x: right * 0.95, y: -0.05, s: Math.min(1.0, (visW * 0.55) / 3.8, visH / 5.4) * (1 + g * 0.5) },
    arch: { x: right * 0.95, y: 0.05, s: Math.min(0.78, (visW * 0.56) / 5.8) * (1 + g * 0.5) },
  };
}

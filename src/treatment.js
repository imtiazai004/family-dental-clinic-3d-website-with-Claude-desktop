// Treatment pages (treatments/<slug>/). Same 3D engine as the home page, driving one scene:
// the hero shows the model taken apart, and the "how it works" story puts it together on scroll.
import './styles.css';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import Lenis from 'lenis';
import { CLINIC, waLink, currentLook, TUNE } from './config.js';
import { createStage, computeLayout, detectTier } from './three/stage.js';
import { buildScenes, seg, clamp, ease } from './three/scenes.js';
import { createBot } from './ui/bot.js';
import { createLabels } from './ui/labels.js';
import { initNavMenu } from './ui/nav.js';

const html = document.documentElement;
const ROOT = html.dataset.root || './';
const SCENE = html.dataset.scene;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SNAP = new URLSearchParams(location.search).has('snap');
const LOOK_NOW = currentLook();
html.dataset.look = LOOK_NOW;

// ---------------------------------------------------------------- links and buttons
const WA_DEFAULT = 'Assalam o Alaikum, I found your clinic online and would like to ask about an appointment.';
for (const a of document.querySelectorAll('[data-wa]')) {
  a.href = waLink(a.dataset.waText || WA_DEFAULT);
  a.target = '_blank'; a.rel = 'noopener';
}
for (const a of document.querySelectorAll('[data-reviews]')) { a.href = CLINIC.reviewsUrl; a.target = '_blank'; a.rel = 'noopener'; }
initNavMenu();

const bot = createBot();
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-book]');
  if (b && !b.closest('.bot')) { e.preventDefault(); bot.open(b.dataset.book || null); }
});

// ---------------------------------------------------------------- smooth scroll
const lenis = reduce ? null : new Lenis({ lerp: 0.11, smoothWheel: true, anchors: { offset: 0 } });
const topBar = document.getElementById('top-bar');
for (const a of document.querySelectorAll('a[href^="#"]')) {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id.length > 1 && document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.4 });
    else target.scrollIntoView();
  });
}

// ---------------------------------------------------------------- chapters (hero + story)
const CH = {};
for (const el of document.querySelectorAll('[data-chapter]')) {
  const steps = el.querySelector('.steps');
  CH[el.dataset.chapter] = {
    el, presence: 0, progress: 0, tPresence: 0, tProgress: 0, sticky: el.classList.contains('sticky'),
    steps: steps ? [...steps.children] : null,
    marks: steps ? steps.dataset.steps.split(',').map(Number) : null,
    rail: el.querySelector('.rail') ? [...el.querySelector('.rail').children] : null,
    active: -1,
  };
}
function measure() {
  const vh = innerHeight;
  for (const c of Object.values(CH)) {
    const r = c.el.getBoundingClientRect();
    if (c.sticky) {
      c.tProgress = clamp(-r.top / Math.max(1, r.height - vh));
      c.tPresence = Math.min(1 - clamp(r.top / (vh * 0.75)), clamp((r.bottom - vh * 0.25) / (vh * 0.75)));
    } else {
      c.tProgress = clamp(-r.top / Math.max(1, r.height));
      c.tPresence = clamp((r.bottom - vh * 0.2) / (vh * 0.6));
    }
  }
}
function updateSteps() {
  for (const c of Object.values(CH)) {
    if (!c.steps) continue;
    let i = 0;
    c.marks.forEach((m, k) => { if (c.progress >= m) i = k; });
    if (i !== c.active) {
      c.steps.forEach((s, k) => { s.classList.toggle('on', k === i); s.toggleAttribute('inert', k !== i); });
      c.active = i;
    }
    c.rail?.forEach((s, k) => {
      const a = c.marks[k], b = c.marks[k + 1] ?? 1;
      s.style.setProperty('--f', clamp((c.progress - a) / (b - a)).toFixed(3));
    });
  }
}

// Which home-page chapter drives this page's scene, and how story progress maps onto it.
const Z = { presence: 0, progress: 0 };
function sceneChapters(presence, progress, ready) {
  const ch = { ready, hero: Z, anatomy: Z, generations: Z, implant: Z, rct: Z, restore: Z, studio: Z };
  if (SCENE === 'implant') ch.implant = { presence, progress };
  else if (SCENE === 'rct') ch.rct = { presence, progress };
  // Braces use the first part of the smile-studio scene: crooked teeth with brackets, then aligned, then brackets off.
  else if (SCENE === 'braces') ch.studio = { presence, progress: 0.02 + progress * 0.34 };
  return ch;
}

// Page framing on top of the home-page layout: the implant parts float high while taken apart,
// so that scene starts a little lower and rises into place as it assembles.
// On phones the hero text is long, so while it is on screen the model sits higher and a little smaller.
function layoutFor(progress, heroK = 0) {
  const L = computeLayout(stage.view, stage.tune.size);
  if (SCENE === 'implant' && !L.portrait) {
    const k = 1 - ease(seg(progress, 0.15, 0.6));
    L.wide = { ...L.wide, y: L.wide.y - 0.4 * k };
  }
  if (L.portrait && heroK > 0) {
    // The implant parts float high when taken apart, so that scene rises less and shrinks a little more.
    const up = SCENE === 'implant' ? 0.28 : 0.42, shrink = SCENE === 'implant' ? 0.27 : 0.2;
    for (const key of ['main', 'wide', 'arch']) {
      L[key] = { ...L[key], y: L[key].y + up * heroK, s: L[key].s * (1 - shrink * heroK) };
    }
  }
  return L;
}

// ---------------------------------------------------------------- 3D
const canvas = document.getElementById('gl');
let stage = null, scenes = null, labels = null;
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  pointer.tx = (e.clientX / innerWidth) * 2 - 1;
  pointer.ty = (e.clientY / innerHeight) * 2 - 1;
}, { passive: true });

let readyStart = 0;
try {
  stage = createStage(canvas, detectTier(), LOOK_NOW);
  stage.tune = TUNE[LOOK_NOW] || {};
} catch {
  html.classList.add('no-gl');
}

if (stage) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const onLoad = (gltf) => {
    scenes = buildScenes(gltf, stage);
    labels = createLabels(document.getElementById('labels'), SCENE === 'implant' ? [
      { group: 'implant', text: 'Crown', anchor: scenes.implantAnchors.crown },
      { group: 'implant', text: 'Abutment', anchor: scenes.implantAnchors.abutment },
      { group: 'implant', text: 'Implant', anchor: scenes.implantAnchors.fixture },
    ] : []);
    // Braces start from the clinic's natural tooth shade, not the stained "before whitening" one.
    if (SCENE === 'braces') scenes.setShade(1);
    // Show only this page's scene, then compile just its materials.
    scenes.update(sceneChapters(1, 0, 1), 0, pointer, layoutFor(0, 1));
    stage.renderer.compile(stage.scene, stage.camera);
    html.classList.add('loaded');
    readyStart = performance.now();
  };
  (async () => {
    let buf;
    try {
      const r = await fetch(`${ROOT}models/teeth.glb`);
      if (!r.ok) throw new Error(String(r.status));
      buf = await r.arrayBuffer();
    } catch {
      const r = await fetch(`${ROOT}models/teeth.json`);
      const bin = atob((await r.json()).glb);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      buf = u8.buffer;
    }
    loader.parse(buf, './', onLoad, () => html.classList.add('no-gl'));
  })().catch(() => html.classList.add('no-gl'));
  addEventListener('resize', () => stage.resize());
}

// Review builds get a small switch to compare the two 3D looks.
if (import.meta.env.VITE_REVIEW) {
  const sw = document.createElement('div');
  sw.className = 'look-switch';
  sw.innerHTML = `<span>3D look</span>${['gloss', 'natural'].map((l) => `<button type="button" data-look="${l}" aria-pressed="${l === LOOK_NOW}">${l === 'gloss' ? 'Gloss' : 'Natural'}</button>`).join('')}`;
  sw.addEventListener('click', (e) => {
    const b = e.target.closest('[data-look]');
    if (!b || b.dataset.look === LOOK_NOW) return;
    location.hash = `look-${b.dataset.look}`;
    location.reload();
  });
  document.body.appendChild(sw);
}

// ---------------------------------------------------------------- loop
let last = performance.now();
let rendered = true;
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  lenis?.raf(now);
  measure();
  const kP = SNAP ? 1 : 1 - Math.exp(-dt * 9), kS = reduce || SNAP ? 1 : 1 - Math.exp(-dt * 7);
  for (const c of Object.values(CH)) {
    c.presence += (c.tPresence - c.presence) * kP;
    c.progress += (c.tProgress - c.progress) * kS;
  }
  updateSteps();
  topBar.classList.toggle('scrolled', scrollY > 40);

  if (scenes && !document.hidden) {
    const ready = reduce || SNAP ? 1 : ease(clamp((now - readyStart) / 1200));
    pointer.x += (pointer.tx - pointer.x) * kP;
    pointer.y += (pointer.ty - pointer.y) * kP;
    const presence = Math.max(CH.hero.presence, CH.story.presence) * ready;
    const progress = CH.story.progress;
    if (presence > 0.002 || rendered) {
      const heroK = ease(clamp(1 - CH.story.presence));
      scenes.update(sceneChapters(presence, progress, ready), now / 1000, pointer, layoutFor(progress, heroK));
      stage.renderer.render(stage.scene, stage.camera);
      rendered = presence > 0.002;
      labels.update(stage.camera, stage.view, () => presence * (1 - seg(progress, 0.1, 0.2)));
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (SNAP) window.__fd = { get stage() { return stage; }, get scenes() { return scenes; }, CH };

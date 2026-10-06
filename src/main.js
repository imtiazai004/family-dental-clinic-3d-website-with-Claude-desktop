import './styles.css';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import Lenis from 'lenis';
import { CLINIC, waLink, currentLook, TUNE } from './config.js';
import { createStage, computeLayout, detectTier } from './three/stage.js';
import { buildScenes, seg, clamp, ease } from './three/scenes.js';
import { createBot } from './ui/bot.js';
import { createLabels } from './ui/labels.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const html = document.documentElement;
const SNAP = new URLSearchParams(location.search).has('snap');
const LOOK_NOW = currentLook();
html.dataset.look = LOOK_NOW;

// ---------------------------------------------------------------- links and buttons
for (const a of document.querySelectorAll('[data-wa]')) {
  a.href = waLink('Assalam o Alaikum, I found your clinic online and would like to ask about an appointment.');
  a.target = '_blank'; a.rel = 'noopener';
}
for (const a of document.querySelectorAll('[data-reviews]')) { a.href = CLINIC.reviewsUrl; a.target = '_blank'; a.rel = 'noopener'; }
for (const a of document.querySelectorAll('[data-maps]')) { a.href = CLINIC.mapsUrl; a.target = '_blank'; a.rel = 'noopener'; }
for (const a of document.querySelectorAll('[data-instagram]')) { a.href = CLINIC.instagram; a.target = '_blank'; a.rel = 'noopener'; }

// Statement: reveal word by word with scroll.
const kinetic = document.querySelector('[data-kinetic]');
let kWords = [];
if (kinetic) {
  const words = kinetic.textContent.trim().split(/\s+/);
  kinetic.setAttribute('aria-label', kinetic.textContent.trim());
  kinetic.innerHTML = words.map((w, i) => `<span class="w${i >= words.length - 2 ? ' hl' : ''}" aria-hidden="true">${w}</span>`).join(' ');
  kWords = [...kinetic.querySelectorAll('.w')];
}

// First-visit dial: four nodes on a half circle, a gold arc that follows scroll.
const dial = document.querySelector('.dial svg');
let dialArc = null, dialLen = 0, dialNodes = [];
if (dial) {
  dialArc = dial.querySelector('.progress');
  dialLen = dialArc.getTotalLength();
  dialArc.style.strokeDasharray = `${dialLen}`;
  dialArc.style.strokeDashoffset = `${dialLen}`;
  const g = dial.querySelector('.nodes');
  const NS = 'http://www.w3.org/2000/svg';
  for (let i = 0; i < 4; i++) {
    const a = Math.PI - (i / 3) * Math.PI;
    const x = 200 + 160 * Math.cos(a), y = 210 - 160 * Math.sin(a);
    const node = document.createElementNS(NS, 'g');
    node.setAttribute('class', 'node');
    node.innerHTML = `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="19"/><text x="${x.toFixed(1)}" y="${y.toFixed(1)}">${i + 1}</text>`;
    g.appendChild(node);
    dialNodes.push(node);
  }
}

// Before/after sliders.
for (const r of document.querySelectorAll('.ba-range')) {
  r.addEventListener('input', () => r.parentElement.style.setProperty('--pos', `${r.value}%`));
}

const bot = createBot();
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-book]');
  if (b && !b.closest('.bot')) { e.preventDefault(); bot.open(b.dataset.book || null); }
  const c = e.target.closest('[data-copy]');
  if (c) {
    const done = () => { c.textContent = 'Copied'; setTimeout(() => (c.textContent = 'Copy'), 1600); };
    navigator.clipboard?.writeText(c.dataset.copy).then(done, () => {
      const r = document.createRange(); r.selectNodeContents(c.previousElementSibling);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    });
  }
});

// ---------------------------------------------------------------- smooth scroll
let lenis = null;
if (!reduce) {
  lenis = new Lenis({ lerp: 0.11, smoothWheel: true, anchors: { offset: 0 } });
}
const topBar = document.getElementById('top-bar');

// ---------------------------------------------------------------- chapters
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
const genTrack = document.querySelector('.gen-track');
const genPanels = genTrack ? [...genTrack.children] : [];

function measure() {
  const vh = innerHeight;
  for (const c of Object.values(CH)) {
    const r = c.el.getBoundingClientRect();
    if (c.sticky) {
      c.tProgress = clamp(-r.top / Math.max(1, r.height - vh));
      const enter = 1 - clamp(r.top / (vh * 0.75));
      const exit = clamp((r.bottom - vh * 0.25) / (vh * 0.75));
      c.tPresence = Math.min(enter, exit);
    } else {
      c.tProgress = clamp(-r.top / Math.max(1, r.height));
      c.tPresence = clamp((r.bottom - vh * 0.2) / (vh * 0.6));
    }
  }
}

function updateCopy() {
  for (const c of Object.values(CH)) {
    if (c.steps) {
      let i = 0;
      c.marks.forEach((m, k) => { if (c.progress >= m) i = k; });
      if (i !== c.active) {
        c.steps.forEach((s, k) => { s.classList.toggle('on', k === i); s.toggleAttribute('inert', k !== i); });
        c.active = i;
      }
      if (c.rail) c.rail.forEach((s, k) => {
        const a = c.marks[k], b = c.marks[k + 1] ?? 1;
        s.style.setProperty('--f', clamp((c.progress - a) / (b - a)).toFixed(3));
      });
    }
  }
  if (kWords.length && CH.statement) {
    const p = CH.statement.progress;
    const n = kWords.length;
    kWords.forEach((w, i) => {
      const o = 0.16 + 0.84 * clamp((p * 1.25 - (i / n) * 0.9) / 0.12);
      w.style.setProperty('--o', o.toFixed(3));
    });
  }
  if (dialArc && CH.journey) {
    const p = CH.journey.progress;
    const k = clamp(p / 0.82);
    dialArc.style.strokeDashoffset = `${(dialLen * (1 - k)).toFixed(1)}`;
    const active = CH.journey.active;
    dialNodes.forEach((nd, i) => {
      nd.classList.toggle('on', i === active);
      nd.classList.toggle('done', i < active);
    });
  }
  const G = CH.generations;
  if (G && genTrack) {
    const raw = clamp(G.progress * 4 - 0.5, 0, 3);
    const f = Math.floor(raw) + ease(seg(raw - Math.floor(raw), 0.3, 0.7));
    genTrack.style.transform = `translate3d(${(-f * 100).toFixed(2)}%, 0, 0)`;
    const idx = Math.round(f);
    genPanels.forEach((p, k) => p.toggleAttribute('inert', k !== idx));
    if (G.rail) G.rail.forEach((s, k) => s.style.setProperty('--f', clamp(G.progress * 4 - k).toFixed(3)));
  }
}

// ---------------------------------------------------------------- whitening slider
const shade = document.getElementById('shade');
const shadeOut = document.getElementById('shade-out');
const SHADES = ['A3.5', 'A3', 'A2', 'A1', 'B1'];
let shadeManual = false;
const showShade = (v) => { shadeOut.textContent = `Shade ${SHADES[Math.round(v * 4)]}`; };
shade?.addEventListener('input', () => { shadeManual = true; scenes?.setShade(shade.value / 100); showShade(shade.value / 100); });

// ---------------------------------------------------------------- 3D
const canvas = document.getElementById('gl');
const loaderRing = document.querySelector('.hero-loader');
let stage = null, scenes = null, labels = null;
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  pointer.tx = (e.clientX / innerWidth) * 2 - 1;
  pointer.ty = (e.clientY / innerHeight) * 2 - 1;
}, { passive: true });

let ready = 0, readyStart = 0;
try {
  stage = createStage(canvas, detectTier(), LOOK_NOW);
  stage.tune = TUNE[LOOK_NOW] || {};
} catch (e) {
  html.classList.add('no-gl');
}

if (stage) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const onLoad = (gltf) => {
    scenes = buildScenes(gltf, stage);
    labels = createLabels(document.getElementById('labels'), [
      { group: 'anatomy', text: 'Enamel', anchor: scenes.anatomyAnchors.enamel },
      { group: 'anatomy', text: 'Dentin', anchor: scenes.anatomyAnchors.dentin },
      { group: 'anatomy', text: 'Pulp', anchor: scenes.anatomyAnchors.pulp },
      { group: 'anatomy', text: 'Roots', anchor: scenes.anatomyAnchors.roots },
      { group: 'implant', text: 'Crown', anchor: scenes.implantAnchors.crown },
      { group: 'implant', text: 'Abutment', anchor: scenes.implantAnchors.abutment },
      { group: 'implant', text: 'Implant', anchor: scenes.implantAnchors.fixture },
    ]);
    // Compile shaders up front so the first scroll into each scene doesn't stall.
    stage.renderer.compile(stage.scene, stage.camera);
    html.classList.add('loaded');
    readyStart = performance.now();
  };
  // The GLB is the normal path; hosts that can't serve .glb get a base64 JSON copy.
  (async () => {
    let buf;
    try {
      const r = await fetch('./models/teeth.glb');
      if (!r.ok) throw new Error(String(r.status));
      buf = await r.arrayBuffer();
    } catch {
      const r = await fetch('./models/teeth.json');
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
  updateCopy();
  topBar.classList.toggle('scrolled', scrollY > 40);

  if (scenes && !document.hidden) {
    ready = reduce ? 1 : ease(clamp((now - readyStart) / 1400));
    pointer.x += (pointer.tx - pointer.x) * kP;
    pointer.y += (pointer.ty - pointer.y) * kP;
    const t = now / 1000;
    const ch = {
      ready,
      hero: CH.hero, anatomy: CH.anatomy, generations: CH.generations,
      implant: CH.implant, rct: CH.rct, restore: CH.restore, studio: CH.studio,
    };
    if (!shadeManual && CH.studio.presence > 0.01) {
      const auto = ease(seg(CH.studio.progress, 0.42, 0.6));
      shade.value = Math.round(auto * 100);
      showShade(auto);
    }
    if (shadeManual && CH.studio.presence < 0.01) { shadeManual = false; scenes.clearShade(); }
    const any = Math.max(CH.hero.presence, CH.anatomy.presence, CH.generations.presence, CH.implant.presence,
      CH.rct.presence, CH.restore.presence, CH.studio.presence);
    if (any > 0.002 || rendered) {
      scenes.update(ch, t, pointer, computeLayout(stage.view, stage.tune.size));
      stage.renderer.render(stage.scene, stage.camera);
      rendered = any > 0.002;
      labels.update(stage.camera, stage.view, (g) => {
        if (g === 'anatomy') return CH.anatomy.presence * seg(CH.anatomy.progress, 0.38, 0.52) * (1 - seg(CH.anatomy.progress, 0.9, 1));
        if (g === 'implant') return CH.implant.presence * (1 - seg(CH.implant.progress, 0.1, 0.2)) * ready;
        return 0;
      });
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Nav links: let Lenis handle smooth jumps.
for (const a of document.querySelectorAll('a[href^="#"]')) {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id.length > 1 && document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.6 });
    else target.scrollIntoView();
  });
}

if (SNAP) window.__fd = { get stage() { return stage; }, get scenes() { return scenes; }, CH };

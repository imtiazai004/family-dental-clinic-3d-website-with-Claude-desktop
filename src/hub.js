// The treatments page (treatments/index.html): hero with a live 3D tooth, a filterable grid of all
// ten treatments, a "help me choose" band, and the shared booking assistant.
import { adoptLenis, isCurrentPage } from './ui/page-start.js';
import './styles.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import Lenis from 'lenis';
import { CLINIC, waLink, currentLook, TUNE } from './config.js';
import { createStage, computeLayout, detectTier } from './three/stage.js';
import { createKit } from './three/kit.js';
import { makeGlossKit } from './three/gloss.js';
import { makeDust } from './three/procedural.js';
import { createBot } from './ui/bot.js';

const html = document.documentElement;
const ROOT = html.dataset.root || './';
const params = new URLSearchParams(location.search);
const SNAP = params.has('snap');
const MAKE_STILLS = params.has('make-stills');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LOOK_NOW = currentLook();
html.dataset.look = LOOK_NOW;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ---------------------------------------------------------------- links, booking
const WA_DEFAULT = 'Assalam o Alaikum, I found your clinic online and would like to ask about an appointment.';
for (const a of document.querySelectorAll('[data-wa]')) {
  a.href = waLink(a.dataset.waText || WA_DEFAULT);
  a.target = '_blank'; a.rel = 'noopener';
}
for (const a of document.querySelectorAll('[data-reviews]')) { a.href = CLINIC.reviewsUrl; a.target = '_blank'; a.rel = 'noopener'; }
const bot = createBot();
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-book]');
  if (b && !b.closest('.bot')) { e.preventDefault(); bot.open(b.dataset.book || null); }
});

// ---------------------------------------------------------------- smooth scroll
const lenis = reduce || SNAP ? null : new Lenis({ lerp: 0.11, smoothWheel: true });
adoptLenis(lenis);
const scrollToEl = (el) => {
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { duration: 1.3, offset: -70 });
  else el.scrollIntoView({ block: 'start' });
};
for (const a of document.querySelectorAll('a[href^="#"]')) {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id.length > 1 && document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    // The "help me choose" tile is part of the grid, so show everything again before going to it.
    if (target.hidden) setFilter('all');
    scrollToEl(target);
  });
}

// ---------------------------------------------------------------- filters
const GROUPS = ['all', 'pain', 'missing', 'smile'];
const chips = [...document.querySelectorAll('.hub-chip')];
const cards = [...document.querySelectorAll('.hub-card')];
const status = document.querySelector('.hub-status');
function setFilter(g, { announce = true } = {}) {
  if (!GROUPS.includes(g)) g = 'all';
  for (const c of chips) c.setAttribute('aria-pressed', String(c.dataset.filter === g));
  let n = 0;
  cards.forEach((card) => {
    const show = g === 'all' || card.dataset.group === g;
    if (show) {
      if (card.hidden) {
        card.hidden = false;
        card.classList.remove('pop');
        void card.offsetWidth;
        card.style.setProperty('--d', `${n * 55}ms`);
        card.classList.add('pop');
      }
      n++;
    } else card.hidden = true;
  });
  if (announce && status) {
    const chip = chips.find((c) => c.dataset.filter === g);
    status.textContent = g === 'all' ? '' : `Showing ${n} treatment${n === 1 ? '' : 's'} for ${chip.firstChild.textContent.trim().toLowerCase()}.`;
  }
  const hash = g === 'all' ? '' : `#${g}`;
  if (location.hash !== hash && (hash || location.hash)) history.replaceState(null, '', hash || location.pathname + location.search);
}
for (const c of chips) c.addEventListener('click', () => setFilter(c.dataset.filter));
for (const b of document.querySelectorAll('[data-pick]')) {
  b.addEventListener('click', () => {
    setFilter(b.dataset.pick);
    scrollToEl(document.getElementById('all'));
  });
}
const startHash = location.hash.slice(1);
if (GROUPS.includes(startHash) && startHash !== 'all') {
  setFilter(startHash, { announce: false });
  requestAnimationFrame(() => document.getElementById('all')?.scrollIntoView());
}

// ---------------------------------------------------------------- reveal on scroll
const reveals = [...document.querySelectorAll('.reveal')];
if (reduce || SNAP || !('IntersectionObserver' in window)) reveals.forEach((el) => el.classList.add('in'));
else {
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  reveals.forEach((el) => io.observe(el));
}

// ---------------------------------------------------------------- header
const topBar = document.getElementById('top-bar');
const hero = document.querySelector('.hub-hero');

// ---------------------------------------------------------------- 3D: a tooth that opens to show its layers
const canvas = document.getElementById('gl');
let stage = null, scene3d = null, readyAt = 0;
try {
  stage = createStage(canvas, detectTier(), LOOK_NOW);
  stage.tune = TUNE[LOOK_NOW] || {};
} catch {
  html.classList.add('no-gl');
}
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  pointer.tx = (e.clientX / innerWidth) * 2 - 1;
  pointer.ty = (e.clientY / innerHeight) * 2 - 1;
}, { passive: true });

function buildHeroTooth(gltf) {
  const kit = createKit(gltf, stage);
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);
  const tooth = kit.molar();
  pivot.add(tooth.g);
  const gk = stage.look === 'gloss' ? makeGlossKit(stage) : null;
  let pad = null;
  if (gk) {
    pad = gk.pad(root, { y: -1.85, w: 2.7, halo: 0.2, haloY: 0.15 });
    gk.glint(tooth.e, tooth.e, 0.7, 0.86, 0.5, () => 1, 0.6);
    gk.glint(tooth.e, tooth.e, 0.3, 0.62, 0.32, () => 1, 2.4);
  }
  const dust = makeDust(stage.tier === 0 ? 40 : 90);
  stage.scene.add(root, dust);
  if (stage.shadows) root.traverse((o) => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
  return {
    update(presence, time, L) {
      const l = L.portrait ? { ...L.main, y: L.main.y + 0.25, s: L.main.s * 0.82 } : L.main;
      root.visible = presence > 0.002;
      if (!root.visible) return;
      const e = 1 - Math.pow(1 - presence, 3);
      root.scale.setScalar(l.s * (0.6 + 0.4 * e) * 1.05);
      root.position.set(l.x, l.y + 0.12 - (1 - e) * 0.6, 0);
      // A slow turn; every few seconds the enamel lifts to show the dentin and pulp inside.
      const cyc = (time % 9) / 9;
      const open = reduce ? 0.35 : ease(clamp((cyc - 0.15) / 0.2)) * (1 - ease(clamp((cyc - 0.62) / 0.2)));
      pivot.rotation.set(0.28 + pointer.y * 0.06, -0.5 + (reduce ? 0 : time * 0.22) + pointer.x * 0.15, 0);
      pivot.position.y = Math.sin(time * 0.9) * 0.05;
      tooth.e.position.y = open * 0.62;
      tooth.p.position.y = open * 0.12;
      if (pad) gk.fade(pad, e);
      gk?.update(time);
      dust.material.uniforms.uTime.value = time;
      dust.material.uniforms.uPx.value = stage.renderer.getPixelRatio() * 60;
      dust.material.uniforms.uAmount.value = 0.45 * presence;
    },
  };
}

async function loadModel() {
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
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return new Promise((ok, fail) => loader.parse(buf, './', ok, fail));
}

if (stage) {
  loadModel().then(async (gltf) => {
    if (MAKE_STILLS) {
      // Tool mode (tools/make-stills.mjs): render the card images and hand them over.
      const [{ makeStills }, { TREATMENTS, HUB }] = await Promise.all([import('./ui/tx-stills.js'), import('./treatments.js')]);
      const jobs = TREATMENTS.filter((t) => t.story3d && HUB.thumbs[t.id]).map((t) => ({ slug: t.slug, story: t.story3d, ...HUB.thumbs[t.id] }));
      window.__stills = await makeStills({ gltf, look: LOOK_NOW, tune: stage.tune, jobs });
      return;
    }
    scene3d = buildHeroTooth(gltf);
    scene3d.update(1, 0, computeLayout(stage.view, stage.tune.size));
    stage.renderer.compile(stage.scene, stage.camera);
    html.classList.add('loaded');
    readyAt = performance.now();
  }).catch(() => html.classList.add('no-gl'));
  addEventListener('resize', () => stage.resize());
}

// Review builds get a small switch to compare the two 3D looks (the card images are made in one look).
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
let presence = 1, rendered = true;
function frame(now) {
  if (!isCurrentPage()) return;
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  lenis?.raf(now);
  topBar.classList.toggle('scrolled', scrollY > 40);
  if (scene3d && !document.hidden) {
    const r = hero.getBoundingClientRect();
    const target = clamp((r.bottom - innerHeight * 0.15) / (innerHeight * 0.55));
    const k = SNAP ? 1 : 1 - Math.exp(-dt * 8);
    presence += (target - presence) * k;
    const ready = reduce || SNAP ? 1 : ease(clamp((now - readyAt) / 1200));
    pointer.x += (pointer.tx - pointer.x) * k;
    pointer.y += (pointer.ty - pointer.y) * k;
    if (presence * ready > 0.002 || rendered) {
      scene3d.update(presence * ready, now / 1000, computeLayout(stage.view, stage.tune.size));
      stage.renderer.render(stage.scene, stage.camera);
      rendered = presence * ready > 0.002;
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

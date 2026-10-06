// The treatments page (treatments/index.html): hero with a live 3D tooth, a filterable grid of all
// ten treatments, a "help me choose" band, and the shared booking assistant.
import { adoptLenis, isCurrentPage } from './ui/page-start.js';
import './styles.css';
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

// ---------------------------------------------------------------- the ring of ten treatments in the hero
const RING = JSON.parse(document.getElementById('ring-data')?.textContent || '[]');
const ringCard = document.querySelector('.ring-card');
const ringCount = document.querySelector('.ring-count b');
const pills = [...document.querySelectorAll('.hub-jump a[data-i]')];
let ring = null;
let lastTurn = 0, hold = 0;
const AUTO = 3800; // ms each treatment stays at the front
function showFront(i) {
  const it = RING[i];
  if (!it || !ringCard) return;
  ringCard.href = it.href;
  ringCard.classList.remove('swap');
  void ringCard.offsetWidth;
  ringCard.classList.add('swap');
  ringCard.querySelector('.ring-group').textContent = it.group;
  ringCard.querySelector('.ring-name').textContent = it.name;
  ringCard.querySelector('.ring-tag').textContent = it.tag;
  if (ringCount) ringCount.textContent = String(i + 1).padStart(2, '0');
  pills.forEach((p, j) => p.classList.toggle('is-front', j === i));
  // keep the highlighted name in view when the row of names scrolls sideways (phones)
  const row = pills[i]?.closest('.hub-jump');
  if (row && row.scrollWidth > row.clientWidth + 2) {
    const rr = row.getBoundingClientRect(), pr = pills[i].getBoundingClientRect();
    row.scrollTo({ left: row.scrollLeft + (pr.left - rr.left) - rr.width / 2 + pr.width / 2, behavior: reduce ? 'auto' : 'smooth' });
  }
}
function turn(fn) {
  if (!ring) return;
  fn();
  lastTurn = performance.now();
}
for (const b of document.querySelectorAll('[data-ring]')) {
  b.addEventListener('click', () => turn(() => (b.dataset.ring === 'next' ? ring.next() : ring.prev())));
}
// Hovering a treatment's name turns the ring to it and holds it there.
for (const p of pills) {
  p.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hold++; turn(() => ring.go(+p.dataset.i)); } });
  p.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hold = Math.max(0, hold - 1); });
  p.addEventListener('focus', () => turn(() => ring?.go(+p.dataset.i)));
}
const ringUi = document.querySelector('.ring-ui');
ringUi?.addEventListener('pointerenter', () => { hold++; });
ringUi?.addEventListener('pointerleave', () => { hold = Math.max(0, hold - 1); lastTurn = performance.now(); });
ringUi?.addEventListener('focusin', () => { hold++; });
ringUi?.addEventListener('focusout', () => { hold = Math.max(0, hold - 1); });
addEventListener('keydown', (e) => {
  if (!ring || !hero || hero.getBoundingClientRect().bottom < innerHeight * 0.4) return;
  if (e.target.closest?.('input, textarea, .bot')) return;
  if (e.key === 'ArrowRight') turn(() => ring.next());
  if (e.key === 'ArrowLeft') turn(() => ring.prev());
});

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
    const { buildHubRing } = await import('./three/hub-ring.js');
    ring = buildHubRing(gltf, stage, RING, { reduce });
    ring.onFront(showFront);
    showFront(0);
    // a soft glow under the ring and floating dust, as on the other pages
    const gk = stage.look === 'gloss' ? makeGlossKit(stage) : null;
    const pad = gk ? gk.pad(ring.root, { y: -1.05, w: 5.4, halo: 0.18, haloY: 0.12 }) : null;
    const dust = makeDust(stage.tier === 0 ? 40 : 90);
    stage.scene.add(dust);
    scene3d = {
      update(presence, time, dt, L, ptr) {
        ring.update(presence, time, dt, L, ptr);
        if (pad) gk.fade(pad, presence);
        gk?.update(time);
        dust.material.uniforms.uTime.value = time;
        dust.material.uniforms.uPx.value = stage.renderer.getPixelRatio() * 60;
        dust.material.uniforms.uAmount.value = 0.45 * presence;
      },
    };
    scene3d.update(1, 0, 0, computeLayout(stage.view, stage.tune.size), pointer);
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
    // the ring moves on by itself, unless the visitor is pointing at it or the hero is off screen
    if (!reduce && !SNAP && !hold && presence > 0.5 && now - lastTurn > AUTO) turn(() => ring.next());
    if (presence * ready > 0.002 || rendered) {
      scene3d.update(presence * ready, now / 1000, dt, computeLayout(stage.view, stage.tune.size), pointer);
      stage.renderer.render(stage.scene, stage.camera);
      rendered = presence * ready > 0.002;
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

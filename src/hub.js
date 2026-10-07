// The treatments page (treatments/index.html): hero with all ten treatments on a 3D ring (drag it,
// click a model to open its page), a filterable grid, a "help me choose" tile, and the booking assistant.
import { adoptLenis, isCurrentPage } from './ui/page-start.js';
import './styles.css';
import Lenis from 'lenis';
import { CLINIC, waLink, currentLook, TUNE } from './config.js';
import { createStage, computeLayout, detectTier, prepareStage } from './three/stage.js';
import { loadTeeth } from './three/model-file.js';
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

// Drag the ring to turn it: it follows the pointer and, when let go, settles on the nearest of the
// ten stops (36° apart; a quick flick carries it a stop or two further). Click or tap any model on
// the ring to open its page. A sideways trackpad swipe turns it one stop.
const zone = document.querySelector('.ring-zone');
const tip = document.createElement('div');
tip.className = 'ring-tip';
tip.setAttribute('aria-hidden', 'true');
tip.innerHTML = '<div><b></b><span>Open this treatment →</span></div>';
document.body.appendChild(tip);
const hint = document.querySelector('.ring-ui .ring-hint');
if (hint && matchMedia('(hover: none)').matches) hint.textContent = 'Swipe to turn · tap any model to open it';
const mouse = { x: 0, y: 0, in: false };
let drag = null, hoverI = -1, pickedAt = 0;
const stepPx = () => clamp(innerWidth * 0.085, 70, 140); // pointer travel for one stop
function pick(cx, cy) {
  if (!ring || !stage) return -1;
  const r = canvas.getBoundingClientRect();
  return ring.hit(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1, stage.camera);
}
function openTreatment(i, e) {
  const it = RING[i];
  if (!it) return;
  if (e && (e.ctrlKey || e.metaKey || e.shiftKey)) { window.open(it.href, '_blank', 'noopener'); return; }
  location.href = it.href;
}
function setHover(i) {
  if (i === hoverI) return;
  hoverI = i;
  ring?.setHover(i);
  zone?.classList.toggle('on-model', i >= 0);
  if (i >= 0) {
    tip.querySelector('b').textContent = RING[i].name;
    placeTip();
    tip.classList.add('show');
  } else tip.classList.remove('show');
}
function placeTip() {
  const w = tip.firstElementChild.offsetWidth || 180;
  const x = Math.min(mouse.x + 18, innerWidth - w - 12);
  tip.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(mouse.y + 20)}px, 0)`;
}
function endDrag(e, cancelled) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  try { zone.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  if (d.moved) {
    // a pause before letting go means no flick
    ring.release(cancelled || performance.now() - d.t > 110 ? 0 : d.vel);
    html.classList.remove('ring-dragging');
    html.classList.add('ring-used');
    lastTurn = performance.now();
  } else if (!cancelled) {
    const i = pick(e.clientX, e.clientY);
    if (i >= 0 && i === d.on) openTreatment(i, e);
  }
}
if (zone) {
  zone.addEventListener('pointerdown', (e) => {
    if (!ring || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.pointerType === 'mouse') e.preventDefault();
    drag = { id: e.pointerId, x0: e.clientX, x: e.clientX, t: performance.now(), moved: false, vel: 0, on: pick(e.clientX, e.clientY) };
    try { zone.setPointerCapture(e.pointerId); } catch { /* not supported */ }
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') {
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.in = true;
      if (hoverI >= 0) placeTip();
    }
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) {
      if (Math.abs(e.clientX - drag.x0) < 6) return;
      drag.moved = true;
      drag.x = e.clientX;
      ring.grab();
      html.classList.add('ring-dragging');
      setHover(-1);
      return;
    }
    const now = performance.now();
    const da = ((e.clientX - drag.x) / stepPx()) * ring.step;
    ring.dragBy(da);
    const v = da / Math.max(0.008, (now - drag.t) / 1000);
    drag.vel = drag.vel * 0.5 + v * 0.5;
    drag.x = e.clientX;
    drag.t = now;
  });
  zone.addEventListener('pointerup', (e) => endDrag(e, false));
  zone.addEventListener('pointercancel', (e) => endDrag(e, true));
  zone.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !drag) mouse.in = false; });
  let wheelAcc = 0, wheelAt = 0, wheelLast = 0;
  zone.addEventListener('wheel', (e) => {
    if (!ring || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // up / down still scrolls the page
    e.preventDefault();
    e.stopPropagation();
    const now = performance.now();
    if (now - wheelLast > 250) wheelAcc = 0;
    wheelLast = now;
    if (now - wheelAt < 420) return; // one stop per swipe
    wheelAcc += e.deltaX;
    if (Math.abs(wheelAcc) > 36) {
      const dir = wheelAcc;
      wheelAcc = 0;
      wheelAt = now;
      turn(() => (dir > 0 ? ring.next() : ring.prev()));
      html.classList.add('ring-used');
    }
  }, { passive: false });
}

// The ring's code downloads alongside the model file.
const ringCode = MAKE_STILLS ? null : import('./three/hub-ring.js');
ringCode?.catch(() => {});
let ready3d = false;
if (stage) {
  loadTeeth(ROOT).then(async (gltf) => {
    if (MAKE_STILLS) {
      // Tool mode (tools/make-stills.mjs): render the card images and hand them over.
      const [{ makeStills }, { TREATMENTS, HUB }] = await Promise.all([import('./ui/tx-stills.js'), import('./treatments.js')]);
      const jobs = TREATMENTS.filter((t) => t.story3d && HUB.thumbs[t.id]).map((t) => ({ slug: t.slug, story: t.story3d, ...HUB.thumbs[t.id] }));
      window.__stills = await makeStills({ gltf, look: LOOK_NOW, tune: stage.tune, jobs });
      return;
    }
    const { buildHubRing } = await ringCode;
    ring = await buildHubRing(gltf, stage, RING, { reduce });
    ring.onFront(showFront);
    showFront(0);
    if (import.meta.env.VITE_REVIEW) window.__hub = { ring, camera: stage.camera, RING };
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
    // compile in the background and put everything on the graphics card before showing the ring
    await prepareStage(stage);
    ready3d = true;
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
  if (scene3d && ready3d && !document.hidden) {
    const r = hero.getBoundingClientRect();
    const target = clamp((r.bottom - innerHeight * 0.15) / (innerHeight * 0.55));
    const k = SNAP ? 1 : 1 - Math.exp(-dt * 8);
    presence += (target - presence) * k;
    const ready = reduce || SNAP ? 1 : ease(clamp((now - readyAt) / 1200));
    pointer.x += (pointer.tx - pointer.x) * k;
    pointer.y += (pointer.ty - pointer.y) * k;
    // the ring moves on by itself, unless the visitor is pointing at it, turning it, or the hero is off screen
    if (!reduce && !SNAP && !hold && hoverI < 0 && !drag && presence > 0.5 && now - lastTurn > AUTO) turn(() => ring.next());
    if (presence * ready > 0.002 || rendered) {
      scene3d.update(presence * ready, now / 1000, dt, computeLayout(stage.view, stage.tune.size), pointer);
      stage.renderer.render(stage.scene, stage.camera);
      stage.frame(now);
      rendered = presence * ready > 0.002;
    }
    // which model is under the mouse (checked every frame, as the models move under a still pointer)
    if (ring) {
      if (!(mouse.in && !drag?.moved && presence > 0.5)) setHover(-1);
      else if (now - pickedAt > 90) { pickedAt = now; setHover(pick(mouse.x, mouse.y)); }
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

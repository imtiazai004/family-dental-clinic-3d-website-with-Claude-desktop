import * as THREE from 'three';
import { createStage } from '../three/stage.js';
import { createKit } from '../three/kit.js';
import { buildTypeModel } from '../three/implant-types.js';

// Cards whose 3D model comes apart. At rest each card shows two still renders (together / slightly apart,
// swapped on hover). Opening a card grows it into a panel where the live model comes apart with labels,
// can be turned by dragging, and the details are shown. One small 3D view serves every card.

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

export function initExplodeCards({ gltf, look, tier, tune, lenis, reduce }) {
  const cards = [...document.querySelectorAll('.xcard')];
  if (!cards.length) return;

  // The 3D view lives off screen while making stills, then moves into the open panel.
  const holder = document.createElement('div');
  holder.className = 'xcard-holder';
  holder.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  holder.appendChild(canvas);
  document.body.appendChild(holder);
  let stage;
  try {
    stage = createStage(canvas, Math.min(tier, 1), look);
  } catch {
    return;
  }
  stage.tune = tune;
  const kit = createKit(gltf, stage);
  const models = {};
  for (const c of cards) {
    const key = c.dataset.model;
    if (!models[key]) {
      models[key] = buildTypeModel(kit, key);
      models[key].root.visible = false;
      stage.scene.add(models[key].root);
    }
  }
  const showOnly = (key) => { for (const [k, m] of Object.entries(models)) m.root.visible = k === key; };

  // ---------------------------------------------------------------- stills for the cards
  function still(key, k) {
    const m = models[key];
    showOnly(key);
    m.pivot.rotation.set(m.view.rx, m.view.ry, 0);
    m.explode(k);
    m.fit(stage.view.visH, stage.view.visW, 0.86);
    stage.renderer.render(stage.scene, stage.camera);
    return canvas.toDataURL('image/webp', 0.9);
  }
  let made = false;
  function makeStills() {
    if (made) return;
    made = true;
    stage.resize(true);
    for (const c of cards) {
      const key = c.dataset.model;
      c.querySelector('.xcard-a').src = still(key, 0);
      c.querySelector('.xcard-b').src = still(key, 0.42);
      c.classList.add('ready');
    }
  }
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { makeStills(); io.disconnect(); } }, { rootMargin: '900px 0px' });
  io.observe(cards[0]);

  // ---------------------------------------------------------------- panel
  const backdrop = document.createElement('div');
  backdrop.className = 'xpanel-backdrop';
  const panel = document.createElement('div');
  panel.className = 'xpanel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'xp-title');
  panel.hidden = true;
  backdrop.hidden = true;
  panel.innerHTML = `
    <div class="xpanel-stage"><div class="xpanel-labels" aria-hidden="true"></div><p class="xpanel-tip" aria-hidden="true">Drag to turn</p></div>
    <div class="xpanel-body">
      <p class="eyebrow xp-n"></p>
      <h2 id="xp-title"></h2>
      <div class="xpanel-detail"></div>
      <div class="cta-row"><button class="btn btn-primary" type="button" data-book>Ask about this</button></div>
    </div>
    <button class="xpanel-close" type="button" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
  document.body.append(backdrop, panel);
  const stageEl = panel.querySelector('.xpanel-stage');
  const labelLayer = panel.querySelector('.xpanel-labels');
  const closeBtn = panel.querySelector('.xpanel-close');

  let current = null, openCard = null, k = 0, kFrom = 0, kTo = 0, kStart = 0, kDur = 1;
  let raf = 0, last = 0;
  const rot = { y: 0, x: 0, vy: 0, drag: false, lx: 0, ly: 0, idle: 0 };
  const v = new THREE.Vector3();
  let labelEls = [];

  function animateK(to, dur, delay = 0) {
    kFrom = k; kTo = to; kStart = performance.now() + (reduce ? 0 : delay); kDur = reduce ? 1 : dur;
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    const m = models[current];
    if (!m) return;
    k = kFrom + (kTo - kFrom) * easeInOut(clamp((now - kStart) / kDur));
    if (!rot.drag) {
      rot.idle += dt;
      rot.vy *= 0.94;
      rot.y += rot.vy + (rot.idle > 1.5 && !reduce ? dt * 0.25 : 0);
    }
    m.explode(k);
    m.pivot.rotation.set(m.view.rx + rot.x, m.view.ry + rot.y, 0);
    stage.renderer.render(stage.scene, stage.camera);
    // labels
    const show = clamp((k - 0.75) / 0.25);
    labelEls.forEach(({ el, i }) => {
      m.labelPoint(i, v).project(stage.camera);
      el.style.transform = `translate3d(${((v.x * 0.5 + 0.5) * stage.view.w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * stage.view.h - 12).toFixed(1)}px, 0)`;
      el.style.opacity = show.toFixed(3);
    });
  }

  function flip(fromRect, toRect, reverse, done) {
    if (reduce) { done?.(); return; }
    const sx = fromRect.width / toRect.width, sy = fromRect.height / toRect.height;
    const dx = fromRect.left - toRect.left, dy = fromRect.top - toRect.top;
    const a = { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.6, borderRadius: '22px' };
    const b = { transform: 'none', opacity: 1 };
    const anim = panel.animate(reverse ? [b, a] : [a, b], { duration: reverse ? 380 : 520, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
    anim.onfinish = () => { anim.cancel(); done?.(); };
  }

  function open(card) {
    if (openCard) return;
    makeStills();
    openCard = card;
    current = card.dataset.model;
    const m = models[current];
    panel.querySelector('.xp-n').textContent = card.querySelector('.tx-card-n')?.textContent ? `Type ${card.querySelector('.tx-card-n').textContent}` : '';
    panel.querySelector('#xp-title').textContent = card.querySelector('h3').textContent;
    panel.querySelector('.xpanel-detail').innerHTML = card.querySelector('.xcard-detail').innerHTML;
    panel.querySelector('[data-book]').dataset.book = card.querySelector('[data-book]')?.dataset.book || '';
    labelLayer.innerHTML = '';
    labelEls = m.parts.map((p, i) => {
      if (!p.label) return null;
      const el = document.createElement('div');
      el.className = 'lbl';
      el.innerHTML = `<i></i><b>${p.label}</b>`;
      el.style.opacity = '0';
      labelLayer.appendChild(el);
      return { el, i };
    }).filter(Boolean);
    backdrop.hidden = false;
    panel.hidden = false;
    document.documentElement.classList.add('xpanel-open');
    lenis?.stop();
    stageEl.prepend(canvas);
    stage.resize(true);
    showOnly(current);
    k = 0;
    rot.y = 0; rot.x = 0; rot.vy = 0; rot.idle = 0;
    m.explode(1);
    m.pivot.rotation.set(m.view.rx, m.view.ry, 0);
    m.fit(stage.view.visH, stage.view.visW, 0.8);
    m.explode(0);
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    const from = card.querySelector('.xcard-media').getBoundingClientRect();
    const to = panel.getBoundingClientRect();
    requestAnimationFrame(() => backdrop.classList.add('on'));
    flip(from, to, false);
    // The model starts coming apart as the panel finishes growing.
    animateK(1, 1300, 420);
    closeBtn.focus({ preventScroll: true });
  }

  function close() {
    if (!openCard) return;
    const card = openCard;
    animateK(0, reduce ? 1 : 520);
    backdrop.classList.remove('on');
    setTimeout(() => {
      const from = card.querySelector('.xcard-media').getBoundingClientRect();
      flip(from, panel.getBoundingClientRect(), true, () => {
        cancelAnimationFrame(raf);
        panel.hidden = true;
        backdrop.hidden = true;
        holder.appendChild(canvas);
        document.documentElement.classList.remove('xpanel-open');
        lenis?.start();
        openCard = null;
        card.querySelector('.xcard-open').focus({ preventScroll: true });
      });
    }, reduce ? 0 : 420);
  }

  for (const c of cards) {
    c.querySelector('.xcard-open').addEventListener('click', () => open(c));
    c.querySelector('.xcard-more')?.addEventListener('click', () => open(c));
  }
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  panel.addEventListener('click', (e) => { if (e.target.closest('[data-book]')) close(); });
  document.addEventListener('keydown', (e) => {
    if (!openCard) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const f = [...panel.querySelectorAll('button, a[href]')].filter((x) => !x.hidden);
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  addEventListener('resize', () => { if (openCard) { stage.resize(true); models[current].fit(stage.view.visH, stage.view.visW, 0.8); } });

  // Drag to turn.
  stageEl.addEventListener('pointerdown', (e) => { rot.drag = true; rot.lx = e.clientX; rot.ly = e.clientY; rot.idle = 0; stageEl.setPointerCapture(e.pointerId); });
  stageEl.addEventListener('pointermove', (e) => {
    if (!rot.drag) return;
    const dx = e.clientX - rot.lx, dy = e.clientY - rot.ly;
    rot.lx = e.clientX; rot.ly = e.clientY;
    rot.y += dx * 0.008; rot.vy = dx * 0.008;
    rot.x = clamp(rot.x + dy * 0.005, -0.5, 0.6);
  });
  const end = () => { rot.drag = false; rot.idle = 0; };
  stageEl.addEventListener('pointerup', end);
  stageEl.addEventListener('pointercancel', end);
}

import { defineConfig } from 'vite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { SERVICES, GENERATIONS, JOURNEY, FAQ, FAQ_GROUPS, REVIEWS, BEFORE_AFTER } from './src/config.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Renders content from src/config.js into static HTML, so it is crawlable
// and visible before any script runs.
const has = (src) => !!src && existsSync(resolve('public', src));

// Line drawings shown in a step's frame until its photo or video is added.
const ART = [
  '',
  // check-up: tooth and dental mirror
  `<path d="M38 30c-9 0-15 8-14 19 1 10 6 16 8 26 2 11 3 22 9 22s6-12 9-20c2-6 4-8 7-8s5 2 7 8c3 8 3 20 9 20s7-11 9-22c2-10 7-16 8-26 1-11-5-19-14-19-8 0-12 4-19 4s-11-4-19-4z"/>
   <circle cx="100" cy="44" r="13"/><path d="M91 54 70 104"/><path d="M95 40a7 7 0 0 1 8-3" class="soft"/>`,
  // plan explained: tablet with a tooth and a checklist
  `<rect x="30" y="18" width="60" height="86" rx="8"/><path d="M54 98h12" class="soft"/>
   <path d="M52 32c-4 0-7 3-6 8 0 4 3 7 4 11 1 4 1 8 4 8 2 0 2-5 3-8 1-2 1-3 3-3s2 1 3 3c1 3 1 8 3 8 3 0 3-4 4-8 1-4 4-7 4-11 1-5-2-8-6-8-3 0-5 2-8 2s-5-2-8-2z"/>
   <path d="M40 70l3 3 5-6M40 82l3 3 5-6"/><path d="M54 70h26M54 82h20" class="soft"/>`,
  // treatment and follow-up: tooth, sparkles and a calendar
  `<path d="M34 26c-9 0-15 8-14 19 1 10 6 16 8 26 2 11 3 22 9 22s6-12 9-20c2-6 4-8 7-8s5 2 7 8c3 8 3 20 9 20s7-11 9-22c2-10 7-16 8-26 1-11-5-19-14-19-8 0-12 4-19 4s-11-4-19-4z"/>
   <path d="M94 18v12M88 24h12M104 40v7M100.5 43.5h7" class="soft"/>
   <rect x="78" y="72" width="30" height="28" rx="4"/><path d="M78 80h30M86 68v8M100 68v8"/><path d="M86 90l4 4 8-8"/>`,
];

const DEMO = `
        <div class="demo" aria-hidden="true">
          <div class="demo-scene demo-site">
            <div class="demo-head"><span class="demo-av"><svg viewBox="0 0 24 24"><path d="M8.2 5c-2 0-3.3 1.6-3.3 3.8 0 1.8.8 3 1.3 4.1.7 1.3.8 2.6 1.1 4.1.2 1.2.7 2 1.5 2 .9 0 1.1-1.1 1.4-2.5.3-1.3.7-2.4 1.8-2.4s1.5 1.1 1.8 2.4c.3 1.4.5 2.5 1.4 2.5.8 0 1.2-.8 1.5-2 .3-1.5.4-2.8 1.1-4.1.5-1.1 1.3-2.3 1.3-4.1 0-2.2-1.3-3.8-3.3-3.8-1.5 0-2.2.8-3.7.8S9.7 5 8.2 5z"/></svg></span><b>Booking assistant</b><small>On this website</small></div>
            <div class="demo-log">
              <p class="b them">What would you like to book?</p>
              <p class="b chips"><span class="pick">Check-up</span><span>Whitening</span><span>Braces</span></p>
              <p class="b me">Check-up</p>
              <p class="b them">Which day suits you?</p>
              <p class="b me">Tomorrow, evening</p>
              <p class="b them">Your name and phone number?</p>
              <p class="b me">Sana, 0300 1234567</p>
              <p class="b send">Send on WhatsApp</p>
            </div>
          </div>
          <div class="demo-scene demo-wa">
            <div class="demo-head"><span class="demo-av"><svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z"/></svg></span><b>Family Dental</b><small>On WhatsApp</small></div>
            <div class="demo-log">
              <p class="b me">Appointment request: check-up, tomorrow evening. Sana</p>
              <p class="b them">Thank you, Sana. 6:30 pm tomorrow is free. Shall we book it?</p>
              <p class="b me">Yes, please.</p>
              <p class="b them">Booked. See you tomorrow!</p>
            </div>
          </div>
          <p class="demo-tag">Example</p>
        </div>`;

function journeyMediaHtml(m, i) {
  let inner;
  if (m.demo) inner = DEMO;
  else if (m.video && has(m.video)) {
    inner = `
        <video muted loop playsinline preload="none"${has(m.poster) ? ` poster="${esc(m.poster)}"` : ''} aria-label="${esc(m.alt || '')}"><source src="${esc(m.video)}" type="video/mp4"></video>
        <button class="jm-sound" type="button" aria-pressed="false" aria-label="Turn sound on"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="on" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/><path class="off" d="M16 9.5l5 5M21 9.5l-5 5"/></svg></button>`;
  } else if (m.image && has(m.image)) {
    inner = `
        <img src="${esc(m.image)}" alt="${esc(m.alt || '')}" loading="lazy" decoding="async">`;
  } else {
    inner = `
        <svg class="jm-art" viewBox="0 0 128 128" aria-hidden="true">${ART[i] || ''}</svg>`;
  }
  const kind = m.demo ? 'demo' : inner.includes('<video') ? 'video' : inner.includes('<img') ? 'image' : 'art';
  return `
      <div class="jm is-${kind}" data-i="${i}">${inner}
      </div>`;
}

function staticContent() {
  return {
    name: 'static-content',
    transformIndexHtml(html) {
      const services = SERVICES.map((s) => `
        <li class="tx">
          <div class="tx-text"><h3>${esc(s.name)}</h3><p>${esc(s.desc)}</p></div>
          <button class="btn btn-ghost btn-sm" type="button" data-book="${s.id}" aria-label="Book ${esc(s.name.toLowerCase())}">Book</button>
        </li>`).join('');
      const gens = GENERATIONS.map((g, i) => `
            <article class="gen-panel" aria-label="${esc(g.title)}">
              <p class="step-n">${i + 1} of ${GENERATIONS.length}</p>
              <h3>${esc(g.title)}</h3>
              <p>${esc(g.text)}</p>
              <ul class="tags">${g.services.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
            </article>`).join('');
      const journey = JOURNEY.map((j, i) => `
          <li class="step">
            <p class="step-n">Step ${i + 1} of ${JOURNEY.length}</p>
            <h3>${esc(j.title)}</h3>
            <p>${esc(j.text)}</p>${j.cta ? `
            <div class="step-cta">
              <button class="btn btn-primary btn-sm" type="button" data-book>Booking assistant</button>
              <a class="btn btn-ghost btn-sm" data-wa>WhatsApp</a>
            </div>` : ''}
          </li>`).join('');
      const journeyMedia = JOURNEY.map((j, i) => journeyMediaHtml(j.media || {}, i)).join('');
      const faq = FAQ_GROUPS.map((g, gi) => `
        <div class="faq-group">
          <h3>${esc(g)}</h3>
          ${FAQ.filter((f) => f.group === gi).map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n          ')}
        </div>`).join('');
      const reviews = REVIEWS.map((r) => `
      <figure class="quote">
        <blockquote><p>${esc(r.text)}</p></blockquote>
        <figcaption><strong>${esc(r.name)}</strong> <span>${esc(r.detail)}</span></figcaption>
      </figure>`).join('');
      const cases = BEFORE_AFTER.length ? `
  <section class="plain cases" id="results" aria-labelledby="cases-h">
    <div class="wrap">
      <div class="section-head">
        <h2 id="cases-h">Real results</h2>
        <p>Cases from the clinic, shared with each patient's permission. Drag to compare.</p>
      </div>
      <div class="ba-grid">${BEFORE_AFTER.map((c, i) => `
        <figure class="ba">
          <div class="ba-frame" style="--pos: 50%">
            <img class="ba-after" src="${esc(c.after)}" alt="${esc(c.title)}, after treatment" loading="lazy" decoding="async">
            <img class="ba-before" src="${esc(c.before)}" alt="${esc(c.title)}, before treatment" loading="lazy" decoding="async">
            <span class="ba-tag ba-tag-b">Before</span><span class="ba-tag ba-tag-a">After</span>
            <span class="ba-handle" aria-hidden="true"></span>
            <label class="sr-only" for="ba-${i}">Compare before and after for ${esc(c.title)}</label>
            <input class="ba-range" id="ba-${i}" type="range" min="0" max="100" value="50">
          </div>
          <figcaption><strong>${esc(c.title)}</strong>${c.note ? ` <span>${esc(c.note)}</span>` : ''}</figcaption>
        </figure>`).join('')}
      </div>
    </div>
  </section>` : '';
      return html
        .replace('<!--SERVICES-->', services)
        .replace('<!--GENERATIONS-->', gens)
        .replace('<!--JOURNEY-->', journey)
        .replace('<!--JOURNEY_MEDIA-->', journeyMedia)
        .replace('<!--FAQ-->', faq)
        .replace('<!--REVIEWS-->', reviews)
        .replace('<!--BEFORE_AFTER-->', cases);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [staticContent()],
  build: { assetsInlineLimit: 0, chunkSizeWarningLimit: 900, target: 'es2020' },
});

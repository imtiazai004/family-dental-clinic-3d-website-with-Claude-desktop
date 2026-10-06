import { defineConfig } from 'vite';
import { SERVICES, GENERATIONS, JOURNEY, FAQ, FAQ_GROUPS, REVIEWS, BEFORE_AFTER } from './src/config.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Renders content from src/config.js into static HTML, so it is crawlable
// and visible before any script runs.
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
            <p>${esc(j.text)}</p>
          </li>`).join('');
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

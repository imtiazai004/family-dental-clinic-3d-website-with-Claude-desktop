// Builds the treatments page (treatments/index.html), the "front door" listing all ten treatments.
// Runs in Node when Vite loads its config, like the treatment pages.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CLINIC, SERVICES, REVIEWS, FAQ } from '../src/config.js';
import { TREATMENTS, TX_GROUPS, HUB } from '../src/treatments.js';
import { esc, linker, navTx, topTx, HEAD, BRAND } from './treatment-page.mjs';

const TOOTH = 'M7.5 3.5c-2.4 0-4 1.9-4 4.6 0 2.2.9 3.6 1.6 5 .8 1.6.9 3.2 1.3 5 .3 1.5.9 2.4 1.8 2.4 1.1 0 1.4-1.3 1.7-3 .3-1.6.8-2.9 2.1-2.9s1.8 1.3 2.1 2.9c.3 1.7.6 3 1.7 3 .9 0 1.5-.9 1.8-2.4.4-1.8.5-3.4 1.3-5 .7-1.4 1.6-2.8 1.6-5 0-2.7-1.6-4.6-4-4.6-1.8 0-2.7 1-4.5 1s-2.7-1-4.5-1z';
const svg = (inner, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
const ICONS = {
  pain: svg(`<path d="${TOOTH}"/><path d="M12.4 6.2 10.6 9.4h2.6l-1.9 3.4"/>`),
  missing: svg(`<path d="${TOOTH}" stroke-dasharray="2.2 2"/><path d="M12 9.5v4M10 11.5h4"/>`),
  smile: svg(`<path d="M5 11.5c1.8 3.2 4.2 4.5 7 4.5s5.2-1.3 7-4.5"/><path d="M18 3.5v3M16.5 5h3M5.5 4v2M4.5 5h2"/>`),
  steam: svg(`<rect x="4" y="9" width="16" height="11" rx="2.5"/><path d="M8 13h8M8 16h5"/><path d="M9 6.5c0-1 1-1 1-2M12 6.5c0-1 1-1 1-2M15 6.5c0-1 1-1 1-2"/>`),
  glove: svg(`<path d="M7 21v-6.5L5 11c-.6-1 .9-2 1.6-1L8.5 12V5a1.2 1.2 0 0 1 2.4 0v5V3.8a1.2 1.2 0 0 1 2.4 0V10V5a1.2 1.2 0 0 1 2.4 0v6V7.5a1.2 1.2 0 0 1 2.3 0V15c0 3-1.8 6-5 6z"/>`),
  spark: svg(`<path d="M12 3.5l1.6 4.4 4.4 1.6-4.4 1.6L12 15.5l-1.6-4.4L6 9.5l4.4-1.6z"/><path d="M18.5 15v4M16.5 17h4M5 17.5v2.5M3.8 18.8h2.5"/>`),
  shield: svg(`<path d="M12 3 5 6v5.5c0 4.3 2.9 7.8 7 9.5 4.1-1.7 7-5.2 7-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>`),
  arrow: svg('<path d="M5 12h13M13 7l5 5-5 5"/>', 'arr'),
};

const svcOf = (id) => SERVICES.find((s) => s.id === id);
// Card images are made by tools/make-stills.mjs into public/media/tx/<slug>-a.webp and -b.webp.
const still = (slug, k) => `media/tx/${slug}-${k}.webp`;
const hasStill = (slug, k) => existsSync(resolve('public', still(slug, k)));

function card(t, i, L) {
  const s = svcOf(t.id);
  const types = t.options?.items?.length || 0;
  const imgA = hasStill(t.slug, 'a'), imgB = hasStill(t.slug, 'b');
  return `
        <li class="hub-card reveal" data-group="${esc(t.group)}" style="--rd: ${(i % 3) * 90}ms">
          <a class="hub-card-link" href="${L.page(t.slug)}">
            <span class="hub-media${imgA ? ' has-img' : ''}" aria-hidden="true">
              <span class="hub-glow"></span>
              ${svg(`<path d="${TOOTH}"/>`, 'hub-ph')}
              ${imgA ? `<img class="hub-a" src="${L.root}${still(t.slug, 'a')}" alt="" width="960" height="720" loading="lazy" decoding="async">` : ''}
              ${imgB ? `<img class="hub-b" src="${L.root}${still(t.slug, 'b')}" alt="" width="960" height="720" loading="lazy" decoding="async">` : ''}
            </span>
            <span class="hub-meta"><span class="hub-n">${String(i + 1).padStart(2, '0')}</span><span class="hub-group">${esc(TX_GROUPS[t.group])}</span></span>
            <h3>${esc(t.name)}</h3>
            <p class="hub-tag">${esc(t.tagline)}</p>
            <p class="hub-desc">${esc(s ? s.desc : t.lead)}</p>
            <span class="hub-more">See how it works ${ICONS.arrow}</span>
          </a>
          <div class="hub-foot">
            <span class="hub-facts">${t.story.steps.length} steps in 3D${types ? ` · ${types} types` : ''}</span>
            <button class="btn btn-ghost btn-sm" type="button" data-book="${esc(t.id)}" aria-label="Book ${esc(t.name.toLowerCase())}">Book</button>
          </div>
        </li>`;
}

export function renderHubPage({ explicit = false } = {}) {
  const L = linker(1, explicit);
  // Cards in the order of the problem groups, so filtered lists stay in a sensible order.
  const order = Object.keys(TX_GROUPS).flatMap((g) => TREATMENTS.filter((t) => t.group === g));
  const counts = Object.fromEntries(Object.keys(TX_GROUPS).map((g) => [g, TREATMENTS.filter((t) => t.group === g).length]));
  const waText = 'Assalam o Alaikum, I found your clinic online and would like some advice about which treatment I need.';
  const faq = HUB.faq.map((f) => (f.fromHome ? FAQ.find((x) => x.q === f.fromHome) : f)).filter(Boolean);
  const review = REVIEWS[0];
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: HUB.seoTitle,
    description: HUB.description,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: order.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, description: t.tagline })),
    },
    publisher: { '@type': 'Dentist', name: CLINIC.name, telephone: CLINIC.phoneDisplay, address: { '@type': 'PostalAddress', streetAddress: CLINIC.address.slice(0, 2).join(', '), addressLocality: 'Peshawar', addressCountry: 'PK' } },
  };

  return `<!doctype html>
<html lang="en" data-root="${L.root}" data-hub>
<head>
${HEAD(HUB.seoTitle, HUB.description)}
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body class="tx-page hub-page">
<a class="skip" href="#all">Skip to the treatments</a>

<header class="top" id="top-bar">
  <a class="brand" href="${L.home()}" aria-label="Family Dental & Aesthetic Clinic, home page">
    ${BRAND}
  </a>
  <nav class="nav" aria-label="Main">
    <a href="${L.home()}">Home</a>
    ${navTx(L, 'hub')}
    <a href="${L.home('#first-visit')}">Your first visit</a>
    <a href="${L.home('#dentist')}">Your dentist</a>
    <a href="${L.home('#visit')}">Visit</a>
  </nav>
  ${topTx(L, 'hub')}
  <button class="btn btn-primary btn-sm" type="button" data-book>Book a visit</button>
</header>

<canvas id="gl" aria-hidden="true"></canvas>

<main>
  <section class="hub-hero" id="top" aria-labelledby="hub-h">
    <div class="hub-hero-copy">
      <div class="hub-hero-top">
        <nav class="crumbs" aria-label="Breadcrumb">
          <ol>
            <li><a href="${L.home()}">Home</a></li>
            <li aria-current="page">Treatments</li>
          </ol>
        </nav>
        <span class="ring-hint ring-hint-m" aria-hidden="true">Swipe to turn · tap to open</span>
      </div>
      <p class="eyebrow">${esc(HUB.eyebrow)}</p>
      <h1 id="hub-h">${esc(HUB.title)}</h1>
      <p class="lede">${esc(HUB.lead)}</p>
      <div class="cta-row">
        <a class="btn btn-primary" href="#all">See all treatments</a>
        <a class="btn btn-ghost" href="#choose">Help me choose</a>
      </div>
      <a class="rating" data-reviews>
        <span class="stars" aria-hidden="true">★★★★★</span>
        <span><strong>${esc(CLINIC.rating)}</strong> on Google from ${esc(CLINIC.reviews)} reviews</span>
      </a>
    </div>
    <div class="ring-zone" aria-hidden="true"></div>
    <div class="ring-ui" aria-label="The ten treatments in 3D">
      <button class="ring-nav" type="button" data-ring="prev" aria-label="Previous treatment">${svg('<path d="M15 5l-7 7 7 7"/>', 'arr')}</button>
      <a class="ring-card" href="${L.page(order[0].slug)}" aria-live="polite">
        <span class="ring-group">${esc(TX_GROUPS[order[0].group])}</span>
        <b class="ring-name">${esc(order[0].name)}</b>
        <span class="ring-tag">${esc(order[0].tagline)}</span>
        <span class="ring-go">See how it works ${ICONS.arrow}</span>
      </a>
      <button class="ring-nav" type="button" data-ring="next" aria-label="Next treatment">${svg('<path d="M9 5l7 7-7 7"/>', 'arr')}</button>
      <span class="ring-count" aria-hidden="true"><b>01</b> / ${String(order.length).padStart(2, '0')}</span>
      <span class="ring-hint" aria-hidden="true">Drag to turn · click any model to open it</span>
    </div>
    <script type="application/json" id="ring-data">${JSON.stringify(order.map((t) => ({ id: t.id, name: t.name, tag: t.tagline, group: TX_GROUPS[t.group], href: L.page(t.slug), model: HUB.heroModels[t.id] }))).replace(/</g, '\\u003c')}</script>
    <ul class="hub-jump" aria-label="Treatments">${order.map((t, i) => `<li><a href="${L.page(t.slug)}" data-i="${i}">${esc(t.name)}</a></li>`).join('')}</ul>
    <div class="hero-loader" aria-hidden="true"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17"/></svg></div>
  </section>

  <section class="plain hub-all" id="all" aria-labelledby="all-h">
    <div class="wrap">
      <div class="section-head hub-head">
        <h2 id="all-h">${esc(HUB.gridTitle)}</h2>
        <p>${esc(HUB.gridText)}</p>
      </div>
      <div class="hub-filters" role="group" aria-label="Show treatments for">
        <button class="hub-chip" type="button" data-filter="all" aria-pressed="true">All <span>${TREATMENTS.length}</span></button>
        ${Object.entries(TX_GROUPS).map(([g, label]) => `<button class="hub-chip" type="button" data-filter="${g}" aria-pressed="false">${esc(label)} <span>${counts[g]}</span></button>`).join('\n        ')}
      </div>
      <p class="hub-status" aria-live="polite"></p>
      <ul class="hub-grid">${order.map((t, i) => card(t, i, L)).join('')}
        <li class="hub-card hub-help reveal" id="choose" data-group="help" style="--rd: 90ms">
          <div class="hub-help-copy">
            <p class="eyebrow">Help me choose</p>
            <h3 id="choose-h">${esc(HUB.helper.title)}</h3>
            <p>${esc(HUB.helper.text)}</p>
            <div class="cta-row">
              <button class="btn btn-primary btn-sm" type="button" data-book>Ask the booking assistant</button>
              <a class="btn btn-ghost btn-sm" data-wa data-wa-text="${esc(waText)}">WhatsApp</a>
            </div>
          </div>
          <div class="hub-options" role="group" aria-labelledby="choose-h">${HUB.helper.options.map((o) => `
            <button class="hub-option" type="button" data-pick="${esc(o.group)}">
              ${ICONS[o.group] || ''}
              <span><b>${esc(o.label)}</b><small>${esc(o.hint)}</small></span>
              ${ICONS.arrow}
            </button>`).join('')}
          </div>
        </li>
      </ul>
    </div>
  </section>

  <section class="plain hub-why" aria-label="Why patients choose the clinic">
    <div class="wrap">
      <ul class="hub-why-list">${HUB.why.map((w, i) => `
        <li class="reveal" style="--rd: ${i * 90}ms"><b>${esc(w.big)}</b><span>${esc(w.label)}</span></li>`).join('')}
      </ul>
    </div>
  </section>

  <section class="plain hub-safety" id="safety" aria-labelledby="safety-h">
    <div class="wrap">
      <div class="section-head">
        <h2 id="safety-h">${esc(HUB.safety.title)}</h2>
        <p>${esc(HUB.safety.text)}</p>
      </div>
      <ul class="hub-safety-grid">${HUB.safety.items.map((s, i) => `
        <li class="reveal" style="--rd: ${i * 90}ms">
          ${ICONS[s.icon] || ''}
          <h3>${esc(s.title)}</h3>
          <p>${esc(s.text)}</p>
        </li>`).join('')}
      </ul>
    </div>
  </section>

  <section class="plain tx-review" aria-label="A patient's review">
    <div class="wrap">
      <figure class="quote">
        <blockquote><p>${esc(review.text)}</p></blockquote>
        <figcaption><strong>${esc(review.name)}</strong> <span>${esc(review.detail)}</span></figcaption>
      </figure>
    </div>
  </section>

  <section class="plain dentist" id="dentist" aria-labelledby="dentist-h">
    <div class="wrap dentist-grid">
      <div class="monogram" aria-hidden="true"><span>${esc(CLINIC.dentist.initials)}</span></div>
      <div class="dentist-copy">
        <h2 id="dentist-h">${esc(CLINIC.dentist.name)}</h2>
        <p class="role">${esc(CLINIC.dentist.role)}</p>
        <p>Every treatment at the clinic is planned and carried out by Dr. Tabassum. As a prosthodontist she specialises in restoring and replacing teeth, with crowns, veneers, implants and dentures. She explains each step, and what it costs, before anything starts.</p>
        <div class="cta-row">
          <button class="btn btn-primary" type="button" data-book>Book with Dr. Tabassum</button>
          <a class="btn btn-ghost" href="${L.home('#dentist')}">About the clinic</a>
        </div>
      </div>
    </div>
  </section>

  <section class="plain faq" id="questions" aria-labelledby="faq-h">
    <div class="wrap faq-grid">
      <div class="faq-intro">
        <h2 id="faq-h">Questions</h2>
        <p>Can't find yours? Ask the booking assistant, or message the clinic on WhatsApp.</p>
        <button class="btn btn-ghost" type="button" data-book>Ask a question</button>
      </div>
      <div class="faq-groups">
        <div class="faq-group">
          ${faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n          ')}
        </div>
      </div>
    </div>
  </section>

  <section class="plain tx-cta" id="book" aria-labelledby="book-h">
    <div class="wrap">
      <div class="tx-cta-box">
        <h2 id="book-h">Book a check-up</h2>
        <p>The dentist examines you and explains your options, how long each takes and what it costs, before anything starts.</p>
        <div class="cta-row">
          <button class="btn btn-primary" type="button" data-book>Book a visit</button>
          <a class="btn btn-ghost" data-wa data-wa-text="${esc(waText)}">WhatsApp</a>
          <a class="btn btn-ghost" href="tel:+${esc(CLINIC.phoneIntl)}">Call ${esc(CLINIC.phoneDisplay)}</a>
        </div>
        <p class="tx-cta-addr">${esc(CLINIC.address.join(', '))}</p>
      </div>
    </div>
  </section>

  <footer class="foot">
    <div class="wrap foot-row">
      <p class="foot-brand">${esc(CLINIC.name)}</p>
      <p>${esc(CLINIC.address.join(', '))} · ${esc(CLINIC.phoneDisplay)}</p>
    </div>
  </footer>
</main>

<nav class="dock" aria-label="Quick actions">
  <button type="button" data-book>Book</button>
  <a data-wa data-wa-text="${esc(waText)}">WhatsApp</a>
  <a href="tel:+${esc(CLINIC.phoneIntl)}">Call</a>
</nav>

<script type="module" src="/src/hub.js"></script>
</body>
</html>
`;
}

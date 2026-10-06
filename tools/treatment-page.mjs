// Builds the treatment pages from src/treatments.js. Runs in Node when Vite loads its config.
// Every page uses the same template; sections without content are left out.
import { CLINIC, SERVICES, REVIEWS, waLink } from '../src/config.js';
import { TREATMENTS, TX_GROUPS } from '../src/treatments.js';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Relative links. depth = folders below the site root (0 for the home page, 2 for treatments/<slug>/).
// explicit = write index.html into links, for hosts that do not serve folder indexes.
export function linker(depth, explicit = false) {
  const up = '../'.repeat(depth);
  const file = explicit ? 'index.html' : '';
  return {
    root: depth ? up : './',
    home: (hash = '') => (depth ? `${up}${file}${hash}` : hash || `./${file}`),
    page: (slug) => `${up}treatments/${slug}/${file}`,
  };
}

const CHEVRON = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// "Treatments" dropdown for the header, grouped by what the patient is dealing with.
export function navMenu(L, current = null) {
  const cols = Object.entries(TX_GROUPS).map(([g, label]) => {
    const items = TREATMENTS.filter((t) => t.group === g);
    if (!items.length) return '';
    return `
          <div class="nav-menu-col">
            <p class="nav-menu-h">${esc(label)}</p>
            ${items.map((t) => `<a class="nav-tx" href="${L.page(t.slug)}"${t.id === current ? ' aria-current="page"' : ''}><b>${esc(t.name)}</b><span>${esc(t.tagline)}</span></a>`).join('\n            ')}
          </div>`;
  }).join('');
  return `<div class="nav-dd">
      <button class="nav-dd-btn" type="button" aria-expanded="false" aria-controls="tx-menu">Treatments ${CHEVRON}</button>
      <div class="nav-menu" id="tx-menu">
        <div class="nav-menu-cols">${cols}
        </div>
        <a class="nav-menu-all" href="${L.home('#treatments')}">All ten treatments</a>
      </div>
    </div>`;
}

const svc = (id) => SERVICES.find((s) => s.id === id);
const txById = (id) => TREATMENTS.find((t) => t.id === id);
const shortName = (t) => t.name.replace(/^Dental /, '').toLowerCase();

const HEAD = (title, desc) => `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#1b0e1d">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='6' fill='%231b0e1d'/%3E%3Cpath d='M8.2 5c-2 0-3.3 1.6-3.3 3.8 0 1.8.8 3 1.3 4.1.7 1.3.8 2.6 1.1 4.1.2 1.2.7 2 1.5 2 .9 0 1.1-1.1 1.4-2.5.3-1.3.7-2.4 1.8-2.4s1.5 1.1 1.8 2.4c.3 1.4.5 2.5 1.4 2.5.8 0 1.2-.8 1.5-2 .3-1.5.4-2.8 1.1-4.1.5-1.1 1.3-2.3 1.3-4.1 0-2.2-1.3-3.8-3.3-3.8-1.5 0-2.2.8-3.7.8S9.7 5 8.2 5z' fill='%23f5efe6'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..600&family=Onest:wght@400;500;600&display=swap">`;

const BRAND = `<svg class="brand-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 3.5c-2.4 0-4 1.9-4 4.6 0 2.2.9 3.6 1.6 5 .8 1.6.9 3.2 1.3 5 .3 1.5.9 2.4 1.8 2.4 1.1 0 1.4-1.3 1.7-3 .3-1.6.8-2.9 2.1-2.9s1.8 1.3 2.1 2.9c.3 1.7.6 3 1.7 3 .9 0 1.5-.9 1.8-2.4.4-1.8.5-3.4 1.3-5 .7-1.4 1.6-2.8 1.6-5 0-2.7-1.6-4.6-4-4.6-1.8 0-2.7 1-4.5 1s-2.7-1-4.5-1z"/></svg>
    <span class="brand-text"><span class="brand-name">Family Dental</span><span class="brand-sub">&amp; Aesthetic Clinic</span></span>`;

export function renderTreatmentPage(t, { explicit = false } = {}) {
  const L = linker(2, explicit);
  const short = shortName(t);
  const waText = `Assalam o Alaikum, I found your clinic online and would like to ask about ${t.name.toLowerCase()}.`;
  const review = t.review != null ? REVIEWS[t.review] : null;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    name: t.seoTitle,
    description: t.description,
    about: { '@type': 'MedicalProcedure', name: t.name, description: t.lead },
    publisher: { '@type': 'Dentist', name: CLINIC.name, telephone: CLINIC.phoneDisplay, address: { '@type': 'PostalAddress', streetAddress: CLINIC.address.slice(0, 2).join(', '), addressLocality: 'Peshawar', addressCountry: 'PK' } },
  };

  const steps = t.story.steps.map((s, i) => `
          <li class="step">
            <p class="step-n">Step ${i + 1} of ${t.story.steps.length}</p>
            <h3>${esc(s.title)}</h3>
            <p>${esc(s.text)}</p>
          </li>`).join('');

  const types = t.options ? `
  <section class="plain tx-types" id="types" aria-labelledby="types-h">
    <div class="wrap">
      <div class="section-head">
        <h2 id="types-h">${esc(t.options.title)}</h2>
        <p>The dentist recommends what suits you after your check-up and, if needed, an X-ray.</p>
      </div>
      <ul class="tx-cards">${t.options.items.map((o, i) => `
        <li class="tx-card">
          <span class="tx-card-n">${String(i + 1).padStart(2, '0')}</span>
          <h3>${esc(o.name)}</h3>
          <p>${esc(o.text)}</p>
          <button class="btn btn-ghost btn-sm" type="button" data-book="${esc(o.book || t.id)}">Ask about this</button>
        </li>`).join('')}
      </ul>
    </div>
  </section>` : '';

  const fit = `
  <section class="plain tx-fit" id="fit" aria-label="Who it is for and aftercare">
    <div class="wrap tx-fit-grid">
      <div class="tx-panel">
        <h2>${esc(t.fit.title)}</h2>
        <ul class="ticks">${t.fit.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        ${t.fit.note ? `<p class="tx-note">${esc(t.fit.note)}</p>` : ''}
      </div>
      <div class="tx-panel">
        <h2>${esc(t.care.title)}</h2>
        <ol class="numbered">${t.care.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      </div>
    </div>
  </section>`;

  const quote = review ? `
  <section class="plain tx-review" aria-label="A patient's review">
    <div class="wrap">
      <figure class="quote">
        <blockquote><p>${esc(review.text)}</p></blockquote>
        <figcaption><strong>${esc(review.name)}</strong> <span>${esc(review.detail)}</span></figcaption>
      </figure>
    </div>
  </section>` : '';

  const related = t.related.map((id) => {
    const s = svc(id);
    if (!s) return '';
    const page = txById(id);
    return page
      ? `<li class="tx-rel"><a href="${L.page(page.slug)}"><h3>${esc(s.name)}</h3><p>${esc(s.desc)}</p><span class="tx-rel-go">Learn more</span></a></li>`
      : `<li class="tx-rel"><div><h3>${esc(s.name)}</h3><p>${esc(s.desc)}</p><button class="btn btn-ghost btn-sm" type="button" data-book="${esc(id)}">Book</button></div></li>`;
  }).join('');

  return `<!doctype html>
<html lang="en" data-root="${L.root}" data-scene="${esc(t.scene)}" data-tx="${esc(t.id)}">
<head>
${HEAD(t.seoTitle, t.description)}
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body class="tx-page">
<a class="skip" href="#how">Skip to how it works</a>

<header class="top" id="top-bar">
  <a class="brand" href="${L.home()}" aria-label="Family Dental & Aesthetic Clinic, home page">
    ${BRAND}
  </a>
  <nav class="nav" aria-label="Main">
    ${navMenu(L, t.id)}
    <a href="#how">How it works</a>
    <a href="#questions">Questions</a>
    <a href="#dentist">Your dentist</a>
    <a href="${L.home('#visit')}">Visit</a>
  </nav>
  <button class="btn btn-primary btn-sm" type="button" data-book="${esc(t.id)}">Book a visit</button>
</header>

<canvas id="gl" aria-hidden="true"></canvas>
<div id="labels" aria-hidden="true"></div>

<main>
  <section class="chapter tx-hero" id="top" data-chapter="hero" aria-labelledby="tx-h">
    <div class="tx-hero-copy">
      <nav class="crumbs" aria-label="Breadcrumb">
        <ol>
          <li><a href="${L.home()}">Home</a></li>
          <li><a href="${L.home('#treatments')}">Treatments</a></li>
          <li aria-current="page">${esc(t.name)}</li>
        </ol>
      </nav>
      <p class="eyebrow">${esc(TX_GROUPS[t.group])}</p>
      <h1 id="tx-h">${esc(t.name)}</h1>
      <p class="lede">${esc(t.lead)}</p>
      <div class="cta-row">
        <button class="btn btn-primary" type="button" data-book="${esc(t.id)}">Book a visit</button>
        <a class="btn btn-ghost" data-wa data-wa-text="${esc(waText)}">Ask on WhatsApp</a>
      </div>
      <a class="rating" data-reviews>
        <span class="stars" aria-hidden="true">★★★★★</span>
        <span><strong>${esc(CLINIC.rating)}</strong> on Google from ${esc(CLINIC.reviews)} reviews</span>
      </a>
    </div>
    <div class="hero-loader" aria-hidden="true"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17"/></svg></div>
    <p class="scroll-cue" aria-hidden="true">Scroll to see how it works</p>
  </section>

  <section class="chapter sticky" id="how" data-chapter="story" style="--len: ${esc(t.story.length)}" aria-labelledby="how-h">
    <div class="stage">
      <div class="copy">
        <h2 id="how-h">${esc(t.story.title)}</h2>
        <ol class="steps" data-steps="${t.story.marks.join(',')}">${steps}
        </ol>
        <div class="rail" aria-hidden="true">${t.story.steps.map(() => '<span></span>').join('')}</div>
        <button class="btn btn-ghost" type="button" data-book="${esc(t.id)}">Ask about ${esc(short)}</button>
      </div>
    </div>
  </section>
${types}
${fit}
${quote}
  <section class="plain dentist" id="dentist" aria-labelledby="dentist-h">
    <div class="wrap dentist-grid">
      <div class="monogram" aria-hidden="true"><span>${esc(CLINIC.dentist.initials)}</span></div>
      <div class="dentist-copy">
        <h2 id="dentist-h">${esc(CLINIC.dentist.name)}</h2>
        <p class="role">${esc(CLINIC.dentist.role)}</p>
        <p>Your treatment is planned and carried out by Dr. Tabassum, who leads the clinic on Nasir Bagh Road. She explains each step, and what it costs, before anything starts.</p>
        <div class="cta-row">
          <button class="btn btn-primary" type="button" data-book="${esc(t.id)}">Book with Dr. Tabassum</button>
          <a class="btn btn-ghost" href="${L.home('#dentist')}">About the clinic</a>
        </div>
      </div>
    </div>
  </section>

  <section class="plain faq" id="questions" aria-labelledby="faq-h">
    <div class="wrap faq-grid">
      <div class="faq-intro">
        <h2 id="faq-h">Questions about ${esc(short)}</h2>
        <p>Can't find yours? Ask the booking assistant, or message the clinic on WhatsApp.</p>
        <button class="btn btn-ghost" type="button" data-book="${esc(t.id)}">Ask a question</button>
      </div>
      <div class="faq-groups">
        <div class="faq-group">
          ${t.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n          ')}
        </div>
      </div>
    </div>
  </section>

  <section class="plain tx-cta" id="book" aria-labelledby="book-h">
    <div class="wrap">
      <div class="tx-cta-box">
        <h2 id="book-h">Talk to the clinic about ${esc(short)}</h2>
        <p>Book a check-up. The dentist examines you and explains your options, how long each takes and what it costs, before anything starts.</p>
        <div class="cta-row">
          <button class="btn btn-primary" type="button" data-book="${esc(t.id)}">Book a visit</button>
          <a class="btn btn-ghost" data-wa data-wa-text="${esc(waText)}">WhatsApp</a>
          <a class="btn btn-ghost" href="tel:+${esc(CLINIC.phoneIntl)}">Call ${esc(CLINIC.phoneDisplay)}</a>
        </div>
        <p class="tx-cta-addr">${esc(CLINIC.address.join(', '))}</p>
      </div>
    </div>
  </section>

  <section class="plain tx-related-sec" aria-labelledby="rel-h">
    <div class="wrap">
      <div class="section-head">
        <h2 id="rel-h">Related treatments</h2>
        <p><a class="link" href="${L.home('#treatments')}">See all ten treatments</a></p>
      </div>
      <ul class="tx-rels">${related}</ul>
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
  <button type="button" data-book="${esc(t.id)}">Book</button>
  <a data-wa data-wa-text="${esc(waText)}">WhatsApp</a>
  <a href="tel:+${esc(CLINIC.phoneIntl)}">Call</a>
</nav>

<script type="module" src="/src/treatment.js"></script>
</body>
</html>
`;
}

export { TREATMENTS, waLink };

import { CLINIC, SERVICES, FAQ, waLink } from '../config.js';

const TOOTH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 3.5c-2.4 0-4 1.9-4 4.6 0 2.2.9 3.6 1.6 5 .8 1.6.9 3.2 1.3 5 .3 1.5.9 2.4 1.8 2.4 1.1 0 1.4-1.3 1.7-3 .3-1.6.8-2.9 2.1-2.9s1.8 1.3 2.1 2.9c.3 1.7.6 3 1.7 3 .9 0 1.5-.9 1.8-2.4.4-1.8.5-3.4 1.3-5 .7-1.4 1.6-2.8 1.6-5 0-2.7-1.6-4.6-4-4.6-1.8 0-2.7 1-4.5 1s-2.7-1-4.5-1z"/></svg>';
const CLOSE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const WHO = ['Myself', 'My child', 'My parent', 'Someone else'];
const TIMES = ['Morning', 'Afternoon', 'Evening'];

function nextDays(n = 7) {
  const fmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const out = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : fmt.format(d);
    out.push({ label, full: i < 2 ? `${label}, ${fmt.format(d)}` : fmt.format(d) });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// Matches a free-text question to an answer. Keys match whole words or word starts.
function matchAnswer(text) {
  const s = text.toLowerCase();
  const words = s.split(/[^a-z0-9]+/).filter(Boolean);
  const hit = (k) => (k.includes(' ') ? s.includes(k) : words.some((w) => w.startsWith(k)));
  const byQ = (q) => FAQ.find((f) => f.q === q);
  const order = ['Why are prices not listed on the website?', 'What are your timings?', 'Where is the clinic?', 'Who is the dentist?',
    'Do you treat children?', 'How long does an implant take?', 'Does root canal treatment hurt?', 'Is whitening safe?'];
  for (const q of order) {
    const f = byQ(q);
    if (f && f.keys.some(hit)) return { faq: f };
  }
  const svc = SERVICES.find((x) => x.keys.some(hit));
  if (svc) return { svc };
  const booking = byQ('How do I book an appointment?');
  if (booking && booking.keys.some(hit)) return { faq: booking };
  if (/\b(hi|hello|salam|assalam|aoa)\b/.test(s)) return { hello: true };
  return null;
}

export function createBot() {
  const launch = document.createElement('button');
  launch.type = 'button';
  launch.className = 'btn btn-primary bot-launch';
  launch.setAttribute('data-book', '');
  launch.innerHTML = `${TOOTH_ICON.replace('<svg', '<svg width="18" height="18"')}<span>Book a visit</span>`;
  document.body.appendChild(launch);

  const root = document.createElement('div');
  root.className = 'bot';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-labelledby', 'bot-title');
  root.innerHTML = `
    <div class="bot-panel">
      <div class="bot-head">
        <span class="bot-avatar">${TOOTH_ICON}</span>
        <div><p class="bot-title" id="bot-title">Booking assistant</p><p class="bot-sub">The clinic confirms your time on WhatsApp</p></div>
        <button class="bot-close" type="button" aria-label="Close booking assistant">${CLOSE_ICON}</button>
      </div>
      <div class="bot-log" aria-live="polite"></div>
      <div class="bot-actions"></div>
      <form class="bot-form" hidden novalidate>
        <label class="sr-only" for="bot-input">Your answer</label>
        <input id="bot-input" type="text" autocomplete="off">
        <button type="submit">Send</button>
        <p class="bot-err" hidden></p>
      </form>
    </div>`;
  document.body.appendChild(root);

  const log = root.querySelector('.bot-log');
  const actions = root.querySelector('.bot-actions');
  const form = root.querySelector('.bot-form');
  const input = root.querySelector('#bot-input');
  const err = root.querySelector('.bot-err');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let opener = null;
  let started = false;
  let onSubmit = null;
  let data = {};
  let token = 0;

  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));

  async function say(html, delay = 420) {
    const my = token;
    const b = document.createElement('div');
    b.className = 'msg bot-msg';
    b.innerHTML = '<span class="typing" aria-label="typing"><i></i><i></i><i></i></span>';
    log.appendChild(b);
    scroll();
    await wait(delay);
    if (my !== token) { b.remove(); return false; }
    b.innerHTML = html;
    scroll();
    return true;
  }
  function me(text) {
    const b = document.createElement('div');
    b.className = 'msg me';
    b.textContent = text;
    log.appendChild(b);
    scroll();
  }
  function clearActions() { actions.innerHTML = ''; form.hidden = true; onSubmit = null; err.hidden = true; }
  function chips(list) {
    clearActions();
    for (const c of list) {
      const el = document.createElement(c.href ? 'a' : 'button');
      el.className = `chip${c.primary ? ' primary' : ''}`;
      el.textContent = c.label;
      if (c.href) { el.href = c.href; el.target = '_blank'; el.rel = 'noopener'; el.addEventListener('click', () => c.onClick?.()); }
      else { el.type = 'button'; el.addEventListener('click', () => { if (c.echo !== false) me(c.label); c.onClick(); }); }
      actions.appendChild(el);
    }
    const first = actions.querySelector('.chip');
    if (first && !root.hidden) first.focus({ preventScroll: true });
  }
  function ask({ placeholder, type = 'text', inputmode, validate, skip }) {
    clearActions();
    if (skip) chips([{ label: skip.label, onClick: skip.onClick }]);
    form.hidden = false;
    input.value = '';
    input.type = type;
    input.placeholder = placeholder || '';
    if (inputmode) input.setAttribute('inputmode', inputmode); else input.removeAttribute('inputmode');
    onSubmit = (val) => {
      const problem = validate ? validate(val) : null;
      if (problem) { err.textContent = problem; err.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); return false; }
      return true;
    };
    setTimeout(() => input.focus({ preventScroll: true }), 50);
    return new Promise((resolve) => { form._resolve = resolve; });
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = input.value.trim();
    if (!onSubmit || !onSubmit(val)) return;
    input.removeAttribute('aria-invalid');
    me(val);
    const r = form._resolve;
    clearActions();
    r?.(val);
  });
  input.addEventListener('input', () => { err.hidden = true; input.removeAttribute('aria-invalid'); });

  // ---------------------------------------------------------------- flows
  async function home(greet = true) {
    token++;
    clearActions();
    if (greet) {
      if (!(await say(`Assalam o Alaikum. I can book your visit to ${esc(CLINIC.name)} in about a minute, or answer a quick question.`, 500))) return;
    } else if (!(await say('What would you like to do next?', 300))) return;
    chips([
      { label: 'Book an appointment', primary: true, onClick: () => book() },
      { label: 'Ask a question', onClick: () => questions() },
      { label: 'Chat on WhatsApp', href: waLink('Assalam o Alaikum, I would like to ask about an appointment.') },
    ]);
  }

  async function book(serviceId) {
    token++;
    data = {};
    const svc = SERVICES.find((s) => s.id === serviceId);
    if (svc) {
      data.treatment = svc.name;
      if (!(await say(`Let's book a visit for <strong>${esc(svc.name.toLowerCase())}</strong>.`, 350))) return;
      return askWho();
    }
    if (!(await say('Which treatment is this for?'))) return;
    chips([
      ...SERVICES.map((s) => ({ label: s.name, onClick: () => { data.treatment = s.name; askWho(); } })),
      { label: 'Not sure, I need a check-up', onClick: () => { data.treatment = 'Check-up / consultation'; askWho(); } },
    ]);
  }
  async function askWho() {
    if (!(await say('Who is the appointment for?'))) return;
    chips(WHO.map((w) => ({ label: w, onClick: () => { data.who = w; askDay(); } })));
  }
  async function askDay() {
    if (!(await say('Which day suits you best?'))) return;
    chips(nextDays(7).map((d) => ({ label: d.label, onClick: () => { data.day = d.full; askTime(); } })));
  }
  async function askTime() {
    if (!(await say('And what time of day?'))) return;
    chips(TIMES.map((t) => ({ label: t, onClick: () => { data.time = t; askName(); } })));
  }
  async function askName() {
    const whose = data.who === 'Myself' ? 'your name' : "the patient's name";
    if (!(await say(`What's ${whose}?`))) return;
    data.name = await ask({ placeholder: 'Full name', validate: (v) => (v.replace(/[^\p{L}]/gu, '').length < 2 ? "Enter the patient's name, at least two letters." : null) });
    askPhone();
  }
  async function askPhone() {
    if (!(await say('Which phone number should the clinic use to confirm?'))) return;
    data.phone = await ask({
      placeholder: '0300 1234567', type: 'tel', inputmode: 'tel',
      validate: (v) => (/^\+?\d{7,15}$/.test(v.replace(/[\s().-]/g, '')) ? null : 'Enter a phone number with 7 to 15 digits, for example 0300 1234567.'),
    });
    askNotes();
  }
  async function askNotes() {
    if (!(await say('Anything the dentist should know, like pain or swelling? This is optional.'))) return;
    const v = await ask({
      placeholder: 'For example: pain on the lower left side',
      skip: { label: 'Skip', onClick: () => { const r = form._resolve; clearActions(); r?.(''); } },
    });
    data.notes = v;
    summary();
  }
  function message() {
    const lines = [
      '*Appointment request from the website*',
      `Treatment: ${data.treatment}`,
      `Patient: ${data.name}${data.who && data.who !== 'Myself' ? ` (${data.who.toLowerCase()})` : ''}`,
      `Preferred: ${data.day}, ${data.time.toLowerCase()}`,
      `Phone: ${data.phone}`,
    ];
    if (data.notes) lines.push(`Notes: ${data.notes}`);
    return lines.join('\n');
  }
  async function summary() {
    if (!(await say("Here's your request. Send it to the clinic on WhatsApp and they'll confirm an exact time."))) return;
    const card = document.createElement('div');
    card.className = 'summary';
    const rows = [['Treatment', data.treatment], ['Patient', `${data.name}${data.who !== 'Myself' ? ` (${data.who.toLowerCase()})` : ''}`], ['Day', data.day], ['Time', data.time], ['Phone', data.phone]];
    if (data.notes) rows.push(['Notes', data.notes]);
    card.innerHTML = `<dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
    log.appendChild(card);
    scroll();
    const text = message();
    chips([
      { label: 'Send on WhatsApp', primary: true, href: waLink(text), onClick: () => sent() },
      { label: 'Copy details', echo: false, onClick: () => copyText(text) },
      { label: 'Start again', onClick: () => book() },
    ]);
  }
  async function sent() {
    token++;
    await say(`WhatsApp should open with your request ready. Press send there to reach the clinic. If it didn't open, message ${esc(CLINIC.phoneDisplay)} with the details above.`, 600);
    chips([{ label: 'Book another visit', onClick: () => book() }, { label: 'Ask a question', onClick: () => questions() }]);
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); await say('Copied. You can paste it into WhatsApp or an SMS.', 200); }
    catch { await say(`Copy didn't work here. Select the details above, or send them to ${esc(CLINIC.phoneDisplay)}.`, 200); }
    const t = message();
    chips([{ label: 'Send on WhatsApp', primary: true, href: waLink(t), onClick: () => sent() }, { label: 'Start again', onClick: () => book() }]);
  }

  async function questions() {
    token++;
    if (!(await say('Pick a common question, or type your own.'))) return;
    freeAsk();
  }
  function freeAsk() {
    clearActions();
    for (const f of FAQ) {
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'chip'; el.textContent = f.q;
      el.addEventListener('click', () => { me(f.q); reply({ faq: f }); });
      actions.appendChild(el);
    }
    form.hidden = false;
    input.type = 'text'; input.value = ''; input.placeholder = 'Type a question'; input.removeAttribute('inputmode');
    onSubmit = (v) => (v.length < 2 ? (err.textContent = 'Type a question first.', err.hidden = false, false) : true);
    form._resolve = (v) => reply(matchAnswer(v));
  }
  async function reply(m) {
    token++;
    if (!m) {
      if (!(await say("I'm not sure about that one. The clinic team can answer it on WhatsApp."))) return;
      chips([
        { label: 'Ask on WhatsApp', primary: true, href: waLink('Assalam o Alaikum, I have a question:') },
        { label: 'Book an appointment', onClick: () => book() },
        { label: 'Another question', onClick: () => freeAsk() },
      ]);
      return;
    }
    if (m.hello) { home(true); return; }
    if (m.faq) {
      const link = m.faq.link ? ` <a href="${m.faq.link.href}" target="_blank" rel="noopener">${esc(m.faq.link.label)}</a>` : '';
      if (!(await say(esc(m.faq.a) + link, 550))) return;
      chips([{ label: 'Book an appointment', primary: true, onClick: () => book() }, { label: 'Another question', onClick: () => freeAsk() }]);
      return;
    }
    if (m.svc) {
      if (!(await say(`${esc(m.svc.name)}: ${esc(m.svc.desc)} The dentist will advise whether it suits you after a check-up.`, 550))) return;
      chips([{ label: `Book ${m.svc.short.toLowerCase()}`, primary: true, onClick: () => book(m.svc.id) }, { label: 'Another question', onClick: () => freeAsk() }]);
    }
  }

  // ---------------------------------------------------------------- open / close
  function open(serviceId) {
    opener = document.activeElement;
    root.hidden = false;
    launch.hidden = true;
    if (serviceId) { if (!started) log.innerHTML = ''; started = true; book(serviceId); }
    else if (!started) { started = true; home(true); }
    else { const f = actions.querySelector('.chip') || (!form.hidden && input); f?.focus({ preventScroll: true }); }
  }
  function close() {
    root.hidden = true;
    launch.hidden = false;
    opener?.focus?.({ preventScroll: true });
  }
  root.querySelector('.bot-close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) close(); });
  return { open, close, root };
}

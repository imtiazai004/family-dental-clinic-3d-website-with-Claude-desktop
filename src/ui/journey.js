// First-visit media inside the wheel's arch: one item per step.
// Step 1 plays a short example of booking (assistant on this page, then WhatsApp);
// a step video plays only while its step is showing.

function makeDemo(root, reduce) {
  const site = root.querySelector('.demo-site');
  const wa = root.querySelector('.demo-wa');
  const sb = [...site.querySelectorAll('.b')];
  const wb = [...wa.querySelectorAll('.b')];
  const chips = site.querySelector('.chips');
  const send = site.querySelector('.send');
  const show = (b) => b && b.classList.add('in');
  const scene = (k) => { site.classList.toggle('on', k === 0); wa.classList.toggle('on', k === 1); };
  const T = [
    [300, () => show(sb[0])], [1000, () => show(sb[1])], [1900, () => chips.classList.add('picked')],
    [2400, () => show(sb[2])], [3200, () => show(sb[3])], [4000, () => show(sb[4])],
    [4800, () => show(sb[5])], [5600, () => show(sb[6])], [6400, () => show(sb[7])],
    [7300, () => send.classList.add('tap')], [7900, () => scene(1)],
    [8500, () => show(wb[0])], [9700, () => show(wb[1])], [10900, () => show(wb[2])], [11800, () => show(wb[3])],
    [14800, () => run()],
  ];
  let timers = [];
  function clear() {
    timers.forEach(clearTimeout);
    timers = [];
    for (const b of [...sb, ...wb]) b.classList.remove('in');
    chips.classList.remove('picked');
    send.classList.remove('tap');
    scene(0);
  }
  function run() { clear(); for (const [t, f] of T) timers.push(setTimeout(f, t)); }
  // Resting state: the finished conversation on the website.
  function still() { clear(); sb.forEach(show); chips.classList.add('picked'); }
  still();
  return { start() { if (reduce) still(); else run(); }, stop: still };
}

export function createJourneyMedia({ reduce }) {
  const items = [...document.querySelectorAll('.jm')];
  if (!items.length) return { update() {} };
  const demoEl = document.querySelector('.demo');
  const demo = demoEl ? makeDemo(demoEl, reduce) : null;
  const video = document.querySelector('.jm video');
  const sound = document.querySelector('.jm-sound');
  const videoStep = video ? +video.closest('.jm').dataset.i : -1;
  const demoStep = demoEl ? +demoEl.closest('.jm').dataset.i : -1;

  sound?.addEventListener('click', () => {
    const turnOn = video.muted;
    video.muted = !turnOn;
    sound.setAttribute('aria-pressed', String(turnOn));
    sound.setAttribute('aria-label', turnOn ? 'Turn sound off' : 'Turn sound on');
    if (turnOn) video.play().catch(() => {});
  });

  let shown = -2, playing = -2;
  return {
    // active: current step index; live: the section is on screen.
    update(active, live) {
      if (active !== shown) {
        shown = active;
        items.forEach((m, k) => m.classList.toggle('on', k === active));
      }
      const want = live ? active : -1;
      if (want === playing) return;
      playing = want;
      if (demo) (want === demoStep ? demo.start : demo.stop)();
      if (video) {
        if (want === videoStep) video.play().catch(() => {});
        else video.pause();
      }
    },
  };
}

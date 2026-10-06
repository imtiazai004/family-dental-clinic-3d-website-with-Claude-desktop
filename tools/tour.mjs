// Scrolls through the page and screenshots key moments.
import { chromium } from 'playwright';
const [url, prefix, w = 1440, h = 900, only = ''] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto(url + (url.includes("?") ? "&" : "?") + "snap", { waitUntil: "load" });
try { await page.waitForFunction(() => document.documentElement.classList.contains('loaded') || document.documentElement.classList.contains('no-gl'), null, { timeout: 60000 }); } catch { logs.push('not loaded'); }
const shots = [
  ['hero', 0, 0],
  ['anatomy', 'anatomy', 0.15], ['anatomy2', 'anatomy', 0.7],
  ['gen1', 'family', 0.1], ['gen3', 'family', 0.65],
  ['imp1', 'implant', 0.05], ['imp2', 'implant', 0.5], ['imp3', 'implant', 0.95],
  ['rct1', 'rct', 0.12], ['rct2', 'rct', 0.38], ['rct3', 'rct', 0.68],
  ['crown', 'restore', 0.3], ['veneer', 'restore', 0.9],
  ['braces', 'studio', 0.12], ['white', 'studio', 0.55], ['denture', 'studio', 0.95],
  ['promise', 'promise', 0.6], ['dentist', 'dentist', 0], ['journey1', 'first-visit', 0.1], ['journey3', 'first-visit', 0.6],
  ['treat', 'treatments', -0.05], ['reviews', 'reviews', 0], ['faq', 'faq', 0], ['visit', 'visit', 0],
];
for (const [name, id, f] of shots) {
  if (only && !only.split(',').includes(name)) continue;
  await page.evaluate(([id, f]) => {
    if (id === 0) return window.scrollTo(0, 0);
    const el = document.getElementById(id);
    const top = el.getBoundingClientRect().top + scrollY;
    const span = el.classList.contains('sticky') ? el.offsetHeight - innerHeight : 0;
    window.scrollTo(0, top + span * f + (span ? 0 : f * innerHeight));
  }, [id, f]);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${prefix}-${name}.png` });
}
console.log(logs.slice(0, 15).join('\n') || 'no errors');
await browser.close();

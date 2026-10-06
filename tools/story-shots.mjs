// Screenshots of a treatment page: hero, the story steps, the type cards and each opened card.
// usage: node tools/story-shots.mjs <base> <slug> <prefix> [w] [h] [only]
import { chromium } from 'playwright';
const [base, slug, prefix, w = 1440, h = 900, only = ''] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto(`${base}/treatments/${slug}/?snap`, { waitUntil: 'load' });
try { await page.waitForFunction(() => document.documentElement.classList.contains('loaded') || document.documentElement.classList.contains('no-gl'), null, { timeout: 60000 }); } catch { logs.push('not loaded'); }
await page.waitForTimeout(1500);
const go = (id, f) => page.evaluate(([id, f]) => {
  const el = document.getElementById(id);
  const top = el.getBoundingClientRect().top + scrollY;
  const span = el.classList.contains('sticky') ? el.offsetHeight - innerHeight : 0;
  window.scrollTo(0, top + (span ? span * f : f * innerHeight));
}, [id, f]);
const n = await page.evaluate(() => document.querySelectorAll('#how .step').length);
const shots = [['hero', 'top', 0]];
for (let i = 0; i < n; i++) { shots.push([`s${i + 1}`, 'how', (i + 0.45) / n], [`s${i + 1}b`, 'how', (i + 0.85) / n]); }
shots.push(['types', 'types', -0.1]);
for (const [name, id, f] of shots) {
  if (only && !only.split(',').includes(name)) continue;
  await go(id, f);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${prefix}-${name}.png` });
}
if (!only || only.includes('panel')) {
  await go('types', -0.1);
  await page.waitForTimeout(2500);
  const cards = await page.$$('.xcard-open');
  for (const [i, c] of cards.entries()) {
    if (only && !only.includes('panel')) break;
    await c.click();
    await page.waitForTimeout(2600);
    await page.screenshot({ path: `${prefix}-panel${i + 1}.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1200);
  }
}
console.log(logs.filter((l) => !/TUNNEL|fonts/.test(l)).slice(0, 12).join('\n') || 'no errors');
await browser.close();

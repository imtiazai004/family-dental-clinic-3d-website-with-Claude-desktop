// Screenshots of the implant page: hero, the seven story steps, the type cards and an open card.
import { chromium } from 'playwright';
const [base, prefix, w = 1440, h = 900, only = ''] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto(`${base}/treatments/dental-implants/?snap`, { waitUntil: 'load' });
try { await page.waitForFunction(() => document.documentElement.classList.contains('loaded') || document.documentElement.classList.contains('no-gl'), null, { timeout: 60000 }); } catch { logs.push('not loaded'); }
await page.waitForTimeout(1500);
const go = (id, f) => page.evaluate(([id, f]) => {
  const el = document.getElementById(id);
  const top = el.getBoundingClientRect().top + scrollY;
  const span = el.classList.contains('sticky') ? el.offsetHeight - innerHeight : 0;
  window.scrollTo(0, top + (span ? span * f : f * innerHeight));
}, [id, f]);
const shots = [['hero', 'top', 0], ['s1', 'how', 0.6 / 7], ['s1b', 'how', 0.9 / 7], ['s2', 'how', 1.7 / 7], ['s3', 'how', 2.55 / 7], ['s3b', 'how', 2.9 / 7], ['s4', 'how', 3.5 / 7], ['s5', 'how', 4.6 / 7], ['s6', 'how', 5.3 / 7], ['s6b', 'how', 5.9 / 7], ['s7', 'how', 6.3 / 7], ['s7b', 'how', 6.85 / 7], ['types', 'types', -0.1]];
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

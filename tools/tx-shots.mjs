// Screenshots of a treatment page: hero, story steps and the plain sections below.
import { chromium } from 'playwright';
const [base, slug, prefix, w = 1440, h = 900, only = ''] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto(`${base}/treatments/${slug}/?snap`, { waitUntil: 'load' });
try { await page.waitForFunction(() => document.documentElement.classList.contains('loaded') || document.documentElement.classList.contains('no-gl'), null, { timeout: 60000 }); } catch { logs.push('not loaded'); }
const shots = [['hero', 'top', 0], ['how1', 'how', 0.05], ['how2', 'how', 0.45], ['how3', 'how', 0.97], ['types', 'types', -0.1], ['fit', 'fit', -0.05], ['dentist', 'dentist', -0.1], ['faq', 'questions', -0.05], ['cta', 'book', -0.15]];
for (const [name, id, f] of shots) {
  if (only && !only.split(',').includes(name)) continue;
  const ok = await page.evaluate(([id, f]) => {
    const el = document.getElementById(id);
    if (!el) return false;
    const top = el.getBoundingClientRect().top + scrollY;
    const span = el.classList.contains('sticky') ? el.offsetHeight - innerHeight : 0;
    window.scrollTo(0, top + (span ? span * f : f * innerHeight));
    return true;
  }, [id, f]);
  if (!ok) continue;
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${prefix}-${name}.png` });
}
console.log(logs.filter((l) => !/TUNNEL|fonts/.test(l)).slice(0, 10).join('\n') || 'no errors');
await browser.close();

import { chromium } from 'playwright';
const [url, out, w = 1400, h = 900, wait = 'done'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', m => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', e => logs.push('pageerror: ' + e.message));
await page.goto(url);
try { await page.waitForFunction((t) => document.title === t, wait, { timeout: 60000 }); } catch (e) { logs.push('timeout waiting'); }
await page.screenshot({ path: out });
console.log(logs.slice(0, 20).join('\n'));
await browser.close();

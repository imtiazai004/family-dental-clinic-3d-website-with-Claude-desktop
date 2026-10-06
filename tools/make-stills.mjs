// Renders the card images for the treatments page from each treatment's 3D story.
// usage: (build and start the preview server first) node tools/make-stills.mjs [base-url]
// Writes public/media/tx/<slug>-a.webp and <slug>-b.webp; rebuild afterwards to include them.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const base = process.argv[2] || 'http://127.0.0.1:4173';
const out = resolve('public/media/tx');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/treatments/?make-stills&snap`);
await page.waitForFunction(() => window.__stills, null, { timeout: 300000 });
const stills = await page.evaluate(() => window.__stills);
for (const [slug, shots] of Object.entries(stills)) {
  for (const [k, url] of Object.entries(shots)) {
    const buf = Buffer.from(url.split(',')[1], 'base64');
    writeFileSync(resolve(out, `${slug}-${k}.webp`), buf);
    console.log(`${slug}-${k}.webp`, Math.round(buf.length / 1024), 'KB');
  }
}
if (errs.length) console.log('page errors:', errs.join('\n'));
await browser.close();

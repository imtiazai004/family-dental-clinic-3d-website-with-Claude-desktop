# Family Dental & Aesthetic Clinic — website

Immersive 3D scroll site with a booking assistant. English only, no prices.

## Run it

```bash
npm install
npm run dev        # local dev server
npm run build      # production build in dist/
npm run preview    # serve dist/ locally
```

Upload the contents of `dist/` to any static host (Cloudflare Pages, Netlify, Vercel, or cPanel `public_html`).

## Where things live

| What | File |
|---|---|
| Clinic name, phone, address, services, FAQ, age groups | `src/config.js` |
| Page copy and section order | `index.html` |
| Colours, fonts, layout | `src/styles.css` |
| 3D scenes and scroll choreography | `src/three/scenes.js` |
| Materials (enamel, gum, cut-away shader, root canal shader) | `src/three/materials.js` |
| Implant, abutment, file, brackets, gum arch, palate (generated in code) | `src/three/procedural.js` |
| Renderer, lights, device tiers, phone/desktop framing | `src/three/stage.js` |
| Booking assistant | `src/ui/bot.js` |
| Sculpted teeth, bone and gum (generated, ~0.5 MB GLB) | `tools/build-models.mjs` → `public/models/teeth.glb` |

The treatment list and age panels are rendered into static HTML at build time from `src/config.js` (see `vite.config.js`), so they are crawlable.

## The two 3D looks (and how to go back)

- **Gloss** (default now): bright white glossy teeth, candy-pink gums, chrome implant parts, sparkles, a glow under each object and a smiling milk tooth in the Children panel.
- **Natural** (version 3): anatomical colours, exactly as before.

To switch:

- Quick look in a browser: add `#look-natural` or `#look-gloss` to the end of the page address.
- Permanently: in `src/config.js` set `LOOK = 'natural'` (or `'gloss'`), then `npm run build`.
- Review build with an on-screen switch: `VITE_REVIEW=1 npm run build`.
- Teeth colour and object size of the gloss look: `TUNE` in `src/config.js`. Version 4.1 uses `size: 1.14, teeth: '#f5f1e9'`; version 4 was `size: 1, teeth: '#ffffff'`.
- Full return to an earlier version: `git checkout v3-natural`, `git checkout v4-gloss` or `git checkout v4.1-gloss`. The zips `family-dental-website-v3-natural.zip` and `family-dental-website-v4-gloss.zip` are second backups.

## Treatment pages

Each treatment with its own page lives in `src/treatments.js` (intro, 3D story steps, types, who it is for, aftercare, FAQ, related treatments). The build turns every entry into `treatments/<slug>/index.html` using one template (`tools/treatment-page.mjs`), and adds it to the treatments page and the home page. To add a page: add an entry, then `npm run build`.

- The home page's Treatments section uses the same picture cards as the treatments page (`renderHomeTreatments()` in `tools/treatment-hub.mjs`), ending with a "Not sure which one you need?" tile whose choices open the treatments page already filtered (`treatments/#pain`, `#missing`, `#smile`). Its heading "Treatments" is a link to the treatments page. On phones the cards are a sideways row with dots.

- All ten pages have their own deeper 3D story (`story3d`), one module per treatment in `src/three/stories/` (registry in `stories/index.js`, shared helpers in `stories/core.js`). Each story is a set of steps on scroll; `K` holds the camera framing per step.
- The type cards ("Types of …") explode into their parts when opened. Their models are in `src/three/types/` (`buildTypeModel(kit, key)` in `types/index.js`); the card's `model` key in `treatments.js` picks one.
- Shared pieces: `src/three/arch.js` (upper arch of teeth), `src/three/shells.js` (veneer/gel shells and surface patches cast from the tooth models), `src/three/partial-kit.js` (partial denture framework, clasps, saddles).
- The treatments page (`treatments/index.html`) is built by `tools/treatment-hub.mjs` from `HUB` in `src/treatments.js`; the header's "Treatments" is a plain link to it. Its card images come from each page's 3D story: `node tools/make-stills.mjs` (with the preview server running) writes `public/media/tx/<slug>-a.webp` and `-b.webp` (shown on hover); `HUB.thumbs` picks the story moments and framing. Rebuild afterwards.
- The treatments page hero is a 3D ring of all ten treatments (`src/three/hub-ring.js`, models picked by `HUB.heroModels`). It turns by itself; visitors can drag or swipe it (it settles on the nearest of ten stops, 36° apart), use the arrows, a sideways trackpad swipe or the arrow keys, and click or tap any model to open that treatment's page. The page-side handling is in `src/hub.js` (the `.ring-zone` layer over the canvas catches drags and clicks).
- `scene` is only a fallback: a home-page chapter used if a page has no story of its own.
- For hosts that do not open folder addresses (like `treatments/braces/`), build with `LINKS_EXPLICIT=1` so links point to `index.html` directly.
- Items marked `confirm: true` need the clinic's confirmation before launch.

## The 3D models

Every tooth is generated from signed-distance functions (`tools/sdf.mjs`), meshed with surface nets (`tools/mesher.mjs`), simplified and compressed with meshoptimizer into one GLB. To change a shape, edit `tools/build-models.mjs` and run `npm run models`. The GLB opens in Blender if you want to sculpt further.

## Booking assistant

Guided flow: treatment → who → day → time → name → phone → notes → summary. It ends by opening WhatsApp to +92 333 9202134 with the request pre-filled; the clinic confirms the exact time. No backend, no cost. It also answers common questions (pain, implant timeline, whitening safety, children, location, timings, cost policy) by keyword.

Phase 2 options: real time slots (Google Calendar or Cal.com), WhatsApp Business API confirmations, AI answers through a small serverless function.

## Testing helpers

- `node tools/tour.mjs <url> <prefix> <width> <height>` screenshots every scroll scene (needs Playwright).
- `node tools/bot-test.mjs <width> <height> <prefix>` runs the booking flow.
- Append `?snap` to the URL to disable easing (useful for screenshots).

## Before launch, get from the clinic

- Logo as SVG, doctors' names, qualifications and PMDC numbers, photos
- Opening hours (currently "Call or WhatsApp for today's timings")
- Approval of all medical copy
- Domain name

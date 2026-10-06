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

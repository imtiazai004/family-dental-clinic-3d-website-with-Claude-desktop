import { createStage, computeLayout } from '../three/stage.js';
import { createKit } from '../three/kit.js';
import { STORIES } from '../three/stories/index.js';

// Renders still images of each treatment's 3D story at chosen moments, for the cards on the
// treatments page. Used only by tools/make-stills.mjs (page opened with ?make-stills); the page
// itself shows the saved images. jobs: [{ slug, story, a, b, zoom?, x?, y? }] (a, b = story progress).
export async function makeStills({ gltf, look, tune, jobs, w = 960, h = 720 }) {
  const holder = document.createElement('div');
  holder.style.cssText = `position:fixed;left:-${w + 80}px;top:0;width:${w}px;height:${h}px;`;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `display:block;width:${w}px;height:${h}px;`;
  holder.appendChild(canvas);
  document.body.appendChild(holder);
  const stage = createStage(canvas, 2, look);
  stage.tune = tune;
  stage.resize(true);
  const kit = createKit(gltf, stage);
  const still = { x: 0, y: 0 };
  const out = {};
  for (const job of jobs) {
    const mod = await STORIES[job.story]();
    const story = mod.build(kit);
    stage.scene.add(story.group);
    if (stage.shadows) story.group.traverse((o) => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
    const L = computeLayout(stage.view, tune.size || 1)[story.layout || 'wide'];
    story.group.scale.setScalar(L.s * (job.zoom || 1));
    story.group.position.set(job.x || 0, L.y + (job.y || 0), 0);
    stage.fitShadow?.(0, 0);
    const shots = {};
    for (const k of ['a', 'b']) {
      // Twice, so anything that reads world matrices during update (cut-away planes) is in step.
      for (let i = 0; i < 2; i++) {
        story.update(job[k], 3, still, 0);
        stage.renderer.render(stage.scene, stage.camera);
      }
      shots[k] = canvas.toDataURL('image/webp', 0.88);
    }
    stage.scene.remove(story.group);
    out[job.slug] = shots;
    await new Promise((r) => setTimeout(r, 0));
  }
  holder.remove();
  return out;
}

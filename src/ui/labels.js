import * as THREE from 'three';

// HTML labels pinned to points on 3D objects.
export function createLabels(layer, defs) {
  const v = new THREE.Vector3();
  const items = defs.map((d) => {
    const el = document.createElement('div');
    el.className = 'lbl';
    // text may be a function, for labels whose wording changes (it is re-read every frame).
    const text = typeof d.text === 'function' ? d.text() : d.text;
    el.innerHTML = `<i></i><b>${text}</b>`;
    layer.appendChild(el);
    return { ...d, el, b: el.querySelector('b'), last: text, shown: -1, w: 0, flip: false };
  });
  return {
    update(camera, view, opacity) {
      for (const it of items) {
        const o = opacity(it.group);
        if (o < 0.01) {
          if (it.shown !== 0) { it.el.style.opacity = '0'; it.shown = 0; }
          continue;
        }
        if (typeof it.text === 'function') {
          const now = it.text();
          if (now !== it.last) { it.b.textContent = now; it.last = now; it.w = 0; }
        }
        it.anchor.obj.localToWorld(v.copy(it.anchor.p));
        v.project(camera);
        const ax = (v.x * 0.5 + 0.5) * view.w;
        const y = (-v.y * 0.5 + 0.5) * view.h - 12;
        // A label that would run off the right edge sits to the left of its dot instead.
        if (!it.w) it.w = it.el.offsetWidth;
        const flip = ax - 4.5 + it.w > view.w - 6 && ax - it.w > 6;
        if (flip !== it.flip) { it.el.classList.toggle('flip', flip); it.flip = flip; }
        const x = flip ? ax + 4.5 - it.w : ax - 4.5;
        it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        it.el.style.opacity = o.toFixed(3);
        it.shown = 1;
      }
    },
  };
}

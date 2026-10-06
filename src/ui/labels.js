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
    return { ...d, el, b: el.querySelector('b'), last: text, shown: -1, nw: 0, w: 0, h: 24, maxW: 0, flip: false };
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
          if (now !== it.last) { it.b.textContent = now; it.last = now; it.nw = 0; }
        }
        it.anchor.obj.localToWorld(v.copy(it.anchor.p));
        v.project(camera);
        const ax = (v.x * 0.5 + 0.5) * view.w;
        // A label that would run off the right edge sits to the left of its dot instead;
        // if it fits on neither side (small screens), it wraps onto two lines on the roomier side.
        if (!it.nw) {
          it.el.style.maxWidth = '';
          it.el.classList.remove('wrap');
          it.nw = it.w = it.el.offsetWidth;
          it.h = it.el.offsetHeight || 24;
          it.maxW = 0;
        }
        const right = view.w - 6 - (ax - 4.5), left = ax + 4.5 - 6;
        let flip = false, maxW = 0;
        if (it.nw > right) {
          if (it.nw <= left) flip = true;
          else { flip = left > right; maxW = Math.max(96, Math.floor((flip ? left : right) - 17)); }
        }
        if (maxW !== it.maxW && (!maxW || !it.maxW || Math.abs(maxW - it.maxW) > 6)) {
          it.maxW = maxW;
          it.el.style.maxWidth = maxW ? `${maxW + 17}px` : '';
          it.el.classList.toggle('wrap', !!maxW);
          it.w = it.el.offsetWidth;
          it.h = it.el.offsetHeight || 24;
        }
        if (flip !== it.flip) { it.el.classList.toggle('flip', flip); it.flip = flip; }
        const w = it.maxW ? it.w : it.nw;
        const x = flip ? ax + 4.5 - w : ax - 4.5;
        const y = (-v.y * 0.5 + 0.5) * view.h - it.h / 2;
        it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        it.el.style.opacity = o.toFixed(3);
        it.shown = 1;
      }
    },
  };
}

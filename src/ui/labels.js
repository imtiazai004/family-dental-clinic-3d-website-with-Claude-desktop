import * as THREE from 'three';

// HTML labels pinned to points on 3D objects.
export function createLabels(layer, defs) {
  const v = new THREE.Vector3();
  const items = defs.map((d) => {
    const el = document.createElement('div');
    el.className = 'lbl';
    el.innerHTML = `<i></i><b>${d.text}</b>`;
    layer.appendChild(el);
    return { ...d, el, shown: -1 };
  });
  return {
    update(camera, view, opacity) {
      for (const it of items) {
        const o = opacity(it.group);
        if (o < 0.01) {
          if (it.shown !== 0) { it.el.style.opacity = '0'; it.shown = 0; }
          continue;
        }
        it.anchor.obj.localToWorld(v.copy(it.anchor.p));
        v.project(camera);
        const x = (v.x * 0.5 + 0.5) * view.w - 4.5;
        const y = (-v.y * 0.5 + 0.5) * view.h - 12;
        it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        it.el.style.opacity = o.toFixed(3);
        it.shown = 1;
      }
    },
  };
}

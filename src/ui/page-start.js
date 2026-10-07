// Imported first by every page. A newly opened page always starts at the top, even if the page
// before it was scrolled down: some hosts (for example a page shown inside a frame) keep the old
// scroll position, and browsers restore it on reload. Links to a section (index.html#visit) still
// go to that section, and nothing is forced once the visitor has started scrolling themselves.

try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch { /* not allowed here */ }

let moved = false;
const mark = () => { moved = true; };
for (const ev of ['wheel', 'touchmove', 'keydown', 'pointerdown']) addEventListener(ev, mark, { passive: true, capture: true });

export function toTop() {
  if (moved || location.hash.length > 1) return;
  const el = document.scrollingElement || document.documentElement;
  if (window.scrollX || window.scrollY || el.scrollTop) window.scrollTo(0, 0);
  if (el.scrollTop) el.scrollTop = 0;
  if (document.body && document.body.scrollTop) document.body.scrollTop = 0;
}
toTop();
document.addEventListener('DOMContentLoaded', toTop, { once: true });
addEventListener('load', () => {
  toTop();
  // Once more after the first frames, in case the host or the browser moves the page after load.
  requestAnimationFrame(() => requestAnimationFrame(toTop));
  setTimeout(toTop, 250);
}, { once: true });
addEventListener('pageshow', (e) => { if (!e.persisted) toTop(); });

// Opening another page of the site: its HTML is fetched as soon as the pointer rests on the link
// (or a finger touches it), so the page is already on its way when the click lands. The scripts,
// styles and 3D model it needs are shared with this page and already cached.
const fetched = new Set([location.pathname]);
function prefetch(e) {
  const a = e.target.closest?.('a[href]');
  if (!a || a.target === '_blank' || a.hasAttribute('download') || navigator.connection?.saveData) return;
  try {
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin || fetched.has(u.pathname) || !/(\/|\.html)$/.test(u.pathname)) return;
    fetched.add(u.pathname);
    const l = document.createElement('link');
    l.rel = 'prefetch';
    l.href = u.pathname;
    document.head.appendChild(l);
  } catch { /* not a normal link */ }
}
addEventListener('pointerover', prefetch, { passive: true });
addEventListener('touchstart', prefetch, { passive: true });
addEventListener('focusin', prefetch, { passive: true });

// If a host swaps pages inside the same window, the previous page's smooth scrolling and animation
// loops must stop, or two of them would fight over the scroll position.
const PAGE = {};
window.__fdPage = PAGE;
export const isCurrentPage = () => window.__fdPage === PAGE;
export function adoptLenis(lenis) {
  try { if (window.__fdLenis && window.__fdLenis !== lenis) window.__fdLenis.destroy(); } catch { /* already gone */ }
  window.__fdLenis = lenis || null;
  if (lenis && !moved && location.hash.length <= 1) lenis.scrollTo(0, { immediate: true, force: true });
}

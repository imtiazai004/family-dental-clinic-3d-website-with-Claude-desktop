// "Treatments" dropdown in the header: opens on hover (mouse), click or keyboard; closes on Escape or outside click.
export function initNavMenu() {
  for (const dd of document.querySelectorAll('.nav-dd')) {
    const btn = dd.querySelector('.nav-dd-btn');
    const set = (open) => {
      dd.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    };
    // With a mouse, hovering already opens the menu, so a click keeps it open rather than closing it.
    btn.addEventListener('click', () => {
      const open = dd.classList.contains('open');
      set(matchMedia('(hover: hover)').matches ? true : !open);
    });
    dd.addEventListener('mouseenter', () => { if (matchMedia('(hover: hover)').matches) set(true); });
    dd.addEventListener('mouseleave', () => { if (matchMedia('(hover: hover)').matches) set(false); });
    dd.addEventListener('keydown', (e) => { if (e.key === 'Escape') { set(false); btn.focus(); } });
    dd.addEventListener('focusout', (e) => { if (!dd.contains(e.relatedTarget)) set(false); });
    document.addEventListener('click', (e) => { if (!dd.contains(e.target)) set(false); });
    for (const a of dd.querySelectorAll('.nav-menu a')) a.addEventListener('click', () => set(false));
  }
}

(() => {
  'use strict';
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.site-nav');
  const backdrop = document.querySelector('.menu-backdrop');
  const close = document.querySelector('.menu-close');
  const mobile = window.matchMedia('(max-width: 980px)');
  let previousFocus;
  function setMenu(open, restoreFocus = true) {
    if (open) previousFocus = document.activeElement === document.body ? toggle : document.activeElement;
    document.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    backdrop.hidden = !open;
    if (open) {
      nav.setAttribute('role', 'dialog');
      nav.setAttribute('aria-modal', 'true');
      // Wait until the drawer is visible before moving keyboard focus into it.
      window.setTimeout(() => {
        if (document.body.classList.contains('menu-open')) close.focus();
      }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 360);
    } else {
      nav.removeAttribute('role');
      nav.removeAttribute('aria-modal');
      if (restoreFocus && previousFocus) previousFocus.focus();
    }
  }
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  close.addEventListener('click', () => setMenu(false));
  backdrop.addEventListener('click', () => setMenu(false));
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    if (document.body.classList.contains('menu-open')) setMenu(false);
  }));
  document.addEventListener('keydown', event => {
    if (!document.body.classList.contains('menu-open')) return;
    if (event.key === 'Escape') { event.preventDefault(); setMenu(false); }
    if (event.key === 'Tab') {
      const items = [...nav.querySelectorAll('button, a[href]')];
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  mobile.addEventListener('change', () => { if (!mobile.matches) setMenu(false, false); });
  const capacity = document.querySelector('.capacity');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let scheduled = false;
  const updateScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 60);
    if (window.innerWidth > 980 && !reducedMotion.matches) {
      const box = capacity.getBoundingClientRect();
      if (box.top < window.innerHeight && box.bottom > 0) {
        const offset = Math.max(-15, Math.min(15, (window.innerHeight / 2 - box.top - box.height / 2) * 0.035));
        capacity.style.backgroundPosition = `center, center calc(55% + ${offset}px)`;
      }
    } else capacity.style.backgroundPosition = '';
    scheduled = false;
  };
  const scheduleScroll = () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(updateScroll); }
  };
  window.addEventListener('scroll', scheduleScroll, { passive: true });
  window.addEventListener('resize', scheduleScroll, { passive: true });
  reducedMotion.addEventListener('change', scheduleScroll);
  updateScroll();
  document.querySelector('[data-year]').textContent = new Date().getFullYear();
  // Content stays visible when JavaScript or IntersectionObserver is unavailable.
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16 });
    document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
    document.documentElement.classList.add('js-reveal');
  }
})();

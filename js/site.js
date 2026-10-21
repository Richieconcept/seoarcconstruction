/* Shared behavior for SEOARC's secondary pages. No third-party runtime required. */
(() => {
  'use strict';
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.site-nav');
  const backdrop = document.querySelector('.menu-backdrop');
  const close = document.querySelector('.menu-close');
  const mobile = matchMedia('(max-width: 980px)');
  let previousFocus;
  function setMenu(open, restore = true) {
    if (open) previousFocus = document.activeElement === document.body ? toggle : document.activeElement;
    document.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    backdrop.hidden = !open;
    if (open) {
      nav.setAttribute('role', 'dialog'); nav.setAttribute('aria-modal', 'true');
      setTimeout(() => { if (document.body.classList.contains('menu-open')) close.focus(); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 360);
      document.querySelector('main').inert = true;
      document.querySelector('footer').inert = true;
    } else {
      nav.removeAttribute('role'); nav.removeAttribute('aria-modal');
      document.querySelector('main').inert = false;
      document.querySelector('footer').inert = false;
      if (restore) previousFocus?.focus();
    }
  }
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  close.addEventListener('click', () => setMenu(false));
  backdrop.addEventListener('click', () => setMenu(false));
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { if (document.body.classList.contains('menu-open')) setMenu(false); }));
  document.addEventListener('keydown', e => {
    if (!document.body.classList.contains('menu-open')) return;
    if (e.key === 'Escape') { e.preventDefault(); setMenu(false); }
    if (e.key === 'Tab') {
      const items = [...nav.querySelectorAll('a[href],button')];
      if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === items.at(-1)) { e.preventDefault(); items[0].focus(); }
    }
  });
  mobile.addEventListener('change', () => { if (!mobile.matches) setMenu(false, false); });
  const updateHeader = () => header.classList.toggle('scrolled', scrollY > 60);
  addEventListener('scroll', updateHeader, {passive:true}); updateHeader();
  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
    }), {threshold:0.1});
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    document.documentElement.classList.add('js-reveal');
  }
  const filterButtons = [...document.querySelectorAll('[data-filter]')];
  filterButtons.forEach(button => button.addEventListener('click', () => {
    filterButtons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    let count = 0;
    document.querySelectorAll('[data-category]').forEach(card => {
      card.hidden = button.dataset.filter !== 'all' && card.dataset.category !== button.dataset.filter;
      if (!card.hidden) { card.classList.add('visible'); count++; }
    });
    document.querySelector('[data-project-count]').textContent = `${count} project photographs shown`;
  }));
  const form = document.querySelector('[data-enquiry-form]');
  if (form) {
    const query = new URLSearchParams(location.search);
    if (query.has('service')) {
      const select = form.elements.namedItem('Service');
      if ([...select.options].some(o => o.value === query.get('service'))) select.value = query.get('service');
    }
    const date = form.querySelector('[type="date"]');
    if (date) {
      const now = new Date();
      date.min = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const fields = [...new FormData(form).entries()];
      const subject = `${form.dataset.subject}: ${form.elements.namedItem('Name').value.trim()}`;
      const body = fields.map(([key,value]) => `${key}: ${String(value).trim()}`).join('\r\n\r\n');
      const mailto = `mailto:info@seoarc.com.ng?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      const draft = document.querySelector('[data-email-draft]');
      draft.href = mailto;
      draft.closest('.form-result').hidden = false;
      document.querySelector('[data-form-status]').textContent = 'Your email draft is ready. Open it in your email app, review the details, and send it to us.';
      draft.focus();
    });
  }
})();

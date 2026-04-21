// FinZ Finance — site interactions
// Minimal, dependency-free JS. Keep this file lean.

(function () {
  'use strict';

  // Mobile nav toggle
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Expandable submenus (mobile)
  document.querySelectorAll('.nav-links .has-menu > a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (window.matchMedia('(min-width: 960px)').matches) return;
      e.preventDefault();
      a.parentElement.classList.toggle('open');
    });
  });

  // Close mobile menu when a link is clicked
  document.querySelectorAll('.nav-links a').forEach(function (a) {
    a.addEventListener('click', function () {
      if (window.matchMedia('(max-width: 959px)').matches) {
        if (!a.parentElement.classList.contains('has-menu')) {
          links && links.classList.remove('open');
        }
      }
    });
  });

  // Highlight current page in nav
  const currentPath = window.location.pathname.replace(/\/index\.html$/, '/');
  document.querySelectorAll('.nav-links a[href]').forEach(function (a) {
    const hrefPath = new URL(a.href, window.location.origin).pathname.replace(/\/index\.html$/, '/');
    if (hrefPath === currentPath) a.classList.add('is-active');
  });

  // Simple EMI calculator on product pages (if present)
  const emiForm = document.querySelector('[data-emi-form]');
  if (emiForm) {
    const principal = emiForm.querySelector('[name="principal"]');
    const rate = emiForm.querySelector('[name="rate"]');
    const tenure = emiForm.querySelector('[name="tenure"]');
    const emiOut = emiForm.querySelector('[data-emi-output]');
    const intOut = emiForm.querySelector('[data-interest-output]');
    const totOut = emiForm.querySelector('[data-total-output]');

    function fmt(n) {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
    }

    function recalc() {
      const P = parseFloat(principal.value);
      const R = parseFloat(rate.value);
      const N = parseFloat(tenure.value);
      if (!P || !R || !N) return;
      const r = R / 12 / 100;
      const emi = (P * r * Math.pow(1 + r, N)) / (Math.pow(1 + r, N) - 1);
      const total = emi * N;
      const interest = total - P;
      if (emiOut) emiOut.textContent = fmt(emi);
      if (intOut) intOut.textContent = fmt(interest);
      if (totOut) totOut.textContent = fmt(total);
    }

    emiForm.addEventListener('input', recalc);
    recalc();
  }

  // Year in footer
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();

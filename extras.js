/* Story image zoom + back-to-top */
(function () {
  'use strict';
  /* story image viewer */
  var ov = document.createElement('div');
  ov.className = 'zoom-ov'; ov.hidden = true; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Photo viewer');
  ov.innerHTML = '<button type="button" class="zoom-x" aria-label="Close">&times;</button><img alt="">';
  document.body.appendChild(ov);
  var img = ov.querySelector('img'), last = null;
  function open(src, alt, from) { img.src = src; img.alt = alt || ''; ov.hidden = false; last = from; document.body.style.overflow = 'hidden'; ov.querySelector('.zoom-x').focus(); }
  function close() { ov.hidden = true; img.removeAttribute('src'); document.body.style.overflow = ''; if (last) last.focus(); }
  ov.addEventListener('click', function (e) { if (e.target !== img) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !ov.hidden) close(); });
  document.querySelectorAll('[data-zoom]').forEach(function (el) {
    function go() { open(el.getAttribute('data-zoom'), el.getAttribute('aria-label'), el); }
    el.addEventListener('click', go);
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  /* back to top */
  var t = document.getElementById('toTop');
  if (t) {
    function chk() { t.classList.toggle('show', window.scrollY > 500); }
    window.addEventListener('scroll', chk, { passive: true }); chk();
    t.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }
})();

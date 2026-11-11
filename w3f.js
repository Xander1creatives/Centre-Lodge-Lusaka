/* Web3Forms submissions + custom success / error messages */
(function () {
  'use strict';
  var KEY = 'd676428b-b875-4450-9d4d-16ea93df95b4';
  var ENDPOINT = 'https://api.web3forms.com/submit';

  var MSG = {
    bkForm: function (d) { return ['Request received!', 'Thank you' + (d.name ? ', ' + d.name.split(' ')[0] : '') + '. Your reservation request has been sent to our team. We will contact you shortly on the phone number you gave us to confirm.']; },
    contactForm: function (d) { return ['Message sent!', 'Thank you' + (d.name ? ', ' + d.name.split(' ')[0] : '') + ' for reaching out to Center Lodge. We have your enquiry and will get back to you as soon as we can.']; },
    detailsForm: function (d) { return ['Booking details received!', 'Thank you' + (d.name ? ', ' + d.name.split(' ')[0] : '') + '. A copy of your booking details has been sent to the lodge.']; }
  };

  /* ---------- styles for the popup (injected so every page gets them) ---------- */
  var css = '.w3f-ov{position:fixed;inset:0;z-index:99999;background:rgba(20,20,20,.55);display:flex;align-items:center;justify-content:center;padding:20px;animation:w3fFade .2s ease}' +
    '.w3f-box{background:#fff;max-width:420px;width:100%;border-radius:10px;padding:34px 28px 26px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3);animation:w3fPop .3s cubic-bezier(.2,.9,.3,1.2)}' +
    '.w3f-ic{width:64px;height:64px;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;background:#e6f6ec;color:#1f9d55}' +
    '.w3f-box.err .w3f-ic{background:#fdeaea;color:#c0392b}' +
    '.w3f-ic svg{width:32px;height:32px;fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}' +
    '.w3f-box h3{font:500 28px "Cormorant Garamond",serif;margin:0 0 8px;color:#222}' +
    '.w3f-box p{margin:0 0 22px;color:#555;line-height:1.55;font-size:15px}' +
    '.w3f-box button{background:#222;color:#fff;border:0;border-radius:6px;padding:11px 30px;font:500 15px "Jost",sans-serif;cursor:pointer}' +
    '.w3f-box button:hover{background:#000}' +
    '@keyframes w3fFade{from{opacity:0}to{opacity:1}}@keyframes w3fPop{from{transform:scale(.85);opacity:0}to{transform:none;opacity:1}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function popup(title, text, isErr) {
    var old = document.getElementById('w3fPop'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.className = 'w3f-ov'; ov.id = 'w3fPop'; ov.setAttribute('role', 'alertdialog'); ov.setAttribute('aria-modal', 'true');
    var box = document.createElement('div'); box.className = 'w3f-box' + (isErr ? ' err' : '');
    box.innerHTML = '<div class="w3f-ic"><svg viewBox="0 0 24 24" aria-hidden="true">' +
      (isErr ? '<path d="M6 6l12 12M18 6L6 18"/>' : '<path d="M5 12.5l4.5 4.5L19 7.5"/>') + '</svg></div><h3></h3><p></p><button type="button">' + (isErr ? 'Try again' : 'Done') + '</button>';
    box.querySelector('h3').textContent = title;
    box.querySelector('p').textContent = text;
    ov.appendChild(box); document.body.appendChild(ov);
    var btn = box.querySelector('button'); btn.focus();
    function close() { ov.remove(); document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') close(); }
    btn.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', esc);
  }

  /* ---------- field collection ---------- */
  function labelOf(el) {
    var l = el.closest('label');
    if (l) { var c = l.cloneNode(true); c.querySelectorAll('input,select,textarea,button').forEach(function (n) { n.remove(); }); var t = c.textContent.trim(); if (t) return t; }
    return el.name || el.id || 'Field';
  }
  function collect(scope, out) {
    scope.querySelectorAll('input,select,textarea').forEach(function (el) {
      if (el.type === 'button' || el.type === 'submit' || el.type === 'password' || el.closest('.hp')) return;
      if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
      var v = el.value; if (v === '' || v == null) return;
      var k = labelOf(el);
      if (el.type === 'radio') k = 'Payment method';
      if (el.type === 'checkbox') { k = 'Consent'; v = 'Agreed'; }
      out[k] = v;
    });
  }
  function simple(d) { // convenient keys for greeting
    var n = ''; Object.keys(d).forEach(function (k) { if (!n && /name/i.test(k) && !/event|country/i.test(k)) n = d[k]; });
    return { name: n };
  }

  function send(subject, data) {
    var body = { access_key: KEY, subject: subject, from_name: 'Center Lodge website' };
    Object.keys(data).forEach(function (k) { body[k] = data[k]; });
    return fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j.success) throw new Error(j.message || 'Failed'); return j; });
  }

  function busy(form, on) {
    form.querySelectorAll('button[type=submit]').forEach(function (b) {
      if (on) { b.dataset.t = b.textContent; b.textContent = 'Sending…'; b.disabled = true; }
      else { b.textContent = b.dataset.t || b.textContent; b.disabled = false; }
    });
  }

  /* ---------- homepage: enquiry form ---------- */
  document.addEventListener('submit', function (e) {
    var form = e.target;

    if (form.id === 'contactForm') {
      e.preventDefault(); e.stopImmediatePropagation();
      var d = {}; collect(form, d);
      if (!d['Your name'] || !d['Phone']) { popup('Missing details', 'Please enter your name and phone number so we can reply to you.', true); return; }
      busy(form, true);
      send('New enquiry – ' + (d['What for'] || 'General'), d).then(function () {
        form.reset(); var m = MSG.contactForm(simple(d)); popup(m[0], m[1]);
      }).catch(function () { popup('Could not send', 'Something went wrong while sending your message. Please check your connection and try again, or call us directly.', true); })
        .then(function () { busy(form, false); });
      return;
    }

    /* ---------- homepage: reservation request (step 2 only) ---------- */
    if (form.id === 'bkForm') {
      var s2 = document.getElementById('step2');
      if (!s2 || s2.hidden) return; // step 1 → let the page's own script move to step 2
      e.preventDefault(); e.stopImmediatePropagation();
      var tab = form.parentElement.querySelector('[role=tab][aria-selected=true]');
      var grp = tab ? tab.getAttribute('data-tab') : 'stay';
      var data = { 'Request type': grp === 'dine' ? 'Restaurant table' : grp === 'event' ? 'Event' : 'Accommodation' };
      var g = form.querySelector('.fields[data-group="' + grp + '"]'); if (g) collect(g, data);
      collect(s2, data);
      var sum = document.getElementById('bkSummary'); if (sum && sum.textContent.trim()) data['Summary'] = sum.textContent.trim();
      if (!data['Your name'] || !data['Phone / WhatsApp']) { popup('Missing details', 'Please enter your name and phone / WhatsApp number so we can confirm your request.', true); return; }
      busy(form, true);
      send('New reservation request – ' + data['Request type'], data).then(function () {
        var m = MSG.bkForm(simple(data)); popup(m[0], m[1]);
        form.reset();
        s2.hidden = true; var s1 = document.getElementById('step1'); if (s1) s1.hidden = false;
      }).catch(function () { popup('Could not send', 'We could not send your request just now. Please try again or contact us on WhatsApp.', true); })
        .then(function () { busy(form, false); });
      return;
    }

    /* ---------- book.html: booking details (non-blocking copy to the lodge) ---------- */
    if (form.id === 'detailsForm') {
      var hp = document.getElementById('hp'); if (hp && hp.value) return;
      var b = {}; collect(form, b);
      if (!b['Full name'] || !b['Email'] || !b['Phone / WhatsApp'] || !b['Consent']) return; // page's own validation will complain
      var inEl = document.getElementById('in'), outEl = document.getElementById('out');
      if (inEl && inEl.value) b['Check-in'] = inEl.value;
      if (outEl && outEl.value) b['Check-out'] = outEl.value;
      var sm = document.getElementById('summary'); if (sm) b['Booking summary'] = sm.textContent.replace(/\s+/g, ' ').trim();
      b.replyto = b['Email'];
      send('New room booking – ' + b['Full name'], b).catch(function () {});
      // the page's own booking script continues and shows its confirmation screen
    }
  }, true);
})();

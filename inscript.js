// Contact details, social links and keys come from site-settings.js (cleaned by js/common.js)
const CONFIG = (window.CL && CL.site) || { phone: '', whatsapp: '', email: '', address: '', mapQuery: '', social: {}, bank: {} };

// ===== Animated icons (inline SVG, animated with CSS in instyles.css) =====
const HEART = 'M32 54S8 40 8 24a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 16-24 30-24 30z';
const ICONS = {
  sparkle: `<svg viewBox="0 0 64 64"><path class="star" d="M30 8l5 18 18 5-18 5-5 18-5-18-18-5 18-5z"/><path class="tw" d="M52 8v10M47 13h10"/><path class="tw b" d="M11 44v8M7 48h8"/></svg>`,
  bed: `<svg viewBox="0 0 64 64"><path d="M8 52V22M8 42h48M56 52V38a6 6 0 0 0-6-6H28v10"/><rect class="pillow" x="13" y="31" width="12" height="8" rx="3"/><path class="zz" d="M38 20h6l-6 7h6"/><path class="zz b" d="M47 8h8l-8 9h8"/></svg>`,
  cloche: `<svg viewBox="0 0 64 64"><path d="M6 52h52"/><g class="lid"><path d="M12 48a20 20 0 0 1 40 0z"/><circle cx="32" cy="25" r="2.5"/></g><path class="steam" pathLength="10" d="M23 18c-3-3 3-5 0-9"/><path class="steam b" pathLength="10" d="M32 16c-3-3 3-5 0-9"/><path class="steam c3" pathLength="10" d="M41 18c-3-3 3-5 0-9"/></svg>`,
  conference: `<svg viewBox="0 0 64 64"><rect x="8" y="8" width="48" height="34" rx="2"/><path d="M32 42v8M22 57l10-7 10 7"/><rect class="bar" x="16" y="22" width="7" height="14" rx="1"/><rect class="bar b" x="28.500" y="16" width="7" height="20" rx="1"/><rect class="bar c3" x="41" y="26" width="7" height="10" rx="1"/></svg>`,
  rings: `<svg viewBox="0 0 64 64"><circle class="r1" cx="24" cy="42" r="12"/><circle class="r2" cx="40" cy="42" r="12"/><path class="gem" d="M40 8l6 7-6 9-6-9zM34 15h12"/><path class="tw" d="M54 12v8M50 16h8"/><path class="tw b" d="M10 18v6M7 21h6"/></svg>`,
  heart: `<svg viewBox="0 0 64 64"><path class="halo" d="${HEART}"/><path class="heart" d="${HEART}"/></svg>`,
  popper: `<svg viewBox="0 0 64 64"><g class="pop"><path d="M8 56l12-32 20 20z"/><path d="M13 44l14 8M17 34l14 8"/></g><circle class="cf" style="--x:8px;--y:-18px" cx="34" cy="26" r="2"/><rect class="cf" style="--x:20px;--y:-8px;animation-delay:.2s" x="38" y="30" width="6" height="2.500" rx="1"/><path class="cf" style="--x:-4px;--y:-20px;animation-delay:.4s" d="M28 24l1-5"/><circle class="cf" style="--x:18px;--y:-20px;animation-delay:.6s" cx="38" cy="22" r="1.500"/><rect class="cf" style="--x:16px;--y:6px;animation-delay:.3s" x="40" y="38" width="5" height="2.500" rx="1"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" style="stroke-width:1.7"><path class="hs" d="M22 16.920v3a2 2 0 0 1-2.180 2 19.790 19.790 0 0 1-8.630-3.070 19.500 19.500 0 0 1-6-6 19.790 19.790 0 0 1-3.070-8.670A2 2 0 0 1 4.110 2h3a2 2 0 0 1 2 1.720 12.840 12.840 0 0 0 .7 2.810 2 2 0 0 1-.45 2.110L8.090 9.910a16 16 0 0 0 6 6l1.270-1.270a2 2 0 0 1 2.110-.45 12.840 12.840 0 0 0 2.810.7A2 2 0 0 1 22 16.920z"/><path class="wv" d="M15.050 5A5 5 0 0 1 19 8.950"/><path class="wv b" d="M15.050 1A9 9 0 0 1 23 8.940"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" style="stroke-width:1.7"><rect class="ml" x="3" y="5" width="18" height="14" rx="2"/><path class="ml" d="M3 7l9 6 9-6"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" style="stroke-width:1.7"><path class="pinb" d="M12 21s-7-6.200-7-11a7 7 0 0 1 14 0c0 4.800-7 11-7 11z"/><circle class="pinb" cx="12" cy="10" r="2.500"/></svg>`
};
const paintIcons = root => (root || document).querySelectorAll('[data-icon]').forEach(el => {
  el.innerHTML = ICONS[el.dataset.icon] || '';
  el.setAttribute('aria-hidden', 'true');
});
paintIcons();

// ===== Header + mobile menu =====
const nav = document.getElementById('nav');
const menuBtn = document.getElementById('menuBtn');
function setMenu(open) {
  nav.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', open);
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}
menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
window.addEventListener('resize', () => { if (innerWidth > 900) setMenu(false); });

// ===== Hero slider =====
const SLIDES = [
  { i: 'sparkle',    t: 'Centre Lodge',          p: 'Where Comfort Meets Exceptional Hospitality',                      b: 'Book your stay',   topic: 'Accommodation' },
  { i: 'bed',        t: 'Accommodation',         p: 'Comfortable and relaxing rooms for your stay',                     b: 'Book a room',      topic: 'Accommodation' },
  { i: 'cloche',     t: 'Restaurant',            p: 'Delicious meals and a welcoming dining experience',                b: 'Reserve a table',  topic: 'Restaurant table' },
  { i: 'conference', t: 'Conference Facilities', p: 'Professional spaces for meetings, workshops, and business conferences', b: 'Enquire now', topic: 'Conference facilities' },
  { i: 'rings',      t: 'Weddings & Blessings',  p: 'Celebrate love, family, and tradition in a welcoming setting',     b: 'Plan your day',    topic: 'Wedding reception' },
  { i: 'popper',     t: 'Corporate Events',      p: 'Business gatherings, celebrations, and memorable events',          b: 'Enquire now',      topic: 'Corporate event / special function' }
];
const trk = document.getElementById('trk');
const cap = document.getElementById('cap');
const dots = document.getElementById('dots');
const N = SLIDES.length;
let cur = 0, timer;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

SLIDES.forEach((s, k) => {
  const d = document.createElement('button');
  d.type = 'button';
  d.setAttribute('aria-label', 'Go to slide ' + (k + 1) + ': ' + s.t);
  d.addEventListener('click', () => { show(k); arm(); });
  dots.appendChild(d);
});
function show(n) {
  cur = (n + N) % N;
  trk.style.transform = `translateX(-${cur * 100 / N}%)`;
  [...dots.children].forEach((d, k) => d.classList.toggle('on', k === cur));
  const s = SLIDES[cur];
  cap.innerHTML = `<i class="ico" data-icon="${s.i}"></i>${cur === 0 ? '<h1>' : '<h2 class="ct">'}${s.t}${cur === 0 ? '</h1>' : '</h2>'}<p>${s.p}</p><a class="btn" href="#reserve" data-intent="${s.topic}">${s.b}</a>`;
  paintIcons(cap);
  bindIntent(cap);
}
function arm() { clearInterval(timer); if (!reduce) timer = setInterval(() => show(cur + 1), 5500); }
let x0 = null;
const hero = document.getElementById('home');
hero.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
hero.addEventListener('touchend', e => {
  if (x0 === null) return;
  const dx = e.changedTouches[0].clientX - x0;
  if (Math.abs(dx) > 50) { show(cur + (dx < 0 ? 1 : -1)); arm(); }
  x0 = null;
});
document.addEventListener('visibilitychange', () => document.hidden ? clearInterval(timer) : arm());

// ===== Buttons that pre-select the reservation tab / topic =====
function bindIntent(root) {
  (root || document).querySelectorAll('[data-intent]').forEach(btn => {
    btn.addEventListener('click', () => {
      const want = btn.dataset.intent;
      // contact form topic
      document.querySelectorAll('select.topic').forEach(sel => {
        const opt = [...sel.options].find(o => o.text === want);
        if (opt) sel.value = opt.value;
      });
      // reservation tab
      if (want === 'Accommodation') setTab('stay');
      else if (want === 'Restaurant table') setTab('dine');
      else {
        setTab('event');
        const ev = document.getElementById('evType');
        const opt = [...ev.options].find(o => o.text === want);
        if (opt) ev.value = opt.value;
      }
    });
  });
}

// ===== Contact details from CONFIG =====
document.querySelectorAll('[data-cfg]').forEach(el => {
  const val = CONFIG[el.dataset.cfg];
  const row = el.closest('[data-cfg-row]');
  if (!val) { if (row) row.hidden = true; return; }
  el.textContent = val;
  if (el.dataset.href === 'tel') el.href = 'tel:' + val.replace(/[^\d+]/g, '');
  if (el.dataset.href === 'mailto') el.href = 'mailto:' + val;
  if (el.dataset.href === 'wa') { el.textContent = 'Chat with us on WhatsApp'; el.href = CL.site.waLink('Hello Center Lodge, I would like to make an enquiry.'); el.target = '_blank'; el.rel = 'noopener noreferrer'; }
});
// social media icons (only the links you filled in)
(() => {
  const lists = [...document.querySelectorAll('ul[data-socials]')]; if (!lists.length) return;
  const icons = window.CL_SOCIAL_ICONS || {}, NAMES = { facebook: 'Facebook', tiktok: 'TikTok', instagram: 'Instagram', linkedin: 'LinkedIn', x: 'X (Twitter)', youtube: 'YouTube' };
  const links = { ...CONFIG.social };
  const keys = Object.keys(NAMES).filter(k => links[k] && icons[k]);
  lists.forEach(ul => {
    if (!keys.length) { ul.hidden = true; return; }
    ul.replaceChildren(...keys.map(k => {
      const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path');
      svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); p.setAttribute('d', icons[k]); svg.append(p);
      const a = document.createElement('a'); a.href = links[k]; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.className = 'sn-' + k;
      a.setAttribute('aria-label', NAMES[k] + ' (opens in a new tab)'); a.title = NAMES[k]; a.append(svg);
      const li = document.createElement('li'); li.append(a); return li;
    }));
  });
})();
// location map (Google Maps embed, no key needed)
(() => {
  const wrap = document.getElementById('mapWrap'); if (!wrap) return;
  const q = CONFIG.mapQuery || CONFIG.address;
  if (!q) { wrap.hidden = true; return; }
  const f = document.createElement('iframe');
  f.src = 'https://www.google.com/maps?q=' + encodeURIComponent(q) + '&output=embed';
  f.title = 'Map showing the location of Center Lodge'; f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade';
  f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox'); f.allowFullscreen = true;
  wrap.replaceChildren(f);
})();
const wa = document.getElementById('waFloat');
if (CONFIG.whatsapp) {
  wa.hidden = false;
  wa.href = 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent('Hello Center Lodge, I would like to make an enquiry.');
  wa.target = '_blank'; wa.rel = 'noopener';
}
document.getElementById('year').textContent = new Date().getFullYear();

// ===== Enquiry forms: send via WhatsApp (or email) =====
const toast = msg => {
  const d = document.createElement('div');
  d.textContent = msg;
  document.getElementById('toasts').append(d);
  setTimeout(() => d.remove(), 5000);
};
const today = new Date().toISOString().slice(0, 10);
document.querySelectorAll('input[type=date]').forEach(i => i.min = today);

async function deliver(subject, fields, replyTo, plain) {
  if (window.CL && CL.mail && CL.site.web3formsKey) {
    if (await CL.mail.send(subject, fields, replyTo)) {
      const first = String(fields.Name || '').trim().split(/\s+/)[0], hi = first ? 'Thank you, ' + first + '.' : 'Thank you.';
      const isEnq = /^Website enquiry/.test(subject);
      if (CL.popup) CL.popup(isEnq ? 'Message sent!' : 'Request received!',
        isEnq ? hi + ' Your enquiry has reached Center Lodge. We will get back to you as soon as we can.'
              : hi + ' Your reservation request has been sent to our team. We will contact you shortly on the number you gave us to confirm.');
      else toast('Thank you! Your message has been sent to Center Lodge.');
      return true;
    }
    if (CL.popup && !CONFIG.whatsapp && !CONFIG.email) { CL.popup('Could not send', 'Something went wrong while sending your message. Please check your connection and try again.', true); return false; }
    toast('We could not send that online, trying another way…');
  }
  if (CONFIG.whatsapp) { window.open('https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(plain), '_blank', 'noopener'); toast('Opening WhatsApp so you can send your message.'); return true; }
  if (CONFIG.email) { location.href = 'mailto:' + CONFIG.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(plain); toast('Opening your email app.'); return true; }
  toast('Contact details are not set up yet. Add them in site-settings.js.'); return false;
}
function handleEnquiry(form) {
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(form);
    let ok = true;
    ['name', 'phone'].forEach(n => {
      const bad = !String(f.get(n) || '').trim();
      form.elements[n].classList.toggle('invalid', bad);
      if (bad) ok = false;
    });
    if (!ok) { toast('Please add your name and phone number.'); return; }
    const text = [
      'Hello Center Lodge,',
      'Name: ' + f.get('name'),
      'Phone: ' + f.get('phone'),
      'Enquiry: ' + f.get('topic'),
      f.get('date') ? 'Date: ' + f.get('date') : '',
      f.get('message') ? 'Message: ' + f.get('message') : ''
    ].filter(Boolean).join('\n');
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    const sent = await deliver('Website enquiry: ' + f.get('topic') + ' - ' + f.get('name'),
      { 'Name': f.get('name'), 'Phone': f.get('phone'), 'Enquiry about': f.get('topic'), 'Date': f.get('date'), 'Message': f.get('message') }, undefined, text);
    btn.disabled = false; if (sent) form.reset();
  });
  form.querySelectorAll('input').forEach(i => i.addEventListener('input', () => i.classList.remove('invalid')));
}
handleEnquiry(document.getElementById('contactForm'));

// ===== Reservation section (Stay / Dine / Events) =====
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const $ = id => document.getElementById(id);
const stayIn = $('stayIn'), stayOut = $('stayOut');
stayIn.value = iso(addDays(1)); stayOut.value = iso(addDays(3));
$('dineDate').value = iso(addDays(1));
[stayIn, stayOut, $('dineDate'), $('evDate')].forEach(i => i.min = iso(new Date()));
stayIn.addEventListener('change', () => {
  stayOut.min = stayIn.value;
  if (stayOut.value <= stayIn.value) {
    const d = new Date(stayIn.value + 'T12:00:00'); d.setDate(d.getDate() + 1);
    stayOut.value = iso(d);
  }
});
const fmt = v => v ? new Date(v + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const nightsBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 864e5));

let tab = 'stay';
function setTab(t) {
  tab = t;
  document.querySelectorAll('.tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
  document.querySelectorAll('.fields[data-group]').forEach(g => g.hidden = g.dataset.group !== t);
  showStep(1);
}
function showStep(n) {
  $('step1').hidden = n !== 1;
  $('step2').hidden = n !== 2;
}
document.querySelectorAll('.tabs [role=tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
$('bkBack').addEventListener('click', () => showStep(1));

let booking = null;   // what the guest picked in step 1
function pickDetails() {
  if (tab === 'stay') {
    if (!stayIn.value || !stayOut.value || stayOut.value <= stayIn.value) { toast('Choose a check-out date after your check-in date.'); return null; }
    const n = nightsBetween(stayIn.value, stayOut.value);
    const g = $('stayGuests').value, r = $('stayRooms').value;
    return {
      title: 'Room reservation',
      lines: ['Check-in: ' + fmt(stayIn.value), 'Check-out: ' + fmt(stayOut.value), 'Nights: ' + n, 'Guests: ' + g, 'Rooms: ' + r],
      summary: `Stay · ${fmt(stayIn.value)} to ${fmt(stayOut.value)} · ${n} night${n > 1 ? 's' : ''} · ${g} guest${g === '1' ? '' : 's'} · ${r} room${r === '1' ? '' : 's'}`
    };
  }
  if (tab === 'dine') {
    if (!$('dineDate').value) { toast('Please choose a date for your table.'); return null; }
    const g = $('dineGuests').value;
    return {
      title: 'Table reservation',
      lines: ['Date: ' + fmt($('dineDate').value), 'Time: ' + $('dineTime').value, 'Guests: ' + g],
      summary: `Table · ${fmt($('dineDate').value)} at ${$('dineTime').value} · ${g} guest${g === '1' ? '' : 's'}`
    };
  }
  if (!$('evDate').value) { toast('Please choose a date for your event.'); return null; }
  const type = $('evType').value, g = $('evGuests').value;
  return {
    title: 'Event booking: ' + type,
    lines: ['Event: ' + type, 'Date: ' + fmt($('evDate').value), g ? 'Guests expected: ' + g : ''],
    summary: `${type} · ${fmt($('evDate').value)}${g ? ' · ' + g + ' guests' : ''}`
  };
}

$('bkForm').addEventListener('submit', async e => {
  e.preventDefault();
  // step 1 -> step 2
  if (!$('step1').hidden) {
    if (tab === 'stay') {                      // rooms are booked on the live booking page
      if (!stayIn.value || !stayOut.value || stayOut.value <= stayIn.value) { toast('Choose a check-out date after your check-in date.'); return; }
      const q = new URLSearchParams({ in: stayIn.value, out: stayOut.value, guests: parseInt($('stayGuests').value, 10) || 2, rooms: parseInt($('stayRooms').value, 10) || 1 });
      location.href = 'book.html?' + q.toString();
      return;
    }
    booking = pickDetails();
    if (!booking) return;
    $('bkSummary').textContent = booking.summary;
    showStep(2);
    $('bkName').focus({ preventScroll: true });
    return;
  }
  // step 2 -> send
  const name = $('bkName'), phone = $('bkPhone');
  let ok = true;
  [name, phone].forEach(i => { const bad = !i.value.trim(); i.classList.toggle('invalid', bad); if (bad) ok = false; });
  if (!ok) { toast('Please add your name and phone number.'); return; }
  const text = ['Hello Center Lodge, I would like to make a reservation request.', '', booking.title,
    ...booking.lines.filter(Boolean), '', 'Name: ' + name.value.trim(), 'Phone: ' + phone.value.trim(),
    $('bkNotes').value.trim() ? 'Notes: ' + $('bkNotes').value.trim() : ''].filter((l, i, a) => l !== '' || (a[i - 1] !== '' && i)).join('\n');
  const sbtn = $('bkForm').querySelector('#step2 .go'); sbtn.disabled = true;
  const sent = await deliver('Website request: ' + booking.title + ' - ' + name.value.trim(),
    { 'Request': booking.title, 'Details': booking.lines.filter(Boolean).join(' | '), 'Name': name.value.trim(), 'Phone': phone.value.trim(), 'Notes': $('bkNotes').value.trim() }, undefined, text);
  sbtn.disabled = false;
  if (!sent) return;
  name.value = ''; phone.value = ''; $('bkNotes').value = '';
  showStep(1);
});
[$('bkName'), $('bkPhone')].forEach(i => i.addEventListener('input', () => i.classList.remove('invalid')));

bindIntent();
show(0);
arm();

// ===== Shared lightbox (Gallery tiles + the 4 images inside a detail dialog) =====
const lbDlg = $('lightbox'), lbStage = $('lbStage'), lbCaption = $('lbCaption');
let LB_SET = [], LB_I = 0;
function openLightbox(set, i) {
  LB_SET = set; LB_I = ((i % set.length) + set.length) % set.length;
  drawLightbox();
  if (!lbDlg.open) lbDlg.showModal();
}
function drawLightbox() {
  const item = LB_SET[LB_I];
  lbStage.style.setProperty('--img', item.img);
  lbStage.className = 'lb-stage ' + (item.scene || 's1');
  lbCaption.textContent = LB_SET.length > 1 ? `${item.caption}  ·  ${LB_I + 1} / ${LB_SET.length}` : (item.caption || '');
  const multi = LB_SET.length > 1;
  $('lbPrev').hidden = !multi; $('lbNext').hidden = !multi;
}
$('lbPrev').addEventListener('click', () => { LB_I = (LB_I - 1 + LB_SET.length) % LB_SET.length; drawLightbox(); });
$('lbNext').addEventListener('click', () => { LB_I = (LB_I + 1) % LB_SET.length; drawLightbox(); });
$('lbClose').addEventListener('click', () => lbDlg.close());
lbDlg.addEventListener('click', e => { if (e.target === lbDlg) lbDlg.close(); });
document.addEventListener('keydown', e => {
  if (!lbDlg.open) return;
  if (e.key === 'ArrowLeft') $('lbPrev').click();
  if (e.key === 'ArrowRight') $('lbNext').click();
});

// ===== Gallery tiles: click to open in the lightbox, with next/previous =====
const GALLERY_TILES = [...document.querySelectorAll('#gallery .gtile')];
const GALLERY_SET = GALLERY_TILES.map(t => ({
  img: getComputedStyle(t.querySelector('.ph')).getPropertyValue('--img') || t.querySelector('.ph').style.getPropertyValue('--img'),
  scene: [...t.querySelector('.ph').classList].find(c => /^s[1-6]$/.test(c)),
  caption: t.querySelector('h3').textContent
}));
GALLERY_TILES.forEach((t, i) => t.addEventListener('click', () => openLightbox(GALLERY_SET, i)));

// ===== Shared detail dialog (Our Services / Our Rooms) =====
const ddDlg = $('detailDlg');
function openDetail({ title, meta, description, images, cta }) {
  const imgDivs = images.map((im, i) => {
    const d = document.createElement('div');
    d.className = 'ph ' + (im.scene || 's1');
    d.style.setProperty('--img', im.img);
    d.setAttribute('role', 'button'); d.tabIndex = 0; d.setAttribute('aria-label', 'View larger: ' + im.caption);
    const open = () => openLightbox(images.map(x => ({ img: x.img, scene: x.scene, caption: x.caption })), i);
    d.addEventListener('click', open);
    d.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    return d;
  });
  const card = document.createElement('div'); card.className = 'dd-card';
  const head = document.createElement('div'); head.className = 'dd-head';
  const h = document.createElement('h3'); h.textContent = title;
  const x = document.createElement('button'); x.type = 'button'; x.className = 'dd-close'; x.setAttribute('aria-label', 'Close'); x.innerHTML = '&times;';
  x.addEventListener('click', () => ddDlg.close());
  head.append(h, x);
  const imgs = document.createElement('div'); imgs.className = 'dd-imgs'; imgs.append(...imgDivs);
  const body = document.createElement('div'); body.className = 'dd-body';
  if (meta && meta.length) {
    const m = document.createElement('p'); m.className = 'dd-meta';
    meta.forEach(line => { const b = document.createElement('b'); b.textContent = line; m.append(b, ' '); });
    body.append(m);
  }
  const p = document.createElement('p'); p.textContent = description; body.append(p);
  if (cta) { const a = document.createElement('a'); a.className = 'btn'; a.href = cta.href; if (cta.intent) a.dataset.intent = cta.intent; a.textContent = cta.label; body.append(a); }
  card.append(head, imgs, body);
  ddDlg.replaceChildren(card);
  paintIcons(card); bindIntent(card);
  if (!ddDlg.open) ddDlg.showModal();
}
ddDlg.addEventListener('click', e => { if (e.target === ddDlg) ddDlg.close(); });

// ===== Our Services: click a card to see its details and 4 photos =====
const SERVICES = {
  accommodation: {
    title: 'Accommodation',
    description: 'Comfortable, quiet rooms set up for genuine rest, from a single overnight stop to a longer stay. Choose Standard, Deluxe, Twin or Royal depending on your space and budget — see Our Rooms below for live availability and pricing.',
    meta: ['Daily housekeeping', 'Free Wi-Fi'],
    cta: { label: 'Check room availability', href: '#reserve', intent: 'Accommodation' }
  },
  restaurant: {
    title: 'Restaurant Services',
    description: 'A relaxed dining room serving hearty local and international dishes, from an early breakfast to a late dinner. Whether it is a quick meal or a table for a group, our team will look after you.',
    meta: ['Breakfast, lunch & dinner', 'Groups welcome'],
    cta: { label: 'Reserve a table', href: '#reserve', intent: 'Restaurant table' }
  },
  conference: {
    title: 'Conference Facilities',
    description: 'Flexible meeting space for workshops, training sessions and business conferences, with seating arranged to suit your group size and refreshments available throughout the day.',
    meta: ['Flexible seating', 'Catering available'],
    cta: { label: 'Enquire about conferences', href: '#reserve', intent: 'Conference facilities' }
  },
  wedding: {
    title: 'Wedding Receptions',
    description: 'A warm, beautifully set hall for your reception, sized and styled around your day. Our team works with you on layout, catering and timing so you can focus on celebrating.',
    meta: ['Full-hall setup', 'Catering available'],
    cta: { label: 'Plan your wedding day', href: '#reserve', intent: 'Wedding reception' }
  },
  'kitchen-party': {
    title: 'Kitchen Parties & Marriage Blessings',
    description: 'A welcoming venue for the traditions that matter — kitchen parties, marriage blessings and family celebrations — with space for family, friends and all the festivities that come with them.',
    meta: ['Family celebrations', 'Flexible guest numbers'],
    cta: { label: 'Enquire about your celebration', href: '#reserve', intent: 'Kitchen party / marriage blessing' }
  },
  'corporate-events': {
    title: 'Corporate Events & Special Functions',
    description: 'From staff functions to product launches, we host business gatherings and special occasions with the space, seating and service to match the occasion.',
    meta: ['Business functions', 'Custom setups'],
    cta: { label: 'Enquire about your event', href: '#reserve', intent: 'Corporate event / special function' }
  }
};
document.querySelectorAll('#services .c[data-service]').forEach(card => {
  const slug = card.dataset.service, svc = SERVICES[slug];
  if (!svc) return;
  const scene = [...card.querySelector('.ph').classList].find(c => /^s[1-6]$/.test(c)) || 's1';
  const images = [1, 2, 3, 4].map(n => ({ img: `url('images/service-${slug}-${n}.jpg')`, scene, caption: svc.title }));
  const open = () => openDetail({ title: svc.title, meta: svc.meta, description: svc.description, images, cta: svc.cta });
  card.addEventListener('click', e => { if (e.target.closest('a')) return; open(); });
  card.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('a')) { e.preventDefault(); open(); } });
});


// ===== Live room types and prices from the booking system =====
(async () => {
  if (!window.CL || !CL.configured) return;
  const res = await CL.rpc('get_availability', { p_in: CL.addDays(CL.todayISO(), 1), p_out: CL.addDays(CL.todayISO(), 2) });
  if (!res.ok || !res.rooms.length) return;
  const SCENE = { standard: 's2', deluxe: 's3', twin: 's4', royal: 's5' };
  document.getElementById('roomGrid').replaceChildren(...res.rooms.map(r => {
    const slug = /^[a-z0-9-]{1,40}$/.test(r.slug) ? r.slug : 'standard';
    const scene = SCENE[slug] || 's1';
    // drop images/room-<slug>-1.jpg (through -4.jpg) in to show your own photos; card and detail view share image 1
    const card = CL.h('article', { class: 'c', 'data-slug': slug, tabindex: '0', role: 'button', 'aria-haspopup': 'dialog' },
      CL.h('div', { class: 'ph room-ph ' + scene, style: `--img:url('images/room-${slug}-1.jpg'),url('images/room-${slug}.webp')`, role: 'img', 'aria-label': r.name },
        CL.h('span', { class: 'view-chip' }, 'View details')),
      CL.h('div', { class: 'cb' },
        CL.h('h3', null, r.name), CL.h('p', { class: 'm' }, r.description),
        CL.h('p', { class: 'room-price' }, CL.money(r.price_per_night), CL.h('small', null, ' / night')),
        CL.h('p', { class: 'room-meta' }, 'Sleeps up to ' + r.max_guests + ' per room'),
        CL.h('a', { class: 'btn o', href: 'book.html' }, 'Check availability')));
    const images = [1, 2, 3, 4].map(n => ({ img: n === 1 ? `url('images/room-${slug}-1.jpg'),url('images/room-${slug}.webp')` : `url('images/room-${slug}-${n}.jpg')`, scene, caption: r.name }));
    const open = () => openDetail({
      title: r.name,
      meta: [CL.money(r.price_per_night) + ' / night', 'Sleeps up to ' + r.max_guests + ' per room'],
      description: r.description,
      images,
      cta: { label: 'Check availability', href: 'book.html' }
    });
    card.addEventListener('click', e => { if (e.target.closest('a')) return; open(); });
    card.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('a')) { e.preventDefault(); open(); } });
    return card;
  }));
  document.getElementById('rooms').hidden = false;
})();

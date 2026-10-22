// ===== CENTER LODGE SETTINGS — fill these in =====
const CONFIG = {
  whatsapp: '',   // digits only with country code, e.g. '260971234567'
  phone:    '',   // shown on the page, e.g. '+260 97 123 4567'
  email:    '',   // e.g. 'info@centerlodge.com'
  address:  ''    // e.g. 'Plot 12, Main Road, Town'
};

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
  { i: 'sparkle',    t: 'Center Lodge',          p: 'Where Comfort Meets Exceptional Hospitality',                      b: 'Book your stay',   topic: 'Accommodation' },
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
});
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

function handleEnquiry(form) {
  form.addEventListener('submit', e => {
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
    if (CONFIG.whatsapp) {
      window.open('https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
      toast('Opening WhatsApp so you can send your enquiry.');
    } else if (CONFIG.email) {
      location.href = 'mailto:' + CONFIG.email + '?subject=' + encodeURIComponent('Enquiry: ' + f.get('topic')) + '&body=' + encodeURIComponent(text);
      toast('Opening your email app.');
    } else {
      toast('Contact details are not set up yet. Add them in inscript.js.');
    }
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

$('bkForm').addEventListener('submit', e => {
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
  if (CONFIG.whatsapp) {
    window.open('https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
    toast('Opening WhatsApp so you can send your reservation request.');
  } else if (CONFIG.email) {
    location.href = 'mailto:' + CONFIG.email + '?subject=' + encodeURIComponent(booking.title) + '&body=' + encodeURIComponent(text);
    toast('Opening your email app.');
  } else {
    toast('Contact details are not set up yet. Add them in inscript.js.');
    return;
  }
  showStep(1);
});
[$('bkName'), $('bkPhone')].forEach(i => i.addEventListener('input', () => i.classList.remove('invalid')));

bindIntent();
show(0);
arm();

// ===== Live room types and prices from the booking system =====
(async () => {
  if (!window.CL || !CL.configured) return;
  const res = await CL.rpc('get_availability', { p_in: CL.addDays(CL.todayISO(), 1), p_out: CL.addDays(CL.todayISO(), 2) });
  if (!res.ok || !res.rooms.length) return;
  document.getElementById('roomGrid').replaceChildren(...res.rooms.map(r =>
    CL.h('article', { class: 'c' }, CL.h('div', { class: 'cb' },
      CL.h('h3', null, r.name), CL.h('p', { class: 'm' }, r.description),
      CL.h('p', null, 'From ', CL.h('b', null, CL.money(r.price_per_night)), ' / night'),
      CL.h('a', { class: 'btn o', href: 'book.html' }, 'Check availability')))));
  document.getElementById('rooms').hidden = false;
})();

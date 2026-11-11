(() => {
  'use strict';
  const { sb, h, money, fmtDate, fmtDay, fmtTime, todayISO, addDays, nightsBetween, badge, toast, rpc } = CL;
  const $ = id => document.getElementById(id);
  const say = (el, text, kind) => el.replaceChildren(text ? h('div', { class: 'alert ' + (kind || '') }, text) : '');
  const S = { types: [], bookings: [], notifs: [], blocks: [], intents: [], guestType: '', tab: 'overview', q: '', status: '', onDate: '', avFrom: todayISO(), avDays: 14, ready: false };
  const ACTIVE = ['pending', 'confirmed', 'checked_in'];
  const IDLE_MS = 30 * 60 * 1000;
  const POLL_MS = Math.max(+((window.CL_CONFIG || {}).ADMIN_POLL_MS) || 45000, 1000);
  const notConnected = () => 'Not connected: ' + (CL.PROBLEMS[CL.problem] || 'check supabase-config.js.') + ' Open setup-check.html to test.';
  let chan = null, pollTimer = null, idleTimer = null, loadTimer = null, fails = 0, lockUntil = 0, dlgId = null;

  // ---------------------------------------------------------------- sign in
  function showLogin(msg, kind) {
    $('appView').hidden = true; $('loginView').hidden = false; $('lPass').value = '';
    say($('loginMsg'), msg, kind);
    stopLive();
  }
  async function enter() {
    const { data, error } = await sb.rpc('is_admin');
    if (error || data !== true) {
      await sb.auth.signOut();
      return showLogin('This account is not authorised for the staff area.', 'bad');
    }
    const { data: u } = await sb.auth.getUser();
    $('who').textContent = (u && u.user && u.user.email) || '';
    $('loginView').hidden = true; $('appView').hidden = false;
    await loadAll(); S.ready = true;
    goTab(S.tab); startLive();
  }
  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!sb) return say($('loginMsg'), notConnected(), 'bad');
    if (Date.now() < lockUntil) return say($('loginMsg'), 'Too many attempts. Please wait a minute.', 'bad');
    const btn = $('lBtn'); btn.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: $('lEmail').value.trim(), password: $('lPass').value });
    btn.disabled = false;
    if (error) {
      fails++; if (fails >= 5) { lockUntil = Date.now() + 60000; fails = 0; }
      return say($('loginMsg'), 'Incorrect email or password.', 'bad');
    }
    fails = 0; say($('loginMsg'), '');
    await enter();
  });
  $('logout').addEventListener('click', async () => { await sb.auth.signOut(); showLogin('You have been signed out.', 'ok'); });
  if (sb) {
    sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT' && !$('appView').hidden) showLogin('You have been signed out.', 'ok'); });
    sb.auth.getSession().then(({ data }) => { if (data && data.session) enter(); });
  } else say($('loginMsg'), notConnected(), 'bad');

  // auto sign-out after 30 minutes without activity
  function bumpIdle() {
    clearTimeout(idleTimer);
    if ($('appView').hidden) return;
    idleTimer = setTimeout(async () => { await sb.auth.signOut(); showLogin('You were signed out after 30 minutes of inactivity.'); }, IDLE_MS);
  }
  ['click', 'keydown', 'mousemove', 'touchstart', 'scroll'].forEach(ev => document.addEventListener(ev, bumpIdle, { passive: true }));

  // ------------------------------------------------------------------ data
  async function loadAll() {
    const [t, b, n, k, pi] = await Promise.all([
      sb.from('room_types').select('*').order('sort_order'),
      sb.from('bookings').select('*, room_types(name,slug), payments(method,status,amount)').order('created_at', { ascending: false }).limit(2000),
      sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(200),
      sb.from('room_blocks').select('*, room_types(name)').order('date_from', { ascending: true }),
      sb.from('payment_intents').select('*').order('created_at', { ascending: false }).limit(300)
    ]);
    if (t.error || b.error || n.error || k.error || pi.error) { toast('Could not load the latest data. Retrying shortly.', 'bad'); return; }
    S.types = t.data; S.bookings = b.data; S.notifs = n.data; S.blocks = k.data; S.intents = pi.data;
    renderBadges();
    if (S.ready) softRender();
  }
  // Background refreshes must never wipe what staff are typing or steal focus from a field.
  function softRender() {
    if (S.tab === 'reservations' || S.tab === 'blocks') { if (S.redraw) S.redraw(); return; }   // list only, forms untouched
    if (S.tab === 'new' || S.tab === 'rooms') return;
    renderTab();
  }
  const soon = () => { clearTimeout(loadTimer); loadTimer = setTimeout(loadAll, 400); };

  function startLive() {
    bumpIdle(); stopLive();
    pollTimer = setInterval(() => { if (!document.hidden) loadAll(); }, POLL_MS);
    try {
      chan = sb.channel('admin-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => { soon(); })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, p => {
          toast(p.new && p.new.title ? p.new.title : 'New notification'); beep(); soon();
        })
        .subscribe(st => { const el = $('live'); const on = st === 'SUBSCRIBED'; el.textContent = on ? 'Live' : 'Updating every 45s'; el.classList.toggle('on', on); });
    } catch { $('live').textContent = 'Updating every 45s'; }
  }
  function stopLive() { clearInterval(pollTimer); clearTimeout(idleTimer); if (chan && sb) { sb.removeChannel(chan); chan = null; } }
  function beep() {
    try {
      const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain();
      o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.value = .06; o.start(); o.stop(a.currentTime + .15);
    } catch { /* sound is optional */ }
  }

  const typeName = id => (S.types.find(t => t.id === id) || {}).name || 'Room';
  const unread = () => S.notifs.filter(n => !n.is_read).length;
  function renderBadges() {
    const n = unread();
    [$('bellN'), $('tabN')].forEach(el => { el.textContent = n; el.hidden = n === 0; });
  }

  // ------------------------------------------------------------------ tabs
  $('atabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) goTab(b.dataset.tab); });
  $('bell').addEventListener('click', () => goTab('notifications'));
  function goTab(t) {
    S.tab = t; S.redraw = null;
    document.querySelectorAll('#atabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
    ['overview', 'reservations', 'availability', 'new', 'blocks', 'rooms', 'notifications'].forEach(id => { $('p-' + id).hidden = id !== t; });
    renderTab();
  }
  function renderTab() {
    ({ overview: renderOverview, reservations: renderRes, availability: renderAvail, new: renderNew, blocks: renderBlocks, rooms: renderRooms, notifications: renderNotifs })[S.tab]();
  }

  // ---------------------------------------------------------------- helpers
  const METHOD = { online: 'Online', cash: 'Cash', bank_transfer: 'Bank transfer', mobile_money: 'Mobile money', card: 'Card' };
  const PREF = { cash: 'Pay in cash at the lodge', bank_transfer: 'Prepayment by bank transfer', online: 'Pay now online (Lenco)' };
  function payInfo(b) {
    const paid = +b.paid_amount, tot = +b.total_amount;
    const methods = [...new Set((b.payments || []).filter(p => p.status === 'paid').map(p => METHOD[p.method] || p.method))].join(', ');
    if (tot > 0 && paid >= tot) return ['Paid' + (methods ? ' · ' + methods : ''), 'paid'];
    if (paid > 0) return ['Part paid' + (methods ? ' · ' + methods : ''), 'part'];
    return [{ cash: 'Paying in cash', bank_transfer: 'Bank transfer (awaiting)', online: 'Online (awaiting payment)' }[b.payment_pref] || 'Unpaid', 'wait'];
  }
  const payTag = b => { const [t, c] = payInfo(b); return h('span', { class: 'paytag ' + c }, t); };
  const guestTag = b => h('span', { class: 'tag ' + (b.is_international ? 'intl' : 'local') }, b.is_international ? 'International' : 'Local');
  const fullBooking = b => ({
    reference: b.reference, guest_name: b.guest_name, email: b.email, phone: b.phone, country: b.country, room_type: b.room_types.name,
    rooms: b.rooms, guests: b.guests, check_in: b.check_in, check_out: b.check_out, nights: nightsBetween(b.check_in, b.check_out), status: b.status,
    total: b.total_amount, paid: b.paid_amount, balance: Math.max(+b.total_amount - +b.paid_amount, 0), payment_pref: b.payment_pref, notes: b.notes, created_at: b.created_at
  });
  const countrySelect = value => {
    const s = h('select', null, CL_COUNTRIES.map(c => h('option', { value: c }, c)));
    if (value && !CL_COUNTRIES.includes(value)) s.prepend(h('option', { value }, value));
    s.value = value || 'Zambia'; return s;
  };
  const prefSelect = value => { const s = h('select', null, Object.entries(PREF).map(([k, v]) => h('option', { value: k }, v))); s.value = value || 'cash'; return s; };

  // -------------------------------------------------------------- overview
  async function renderOverview() {
    const today = todayISO(), B = S.bookings;
    const pending = B.filter(b => b.status === 'pending');
    const cancels = B.filter(b => b.cancel_requested_at && ['pending', 'confirmed'].includes(b.status));
    const review = S.intents.filter(i => i.status === 'needs_review');
    const arrivals = B.filter(b => ['pending', 'confirmed'].includes(b.status) && b.check_in === today);
    const departures = B.filter(b => b.status === 'checked_in' && b.check_out <= today);
    const inhouse = B.filter(b => b.status === 'checked_in');
    const active = B.filter(b => ACTIVE.includes(b.status));
    const intl = active.filter(b => b.is_international).length;
    const owed = active.reduce((s, b) => s + Math.max(Number(b.total_amount) - Number(b.paid_amount), 0), 0);
    const changed = pending.filter(b => b.modified_at && Date.now() - new Date(b.modified_at) < 7 * 864e5).length;
    const stat = (k, v, cls) => h('div', { class: 'stat ' + (cls || '') }, h('span', null, k), h('b', null, v));
    const item = (b, quick, sub) => h('div', { class: 'row-item' },
      h('div', null, h('div', { class: 't' }, `${b.reference} · ${b.guest_name} `, guestTag(b)), h('div', { class: 's' }, sub || `${b.rooms} × ${b.room_types.name} · ${fmtDay(b.check_in)} → ${fmtDay(b.check_out)} · `, payTag(b))),
      h('div', { class: 'actions' }, quick, h('button', { class: 'btn o small', onclick: () => openBooking(b.id) }, 'Open')));
    const list = (rows, empty, quick, sub) => rows.length ? rows.slice(0, 8).map(b => item(b, quick && quick(b), sub && sub(b))) : [h('p', { class: 'mini' }, empty)];
    const occ = h('div', { class: 'occ' }, h('span', { class: 'mini' }, 'Loading…'));
    $('p-overview').replaceChildren(
      h('h2', null, 'Today'),
      h('div', { class: 'stats' },
        stat('Awaiting your decision', pending.length, pending.length ? 'warn' : ''),
        stat('Cancellation requests', cancels.length, cancels.length ? 'warn' : ''),
        stat('Payments to review', review.length, review.length ? 'warn' : ''),
        stat('Changed by customers (7 days)', changed),
        stat('Arriving today', arrivals.length), stat('In the lodge now', inhouse.length),
        stat('Due out', departures.length), stat('Balance to collect', money(owed)),
        stat('International guests', intl), stat('Local guests', active.length - intl)),
      h('div', { class: 'grid2' },
        h('div', { class: 'panel' }, h('h3', null, 'Waiting for you to accept'),
          list(pending, 'Nothing waiting. New bookings appear here instantly.', b => [
            h('button', { class: 'btn small', onclick: () => setStatus(b.id, 'confirmed') }, 'Accept'),
            h('button', { class: 'btn danger o small', onclick: () => setStatus(b.id, 'declined', 'Decline booking ' + b.reference + '?') }, 'Decline')])),
        h('div', { class: 'panel' }, h('h3', null, 'Cancellation requests'),
          list(cancels, 'No cancellation requests.', b => [
            h('button', { class: 'btn danger small', onclick: () => resolveCancel(b, true) }, 'Approve'),
            h('button', { class: 'btn o small', onclick: () => resolveCancel(b, false) }, 'Keep')], b => `${b.cancel_reason ? 'Reason: ' + b.cancel_reason + ' · ' : ''}paid ${money(b.paid_amount)}`))),
      h('div', { class: 'grid2' },
        h('div', { class: 'panel' }, h('h3', null, 'Room availability tonight'), occ),
        h('div', { class: 'panel' }, h('h3', null, 'Arriving today'), list(arrivals, 'No arrivals today.'))),
      h('div', { class: 'grid2' },
        h('div', { class: 'panel' }, h('h3', null, 'Due out'), list(departures, 'Nobody due out.', b => h('button', { class: 'btn small', onclick: () => setStatus(b.id, 'checked_out') }, 'Check out'))),
        review.length ? h('div', { class: 'panel badbox' }, h('h3', null, 'Payments that need a decision'),
          ...review.slice(0, 6).map(i => { const b = S.bookings.find(x => x.id === i.booking_id); return h('div', { class: 'row-item' },
            h('div', null, h('div', { class: 't' }, `${b ? b.reference : ''} · ${money(i.amount)}`), h('div', { class: 's' }, i.note || '')),
            b ? h('button', { class: 'btn o small', onclick: () => openBooking(b.id) }, 'Open') : null); })) : null));
    const av = await rpc('admin_availability', { p_from: today, p_days: 1 });
    if (av.ok) occ.replaceChildren(...av.rows.map(r => {
      const used = r.total - r.free[0], pct = r.total ? Math.round(used / r.total * 100) : 0;
      return h('div', { class: 'occ-item' }, h('div', { class: 'occ-row' }, h('span', null, r.name), h('span', null, `${r.free[0]} free of ${r.total}`)), h('div', { class: 'meter' }, h('i', { style: `width:${pct}%` })));
    }));
  }
  async function resolveCancel(b, approve) {
    if (!confirm(approve ? `Cancel booking ${b.reference}? ${+b.paid_amount > 0 ? 'The guest has paid ' + money(b.paid_amount) + ': you must refund them yourself.' : ''}` : `Keep booking ${b.reference} and ignore the request?`)) return;
    const r = await rpc('admin_resolve_cancellation', { p_id: b.id, p_approve: approve });
    if (!r.ok) return toast(r.message, 'bad');
    toast(approve ? 'Booking cancelled. Its rooms are free again.' : 'Request dismissed.'); await loadAll(); if (dlgId === b.id) openBooking(b.id);
  }

  // ---------------------------------------------------------- reservations
  function renderRes() {
    const root = $('p-reservations');
    const q = h('input', { type: 'search', placeholder: 'Reference, name, email, phone or country', value: S.q, 'aria-label': 'Search' });
    const st = h('select', null, h('option', { value: '' }, 'All statuses'), ...Object.entries(CL.STATUS).map(([k, v]) => h('option', { value: k }, v[0])));
    st.value = S.status;
    const gt = h('select', null, h('option', { value: '' }, 'Local and international'), h('option', { value: 'local' }, 'Local (Zambia)'), h('option', { value: 'intl' }, 'International'));
    gt.value = S.guestType || '';
    const dt = h('input', { type: 'date', value: S.onDate });
    const body = h('div');
    const draw = () => {
      const needle = q.value.trim().toLowerCase(), raw = needle.replace(/\D/g, ''), digits = raw.length >= 9 ? raw.slice(-9) : raw;   // numbers are stored as their last 9 digits
      const rows = S.bookings.filter(b =>
        (!st.value || b.status === st.value) &&
        (!gt.value || (gt.value === 'intl') === !!b.is_international) &&
        (!dt.value || (b.check_in <= dt.value && b.check_out > dt.value && ACTIVE.includes(b.status))) &&
        (!needle || b.reference.toLowerCase().includes(needle) || b.guest_name.toLowerCase().includes(needle) || b.email.includes(needle) || b.country.toLowerCase().includes(needle) || (digits.length >= 4 && b.phone_digits.includes(digits))));
      S.q = q.value; S.status = st.value; S.onDate = dt.value; S.guestType = gt.value;
      body.replaceChildren(rows.length ? h('div', { class: 'tablewrap' }, h('table', null,
        h('thead', null, h('tr', null, ['Reference', 'Guest', 'Room', 'Stay', 'Total', 'Payment', 'Status', ''].map((t, i) => h('th', { class: i === 4 ? 'num' : '' }, t)))),
        h('tbody', null, rows.slice(0, 300).map(b => h('tr', null,
          h('td', null, h('b', null, b.reference), b.modified_count ? h('span', { class: 'tag' }, 'modified') : null, b.cancel_requested_at ? h('span', { class: 'tag', style: 'background:#b83a2e22;color:#a03227' }, 'cancel request') : null, h('div', { class: 'mini' }, fmtTime(b.created_at))),
          h('td', null, b.guest_name, h('div', { class: 'mini' }, b.phone), h('div', { class: 'mini' }, b.country, ' ', guestTag(b))),
          h('td', null, `${b.rooms} × ${b.room_types.name}`, h('div', { class: 'mini' }, `${b.guests} guest${b.guests > 1 ? 's' : ''}`)),
          h('td', null, `${fmtDay(b.check_in)} → ${fmtDay(b.check_out)}`, h('div', { class: 'mini' }, `${nightsBetween(b.check_in, b.check_out)} nights`)),
          h('td', { class: 'num' }, money(b.total_amount), h('div', { class: 'mini' }, `Paid ${money(b.paid_amount)}`)),
          h('td', null, payTag(b)),
          h('td', null, badge(b.status)),
          h('td', null, h('button', { class: 'btn o small', onclick: () => openBooking(b.id) }, 'Open'))))))) :
        h('div', { class: 'empty' }, 'No reservations match.'),
        rows.length > 300 ? h('p', { class: 'mini' }, 'Showing the first 300. Narrow your search to see more.') : null);
    };
    S.redraw = draw;
    [q, st, gt, dt].forEach(el => el.addEventListener('input', draw));
    root.replaceChildren(h('h2', null, `Reservations (${S.bookings.length})`),
      h('div', { class: 'toolbar' }, h('label', null, 'Search', q), h('label', null, 'Status', st), h('label', null, 'Guests', gt), h('label', null, 'Staying on', dt),
        h('button', { class: 'btn o small', onclick: () => { q.value = ''; st.value = ''; gt.value = ''; dt.value = ''; draw(); } }, 'Clear')), body);
    draw();
  }

  // ---------------------------------------------------------- availability
  async function renderAvail() {
    const root = $('p-availability');
    const from = h('input', { type: 'date', value: S.avFrom });
    const days = h('select', null, ...[14, 21, 31].map(n => h('option', { value: n }, n + ' days')));
    days.value = S.avDays;
    const out = h('div', null, h('p', { class: 'mini' }, 'Loading…'));
    const draw = async () => {
      S.avFrom = from.value || todayISO(); S.avDays = +days.value;
      const r = await rpc('admin_availability', { p_from: S.avFrom, p_days: S.avDays });
      if (!r.ok) return out.replaceChildren(h('div', { class: 'alert bad' }, r.message));
      out.replaceChildren(h('div', { class: 'tablewrap' }, h('table', { class: 'avgrid' },
        h('thead', null, h('tr', null, h('th', null, 'Rooms free'), r.days.map(d => h('th', null, new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' }), h('br'), fmtDay(d))))),
        h('tbody', null, r.rows.map(row => h('tr', null, h('td', null, h('b', null, row.name), h('div', { class: 'mini' }, row.total + ' rooms')),
          row.free.map(f => { const p = row.total ? f / row.total : 0; return h('td', { class: f === 0 ? 'av-0' : p < .25 ? 'av-lo' : p < .6 ? 'av-mid' : 'av-hi' }, f); })))))),
        h('p', { class: 'mini' }, 'Counts drop automatically when a booking is made and return if it is cancelled, declined or edited.'));
    };
    [from, days].forEach(el => el.addEventListener('change', draw));
    root.replaceChildren(h('h2', null, 'Availability by room type'), h('div', { class: 'toolbar' }, h('label', null, 'From', from), h('label', null, 'Show', days)), out);
    draw();
  }

  // ----------------------------------------------------------- new booking
  function renderNew() {
    const root = $('p-new'), today = todayISO();
    const f = {
      name: h('input', { maxlength: 80, required: true }), email: h('input', { type: 'email', maxlength: 254, required: true }),
      phone: h('input', { type: 'tel', maxlength: 30, required: true }), country: countrySelect('Zambia'), pref: prefSelect('cash'),
      type: h('select', null, S.types.filter(t => t.active).map(t => h('option', { value: t.id }, `${t.name} – ${money(t.price_per_night)}`))),
      in: h('input', { type: 'date', min: today, value: today }), out: h('input', { type: 'date', min: addDays(today, 1), value: addDays(today, 1) }),
      rooms: h('input', { type: 'number', min: 1, max: 10, value: 1 }), guests: h('input', { type: 'number', min: 1, max: 60, value: 2 }),
      status: h('select', null, h('option', { value: 'confirmed' }, 'Confirmed (takes the rooms now)'), h('option', { value: 'pending' }, 'Pending (does not take rooms yet)')),
      notes: h('textarea', { maxlength: 500 })
    };
    const info = h('div', { class: 'quote' }, 'Pick dates to see live availability.'), out = h('div');
    const refresh = async () => {
      if (!f.in.value || f.out.value <= f.in.value) { info.textContent = 'Check-out must be after check-in.'; return; }
      const r = await rpc('get_availability', { p_in: f.in.value, p_out: f.out.value });
      if (!r.ok) { info.textContent = r.message; return; }
      const t = r.rooms.find(x => x.id === f.type.value); if (!t) return;
      const n = r.nights, q = parseInt(f.rooms.value, 10) || 1;
      info.replaceChildren(h('b', null, `${t.available} ${t.name}${t.available === 1 ? '' : 's'} free`), ` for ${n} night${n > 1 ? 's' : ''}. Total for ${q} room${q > 1 ? 's' : ''}: `, h('b', null, money(n * q * t.price_per_night)), '.');
    };
    [f.type, f.in, f.out, f.rooms].forEach(el => el.addEventListener('input', refresh));
    f.in.addEventListener('change', () => { f.out.min = addDays(f.in.value, 1); if (f.out.value <= f.in.value) f.out.value = addDays(f.in.value, 1); refresh(); });
    const form = h('form', { class: 'formcard', novalidate: true, onsubmit: async e => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
      const r = await rpc('admin_create_booking', { p_room_type: f.type.value, p_in: f.in.value, p_out: f.out.value, p_rooms: parseInt(f.rooms.value, 10) || 1,
        p_guests: parseInt(f.guests.value, 10) || 1, p_name: f.name.value, p_email: f.email.value, p_phone: f.phone.value, p_country: f.country.value,
        p_pref: f.pref.value, p_notes: f.notes.value || null, p_status: f.status.value });
      btn.disabled = false;
      if (!r.ok) return say(out, r.message, 'bad');
      out.replaceChildren(h('div', { class: 'alert ok' }, h('p', null, `Booking ${r.reference} created (${money(r.total)}). Give the guest this access code so they can manage the booking online:`), h('div', { class: 'code-reveal' }, r.access_code),
        h('p', { class: 'mini' }, 'It is shown only now. You can generate a new one later from the booking.')));
      form.reset(); f.country.value = 'Zambia'; await loadAll(); refresh();
    } },
      h('h2', null, 'Reserve a room for a guest (walk-in or phone)'),
      h('div', { class: 'form-grid' },
        h('label', { class: 'fld wide' }, 'Guest name', f.name), h('label', { class: 'fld' }, 'Email', f.email), h('label', { class: 'fld' }, 'Phone', f.phone),
        h('label', { class: 'fld' }, 'Country', f.country), h('label', { class: 'fld' }, 'Payment', f.pref),
        h('label', { class: 'fld' }, 'Room type', f.type), h('label', { class: 'fld' }, 'Status', f.status),
        h('label', { class: 'fld' }, 'Check-in', f.in), h('label', { class: 'fld' }, 'Check-out', f.out),
        h('label', { class: 'fld' }, 'Rooms', f.rooms), h('label', { class: 'fld' }, 'Guests', f.guests),
        h('label', { class: 'fld wide' }, 'Notes', f.notes)),
      info, out, h('button', { type: 'submit', class: 'btn' }, 'Create booking'));
    root.replaceChildren(form);
    refresh();
  }

  // ----------------------------------------------------------- block rooms
  function renderBlocks() {
    const root = $('p-blocks'), today = todayISO();
    const f = {
      type: h('select', null, S.types.filter(t => t.active).map(t => h('option', { value: t.id }, t.name))),
      from: h('input', { type: 'date', min: today, value: today }), to: h('input', { type: 'date', min: addDays(today, 1), value: addDays(today, 2) }),
      rooms: h('input', { type: 'number', min: 1, max: 500, value: 1 }), reason: h('input', { maxlength: 200, placeholder: 'e.g. Painting, repairs, owner use' })
    };
    const info = h('div', { class: 'quote' }, 'Pick dates to see how many rooms are free to block.'), out = h('div'), listHost = h('div');
    const refresh = async () => {
      if (!f.from.value || f.to.value <= f.from.value) { info.textContent = 'The end date must be after the start date.'; return; }
      const r = await rpc('get_availability', { p_in: f.from.value, p_out: f.to.value });
      if (!r.ok) { info.textContent = r.message; return; }
      const t = r.rooms.find(x => x.id === f.type.value); if (t) info.replaceChildren(h('b', null, `${t.available} ${t.name}${t.available === 1 ? '' : 's'}`), ' free for the whole period. Only free rooms can be blocked.');
    };
    [f.type, f.from, f.to].forEach(el => el.addEventListener('input', refresh));
    f.from.addEventListener('change', () => { f.to.min = addDays(f.from.value, 1); if (f.to.value <= f.from.value) f.to.value = addDays(f.from.value, 1); refresh(); });
    const drawList = () => {
      const rows = S.blocks.filter(k => k.date_to > today);
      listHost.replaceChildren(rows.length ? h('div', { class: 'tablewrap' }, h('table', null,
        h('thead', null, h('tr', null, ['Room type', 'From', 'Free again on', 'Rooms blocked', 'Reason', ''].map(t => h('th', null, t)))),
        h('tbody', null, rows.map(k => h('tr', null, h('td', null, k.room_types.name), h('td', null, fmtDate(k.date_from)), h('td', null, fmtDate(k.date_to)), h('td', null, k.rooms), h('td', null, k.reason || ''),
          h('td', null, h('button', { class: 'btn danger o small', onclick: async () => {
            if (!confirm(`Remove this block of ${k.rooms} ${k.room_types.name}? Those rooms become available to guests again.`)) return;
            const r = await rpc('admin_remove_block', { p_id: k.id }); if (!r.ok) return toast(r.message, 'bad');
            toast('Block removed. The rooms are available again.'); await loadAll(); refresh();
          } }, 'Remove'))))))) : h('div', { class: 'empty' }, 'No rooms are blocked at the moment.'));
    };
    S.redraw = drawList;
    const form = h('form', { class: 'formcard', novalidate: true, onsubmit: async e => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
      const r = await rpc('admin_create_block', { p_type: f.type.value, p_from: f.from.value, p_to: f.to.value, p_rooms: parseInt(f.rooms.value, 10) || 1, p_reason: f.reason.value || null });
      btn.disabled = false;
      if (!r.ok) return say(out, r.message, 'bad');
      say(out, 'Rooms blocked. They are no longer offered to guests for those nights.', 'ok'); f.reason.value = ''; await loadAll(); refresh();
    } },
      h('div', { class: 'form-grid' },
        h('label', { class: 'fld wide' }, 'Room type', f.type),
        h('label', { class: 'fld' }, 'Block from (first night)', f.from), h('label', { class: 'fld' }, 'Free again on', f.to),
        h('label', { class: 'fld' }, 'How many rooms', f.rooms), h('label', { class: 'fld' }, 'Reason (staff only)', f.reason)),
      info, out, h('button', { type: 'submit', class: 'btn' }, 'Block these rooms'));
    root.replaceChildren(h('h2', null, 'Block rooms'),
      h('p', { class: 'lead-sm' }, 'Take rooms out of sale for repairs, events or owner use. Blocked rooms are removed from availability straight away, just like accepted bookings, and guests cannot book them.'),
      form, h('h2', { style: 'margin-top:28px' }, 'Current and upcoming blocks'), listHost);
    drawList(); refresh();
  }

  // ---------------------------------------------------------- rooms & rates
  async function renderRooms() {
    const root = $('p-rooms');
    const rows = S.types.map(t => {
      const price = h('input', { type: 'number', min: 1, step: '0.01', value: t.price_per_night });
      const total = h('input', { type: 'number', min: 0, max: 500, value: t.total_rooms });
      const mg = h('input', { type: 'number', min: 1, max: 12, value: t.max_guests });
      const act = h('input', { type: 'checkbox', checked: t.active });
      return h('tr', null, h('td', null, h('b', null, t.name)), h('td', null, price), h('td', null, total), h('td', null, mg), h('td', null, act),
        h('td', null, h('button', { class: 'btn small', onclick: async e => {
          e.target.disabled = true;
          const r = await rpc('admin_update_room_type', { p_id: t.id, p_price: parseFloat(price.value), p_total: parseInt(total.value, 10), p_max_guests: parseInt(mg.value, 10), p_active: act.checked });
          e.target.disabled = false;
          if (!r.ok) return toast(r.message, 'bad');
          toast(t.name + ' updated.'); loadAll();
        } }, 'Save')));
    });
    const audit = h('div', null);
    root.replaceChildren(h('h2', null, 'Rooms & rates'),
      h('p', { class: 'lead-sm' }, 'Prices apply to new bookings and changes straight away. Availability is worked out as total rooms minus the rooms held by pending, accepted and checked-in bookings on each night. It updates by itself.'),
      h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, ['Room type', 'Price / night (K)', 'Total rooms', 'Guests / room', 'Open for booking', ''].map(t => h('th', null, t)))), h('tbody', null, rows))),
      h('h2', { style: 'margin-top:28px' }, 'Recent changes'), audit);
    const { data } = await sb.from('audit_log').select('*').order('created_at', { ascending: false }).limit(15);
    audit.replaceChildren(data && data.length ? h('ul', { class: 'hist' }, data.map(a => h('li', null,
      h('span', null, `${a.details.room || ''}: price ${money(a.details.before.price)} → ${money(a.details.after.price)}, rooms ${a.details.before.total} → ${a.details.after.total}`), h('span', null, fmtTime(a.created_at))))) : h('p', { class: 'mini' }, 'No changes yet.'));
  }

  // --------------------------------------------------------- notifications
  function renderNotifs() {
    const root = $('p-notifications');
    root.replaceChildren(h('h2', null, 'Notifications'),
      h('div', { class: 'toolbar' }, h('button', { class: 'btn o small', onclick: async () => { await rpc('admin_mark_notifications', {}); await loadAll(); } }, 'Mark all as read')),
      S.notifs.length ? h('div', { class: 'tablewrap' }, S.notifs.map(n => h('div', { class: 'n-item' + (n.is_read ? '' : ' unread'), tabindex: 0, role: 'button',
        onclick: async () => { if (!n.is_read) { await rpc('admin_mark_notifications', { p_ids: [n.id] }); n.is_read = true; renderBadges(); } if (n.booking_id) openBooking(n.booking_id); renderNotifs(); },
        onkeydown: e => { if (e.key === 'Enter') e.currentTarget.click(); } },
        h('i'), h('div', null, h('div', { class: 't' }, n.title), h('div', { class: 's' }, n.body), h('div', { class: 'w' }, fmtTime(n.created_at)))))) :
        h('div', { class: 'empty' }, 'No notifications yet. New bookings, changes and cancellations will appear here live.'));
  }

  // ------------------------------------------------------- booking dialog
  async function setStatus(id, status, confirmText) {
    if (confirmText && !confirm(confirmText)) return;
    const r = await rpc('admin_set_status', { p_id: id, p_status: status });
    if (!r.ok) return toast(r.message, 'bad');
    toast(status === 'confirmed' ? 'Accepted. The rooms are now taken off availability.' : 'Status updated.'); await loadAll(); if (dlgId === id) openBooking(id);
  }
  const summ = x => x ? `${x.rooms} × ${typeName(x.room_type_id)}, ${fmtDay(x.check_in)} → ${fmtDay(x.check_out)}, ${money(x.total)}` : '';
  function describe(ev) {
    const d = ev.details || {};
    switch (ev.kind) {
      case 'created': return `Booking created by ${ev.actor}${d.country ? ' (' + d.country + ')' : ''}.`;
      case 'modified': return `Customer changed the booking: ${summ(d.before)}  →  ${summ(d.after)}. ${d.after && d.after.status === 'pending' ? 'Back to pending.' : 'Still accepted (paid).'}`;
      case 'cancel_requested': return `Customer asked to cancel${d.reason ? ': ' + d.reason : '.'}`;
      case 'cancel_withdrawn': return 'Customer withdrew the cancellation request.';
      case 'cancel_rejected': return 'Cancellation request dismissed by staff.';
      case 'status': return `Status changed: ${d.from} → ${d.to}${d.why ? ' (' + d.why + ')' : ''}.`;
      case 'payment': return `Payment of ${money(d.amount)} recorded${d.method ? ' (' + String(d.method).replace('_', ' ') + ')' : ''}${d.provider ? ' via ' + d.provider : ''}${d.receipt_no ? ', receipt ' + d.receipt_no : ''}${d.rooms_taken ? '. Rooms taken.' : '.'}`;
      case 'payment_review': return `Payment needs review: ${d.note || ''}`;
      case 'admin_edit': return `Edited by staff: ${d.rooms} × ${d.room}, ${fmtDay(d.check_in)} → ${fmtDay(d.check_out)}, ${money(d.total)}.`;
      case 'code_reset': return 'Access code reset by staff.';
      default: return ev.kind;
    }
  }

  async function openBooking(id) {
    const b = S.bookings.find(x => x.id === id); if (!b) return;
    dlgId = id;
    const dlg = $('dlg');
    const [ev, pay, pin] = await Promise.all([
      sb.from('booking_events').select('*').eq('booking_id', id).order('created_at', { ascending: false }),
      sb.from('payments').select('*').eq('booking_id', id).order('created_at', { ascending: false }),
      sb.from('payment_intents').select('*').eq('booking_id', id).order('created_at', { ascending: false })]);   // always fresh, never a stale list
    const payments = pay.data || [], intents = pin.data || [];
    const balance = Math.max(Number(b.total_amount) - Number(b.paid_amount), 0);
    const closed = ['cancelled', 'declined', 'no_show', 'checked_out'].includes(b.status);
    const kv = (k, v) => h('div', null, h('span', null, k), h('b', null, v));
    const act = (label, status, cls, ask) => h('button', { class: 'btn small ' + (cls || ''), onclick: () => setStatus(id, status, ask) }, label);
    const buttons = {
      pending: [act('Accept booking', 'confirmed'), act('Decline', 'declined', 'danger o', 'Decline booking ' + b.reference + '?'), act('Cancel', 'cancelled', 'danger o', 'Cancel booking ' + b.reference + '?')],
      confirmed: [act('Check in', 'checked_in'), act('Mark no-show', 'no_show', 'o', 'Mark as no-show?'), act('Cancel', 'cancelled', 'danger o', 'Cancel booking ' + b.reference + '?'), act('Back to pending', 'pending', 'o', 'Move back to pending? The rooms are released until you accept it again.')],
      checked_in: [act('Check out', 'checked_out')]
    }[b.status] || [];
    const slot = h('div'), out = h('div');
    const paidRows = payments.filter(p => p.status === 'paid').map(p => ({ receipt_no: p.receipt_no, amount: p.amount, method: p.method, provider: p.provider, paid_at: p.created_at })).reverse();
    const png = (mode, action, label) => h('button', { class: 'btn o small', onclick: async () => {
      try { await CL.ticket.make(mode, fullBooking(b), paidRows, action); } catch (e) { toast('Could not create the image.', 'bad'); }
    } }, label);

    const editBtn = h('button', { class: 'btn o small', onclick: () => slot.replaceChildren(editForm()) }, 'Edit booking');
    const payBtn = h('button', { class: 'btn o small', onclick: () => slot.replaceChildren(payForm()) }, 'Record payment');
    const codeBtn = h('button', { class: 'btn o small', onclick: async () => {
      if (!confirm('Create a new access code? The old one will stop working.')) return;
      const r = await rpc('admin_reset_code', { p_id: id });
      if (!r.ok) return toast(r.message, 'bad');
      out.replaceChildren(h('div', { class: 'alert ok' }, h('p', null, 'New access code for ' + r.reference + ' (shown only now):'), h('div', { class: 'code-reveal' }, r.access_code)));
    } }, 'Reset access code');
    const delBtn = ['cancelled', 'declined', 'no_show'].includes(b.status) && !payments.length ? h('button', { class: 'btn danger o small', onclick: async () => {
      if (!confirm(`Permanently delete booking ${b.reference}? This cannot be undone (it is recorded in the audit log).`)) return;
      const r = await rpc('admin_delete_booking', { p_id: id }); if (!r.ok) return toast(r.message, 'bad');
      toast('Booking deleted.'); dlg.close(); await loadAll();
    } }, 'Delete booking') : null;

    function editForm() {
      const f = {
        name: h('input', { value: b.guest_name, maxlength: 80 }), email: h('input', { type: 'email', value: b.email, maxlength: 254 }), phone: h('input', { type: 'tel', value: b.phone, maxlength: 30 }),
        country: countrySelect(b.country), pref: prefSelect(b.payment_pref),
        type: h('select', null, S.types.map(t => h('option', { value: t.id }, `${t.name} – ${money(t.price_per_night)}`))),
        in: h('input', { type: 'date', value: b.check_in }), out: h('input', { type: 'date', value: b.check_out }),
        rooms: h('input', { type: 'number', min: 1, max: 10, value: b.rooms }), guests: h('input', { type: 'number', min: 1, max: 60, value: b.guests }),
        notes: h('textarea', { maxlength: 500 }, b.notes || '')
      };
      f.type.value = b.room_type_id;
      const msg = h('div');
      return h('form', { novalidate: true, onsubmit: async e => {
        e.preventDefault();
        const r = await rpc('admin_modify_booking', { p_id: id, p_room_type: f.type.value, p_in: f.in.value, p_out: f.out.value, p_rooms: parseInt(f.rooms.value, 10) || 1,
          p_guests: parseInt(f.guests.value, 10) || 1, p_name: f.name.value, p_email: f.email.value, p_phone: f.phone.value, p_country: f.country.value, p_pref: f.pref.value, p_notes: f.notes.value || null });
        if (!r.ok) return say(msg, r.message, 'bad');
        toast('Booking saved. New total ' + money(r.total)); await loadAll(); openBooking(id);
      } },
        h('div', { class: 'form-grid' },
          h('label', { class: 'fld wide' }, 'Guest name', f.name), h('label', { class: 'fld' }, 'Email', f.email), h('label', { class: 'fld' }, 'Phone', f.phone),
          h('label', { class: 'fld' }, 'Country', f.country), h('label', { class: 'fld' }, 'Payment choice', f.pref),
          h('label', { class: 'fld wide' }, 'Room type', f.type), h('label', { class: 'fld' }, 'Check-in', f.in), h('label', { class: 'fld' }, 'Check-out', f.out),
          h('label', { class: 'fld' }, 'Rooms', f.rooms), h('label', { class: 'fld' }, 'Guests', f.guests), h('label', { class: 'fld wide' }, 'Notes', f.notes)),
        msg, h('div', { class: 'actions', style: 'margin-top:12px' }, h('button', { class: 'btn small', type: 'submit' }, 'Save changes'), h('button', { class: 'btn o small', type: 'button', onclick: () => slot.replaceChildren() }, 'Close')));
    }
    function payForm() {
      const amt = h('input', { type: 'number', min: 1, step: '0.01', value: balance, max: balance });
      const method = h('select', null, [['cash', 'Cash'], ['mobile_money', 'Mobile money'], ['card', 'Card (at the lodge)'], ['bank_transfer', 'Bank transfer']].map(([v, l]) => h('option', { value: v }, l)));
      if (b.payment_pref === 'bank_transfer') method.value = 'bank_transfer';
      const note = h('input', { maxlength: 300, placeholder: 'Receipt or transaction no. (optional)' }), msg = h('div');
      return h('form', { novalidate: true, onsubmit: async e => {
        e.preventDefault();
        const r = await rpc('admin_record_payment', { p_id: id, p_amount: parseFloat(amt.value), p_method: method.value, p_note: note.value || null });
        if (!r.ok) return say(msg, r.message, 'bad');
        toast('Payment recorded. Receipt ' + r.receipt_no); await loadAll(); openBooking(id);
      } },
        h('div', { class: 'inl' }, h('label', { class: 'fld' }, 'Amount (K)', amt), h('label', { class: 'fld' }, 'Method', method), h('label', { class: 'fld' }, 'Reference', note)),
        msg, h('div', { class: 'actions', style: 'margin-top:12px' }, h('button', { class: 'btn small', type: 'submit' }, 'Record payment'), h('button', { class: 'btn o small', type: 'button', onclick: () => slot.replaceChildren() }, 'Close')));
    }

    const [ptxt] = payInfo(b);
    dlg.replaceChildren(
      h('div', { class: 'd-head' }, h('span', null, h('span', { class: 'bk-ref' }, b.reference), '  ', badge(b.status), b.modified_count ? h('span', { class: 'tag' }, `modified ${b.modified_count}×`) : null),
        h('button', { 'aria-label': 'Close', onclick: () => dlg.close() }, '×')),
      h('div', { class: 'd-body' },
        b.cancel_requested_at ? h('div', { class: 'badbox' }, h('b', null, 'The guest has asked to cancel this booking.'), h('p', { style: 'margin:6px 0 0' }, b.cancel_reason ? 'Reason: ' + b.cancel_reason : 'No reason given.', +b.paid_amount > 0 ? ` They have paid ${money(b.paid_amount)}, which you must refund yourself if you cancel.` : ''),
          h('div', { class: 'actions', style: 'margin-top:10px' }, h('button', { class: 'btn danger small', onclick: () => resolveCancel(b, true) }, 'Approve cancellation'), h('button', { class: 'btn o small', onclick: () => resolveCancel(b, false) }, 'Keep the booking'))) : null,
        h('div', { class: 'kv' }, kv('Guest', b.guest_name), kv('Email', b.email), kv('Phone', b.phone), kv('Country', h('span', null, b.country + ' ', guestTag(b))),
          kv('Room', `${b.rooms} × ${b.room_types.name}`), kv('Guests', b.guests),
          kv('Check-in', fmtDate(b.check_in)), kv('Check-out', fmtDate(b.check_out)), kv('Nights', nightsBetween(b.check_in, b.check_out)),
          kv('Total', money(b.total_amount)), kv('Paid', money(b.paid_amount)), kv('Balance', money(balance)),
          kv('Payment status', payTag(b)), kv('Guest chose', PREF[b.payment_pref] || ''), kv('Booked', fmtTime(b.created_at) + (b.source === 'admin' ? ' (by staff)' : '')),
          b.accepted_at ? kv('Accepted', fmtTime(b.accepted_at)) : null, b.notes ? kv('Notes', b.notes) : null),
        h('div', { class: 'actions' }, buttons, closed ? null : editBtn, closed || balance <= 0 ? null : payBtn, codeBtn, delBtn),
        h('div', { class: 'actions' }, png('confirmation', 'download', 'Download confirmation (PNG)'), paidRows.length ? png('receipt', 'download', 'Download receipt (PNG)') : null, png(paidRows.length ? 'receipt' : 'confirmation', 'print', 'Print')),
        slot, out,
        intents.length ? h('div', null, h('h3', { style: 'font-size:20px;margin-bottom:6px' }, 'Online payment attempts (Lenco)'),
          h('ul', { class: 'hist' }, intents.map(i => h('li', null,
            h('span', null, `${i.reference} · ${money(i.amount)} · `, h('b', null, i.status.replace('_', ' ')), i.note ? ` · ${i.note}` : '', i.failure_reason ? ` · ${i.failure_reason}` : ''),
            h('span', null, fmtTime(i.created_at), ' ',
              ['initiated', 'pending', 'expired'].includes(i.status) ? h('button', { class: 'btn o small', onclick: async e => {
                e.target.disabled = true;
                const r = await CL.pay.verify(i.reference);
                if (!r.ok) { toast(r.message || 'Could not check this payment.', 'bad'); e.target.disabled = false; return; }
                toast(r.state === 'successful' ? 'Payment confirmed with Lenco.' : 'Lenco status: ' + r.state);
                if (r.state === 'successful') await CL.pay.afterPaid(r, fullBooking(b));
                await loadAll(); openBooking(id);
              } }, 'Check with Lenco') : null)))),
          h('p', { class: 'mini' }, 'Payments are only ever added after the system has confirmed them directly with Lenco.')) : null,
        payments.length ? h('div', null, h('h3', { style: 'font-size:20px;margin-bottom:6px' }, 'Payments received'),
          h('ul', { class: 'hist' }, payments.map(p => h('li', null, h('span', null, `${p.receipt_no || ''} · ${money(p.amount)} · ${METHOD[p.method] || p.method}${p.note ? ' · ' + p.note : ''}`), h('span', null, fmtTime(p.created_at)))))) : null,
        h('div', null, h('h3', { style: 'font-size:20px;margin-bottom:6px' }, 'History'),
          ev.data && ev.data.length ? h('ul', { class: 'hist' }, ev.data.map(e => h('li', null, h('span', null, describe(e)), h('span', null, fmtTime(e.created_at))))) : h('p', { class: 'mini' }, 'No history.'))));
    if (!dlg.open) dlg.showModal();
  }
  $('dlg').addEventListener('click', e => { if (e.target === $('dlg')) $('dlg').close(); });
  $('dlg').addEventListener('close', () => { dlgId = null; });
})();

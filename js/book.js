(() => {
  'use strict';
  const { h, money, fmtDate, todayISO, addDays, toast, rpc } = CL;
  const $ = id => document.getElementById(id);
  const qs = new URLSearchParams(location.search);
  const num = (v, d, lo, hi) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : d; };
  const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

  const inEl = $('in'), outEl = $('out'), gEl = $('guests'), rEl = $('rooms');
  const today = todayISO();
  inEl.min = today; outEl.min = addDays(today, 1);
  inEl.value = isDate(qs.get('in')) && qs.get('in') >= today ? qs.get('in') : addDays(today, 1);
  outEl.value = isDate(qs.get('out')) && qs.get('out') > inEl.value ? qs.get('out') : addDays(inEl.value, 2);
  gEl.value = num(qs.get('guests'), 2, 1, 60);
  rEl.value = num(qs.get('rooms'), 1, 1, 10);

  let types = [], nights = 0, chosen = null, busy = false, lastKey = '';

  if (!CL.configured) $('offline').hidden = false;

  function showStep(n) {
    ['s1', 's2', 's3'].forEach((id, i) => { $(id).hidden = i !== n - 1; });
    [...$('steps').children].forEach((li, i) => {
      li.className = i === n - 1 ? 'on' : (i < n - 1 ? 'done' : '');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const say = (el, text, kind) => el.replaceChildren(text ? h('div', { class: 'alert ' + (kind || '') }, text) : '');

  function validDates() { return inEl.value && outEl.value && outEl.value > inEl.value; }

  async function search(silent) {
    if (!validDates()) { if (!silent) say($('msg'), 'Please choose a check-out date after your check-in date.', 'bad'); return; }
    const key = inEl.value + outEl.value;
    if (!silent) say($('msg'), '');
    const res = await rpc('get_availability', { p_in: inEl.value, p_out: outEl.value });
    if (!res.ok) { if (!silent) say($('msg'), res.message, 'bad'); return; }
    types = res.rooms; nights = res.nights; lastKey = key;
    if (chosen) { const fresh = types.find(t => t.id === chosen.id); if (fresh) chosen = fresh; }
    renderResults();
  }

  function renderResults() {
    const rooms = num(rEl.value, 1, 1, 10), guests = num(gEl.value, 2, 1, 60);
    const box = $('results');
    if (!types.length) { box.replaceChildren(h('p', { class: 'mini' }, 'No room types are open for booking right now.')); return; }
    box.replaceChildren(
      h('p', { class: 'mini' }, `${nights} night${nights > 1 ? 's' : ''}: ${fmtDate(inEl.value)} to ${fmtDate(outEl.value)} · ${rooms} room${rooms > 1 ? 's' : ''} · ${guests} guest${guests > 1 ? 's' : ''}`),
      ...types.map(t => {
        const sleepsOk = guests <= rooms * t.max_guests;
        const fits = t.available >= rooms && sleepsOk;
        let pill;
        if (t.available === 0) pill = h('span', { class: 'pill out' }, 'Sold out for these dates');
        else if (t.available < rooms) pill = h('span', { class: 'pill low' }, `Only ${t.available} left`);
        else if (t.available <= 5) pill = h('span', { class: 'pill low' }, `Only ${t.available} left`);
        else pill = h('span', { class: 'pill' }, 'Available');
        const note = !sleepsOk && t.available >= rooms ? `Sleeps ${t.max_guests} per room. Add rooms for ${guests} guests.` : `Sleeps ${t.max_guests} per room`;
        return h('article', { class: 'room' + (fits ? '' : ' off') },
          h('div', null, h('h3', null, t.name), h('p', null, t.description), h('p', { class: 'mini' }, note), pill),
          h('div', { class: 'room-buy' },
            h('div', { class: 'price' }, money(t.price_per_night), h('small', null, ' / night')),
            h('div', { class: 'mini' }, `${money(t.price_per_night * nights * rooms)} for ${nights} night${nights > 1 ? 's' : ''}, ${rooms} room${rooms > 1 ? 's' : ''}`),
            h('button', { type: 'button', class: 'btn', disabled: !fits, onclick: () => choose(t) }, fits ? 'Select' : 'Unavailable')));
      }));
  }

  function choose(t) {
    chosen = t;
    const rooms = num(rEl.value, 1, 1, 10), guests = num(gEl.value, 2, 1, 60);
    const total = t.price_per_night * nights * rooms;
    $('summary').replaceChildren(
      h('h3', null, 'Your stay'),
      h('dl', null,
        h('dt', null, 'Room'), h('dd', null, t.name),
        h('dt', null, 'Check-in'), h('dd', null, fmtDate(inEl.value)),
        h('dt', null, 'Check-out'), h('dd', null, fmtDate(outEl.value)),
        h('dt', null, 'Nights'), h('dd', null, nights),
        h('dt', null, 'Rooms'), h('dd', null, rooms),
        h('dt', null, 'Guests'), h('dd', null, guests),
        h('dt', null, 'Rate'), h('dd', null, `${money(t.price_per_night)} / night`)),
      h('div', { class: 'tot' }, h('span', null, 'Total'), h('span', null, money(total))),
      h('p', { class: 'mini', style: 'margin-top:8px' }, 'Your rooms are held when the lodge accepts your booking, or when you pay online. The final amount is always calculated by Center Lodge.'));
    say($('formMsg'), '');
    showStep(2);
  }

  $('searchForm').addEventListener('submit', e => { e.preventDefault(); search(false); });
  let timer;
  const soon = () => { clearTimeout(timer); timer = setTimeout(() => search(true), 350); };
  inEl.addEventListener('change', () => {
    if (inEl.value) { outEl.min = addDays(inEl.value, 1); if (!outEl.value || outEl.value <= inEl.value) outEl.value = addDays(inEl.value, 1); }
    soon();
  });
  outEl.addEventListener('change', soon);
  [gEl, rEl].forEach(el => el.addEventListener('input', () => { if (types.length) renderResults(); }));
  $('back').addEventListener('click', () => { showStep(1); search(true); });
  setInterval(() => { if (!document.hidden && !$('s1').hidden && types.length) search(true); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('s1').hidden && types.length) search(true); });

  // ---- country list and payment choices
  const countrySel = $('country');
  countrySel.append(...CL_COUNTRIES.map(c => h('option', { value: c }, c)));
  if (CL.pay.enabled()) $('payOnlineOpt').hidden = false;
  const chosenPref = () => (document.querySelector('input[name=pay]:checked') || {}).value || 'cash';

  $('detailsForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (busy || !chosen) return;
    const name = $('name').value.trim(), email = $('email').value.trim(), phone = $('phone').value.trim(), country = countrySel.value;
    const msg = $('formMsg');
    if (name.length < 2) return say(msg, 'Please enter your full name.', 'bad');
    if (!$('email').checkValidity() || !email) return say(msg, 'Please enter a valid email address.', 'bad');
    if (phone.replace(/\D/g, '').length < 9) return say(msg, 'Please enter a valid phone number.', 'bad');
    if (!country) return say(msg, 'Please choose the country you are travelling from.', 'bad');
    if (!$('agree').checked) return say(msg, 'Please tick the box to continue.', 'bad');
    const pref = chosenPref(), rooms = num(rEl.value, 1, 1, 10), guests = num(gEl.value, 2, 1, 60), notes = $('notes').value.trim();
    busy = true; const btn = $('confirm'); btn.disabled = true; btn.textContent = 'Reserving…'; say(msg, '');
    const res = await rpc('create_booking', {
      p_room_type: chosen.id, p_in: inEl.value, p_out: outEl.value, p_rooms: rooms, p_guests: guests,
      p_name: name, p_email: email, p_phone: phone, p_country: country, p_pref: pref, p_notes: notes || null, p_hp: $('hp').value
    });
    busy = false; btn.disabled = false; btn.textContent = 'Confirm reservation';
    if (!res.ok) {
      say(msg, res.message, 'bad');
      if (res.error === 'not_available' || res.error === 'invalid_stay') { await search(true); }
      return;
    }
    const full = {
      reference: res.reference, guest_name: name, email, phone, country: res.country, room_type: res.room, rooms, guests,
      check_in: inEl.value, check_out: outEl.value, nights: res.nights, status: res.status, total: res.total, paid: 0, balance: res.total,
      payment_pref: res.payment_pref, notes, created_at: new Date().toISOString()
    };
    $('detailsForm').reset();
    CL.mail.newBooking(full);                      // email to the lodge (Web3Forms); never blocks the guest
    renderDone(res, full);
  });

  function copyBtn(text) {
    return h('button', { type: 'button', class: 'btn o small', onclick: async () => {
      try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { toast('Select the text and copy it manually.', 'bad'); }
    } }, 'Copy');
  }

  // ---- confirmation screen: details, payment, PNG download, print
  function renderDone(res, full) {
    const state = { booking: full, payments: [], code: res.access_code };
    const payHost = h('div');
    const dl = h('div', { class: 'dl-row no-print' });
    const png = (mode, action) => async () => {
      try { await CL.ticket.make(mode, state.booking, state.payments, action); } catch (e) { toast('Could not create the image. Please try again.', 'bad'); }
    };
    const drawButtons = () => dl.replaceChildren(
      h('button', { type: 'button', class: 'btn', onclick: png('confirmation', 'download') }, 'Download confirmation (PNG)'),
      state.payments.length ? h('button', { type: 'button', class: 'btn', onclick: png('receipt', 'download') }, 'Download receipt (PNG)') : null,
      h('button', { type: 'button', class: 'btn o', onclick: png(state.payments.length ? 'receipt' : 'confirmation', 'print') }, 'Print'));
    drawButtons();

    const box = (kind, title, text, ...extra) => h('div', { class: 'paybox ' + kind }, h('b', null, title), h('p', { style: 'margin:6px 0 0' }, text), extra.length ? h('div', { class: 'actions' }, extra) : null);
    const showPay = (kind, title, text, ...extra) => payHost.replaceChildren(box(kind, title, text, ...extra));

    async function runPayment() {
      showPay('wait', 'Online payment', 'Opening the secure payment window…');
      const r = await CL.pay.start({ reference: full.reference, code: state.code, onStatus: m => showPay('wait', 'Online payment', m) });
      await handleResult(r);
    }
    async function handleResult(r) {
      const again = h('button', { type: 'button', class: 'btn small', onclick: runPayment }, 'Try payment again');
      if (!r.ok) return showPay('bad', 'Payment not started', r.message || 'Something went wrong. Please try again.', again);
      if (r.state === 'successful') {
        const b = r.booking;
        state.booking = { ...state.booking, status: b.status, paid: b.paid, total: b.total, balance: b.balance };
        state.payments = [{ receipt_no: r.payment.receipt_no, amount: r.payment.amount, method: 'online', provider: 'lenco', paid_at: r.payment.paid_at }];
        CL.pay.afterPaid(r, state.booking);        // emails the lodge if the server could not
        showPay('ok', 'Payment confirmed', `Thank you! ${money(r.payment.amount)} received. Receipt ${r.payment.receipt_no}. ${b.status === 'confirmed' ? 'Your booking is accepted and your rooms are held.' : 'The lodge will confirm your rooms shortly.'}`);
        drawButtons(); return;
      }
      if (r.state === 'pending') return showPay('wait', 'Payment pending', CL.pay.MESSAGES.pending, h('button', { type: 'button', class: 'btn small', onclick: async () => handleResult(await CL.pay.poll(r.intent || r.reference, { tries: 3, every: 2500 })) }, 'Check payment status'));
      if (r.state === 'needs_review') return showPay('wait', 'Payment received', CL.pay.MESSAGES.needs_review);
      if (r.state === 'failed') return showPay('bad', 'Payment failed', r.message || CL.pay.MESSAGES.failed, again);
      showPay('wait', 'Payment not completed', CL.pay.MESSAGES.closed, h('button', { type: 'button', class: 'btn small', onclick: runPayment }, 'Proceed to payment'));
    }

    if (full.payment_pref === 'online') {
      showPay('wait', 'Online payment', 'Opening the secure payment window…');
    } else if (full.payment_pref === 'bank_transfer') {
      const bk = CL.site.bank;
      payHost.replaceChildren(bk.accountNumber
        ? h('div', { class: 'bank-box' }, h('b', null, 'Pay by bank transfer'),
            h('dl', null, bk.bankName ? [h('dt', null, 'Bank'), h('dd', null, bk.bankName)] : null,
              bk.accountName ? [h('dt', null, 'Account name'), h('dd', null, bk.accountName)] : null,
              h('dt', null, 'Account number'), h('dd', null, bk.accountNumber),
              bk.branch ? [h('dt', null, 'Branch'), h('dd', null, bk.branch)] : null,
              h('dt', null, 'Reference'), h('dd', null, full.reference),
              h('dt', null, 'Amount'), h('dd', null, money(full.total))),
            bk.note ? h('p', { class: 'mini', style: 'margin:8px 0 0' }, bk.note) : null)
        : box('wait', 'Pay by bank transfer', 'The lodge will contact you with the bank details. Please quote your booking reference when you pay.'));
    } else {
      payHost.replaceChildren(box('ok', 'Pay at the lodge', 'No payment is needed now. You can pay when you arrive.'));
    }

    $('s3').replaceChildren(h('div', { class: 'done-box' },
      h('h2', null, 'Reservation received'),
      h('p', { class: 'lead-sm', style: 'margin-inline:auto' }, `Thank you, ${full.guest_name.split(' ')[0]}. Your request for ${full.rooms} × ${res.room} is awaiting acceptance by our team. Your rooms are held once the lodge accepts it${full.payment_pref === 'online' ? ', or as soon as your online payment is confirmed' : ''}. Follow its status on the My bookings page.`),
      h('div', { class: 'codes' },
        h('div', null, h('span', null, 'Booking reference'), h('b', null, res.reference), copyBtn(res.reference)),
        h('div', null, h('span', null, 'Access code'), h('b', null, res.access_code), copyBtn(res.access_code))),
      h('div', { class: 'alert' }, 'Save your access code now. For your security it is shown only once, and you need it to change your booking, ask for a cancellation, pay later or download your receipt.'),
      h('p', null, `${res.nights} night${res.nights > 1 ? 's' : ''} · total ${money(res.total)}`),
      payHost, dl,
      h('div', { style: 'display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:18px' },
        h('a', { class: 'btn o', href: 'manage.html' }, 'Track my booking'),
        h('a', { class: 'btn o', href: 'book.html' }, 'Book another'))));
    showStep(3);
    if (full.payment_pref === 'online') runPayment();
  }

  if (CL.configured) search(true);
})();

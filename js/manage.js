(() => {
  'use strict';
  const { h, money, fmtDate, todayISO, addDays, nightsBetween, badge, toast, rpc } = CL;
  const $ = id => document.getElementById(id);
  const say = (el, text, kind) => el.replaceChildren(text ? h('div', { class: 'alert ' + (kind || '') }, text) : '');
  let contact = '', busy = false, refreshTimer;
  const codes = {};                                   // access codes remembered for this visit only (never stored)

  if (!CL.configured) $('offline').hidden = false;
  const FLOW = [['pending', 'Received'], ['confirmed', 'Accepted'], ['checked_in', 'Checked in'], ['checked_out', 'Completed']];

  const payLabel = b => {
    const paid = +b.paid_amount, tot = +b.total_amount;
    if (tot > 0 && paid >= tot) return ['Paid in full', 'paid'];
    if (paid > 0) return [`Part paid, balance ${money(tot - paid)}`, 'part'];
    return [{ cash: 'Pay at the lodge (cash)', bank_transfer: 'Awaiting bank transfer', online: 'Awaiting online payment' }[b.payment_pref] || 'Unpaid', 'wait'];
  };

  $('lookupForm').addEventListener('submit', async e => {
    e.preventDefault();
    contact = $('contact').value.trim();
    if (!contact) return;
    await load(false);
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => { if (!document.hidden && !document.querySelector('.editor, .code-inline')) load(true); }, 120000);
  });

  async function load(silent) {
    if (busy) return; busy = true;
    const btn = $('findBtn'); if (!silent) { btn.disabled = true; btn.textContent = 'Searching…'; }
    const res = await rpc('lookup_bookings', { p_contact: contact });
    busy = false; btn.disabled = false; btn.textContent = 'Find my bookings';
    if (!res.ok) { if (!silent) { say($('msg'), res.message, 'bad'); $('list').replaceChildren(); } return; }
    say($('msg'), '');
    render(res.bookings);
  }

  function render(rows) {
    const box = $('list');
    if (!rows.length) {
      box.replaceChildren(h('div', { class: 'alert' }, 'We could not find any bookings for those details. Check the spelling, or try the other contact you used (email or phone).'));
      return;
    }
    box.replaceChildren(
      h('p', { class: 'mini' }, `${rows.length} booking${rows.length > 1 ? 's' : ''} found. `, h('button', { type: 'button', class: 'btn o small', onclick: () => load(false) }, 'Refresh')),
      ...rows.map(card));
  }

  function tracker(status) {
    if (!FLOW.some(f => f[0] === status)) return null;
    const idx = FLOW.findIndex(f => f[0] === status);
    return h('ol', { class: 'track', 'aria-label': 'Booking progress' }, FLOW.map((f, i) => h('li', { class: i <= idx ? 'on' : '' }, f[1])));
  }
  const field = (k, v) => h('div', null, h('span', null, k), h('b', null, v));

  // a small "enter your access code" prompt used by every protected action
  function askCode(holder, kind, intro, buttonText, run, extra) {
    if (holder.firstChild && holder.firstChild.dataset.kind === kind) { holder.replaceChildren(); return; }
    const code = h('input', { maxlength: 12, autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'e.g. K7M2QX9P', required: true });
    const out = h('div');
    code.addEventListener('input', () => say(out, ''));
    const form = h('form', { class: 'editor', 'data-kind': kind, novalidate: true,
      onsubmit: async e => {
        e.preventDefault();
        if (!code.value.trim()) return say(out, 'Enter your access code.', 'bad');
        const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
        try { await run(code.value.trim().toUpperCase(), out, form); } finally { btn.disabled = false; }
      } },
      h('p', null, intro),
      h('div', { class: 'form-grid' }, h('label', { class: 'fld wide' }, 'Access code', code), ...(extra ? extra.fields : [])),
      out, h('button', { type: 'submit', class: 'btn' }, buttonText));
    holder.replaceChildren(form); code.focus();
    return form;
  }

  async function details(ref, code, out) {
    const r = await rpc('get_booking_details', { p_reference: ref, p_code: code });
    if (!r.ok) { say(out, r.message, 'bad'); return null; }
    codes[ref] = code; return r;
  }

  function card(b) {
    const holder = h('div');
    const [pl, pc] = payLabel(b);
    const onlineOn = CL.pay.enabled();
    const showPay = b.can_pay && onlineOn && (b.status !== 'pending' || b.payment_pref === 'online');
    const png = (mode, action, label) => h('button', { type: 'button', class: 'btn o small', onclick: () =>
      askCode(holder, 'dl-' + mode + action, 'Enter your access code to create your ' + (mode === 'receipt' ? 'payment receipt.' : 'booking confirmation.'), label, async (code, out) => {
        const d = await details(b.reference, code, out); if (!d) return;
        try { await CL.ticket.make(mode, d.booking, d.payments, action); holder.replaceChildren(); } catch (e) { say(out, 'Could not create the image. Please try again.', 'bad'); }
      }) }, label);

    const actions = [];
    if (b.can_modify) actions.push(h('button', { type: 'button', class: 'btn', onclick: () => toggleEditor(b, holder) }, 'Change booking'));
    if (showPay) actions.push(h('button', { type: 'button', class: 'btn', onclick: () => payFlow(b, holder) }, b.status === 'confirmed' ? 'Proceed to payment' : 'Pay now'));
    if (b.can_request_cancel && !b.cancel_requested) actions.push(h('button', { type: 'button', class: 'btn o', onclick: () => cancelFlow(b, holder) }, 'Request cancellation'));
    actions.push(png('confirmation', 'download', 'Download confirmation (PNG)'));
    if (+b.paid_amount > 0) actions.push(png('receipt', 'download', 'Download receipt (PNG)'));
    actions.push(png(+b.paid_amount > 0 ? 'receipt' : 'confirmation', 'print', 'Print'));

    return h('article', { class: 'bk-card' },
      h('div', { class: 'bk-head' }, h('span', { class: 'bk-ref' }, b.reference), badge(b.status)),
      h('div', { class: 'bk-body' },
        field('Room', `${b.rooms} × ${b.room_type}`),
        field('Check-in', fmtDate(b.check_in)),
        field('Check-out', fmtDate(b.check_out)),
        field('Nights', b.nights),
        field('Guests', b.guests),
        field('Total', money(b.total_amount)),
        h('div', null, h('span', null, 'Payment'), h('b', null, h('span', { class: 'paytag ' + pc }, pl)))),
      tracker(b.status),
      b.cancel_requested ? h('div', { class: 'alert', style: 'margin:0 22px 14px' }, 'You asked to cancel this booking. The lodge will confirm the cancellation. Until then it stays as it is. ',
        h('button', { type: 'button', class: 'btn o small', onclick: () => withdrawFlow(b, holder) }, 'Withdraw request')) : null,
      b.modified_at && b.status === 'pending' ? h('p', { class: 'mini', style: 'padding:0 22px 12px' }, 'Your latest changes are waiting for the lodge to accept them.') : null,
      b.status === 'pending' && !b.cancel_requested ? h('p', { class: 'mini', style: 'padding:0 22px 12px' }, 'Rooms are held once the lodge accepts your booking' + (onlineOn ? ', or when you pay online.' : '.')) : null,
      h('div', { class: 'bk-actions' }, actions),
      !b.can_modify && ['checked_in', 'checked_out'].includes(b.status) ? h('p', { class: 'mini', style: 'padding:0 22px 14px' }, 'This stay has started, so it cannot be changed online. Please speak to reception.') : null,
      holder);
  }

  // ---- proceed to payment (Lenco)
  function payFlow(b, holder) {
    askCode(holder, 'pay', `Pay ${money(b.balance)} for ${b.reference} with card or mobile money. Enter your access code to continue.`, 'Continue to secure payment', async (code, out, form) => {
      const d = await details(b.reference, code, out); if (!d) return;
      const status = h('div'); out.replaceChildren(status);
      const show = (kind, title, text, ...more) => status.replaceChildren(h('div', { class: 'paybox ' + kind }, h('b', null, title), h('p', { style: 'margin:6px 0 0' }, text), more.length ? h('div', { class: 'actions' }, more) : null));
      show('wait', 'Online payment', 'Opening the secure payment window…');
      const r = await CL.pay.start({ reference: b.reference, code, onStatus: m => show('wait', 'Online payment', m) });
      if (!r.ok) return show('bad', 'Payment not started', r.message || 'Something went wrong. Please try again.');
      if (r.state === 'successful') {
        CL.pay.afterPaid(r, d.booking);
        toast('Payment confirmed. Thank you!');
        show('ok', 'Payment confirmed', `${money(r.payment.amount)} received. Receipt ${r.payment.receipt_no}. You can download your receipt below.`);
        setTimeout(() => load(true), 1200); return;
      }
      if (r.state === 'pending') return show('wait', 'Payment pending', CL.pay.MESSAGES.pending);
      if (r.state === 'needs_review') return show('wait', 'Payment received', CL.pay.MESSAGES.needs_review);
      if (r.state === 'failed') return show('bad', 'Payment failed', r.message || CL.pay.MESSAGES.failed);
      show('wait', 'Payment not completed', CL.pay.MESSAGES.closed);
    });
  }

  // ---- a guest can only ASK to cancel; the lodge confirms
  function cancelFlow(b, holder) {
    const reason = h('textarea', { maxlength: 300, rows: 2, placeholder: 'Reason (optional)' });
    askCode(holder, 'cancel', `Ask the lodge to cancel ${b.reference}. The lodge confirms every cancellation, and any refund is handled by them.`, 'Send cancellation request', async (code, out) => {
      const res = await rpc('request_cancellation', { p_reference: b.reference, p_code: code, p_reason: reason.value.trim() || null });
      if (!res.ok) return say(out, res.message, 'bad');
      toast('Cancellation request sent. The lodge will confirm it.');
      if (Number(res.paid) > 0) toast('You have paid ' + money(res.paid) + '. The lodge will contact you about it.');
      load(false);
    }, { fields: [h('label', { class: 'fld wide' }, 'Reason', reason)] });
  }
  function withdrawFlow(b, holder) {
    askCode(holder, 'withdraw', 'Enter your access code to withdraw your cancellation request.', 'Withdraw request', async (code, out) => {
      const res = await rpc('withdraw_cancellation', { p_reference: b.reference, p_code: code });
      if (!res.ok) return say(out, res.message, 'bad');
      toast('Cancellation request withdrawn.'); load(false);
    });
  }

  // ---- change room type / dates / numbers
  async function toggleEditor(b, holder) {
    if (holder.firstChild && holder.firstChild.dataset.kind === 'edit') { holder.replaceChildren(); return; }
    const inEl = h('input', { type: 'date', min: todayISO(), value: b.check_in, required: true });
    const outEl = h('input', { type: 'date', min: addDays(b.check_in > todayISO() ? b.check_in : todayISO(), 1), value: b.check_out, required: true });
    const rooms = h('input', { type: 'number', min: 1, max: 10, value: b.rooms, inputmode: 'numeric' });
    const guests = h('input', { type: 'number', min: 1, max: 60, value: b.guests, inputmode: 'numeric' });
    const type = h('select', null);
    const code = h('input', { maxlength: 12, autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'e.g. K7M2QX9P', value: codes[b.reference] || '' });
    const quote = h('div', { class: 'quote' }, 'Loading room types…');
    const out = h('div');
    code.addEventListener('input', () => say(out, ''));
    let types = [];

    const refreshTypes = async () => {
      if (!inEl.value || !outEl.value || outEl.value <= inEl.value) { quote.textContent = 'Choose a check-out date after check-in.'; return; }
      const res = await rpc('get_availability', { p_in: inEl.value, p_out: outEl.value });
      if (!res.ok) { quote.textContent = res.message; return; }
      types = res.rooms;
      const keep = type.value;
      type.replaceChildren(...types.map(t => h('option', { value: t.id }, `${t.name} – ${money(t.price_per_night)}/night`)));
      const current = types.find(t => t.name === b.room_type);
      type.value = types.some(t => t.id === keep) ? keep : (current ? current.id : types[0].id);
      updateQuote();
    };
    const updateQuote = () => {
      const t = types.find(x => x.id === type.value); if (!t) return;
      const n = nightsBetween(inEl.value, outEl.value), r = Math.max(parseInt(rooms.value, 10) || 1, 1);
      const total = n * r * t.price_per_night, diff = total - Number(b.total_amount);
      quote.replaceChildren(
        'New total: ', h('b', null, money(total)), ` (${n} night${n > 1 ? 's' : ''} × ${r} room${r > 1 ? 's' : ''}). `,
        diff === 0 ? 'No change in price. ' : (diff > 0 ? `That is ${money(diff)} more than before. ` : `That is ${money(-diff)} less than before. `),
        h('span', { class: 'mini' }, `Rooms free for these dates: ${t.available}.`));
    };
    [inEl, outEl].forEach(el => el.addEventListener('change', () => {
      if (el === inEl && inEl.value) { outEl.min = addDays(inEl.value, 1); if (outEl.value <= inEl.value) outEl.value = addDays(inEl.value, 1); }
      refreshTypes();
    }));
    [type, rooms].forEach(el => el.addEventListener('input', updateQuote));

    const form = h('form', { class: 'editor', 'data-kind': 'edit', novalidate: true,
      onsubmit: async e => {
        e.preventDefault();
        if (!code.value.trim()) return say(out, 'Enter your access code to save changes.', 'bad');
        const sbtn = form.querySelector('button[type=submit]'); sbtn.disabled = true;
        const res = await rpc('modify_booking', {
          p_reference: b.reference, p_code: code.value.trim().toUpperCase(), p_room_type: type.value, p_in: inEl.value, p_out: outEl.value,
          p_rooms: parseInt(rooms.value, 10) || 1, p_guests: parseInt(guests.value, 10) || 1 });
        sbtn.disabled = false;
        if (!res.ok) return say(out, res.message, 'bad');
        codes[b.reference] = code.value.trim().toUpperCase();
        toast(res.status === 'confirmed' ? 'Booking updated. It stays accepted because it is already paid.' : 'Booking updated. The lodge will accept the new details.');
        load(false);
      } },
      h('p', null, 'Change your room type, dates or numbers. Unless you have already paid, your booking goes back to "Awaiting confirmation" and your rooms are held again when the lodge accepts the change.'),
      h('div', { class: 'form-grid' },
        h('label', { class: 'fld' }, 'Check-in', inEl), h('label', { class: 'fld' }, 'Check-out', outEl),
        h('label', { class: 'fld wide' }, 'Room type', type),
        h('label', { class: 'fld' }, 'Rooms', rooms), h('label', { class: 'fld' }, 'Guests', guests),
        h('label', { class: 'fld wide' }, 'Access code (from your booking confirmation)', code)),
      quote, out, h('button', { type: 'submit', class: 'btn' }, 'Save changes'));
    holder.replaceChildren(form);
    await refreshTypes();
  }
})();

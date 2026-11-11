// Sends emails through Web3Forms (to the address registered with your access key).
(() => {
  'use strict';
  const { money, fmtDate } = CL;
  const S = CL.site;
  const clip = v => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, 1500);

  async function send(subject, fields, replyTo) {
    if (!S.web3formsKey) { console.info('[Center Lodge] Web3Forms access key not set: email skipped.'); return false; }
    const body = { access_key: S.web3formsKey, subject: clip(subject), from_name: 'Center Lodge website', botcheck: '' };
    for (const [k, v] of Object.entries(fields || {})) if (v !== '' && v != null) body[k] = clip(v);
    if (replyTo) { body.replyto = clip(replyTo); body.email = clip(replyTo); }
    try {
      const r = await fetch('https://api.web3forms.com/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body)
      });
      const j = await r.json().catch(() => null);
      return !!(r.ok && j && j.success);
    } catch (e) { return false; }
  }

  const PREF = { cash: 'Pay at the lodge (cash)', bank_transfer: 'Prepayment by bank transfer', online: 'Pay now online (Lenco)' };
  const base = b => ({
    'Booking reference': b.reference,
    'Guest': b.guest_name,
    'Guest type': (b.country || '').toLowerCase() === 'zambia' ? 'Local (Zambia)' : 'International (' + b.country + ')',
    'Phone': b.phone, 'Email': b.email,
    'Room': `${b.rooms} x ${b.room_type}`,
    'Check-in': fmtDate(b.check_in), 'Check-out': fmtDate(b.check_out), 'Nights': b.nights, 'Guests staying': b.guests,
    'Total': money(b.total)
  });

  // sent when a guest confirms a reservation (the access code is NEVER included)
  const newBooking = b => send(`New reservation ${b.reference} - ${b.guest_name} (${b.country})`, {
    ...base(b), 'Payment choice': PREF[b.payment_pref] || b.payment_pref, 'Status': 'Awaiting your acceptance',
    'Special requests': b.notes || '',
    'Note': 'Rooms are only taken off availability when you accept this booking, or when the guest pays online.'
  }, b.email);

  // sent when an online payment has been VERIFIED with Lenco
  const paid = (b, p) => send(`PAID: ${b.reference} - ${money(p.amount)} received (${b.guest_name})`, {
    ...base(b), 'Amount paid now': money(p.amount), 'Total paid so far': money(b.paid), 'Balance': money(b.balance),
    'Receipt number': p.receipt_no, 'Paid with': p.channel === 'mobile-money' ? 'Mobile money' : (p.channel === 'card' ? 'Card' : 'Online'),
    'Booking status': b.status, 'Verified': 'Yes, confirmed directly with Lenco'
  }, b.email);

  CL.mail = { send, newBooking, paid, PREF };
})();

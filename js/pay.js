// Online payment through Lenco. The browser only opens Lenco's pop-up; the amount and reference are made by
// the database, and the real result is checked by a Supabase Edge Function that holds the Lenco secret key.
(() => {
  'use strict';
  const { rpc } = CL;
  const S = CL.site;
  const enabled = () => !!(S.lencoKey && CL.configured);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function loadLenco() {
    return new Promise((resolve, reject) => {
      if (window.LencoPay) return resolve();
      const s = document.createElement('script');
      s.src = 'https://pay.lenco.co/js/v1/inline.js'; s.async = true;
      const t = setTimeout(() => reject(new Error('timeout')), 15000);
      s.onload = () => { clearTimeout(t); window.LencoPay ? resolve() : reject(new Error('missing')); };
      s.onerror = () => { clearTimeout(t); reject(new Error('blocked')); };
      document.head.append(s);
    });
  }

  // ask the Edge Function to check a payment reference with Lenco
  async function verify(reference) {
    try {
      const r = await fetch(CL.url + '/functions/v1/lenco-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: CL.key, Authorization: 'Bearer ' + CL.key },
        body: JSON.stringify({ reference })
      });
      const j = await r.json().catch(() => null);
      return j || { ok: false, error: 'bad_response', message: 'We could not read the payment answer. Please check again in a moment.' };
    } catch (e) { return { ok: false, error: 'network', message: 'Network problem while confirming the payment. Please check again in a moment.' }; }
  }
  async function poll(reference, { tries = 8, every = 3000 } = {}) {
    let last = null;
    for (let i = 0; i < tries; i++) {
      last = await verify(reference);
      if (last.ok && ['successful', 'failed', 'needs_review'].includes(last.state)) return last;
      if (!last.ok && ['bad_reference', 'unknown_reference', 'not_configured'].includes(last.error)) return last;
      await sleep(every);
    }
    return last || { ok: true, state: 'pending' };
  }

  // Opens the Lenco pop-up for a booking (needs the booking's access code). Resolves with the final result:
  //   { ok, state: 'successful' | 'pending' | 'failed' | 'needs_review' | 'closed', payment, booking, newly_paid, emailed, reference }
  async function start({ reference, code, onStatus }) {
    const say = m => { try { onStatus && onStatus(m); } catch (e) { /* ignore */ } };
    if (!enabled()) return { ok: false, error: 'disabled', message: 'Online payment is not switched on yet. Please pay at the lodge or by bank transfer.' };
    const s = await rpc('start_payment', { p_reference: reference, p_code: code });
    if (!s.ok) return s;
    try { await loadLenco(); }
    catch (e) { return { ok: false, error: 'widget', message: 'The secure payment window could not load. Check your connection and any ad-blocker, then try again.' }; }
    return await new Promise(resolve => {
      let finished = false, working = false;
      const finish = r => { if (!finished) { finished = true; resolve({ ...r, intent: s.reference }); } };
      say('Opening the secure payment window…');
      window.LencoPay.getPaid({
        key: S.lencoKey,
        reference: s.reference,
        email: s.email,
        amount: Number(s.amount),
        currency: s.currency || 'ZMW',
        channels: ['card', 'mobile-money'],
        customer: { firstName: s.first_name || 'Guest', lastName: s.last_name || s.first_name || 'Guest', phone: s.phone },
        onSuccess: async () => {
          working = true; say('Payment received. Confirming it with the payment provider…');
          finish(await poll(s.reference, { tries: 10, every: 3000 }));
        },
        onConfirmationPending: async () => {
          working = true; say('Your payment is waiting to be confirmed (this can take a minute for mobile money). Please keep this page open…');
          finish(await poll(s.reference, { tries: 30, every: 4000 }));
        },
        onClose: async () => {
          if (working) return;                                      // closing after success is normal
          const r = await verify(s.reference);                      // maybe it did go through
          if (r.ok && ['successful', 'failed', 'needs_review'].includes(r.state)) return finish(r);   // it did go through (or clearly failed)
          finish({ ok: true, state: 'closed' });
        }
      });
    });
  }

  // after a payment: if the server could not send the email itself, the browser sends it (once)
  async function afterPaid(result, fullBooking) {
    if (!result || result.state !== 'successful' || !result.newly_paid || result.emailed) return false;
    const b = { ...fullBooking, ...result.booking, paid: result.booking.paid, balance: result.booking.balance, total: result.booking.total, status: result.booking.status };
    return await CL.mail.paid(b, result.payment);
  }

  const MESSAGES = {
    successful: 'Payment confirmed. Thank you!',
    pending: 'Your payment is still being confirmed. You can close this page: the lodge will see it as soon as it clears, and you can check again from My bookings.',
    failed: 'The payment did not go through. You have not been charged. You can try again.',
    needs_review: 'We received your payment but the lodge needs to check it. They will contact you shortly. Please keep your booking reference.',
    closed: 'The payment window was closed before paying. You can try again any time using "Proceed to payment".'
  };
  CL.pay = { enabled, start, verify, poll, afterPaid, MESSAGES };
})();

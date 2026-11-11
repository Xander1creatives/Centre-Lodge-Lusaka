// Makes the booking confirmation / payment receipt as a high-quality PNG (3x resolution), and prints it.
(() => {
  'use strict';
  const { money, fmtDate, fmtTime } = CL;
  const W = 900, SC = 3;
  const DARK = '#010e03', GOLD = '#e4b24c', GREEN = '#1c6b4f', INK = '#10201c', MUTE = '#566660', LINE = '#d3e0da', PAPER = '#ffffff';
  const STATUS = {
    pending: ['AWAITING CONFIRMATION', '#8a5a00'], confirmed: ['ACCEPTED', GREEN], checked_in: ['CHECKED IN', '#2a4f82'],
    checked_out: ['COMPLETED', MUTE], cancelled: ['CANCELLED', '#a03227'], declined: ['DECLINED', '#a03227'], no_show: ['NO-SHOW', '#a03227']
  };
  const PREF = { cash: 'Pay at the lodge (cash)', bank_transfer: 'Prepayment by bank transfer', online: 'Pay now online (Lenco)' };
  const METHOD = { cash: 'Cash', mobile_money: 'Mobile money', card: 'Card', bank_transfer: 'Bank transfer', online: 'Online (Lenco)' };
  const loadImg = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

  function wrap(ctx, text, maxW) {
    const words = String(text).split(/\s+/), lines = []; let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line); return lines;
  }

  // one drawing routine, run twice: once to measure the height, once to paint
  function paint(ctx, o, logo, draw) {
    const b = o.booking, pays = o.payments || [], receipt = o.mode === 'receipt', site = CL.site;
    const F = (w, s, f) => `${w} ${s}px ${f || '"Jost","Segoe UI",Roboto,Helvetica,Arial,sans-serif'}`;
    const SERIF = '"Cormorant Garamond",Georgia,"Times New Roman",serif';
    const T = (s, x, y, font, color, align, maxW) => { if (!draw) return; ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.fillText(s, x, y, maxW); };
    const R = (x, y, w, h, color, r) => { if (!draw) return; ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r || 0) : ctx.rect(x, y, w, h); ctx.fill(); };
    let y = 0;
    // ---- header band with logo
    R(0, 0, W, 250, DARK);
    if (draw && logo) { const h = 128, w = logo.width * h / logo.height; ctx.drawImage(logo, (W - w) / 2, 26, w, h); }
    else T('CENTER LODGE', W / 2, 100, F(600, 44, SERIF), GOLD, 'center');
    if (draw) try { ctx.letterSpacing = '6px'; } catch (e) { /* older browsers */ }
    T(receipt ? 'PAYMENT RECEIPT' : 'BOOKING CONFIRMATION', W / 2 + 3, 208, F(600, 22), GOLD, 'center');
    if (draw) try { ctx.letterSpacing = '0px'; } catch (e) { /* ignore */ }
    R(0, 250, W, 6, GOLD);
    y = 300;
    // ---- status pill
    const paidFull = Number(b.paid) >= Number(b.total) && Number(b.total) > 0;
    let [label, col] = STATUS[b.status] || [String(b.status).toUpperCase(), MUTE];
    if (receipt) { label = paidFull ? 'PAID IN FULL' : 'PAYMENT RECEIVED'; col = GREEN; }
    ctx.font = F(700, 18);
    const pw = ctx.measureText(label).width + 44;
    R(60, y - 26, pw, 40, col, 20); T(label, 60 + pw / 2, y, F(700, 18), '#fff', 'center');
    // ---- reference + QR
    y += 56;
    T('BOOKING REFERENCE', 60, y, F(500, 15), MUTE);
    T(b.reference, 60, y + 56, F(700, 58, '"Courier New",ui-monospace,Menlo,monospace'), INK);
    if (draw && window.qrcode) {
      const qr = window.qrcode(0, 'M'); qr.addData(String(b.reference)); qr.make(); const n = qr.getModuleCount(), size = 170, x0 = W - 60 - size, y0 = y - 18, cell = size / n;
      ctx.fillStyle = '#fff'; ctx.fillRect(x0 - 8, y0 - 8, size + 16, size + 16); ctx.strokeStyle = LINE; ctx.strokeRect(x0 - 8, y0 - 8, size + 16, size + 16);
      ctx.fillStyle = DARK; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(x0 + c * cell, y0 + r * cell, Math.ceil(cell), Math.ceil(cell));
    }
    T('Scan or quote this at reception', 60, y + 92, F(400, 15), MUTE);
    y += 190;
    const rule = () => { if (draw) { ctx.fillStyle = LINE; ctx.fillRect(60, y, W - 120, 2); } y += 36; };
    const head = s => { T(s, 60, y, F(700, 15), GREEN); y += 14; };
    const cell = (k, v, x, w) => { T(k.toUpperCase(), x, y, F(500, 13), MUTE); ctx.font = F(600, 21); const ls = wrap(ctx, String(v == null || v === '' ? '-' : v), w); ls.slice(0, 3).forEach((l, i) => T(l, x, y + 28 + i * 26, F(600, 21), INK)); return 28 + Math.max(ls.length, 1) * 26 + 18; };
    const row = (a, b2) => { const h1 = cell(a[0], a[1], 60, 380), h2 = b2 ? cell(b2[0], b2[1], 480, 360) : 0; y += Math.max(h1, h2) + 4; };
    rule();
    head('GUEST'); y += 30;
    row(['Name', b.guest_name], ['Country', b.country]);
    row(['Phone', b.phone], ['Email', b.email]);
    rule();
    head('STAY'); y += 30;
    row(['Room type', `${b.rooms} x ${b.room_type}`], ['Guests', b.guests]);
    row(['Check-in', fmtDate(b.check_in)], ['Check-out', fmtDate(b.check_out)]);
    row(['Nights', b.nights], ['Booked on', b.created_at ? fmtTime(b.created_at) : '']);
    if (b.notes) { row(['Special requests', b.notes]); }
    rule();
    head(receipt ? 'PAYMENT' : 'PAYMENT SUMMARY'); y += 30;
    if (receipt && pays.length) {
      const total = pays.reduce((s, p) => s + Number(p.amount), 0);
      R(60, y - 6, W - 120, 120, '#eef4f1', 14);
      T('AMOUNT PAID', 90, y + 30, F(500, 15), MUTE); T(money(total), 90, y + 90, F(700, 62, SERIF), GREEN);
      y += 150;
      pays.forEach(p => {
        T(`${p.receipt_no || ''}`, 60, y, F(700, 19, '"Courier New",ui-monospace,monospace'), INK);
        T(`${METHOD[p.method] || p.method}${p.provider ? ' · ' + p.provider : ''}`, 250, y, F(500, 19), INK);
        T(p.paid_at ? fmtTime(p.paid_at) : '', 560, y, F(400, 17), MUTE);
        T(money(p.amount), W - 60, y, F(700, 21), INK, 'right'); y += 40;
      });
      y += 10;
    }
    row(['Total for the stay', money(b.total)], ['Paid so far', money(b.paid)]);
    row(['Balance due', money(Math.max(Number(b.total) - Number(b.paid), 0))], ['Payment choice', PREF[b.payment_pref] || '']);
    if (!receipt && b.status === 'pending') {
      R(60, y, W - 120, 74, '#fdf3dc', 12);
      T('Your request is waiting for the lodge to accept it.', 84, y + 32, F(600, 18), '#8a5a00');
      T('Rooms are held once accepted, or straight away when you pay online.', 84, y + 58, F(400, 16), '#8a5a00'); y += 100;
    }
    if (!receipt && b.payment_pref === 'bank_transfer' && CL.site.bank.accountNumber && Number(b.paid) < Number(b.total)) {
      const bk = CL.site.bank; R(60, y, W - 120, 118, '#eef4f1', 12);
      T('BANK TRANSFER DETAILS', 84, y + 30, F(700, 14), GREEN);
      T(`${bk.bankName}  ·  ${bk.accountName}`, 84, y + 62, F(600, 19), INK); T(`Account ${bk.accountNumber}${bk.branch ? '  ·  ' + bk.branch : ''}`, 84, y + 90, F(500, 18), INK);
      T(`Use ${b.reference} as the payment reference.`, 84, y + 112, F(400, 15), MUTE); y += 142;
    }
    // ---- footer band
    y += 10;
    const fy = y;
    const lines = [site.phone && 'Tel: ' + site.phone, site.email, site.address].filter(Boolean);
    const fh = 96 + lines.length * 26 + 46;
    R(0, fy, W, fh, DARK);
    T('Thank you for choosing Center Lodge', W / 2, fy + 52, F(600, 30, SERIF), GOLD, 'center');
    lines.forEach((l, i) => T(l, W / 2, fy + 94 + i * 26, F(400, 17), '#d9e6e0', 'center', W - 120));
    T(`Generated ${new Date().toLocaleString('en-GB')}`, W / 2, fy + fh - 18, F(400, 13), '#8fa59c', 'center');
    return fy + fh;
  }

  async function render(o) {
    const [logo] = await Promise.all([loadImg('images/logo.png'), (document.fonts && document.fonts.ready) || null]);
    const probe = document.createElement('canvas').getContext('2d');
    const H = Math.ceil(paint(probe, o, logo, false));
    const cv = document.createElement('canvas'); cv.width = W * SC; cv.height = H * SC;
    const ctx = cv.getContext('2d'); ctx.scale(SC, SC); ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic'; paint(ctx, o, logo, true);
    return await new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('png')), 'image/png'));
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function print(blob) {
    let sheet = document.getElementById('printSheet');
    if (!sheet) { sheet = document.createElement('div'); sheet.id = 'printSheet'; document.body.append(sheet); }
    const url = URL.createObjectURL(blob), img = document.createElement('img'); img.alt = 'Booking'; img.src = url;
    sheet.replaceChildren(img);
    img.onload = () => { window.print(); setTimeout(() => { sheet.replaceChildren(); URL.revokeObjectURL(url); }, 1500); };
  }
  // convenience: build everything from a booking + payments and run an action
  async function make(mode, booking, payments, action) {
    const blob = await render({ mode, booking, payments });
    const name = `Center-Lodge-${booking.reference}-${mode === 'receipt' ? 'receipt' : 'confirmation'}.png`;
    if (action === 'print') print(blob); else download(blob, name);
    return blob;
  }
  CL.ticket = { render, download, print, make };
})();

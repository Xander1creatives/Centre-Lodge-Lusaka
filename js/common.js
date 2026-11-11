// Shared helpers for the booking pages. No user text is ever put into innerHTML.
(() => {
  'use strict';
  // ---- read the settings in supabase-config.js, forgiving about common paste mistakes
  const cfg = window.CL_CONFIG || {};
  const strip = s => String(s == null ? '' : s).trim().replace(/^["'`]+|["'`]+$/g, '').trim();
  let url = strip(cfg.SUPABASE_URL);
  const key = strip(cfg.SUPABASE_ANON_KEY).replace(/\s+/g, '');
  const PROBLEMS = {
    no_config_file: 'supabase-config.js did not load. It must sit in the same folder as index.html.',
    missing: 'The project URL or public key is empty in supabase-config.js.',
    placeholder: 'supabase-config.js still has the example values. Paste your own project URL and public key.',
    bad_url: 'The project URL is not valid. Copy the "Project URL" from Supabase (Project Settings > API); it starts with https://.',
    bad_key: 'The public key looks too short. Copy the full "anon public" (or "publishable") key.',
    service_role: 'That is the secret/service_role key. It is a master key and must never be used in a website. Use the "anon public" or "publishable" key instead.',
    no_library: 'The Supabase library did not load. Check that vendor/supabase-library.min.js was uploaded.'
  };
  const jwtRole = k => { try { return JSON.parse(atob(k.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role; } catch (e) { return null; } };
  let problem = null;
  if (!window.CL_CONFIG) problem = 'no_config_file';
  else if (!url || !key) problem = 'missing';
  else if (/YOUR|PASTE|EXAMPLE/i.test(url + key)) problem = 'placeholder';
  else {
    try {
      const u = new URL(url);                                   // accepts a pasted /rest/v1/ address too: only the origin is kept
      url = u.origin;
      if (u.protocol !== 'https:' && !/^(127\.0\.0\.1|localhost)$/.test(u.hostname)) problem = 'bad_url';
    } catch (e) { problem = 'bad_url'; }
  }
  if (!problem && (/^sb_secret_/i.test(key) || jwtRole(key) === 'service_role')) problem = 'service_role';
  if (!problem && key.length < 20) problem = 'bad_key';
  if (!problem && !window.supabase) problem = 'no_library';
  const configured = !problem;
  if (problem) console.error('[Center Lodge] Booking system is not connected: ' + PROBLEMS[problem] + ' Open setup-check.html for a step-by-step check.');


  // ---- site settings (site-settings.js): cleaned so nothing odd can be injected into the page
  const rawSite = window.CL_SITE || {};
  const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001F<>]/g, '').trim().slice(0, n || 200);
  const httpsOnly = v => { v = String(v || '').trim(); return /^https:\/\/[^\s"'<>]+$/i.test(v) ? v : ''; };
  const rc = rawSite.CONTACT || {}, rs = rawSite.SOCIAL || {}, rb = rawSite.BANK || {};
  const site = {
    phone: txt(rc.phone, 40), whatsapp: String(rc.whatsapp || '').replace(/\D/g, '').slice(0, 15),
    email: /^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/.test(String(rc.email || '').trim()) ? String(rc.email).trim() : '',
    address: txt(rc.address, 200), mapQuery: txt(rc.mapQuery, 200),
    social: { facebook: httpsOnly(rs.facebook), instagram: httpsOnly(rs.instagram), tiktok: httpsOnly(rs.tiktok), x: httpsOnly(rs.x), youtube: httpsOnly(rs.youtube), linkedin: httpsOnly(rs.linkedin) },
    web3formsKey: /^[A-Za-z0-9-]{20,60}$/.test(String(rawSite.WEB3FORMS_ACCESS_KEY || '').trim()) ? String(rawSite.WEB3FORMS_ACCESS_KEY).trim() : '',
    lencoKey: /^[A-Za-z0-9_.-]{10,120}$/.test(String(rawSite.LENCO_PUBLIC_KEY || '').trim()) ? String(rawSite.LENCO_PUBLIC_KEY).trim() : '',
    bank: { bankName: txt(rb.bankName, 80), accountName: txt(rb.accountName, 80), accountNumber: txt(rb.accountNumber, 40), branch: txt(rb.branch, 80), note: txt(rb.note, 200) }
  };
  site.waLink = text => site.whatsapp ? 'https://wa.me/' + site.whatsapp + (text ? '?text=' + encodeURIComponent(text) : '') : '';

  const isAdminPage = document.body && document.body.dataset.admin === '1';
  let sb = null;
  if (configured) {
    try {
      sb = window.supabase.createClient(url, key, {
        auth: isAdminPage
          ? { persistSession: true, autoRefreshToken: true, storage: window.sessionStorage, detectSessionInUrl: false }
          : { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });
    } catch (e) { sb = null; console.error('[Center Lodge] Could not start the Supabase client:', e && e.message); }
  }

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  const money = n => {
    n = Number(n) || 0;
    return 'K' + n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
  };
  const parseISO = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayISO = () => toISO(new Date());
  const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
  const fmtDate = s => s ? parseISO(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const fmtDay = s => parseISO(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const fmtTime = s => s ? new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const nightsBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);

  const STATUS = {
    pending:     ['Awaiting confirmation', 'warn'],
    confirmed:   ['Accepted', 'ok'],
    checked_in:  ['Checked in', 'info'],
    checked_out: ['Completed', 'muted'],
    cancelled:   ['Cancelled', 'bad'],
    declined:    ['Declined', 'bad'],
    no_show:     ['No-show', 'bad']
  };
  const badge = s => { const [t, c] = STATUS[s] || [s, 'muted']; return h('span', { class: 'badge badge-' + c }, t); };

  function toast(msg, kind) {
    let box = document.getElementById('toasts');
    if (!box) { box = h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.append(box); }
    const t = h('div', { class: kind === 'bad' ? 'bad' : '' }, msg);
    box.append(t);
    setTimeout(() => t.remove(), 6000);
  }

  async function rpc(name, args) {
    if (!sb) return { ok: false, error: 'not_configured', message: 'The booking system is not connected yet. Please contact the lodge.' };
    try {
      const { data, error } = await sb.rpc(name, args || {});
      if (error) {
        if (error.code === '42501' || /not_authorized|permission denied/i.test(error.message || '')) return { ok: false, error: 'not_authorized', message: 'You are not authorised to do that.' };
        return { ok: false, error: 'server', message: 'Something went wrong. Please try again in a moment.' };
      }
      return data;
    } catch (e) {
      return { ok: false, error: 'network', message: 'Network problem. Please check your connection and try again.' };
    }
  }

  // mobile menu + footer year (same behaviour as the home page)
  const nav = document.getElementById('nav'), btn = document.getElementById('menuBtn');
  if (nav && btn && !(document.body && document.body.dataset.home)) {
    const set = o => { nav.classList.toggle('open', o); btn.setAttribute('aria-expanded', o); btn.setAttribute('aria-label', o ? 'Close menu' : 'Open menu'); };
    btn.addEventListener('click', () => set(!nav.classList.contains('open')));
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => set(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  }
  const y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();

  window.CL = { configured: configured && !!sb, problem, PROBLEMS, url, key, site, keyPreview: key ? key.slice(0, 8) + '…' : '', sb, h, money, parseISO, toISO, todayISO, addDays, fmtDate, fmtDay, fmtTime, nightsBetween, STATUS, badge, toast, rpc };
})();

(() => {
  'use strict';
  const { h, todayISO, addDays } = CL;
  const list = document.getElementById('checks');
  const tag = s => h('span', { class: 'badge ' + (s === 'ok' ? 'badge-ok' : s === 'warn' ? 'badge-warn' : s === 'skip' ? 'badge-muted' : 'badge-bad') }, s === 'ok' ? 'OK' : s === 'warn' ? 'Check' : s === 'skip' ? 'Skipped' : 'Fix this');
  const row = (state, title, detail, fix) => h('div', { class: 'bk-card', style: 'margin-bottom:12px' },
    h('div', { class: 'bk-head' }, h('b', null, title), tag(state)),
    h('div', { style: 'padding:14px 22px' }, h('p', { style: 'margin:0 0 ' + (fix ? '8px' : '0') }, detail), fix ? h('p', { class: 'mini', style: 'margin:0' }, 'How to fix: ' + fix) : null));

  async function run() {
    const out = [];
    const P = CL.problem;
    out.push(window.CL_CONFIG ? row('ok', 'Settings file', 'supabase-config.js loaded.')
      : row('bad', 'Settings file', CL.PROBLEMS.no_config_file, 'Upload supabase-config.js next to index.html.'));

    const urlBad = ['no_config_file', 'missing', 'placeholder', 'bad_url'].includes(P);
    if (urlBad) out.push(row('bad', 'Project URL', CL.PROBLEMS[P], 'Open supabase-config.js, follow the steps at the top and paste your Project URL.'));
    else {
      let host = ''; try { host = new URL(CL.url).hostname; } catch (e) { /* ignore */ }
      if (/\.supabase\.co$/.test(host) || /^(127\.0\.0\.1|localhost)$/.test(host)) out.push(row('ok', 'Project URL', 'Using ' + host + '.'));
      else out.push(row('warn', 'Project URL', 'Using ' + host + '. This is not a standard supabase.co address.', 'If this is a custom domain, add it (https and wss) to connect-src in the Content-Security-Policy of every page and in _headers / .htaccess, otherwise the browser will block it.'));
    }

    if (['no_config_file', 'missing', 'placeholder'].includes(P)) out.push(row('skip', 'Public key', 'Fix the settings above first.'));
    else if (['bad_key', 'service_role'].includes(P)) out.push(row('bad', 'Public key', CL.PROBLEMS[P], 'In Supabase open Project Settings > API and copy the "anon public" (or "publishable") key.'));
    else out.push(row('ok', 'Public key', 'A public key was found (' + CL.keyPreview + ') and it is not a secret key.'));

    out.push(window.supabase ? row('ok', 'Supabase library', 'Loaded.')
      : row('bad', 'Supabase library', CL.PROBLEMS.no_library, 'Upload the vendor folder including vendor/supabase-library.min.js.'));

    if (!CL.configured || !CL.sb) {
      out.push(row('skip', 'Connection and database', 'Fix the items above first, then run the checks again.'));
    } else {
      let res;
      try { res = await CL.sb.rpc('get_availability', { p_in: addDays(todayISO(), 1), p_out: addDays(todayISO(), 2) }); }
      catch (e) { res = { error: { message: 'Failed to fetch' }, status: 0 }; }
      const { data, error, status } = res;
      if (error) {
        const msg = String(error.message || '');
        if (/api key/i.test(msg) || status === 401 || status === 403)
          out.push(row('bad', 'Connection and database', 'Supabase rejected the key.', 'Copy the key again from Project Settings > API. Make sure it belongs to the same project as the URL and has no extra spaces.'));
        else if (error.code === 'PGRST202' || status === 404)
          out.push(row('bad', 'Connection and database', 'Connected to Supabase, but the booking functions are not installed.', 'Open Supabase > SQL Editor, paste all of Supabase_Setup/schema.sql and press Run. Then run these checks again.'));
        else if (/fetch|network|load failed/i.test(msg) || status === 0)
          out.push(row('bad', 'Connection and database', 'Could not reach your Supabase project.', 'Check the Project URL is exactly right, that your project is not paused (free projects pause when unused; open it in Supabase and press Restore), and that this site is served over https.'));
        else out.push(row('bad', 'Connection and database', 'Supabase answered with an error: ' + msg.slice(0, 120), 'Re-run schema.sql in the SQL Editor, then check again.'));
      } else if (data && data.ok === false && data.error === 'rate_limited') {
        out.push(row('ok', 'Connection and database', 'Connected (you have just made many requests, so a safety limit answered).'));
      } else if (data && data.ok) {
        out.push(row('ok', 'Connection and database', 'Connected. The booking functions are installed.'));
        const names = (data.rooms || []).map(r => r.name);
        out.push(names.length ? row('ok', 'Room types', names.length + ' room types found: ' + names.join(', ') + '.')
          : row('bad', 'Room types', 'No room types were found.', 'Re-run schema.sql, or add room types under Staff > Rooms & rates.'));
      } else out.push(row('bad', 'Connection and database', 'Unexpected answer from the database.', 'Re-run schema.sql in the SQL Editor.'));
    }
    // ---- version 2 database, payment function, Web3Forms, Lenco
    if (CL.configured && CL.sb) {
      const v2 = await CL.sb.rpc('start_payment', { p_reference: 'CL-SETUP0', p_code: 'SETUP000' });
      if (v2.error && (v2.error.code === 'PGRST202' || v2.status === 404)) out.push(row('bad', 'Database version', 'The database is the older version (it has no payment or room-blocking functions).', 'Open Supabase > SQL Editor, paste all of Supabase_Setup/schema.sql and press Run. It upgrades your data in place.'));
      else out.push(row('ok', 'Database version', 'Up to date (payments, room blocks and cancellation requests are installed).'));
    }
    const S = CL.site;
    out.push(S.web3formsKey ? row('ok', 'Web3Forms email', 'An access key is set. Booking, payment and enquiry emails are sent to the address registered with it. Make a test booking to confirm the email arrives.')
      : row('warn', 'Web3Forms email', 'No access key yet, so no emails are sent.', 'Get a free key at web3forms.com (enter the email that should receive bookings) and paste it into site-settings.js.'));
    if (!S.lencoKey) out.push(row('warn', 'Online payment (Lenco)', 'Switched off: no Lenco public key in site-settings.js. Guests can still choose cash or bank transfer.', 'Paste your Lenco PUBLIC key (starts with pub-) into site-settings.js, then deploy the payment function (README, Payments).'));
    else if (CL.configured) {
      let fn;
      try { const r = await fetch(CL.url + '/functions/v1/lenco-payments', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CL.key, Authorization: 'Bearer ' + CL.key }, body: JSON.stringify({ reference: 'CLP-SETUP00000' }) }); fn = { status: r.status, body: await r.json().catch(() => null) }; }
      catch (e) { fn = { status: 0 }; }
      if (fn.status === 404 && !(fn.body && fn.body.error)) out.push(row('bad', 'Online payment (Lenco)', 'The payment function is not deployed.', 'Deploy supabase/functions/lenco-payments to your Supabase project (README, Payments).'));
      else if (fn.body && fn.body.error === 'not_configured') out.push(row('bad', 'Online payment (Lenco)', 'The payment function is deployed but has no secrets yet.', 'In Supabase > Edge Functions > Secrets add LENCO_SECRET_KEY.'));
      else if (fn.status === 0) out.push(row('bad', 'Online payment (Lenco)', 'The payment function could not be reached from this page.', 'Check the function is deployed, and that ALLOWED_ORIGINS (if you set it) includes this website.'));
      else if (fn.status === 401 || fn.status === 403) out.push(row('bad', 'Online payment (Lenco)', 'Supabase blocked the call (JWT check).', 'Deploy the function with --no-verify-jwt (README, Payments).'));
      else out.push(row('ok', 'Online payment (Lenco)', 'Lenco public key is set and the payment function answers. Make a small test payment to confirm end to end.'));
    }
    out.push(row('warn', 'Staff sign-in', 'This page cannot test staff sign-in (it needs a password). Create your admin user in Supabase > Authentication > Users, then run the one-line "make admin" command from README.txt, then sign in at admin.html.'));
    list.replaceChildren(...out);
  }
  document.getElementById('again').addEventListener('click', () => { list.replaceChildren(h('p', { class: 'mini' }, 'Running checks…')); run(); });
  run();
})();

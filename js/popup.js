/* Custom success / error popup: CL.popup(title, text, isError) */
(function () {
  'use strict';
  /* ---------- styles for the popup (injected so every page gets them) ---------- */
  var css = '.w3f-ov{position:fixed;inset:0;z-index:99999;background:rgba(20,20,20,.55);display:flex;align-items:center;justify-content:center;padding:20px;animation:w3fFade .2s ease}' +
    '.w3f-box{background:#fff;max-width:420px;width:100%;border-radius:10px;padding:34px 28px 26px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3);animation:w3fPop .3s cubic-bezier(.2,.9,.3,1.2)}' +
    '.w3f-ic{width:64px;height:64px;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;background:#e6f6ec;color:#1f9d55}' +
    '.w3f-box.err .w3f-ic{background:#fdeaea;color:#c0392b}' +
    '.w3f-ic svg{width:32px;height:32px;fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}' +
    '.w3f-box h3{font:500 28px "Cormorant Garamond",serif;margin:0 0 8px;color:#222}' +
    '.w3f-box p{margin:0 0 22px;color:#555;line-height:1.55;font-size:15px}' +
    '.w3f-box button{background:#222;color:#fff;border:0;border-radius:6px;padding:11px 30px;font:500 15px "Jost",sans-serif;cursor:pointer}' +
    '.w3f-box button:hover{background:#000}' +
    '@keyframes w3fFade{from{opacity:0}to{opacity:1}}@keyframes w3fPop{from{transform:scale(.85);opacity:0}to{transform:none;opacity:1}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function popup(title, text, isErr) {
    var old = document.getElementById('w3fPop'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.className = 'w3f-ov'; ov.id = 'w3fPop'; ov.setAttribute('role', 'alertdialog'); ov.setAttribute('aria-modal', 'true');
    var box = document.createElement('div'); box.className = 'w3f-box' + (isErr ? ' err' : '');
    box.innerHTML = '<div class="w3f-ic"><svg viewBox="0 0 24 24" aria-hidden="true">' +
      (isErr ? '<path d="M6 6l12 12M18 6L6 18"/>' : '<path d="M5 12.5l4.5 4.5L19 7.5"/>') + '</svg></div><h3></h3><p></p><button type="button">' + (isErr ? 'Try again' : 'Done') + '</button>';
    box.querySelector('h3').textContent = title;
    box.querySelector('p').textContent = text;
    ov.appendChild(box); document.body.appendChild(ov);
    var btn = box.querySelector('button'); btn.focus();
    function close() { ov.remove(); document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') close(); }
    btn.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', esc);
  }

  window.CL = window.CL || {};
  CL.popup = popup;
})();

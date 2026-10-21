// pwa.js — web-app support on every page: turns on offline mode (sw.js) and shows an
// "Install" button where it can. Game pages install as their own app; every other page
// installs the whole site (opens to the Arcade). Put <div data-pwa-install></div> where the
// button should go; without one, game pages get a small bar under the game.
// Site visit counter: counts every page opened on any page (per tab session until 2026-10-20; started 2026-10-13).
// window.doppVisits is a promise of the all-time total; the home page shows it.
(function () {
  if (location.protocol === 'file:') return;
  var URL = 'https://gmeyamrlqfrabtslsweu.supabase.co/rest/v1/rpc/', KEY = 'sb_publishable_zClDCZZQEfC9DILpesPiHg_IcyRqW-c';
  window.doppVisits = fetch(URL + 'site_visit_hit', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: '{}' })
    .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
})();

(function () {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });

  var standalone = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
  // remember on this device that the app is installed, so the browser tab stops offering it
  var KEY = 'dopp_app_installed', mark = function (v) { try { v ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch (e) {} };
  var installed = function () { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
  if (standalone) { mark(true); document.documentElement.classList.add('pwa-app'); return; }

  var ua = navigator.userAgent;
  var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var macSafari = !ios && /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua);
  var android = /Android/.test(ua), firefox = /Firefox\//.test(ua), edge = /Edg\//.test(ua), samsung = /SamsungBrowser/.test(ua);
  var gameName = document.documentElement.getAttribute('data-app-name');   // set on game pages by build_pwa.py
  var label = gameName ? 'Install ' + gameName : 'Install the Doppsclass app';
  var deferred = null, btn = null;

  var css = '.pwa-bar{display:flex;justify-content:center;padding:6px 12px 18px}' +
    '.pwa-btn{display:inline-flex;align-items:center;gap:8px;font:800 14px Nunito,system-ui,sans-serif;color:#1a1030;background:#FFD700;border:2px solid #1A1030;border-radius:999px;padding:9px 16px;cursor:pointer;box-shadow:0 3px 0 #1A1030}' +
    '.pwa-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #1A1030}' +
    '.pwa-tip{position:fixed;inset:0;z-index:9999;background:rgba(5,3,15,.72);display:flex;align-items:flex-end;justify-content:center;padding:16px}' +
    '.pwa-card{max-width:400px;width:100%;background:#1b1038;color:#f4efff;border:2px solid #FFD700;border-radius:18px;padding:18px 18px 14px;font:600 15px/1.45 Nunito,system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.5)}' +
    '.pwa-card h3{font:900 18px Nunito,system-ui,sans-serif;color:#FFD700;margin:0 0 8px}.pwa-card ol{margin:0 0 12px 20px;padding:0}.pwa-card li{margin:4px 0}' +
    '.pwa-card .pwa-ok{display:block;width:100%;font:800 15px Nunito,system-ui,sans-serif;background:#FFD700;color:#1a1030;border:0;border-radius:12px;padding:10px;cursor:pointer}' +
    '.pwa-share{display:inline-block;border:1.5px solid #9ec5ff;border-radius:5px;padding:0 4px;color:#9ec5ff;font-weight:900}';

  function tip() {
    var steps = ios
      ? '<li>Tap the <span class="pwa-share">⬆</span> <b>Share</b> button (bottom of the screen on iPhone, top on iPad). In Chrome on iPhone it\'s at the top right.</li><li>Scroll down and tap <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>.</li>'
      : macSafari ? '<li>In the menu bar, click <b>File</b> → <b>Add to Dock…</b></li><li>Click <b>Add</b>.</li>'
      : android && firefox ? '<li>Tap the <b>⋮</b> menu.</li><li>Tap <b>Install</b> (or <b>Add to Home screen</b>).</li>'
      : android && samsung ? '<li>Tap the <b>☰</b> menu at the bottom.</li><li>Tap <b>Add page to</b> → <b>Home screen</b>.</li>'
      : android ? '<li>Tap the <b>⋮</b> menu at the top right.</li><li>Tap <b>Add to Home screen</b> or <b>Install app</b>.</li><li>Tap <b>Install</b>.</li>'
      : firefox ? '<li>Firefox on a computer can\'t install web apps.</li><li>Open <b>doppsclass.com</b> in <b>Chrome</b> or <b>Edge</b> and use this button there — or just bookmark this page (<b>Ctrl+D</b>).</li>'
      : edge ? '<li>Click the <b>⋯</b> menu at the top right.</li><li>Choose <b>Apps</b> → <b>Install this site as an app</b>.</li><li>Click <b>Install</b>.</li>'
      : '<li>Look for the <b>install icon</b> (a little screen with a ⬇ arrow) at the right end of the address bar and click it.</li><li>No icon? Click the <b>⋮</b> menu → <b>Cast, save, and share</b> → <b>Install page as app…</b></li><li>Click <b>Install</b>.</li>';
    var extra = (!ios && !macSafari && !android) ? '<div style="font-size:13px;color:#cfc6ee;margin:-4px 0 10px">On a school Chromebook, installing may be turned off. If so, bookmark this page instead (<b>Ctrl+D</b>).</div>' : '';
    var d = document.createElement('div'); d.className = 'pwa-tip';
    d.innerHTML = '<div class="pwa-card" role="dialog" aria-label="How to install"><h3>📲 ' + label + '</h3><ol>' + steps + '</ol>' + extra +
      '<div style="font-size:13px;color:#cfc6ee;margin-bottom:12px">It gets its own icon, opens full screen, and ' + (gameName ? 'the game works' : 'the arcade games work') + ' without internet.</div>' +
      '<button class="pwa-ok">Got it</button></div>';
    d.onclick = function (e) { if (e.target === d || e.target.classList.contains('pwa-ok')) d.remove(); };
    document.body.appendChild(d);
  }

  function place() {
    if (btn) { btn.parentNode && (btn.parentNode.style.display = ''); return; }
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    btn = document.createElement('button'); btn.type = 'button'; btn.className = 'pwa-btn'; btn.innerHTML = '📲 ' + label;
    btn.onclick = function () {
      if (deferred) { deferred.prompt(); deferred.userChoice.then(function (c) { if (c.outcome === 'accepted') hide(); deferred = null; }); }
      else tip();
    };
    var spot = document.querySelector('[data-pwa-install]');
    if (spot) spot.appendChild(btn);
    else if (gameName) { var bar = document.createElement('div'); bar.className = 'pwa-bar'; bar.appendChild(btn); document.body.appendChild(bar); }
    else btn = null;
  }
  function hide() { if (btn && btn.parentNode) btn.parentNode.style.display = 'none'; }

  // Chrome, Edge, Android: the browser tells us when this page can be installed.
  // (Chrome only offers this when the app is NOT installed, so it also means "they uninstalled it")
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; mark(false); ready(place); });
  window.addEventListener('appinstalled', function () { mark(true); hide(); });
  // iPhone / iPad / Mac Safari: no install prompt, so the button shows how to do it by hand.
  if ((ios || macSafari) && !installed()) ready(place);
  // A page with an install spot (the home page) always shows the button. If the browser
  // hasn't offered its own install prompt, the button shows how to install by hand instead.
  ready(function () { if (document.querySelector('[data-pwa-install]') && !installed()) place(); });

  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
})();

// Trimester Checklist button: a gold "📋 My Checklist" pill in the bottom-left corner of student pages,
// shown only on a device where a student has signed in on the Quest page. Shows their last known % done
// (saved by checklist.html / welcome.html). Hidden on teacher, projected-game, print and game-app pages.
(function () {
  var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (/^(checklist|teacher|teacher-admin|live_host|live|print_quest|offline|404|sub_guide|parents|visitor|save_test|wellness-255-signup-guide|legacy-resources)\.html$/.test(page)) return;
  if (/^game\d\d_/.test(page) || document.documentElement.getAttribute('data-app-name')) return;
  var signedIn = false, pct = null;
  try {
    for (var i = 0; i < localStorage.length; i++) if (/^qSID_/.test(localStorage.key(i)) && localStorage.getItem(localStorage.key(i))) signedIn = true;
    var c = JSON.parse(localStorage.getItem('dopp_cl_pct') || 'null');
    if (c && typeof c.pct === 'number' && Date.now() - c.t < 14 * 86400000) pct = Math.max(0, Math.min(100, Math.round(c.pct)));
    if (sessionStorage.getItem('dopp_cl_hide') === '1') return;
  } catch (e) { return; }
  if (!signedIn) return;
  function add() {
    if (document.getElementById('dopp-cl-pill')) return;
    var st = document.createElement('style');
    st.textContent = '#dopp-cl-pill{position:fixed;left:14px;bottom:14px;z-index:9000;display:flex;align-items:center;gap:6px;font:900 15px/1 Nunito,system-ui,sans-serif}' +
      '#dopp-cl-pill a{display:flex;align-items:center;gap:9px;text-decoration:none;color:#1a1030;background:#FFD700;border:2.5px solid #1A1030;border-radius:999px;padding:10px 16px 10px 12px;box-shadow:0 4px 0 #1A1030,0 8px 22px rgba(0,0,0,.35);animation:dclp 2.6s ease-in-out 1s 2}' +
      '#dopp-cl-pill a:hover{transform:translateY(-2px)}#dopp-cl-pill a:active{transform:translateY(2px);box-shadow:0 1px 0 #1A1030}' +
      '#dopp-cl-pill .ic{font-size:20px}#dopp-cl-pill .bar{display:inline-block;width:46px;height:8px;border-radius:5px;background:rgba(26,16,48,.22);overflow:hidden}' +
      '#dopp-cl-pill .bar i{display:block;height:100%;background:#1A1030}#dopp-cl-pill .pc{font-size:13px}' +
      '#dopp-cl-pill button{width:24px;height:24px;border-radius:50%;border:2px solid #1A1030;background:#fff8d6;color:#1a1030;font:900 13px/1 Nunito,sans-serif;cursor:pointer;padding:0;opacity:.85}' +
      '@keyframes dclp{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}' +
      '@media (max-width:520px){#dopp-cl-pill{left:10px;bottom:10px;font-size:13px}#dopp-cl-pill a{padding:8px 12px 8px 10px}#dopp-cl-pill .bar{width:32px}}' +
      '@media print{#dopp-cl-pill{display:none}}';
    document.head.appendChild(st);
    var d = document.createElement('div'); d.id = 'dopp-cl-pill';
    d.innerHTML = '<a href="checklist.html" title="See what you need to do this trimester"><span class="ic">📋</span><span>My Checklist</span>' +
      (pct === null ? '' : '<span class="bar"><i style="width:' + pct + '%"></i></span><span class="pc">' + pct + '%</span>') + '</a>' +
      '<button type="button" aria-label="Hide checklist button" title="Hide until you open a new tab">✕</button>';
    d.querySelector('button').onclick = function () { try { sessionStorage.setItem('dopp_cl_hide', '1'); } catch (e) {} d.remove(); };
    document.body.appendChild(d);
  }
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
})();

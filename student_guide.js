/* student_guide.js — new-student help on every page (added 2026-11-18, T2 prep). Loaded by theme.js.
 *  1. A "Start Here" link in the top menu (right after Home). Signed-in students see "Today" instead,
 *     which opens their daily start screen (welcome.html).
 *  2. A ❓ Help button (bottom-right) that answers "Where do I find…?" from guide_data.js,
 *     with links to the tour, Start Here, Today and Ask Mr. Dopp.
 *  3. On the Home page, a slim banner: "New here? Start Here" or "Welcome back, Name — Today".
 * Off on: arcade games, projector/teacher/print pages, and inside the tour's preview frames.
 * To turn it all off, delete the line that loads this file at the bottom of theme.js.
 */
(function () {
  if (window.DoppStudentGuide) return;
  window.DoppStudentGuide = true;
  try { if (window.top !== window.self) return; } catch (e) { return; }   // tour previews
  var path = location.pathname, file = (path.split('/').pop() || '').replace(/\.html$/, '');
  var root = document.documentElement;
  if (/\/arcade\/play\//.test(path) || root.hasAttribute('data-app-name') || /^game\d\d_/.test(file)) return;
  if (/^(teacher|teacher-admin|live|live_host|timer|print_quest|sub_guide|offline|dopp_spin|germ_snipes|team_hangman|partner|trail|coin_host|coin_live|cpr_trainer_build|tour)$/.test(file)) return;
  var GAMEISH = /^(dopp_|sprite_|vocab_slice|vocab_engine|cup_pong|tic_tac_toe|blast_blocks|how_smart|coin_quest|immune_defense|germ_sweeper|field_day|habit_showdown|art_studio)/.test(file);
  var HOME = path === '/' || /^\/(index\.html)?$/.test(path);

  function me() {
    try {
      var r = JSON.parse(localStorage.getItem('dopp_remember') || 'null');
      if (r && r.sid && (r.perm || !r.exp || Date.now() < r.exp)) return { name: r.name || '' };
      for (var i = 0; i < localStorage.length; i++) if (/^qSID_/.test(localStorage.key(i)) && localStorage.getItem(localStorage.key(i))) return { name: '' };
    } catch (e) {}
    return null;
  }
  var who = me();
  var LINK = who ? { href: '/welcome.html', text: '📣 Today' } : { href: '/start.html', text: '🧭 Start Here' };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var css = [
    '.sg-nav{color:#00E5A0!important}html.dl .sg-nav{color:#00704D!important}',
    '#sg-help{position:fixed;right:14px;bottom:14px;z-index:9001;font-family:Geist,Nunito,system-ui,sans-serif}',
    '#sg-help.up{bottom:72px}',
    '#sg-btn{display:flex;align-items:center;gap:6px;padding:10px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(7,7,26,.88);color:#eef0ff;',
    ' font:800 14px/1 Geist,Nunito,system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 26px -8px rgba(0,0,0,.7);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}',
    '#sg-btn:hover{border-color:#ffd166}#sg-btn .q{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#ffd166;color:#1a0d00;font-size:13px}',
    'html.dl #sg-btn{background:#fff;color:#15172b;border-color:rgba(21,23,43,.18)}',
    '#sg-pan{position:absolute;right:0;bottom:52px;width:min(360px,calc(100vw - 28px));max-height:min(70vh,560px);overflow:auto;border-radius:18px;padding:14px;',
    ' background:#12122e;color:#eef0ff;border:1px solid rgba(255,255,255,.12);box-shadow:0 24px 60px -18px rgba(0,0,0,.85);display:none}',
    '#sg-help.open #sg-pan{display:block}',
    'html.dl #sg-pan{background:#fff;color:#15172b;border-color:rgba(21,23,43,.14)}',
    '#sg-pan h3{font:800 16px "Bricolage Grotesque",Geist,sans-serif;margin:0 0 8px}',
    '#sg-pan form{display:flex;gap:6px}',
    '#sg-pan input{flex:1;min-width:0;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.25);color:inherit;font:600 15px Geist,Nunito,sans-serif}',
    'html.dl #sg-pan input{background:#f5f6fb;border-color:rgba(21,23,43,.2)}',
    '#sg-pan button.go{padding:10px 12px;border-radius:12px;border:0;background:#ffd166;color:#1a0d00;font:800 14px Geist,sans-serif;cursor:pointer}',
    '#sg-ans{display:grid;gap:8px;margin-top:10px}',
    '#sg-ans .r{padding:9px 11px;border-radius:12px;background:rgba(56,191,255,.09);border:1px solid rgba(56,191,255,.25);font-size:13.5px;line-height:1.45}',
    '#sg-ans .r b{display:block;font-size:14px;margin-bottom:2px}#sg-ans .r a{color:#ffd166;font-weight:800;text-decoration:none}',
    'html.dl #sg-ans .r a{color:#9a6400}',
    '#sg-links{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:12px}',
    '#sg-links a{display:block;padding:9px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.12);color:inherit;text-decoration:none;font:700 13px Geist,Nunito,sans-serif}',
    'html.dl #sg-links a{border-color:rgba(21,23,43,.14)}#sg-links a:hover{border-color:#ffd166}',
    '#sg-banner{max-width:560px;margin:18px 0 0;font-family:Geist,Nunito,system-ui,sans-serif;position:relative;z-index:1}',
    '#sg-banner a{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:16px;text-decoration:none;color:#eef0ff;',
    ' background:linear-gradient(90deg,rgba(0,229,160,.14),rgba(56,191,255,.12));border:1px solid rgba(0,229,160,.35)}',
    '#sg-banner b{font-size:15px}#sg-banner span{color:#a3a6c8;font-size:14px}#sg-banner i{font-style:normal;margin-left:auto;font-weight:800;color:#00E5A0;white-space:nowrap}',
    'html.dl #sg-banner a{color:#15172b}html.dl #sg-banner span{color:#575b78}html.dl #sg-banner i{color:#00704D}',
    '@media (max-width:560px){#sg-btn .t{display:none}#sg-banner span{display:none}}',
    '@media print{#sg-help,#sg-banner{display:none!important}}'
  ].join('\n');

  function addCss() {
    if (document.getElementById('sg-css')) return;
    var st = document.createElement('style'); st.id = 'sg-css'; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  // 1. top-menu link, right after "Home" (desktop bar and phone menu, Next.js and classic pages)
  function navLink() {
    Array.prototype.forEach.call(document.querySelectorAll('header a[href="/"], header a[href="/index.html"], header a[href="index.html"]'), function (a) {
      if ((a.textContent || '').trim() !== 'Home') return;
      var n = a.nextElementSibling;
      if (n && n.classList && n.classList.contains('sg-nav')) return;
      var tpl = a.parentNode.querySelector('a[href="/quest.html"], a[href="quest.html"]') || a;
      var c = tpl.cloneNode(false);
      c.setAttribute('href', LINK.href);
      c.removeAttribute('aria-current');
      c.className = (c.className || '') + ' sg-nav';
      c.textContent = LINK.text;
      a.parentNode.insertBefore(c, a.nextSibling);
    });
  }

  // 2. ❓ Help button
  var guideLoading = false;
  function withGuide(fn) {
    if (window.DoppGuide) return fn();
    if (guideLoading) return setTimeout(function () { withGuide(fn); }, 120);
    guideLoading = true;
    var s = document.createElement('script'); s.src = '/guide_data.js';
    s.onload = function () { fn(); }; document.head.appendChild(s);
  }
  function helpButton() {
    if (GAMEISH || document.getElementById('sg-help') || !document.body) return;
    var w = document.createElement('div'); w.id = 'sg-help'; w.setAttribute('data-keep-colors', '');
    if (document.getElementById('dopp-theme-btn')) w.className = 'up';
    w.innerHTML =
      '<div id="sg-pan" role="dialog" aria-label="Help: where do I find">' +
        '<h3>Where do I find…?</h3>' +
        '<form><input type="search" placeholder="e.g. classwork, my PIN, vocab games" aria-label="Where do I find" autocomplete="off"><button class="go" type="submit">Ask</button></form>' +
        '<div id="sg-ans" aria-live="polite"></div>' +
        '<div id="sg-links">' +
          '<a href="/tour.html">🗺 Take the tour</a><a href="/start.html">🧭 Start Here</a>' +
          '<a href="/welcome.html">📣 Today</a><a href="/checklist.html">📋 Checklist</a>' +
          '<a href="/search.html">🔍 Search the site</a><a href="/ask.html">💬 Ask Mr. Dopp</a>' +
        '</div>' +
      '</div>' +
      '<button id="sg-btn" type="button" aria-expanded="false"><span class="q">?</span><span class="t">Help</span></button>';
    document.body.appendChild(w);
    var btn = w.querySelector('#sg-btn'), inp = w.querySelector('input'), ans = w.querySelector('#sg-ans');
    btn.onclick = function () {
      var open = w.classList.toggle('open'); btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) { withGuide(function () {}); setTimeout(function () { inp.focus(); }, 30); }
    };
    function run() {
      var q = inp.value;
      if (q.trim().length < 3) { ans.innerHTML = ''; return; }
      withGuide(function () {
        var hits = window.DoppGuide.find(q, 2);
        ans.innerHTML = hits.length ? hits.map(function (f) {
          return '<div class="r"><b>' + esc(f.q) + '</b>' + esc(f.a) + '<br><a href="' + esc(f.href) + '">' + esc(f.go) + ' →</a></div>';
        }).join('') : '<div class="r">No match yet. Try other words, or use Search below.</div>';
      });
    }
    w.querySelector('form').onsubmit = function (e) { e.preventDefault(); run(); };
    inp.oninput = run;
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && w.classList.contains('open')) { w.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('click', function (e) { if (w.classList.contains('open') && !w.contains(e.target)) { w.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); } });
  }

  // 3. Home page banner
  function banner() {
    if (!HOME || document.getElementById('sg-banner')) return;
    // right under the hero's "Enter the Quest" buttons (the top of <main> sits under the fixed menu)
    var cta = null;
    Array.prototype.forEach.call(document.querySelectorAll('main a'), function (a) { if (!cta && /Enter the Quest/.test(a.textContent || '')) cta = a; });
    var row = cta && cta.parentNode; if (!row || !row.parentNode) return;
    var b = document.createElement('div'); b.id = 'sg-banner'; b.setAttribute('data-keep-colors', '');
    b.innerHTML = who
      ? '<a href="/welcome.html"><span style="font-size:22px">📣</span><div><b>Welcome back' + (who.name ? ', ' + esc(who.name) : '') + '!</b><br><span>Today\'s briefing, the Survey of the Day, and what\'s due.</span></div><i>Open Today →</i></a>'
      : '<a href="/start.html"><span style="font-size:22px">🧭</span><div><b>New to Mr. Dopp\'s class?</b><br><span>See how the site works and take the 3-minute tour.</span></div><i>Start Here →</i></a>';
    row.parentNode.insertBefore(b, row.nextSibling);
  }

  var queued = false;
  function runAll() { queued = false; addCss(); navLink(); helpButton(); banner(); }
  function schedule() { if (!queued) { queued = true; setTimeout(runAll, 60); } }
  function start() {
    runAll();
    // Next.js can re-render the nav and main after hydration; put things back if they disappear.
    if (window.MutationObserver) {
      // (also catches the phone menu, which is only drawn when it's opened; runAll() changes nothing twice)
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    }
  }
  // Next.js pages: wait until React has hydrated, or React throws away the page and redraws it.
  var NEXT = !!document.querySelector('script[src*="/_next/static/"]') || root.classList.contains('dl-next');
  function later() { setTimeout(start, NEXT ? 400 : 0); }
  if (document.readyState === 'complete') later(); else window.addEventListener('load', later);
})();

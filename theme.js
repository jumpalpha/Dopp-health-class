/* theme.js — light/dark switch for doppsclass.com (added 2026-11-10).
   - One setting per device: localStorage 'dopp_theme' = 'light' | 'dark'. No setting = dark (the default look).
   - html.dl = light mode. Arcade games always stay dark.
   - Puts a sun/moon button in the top nav (site nav, quest nav, or the Next.js nav), next to Search.
   - Classic light-by-design pages (chapters, checklist…) are darkened by dark_mode.js; in light mode
     we just let them be, and next_skin.js uses its light aurora.
   - Natively dark pages (home, chapter list, realms, arcade menu, quest) get light tokens below plus
     a sweep that turns their faint white overlays into faint dark ones.
   Loaded synchronously in <head> (directly on the Next.js pages, via dark_mode.js on classic pages). */
// Next.js pages don't load local-guard.js; bring it in so the demo account's badge + tour show there too.
(function () {
  if (window.DoppDemo) return;
  try { if (!localStorage.getItem('dopp_demo')) return; } catch (e) { return; }
  var s = document.createElement('script'); s.src = '/local-guard.js';
  (document.head || document.documentElement).appendChild(s);
})();
(function () {
  if (window.DoppThemeUI) return;
  var KEY = 'dopp_theme';
  var root = document.documentElement;
  var path = location.pathname;
  var file = (path.split('/').pop() || '').replace(/\.html$/, '');
  var GAME = /\/arcade\/play\//.test(path) || root.hasAttribute('data-app-name') ||
             /^(dopp_spin|germ_snipes|team_hangman|partner|trail|live|live_host|timer|print_quest|sub_guide)$/.test(file) ||
             /^game\d\d_/.test(file);
  var NEXT = !!document.querySelector('link[href*="/_next/static/"], script[src*="/_next/static/"]') || root.classList.contains('h-full');
  var QUEST = file === 'quest';
  if (NEXT) root.classList.add('dl-next');
  if (QUEST) root.classList.add('dl-native');
  if (NEXT) root.classList.add('dl-native');

  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function isLight() { return !GAME && saved() === 'light'; }

  /* ---------------- styles ---------------- */
  var INK = '#15172b', MUTED = '#575b78', BG = '#f5f6fb';
  var css = [
    // shared toggle button (looks like the Search icon next to it)
    '.dl-tg{display:grid;place-items:center;width:36px;height:36px;border-radius:12px;border:0;background:none;padding:0;cursor:pointer;',
    '  color:#a3a6c8;transition:background .2s,color .2s,transform .2s;-webkit-tap-highlight-color:transparent;flex:none}',
    '.dl-tg:hover{background:rgba(255,255,255,.06);color:#eef0ff}',
    '.dl-tg:active{transform:scale(.92)}',
    '.dl-tg svg{width:18px;height:18px;display:block}',
    '.dl-tg .dl-sun{display:none}html.dl .dl-tg .dl-sun{display:block}html.dl .dl-tg .dl-moon{display:none}',
    'html.dl .dl-tg{color:' + MUTED + '}html.dl .dl-tg:hover{background:rgba(21,23,43,.06);color:' + INK + '}',
    'html.dl-switching *,html.dl-switching *::before,html.dl-switching *::after{transition:none!important}',
    '@media print{.dl-tg{display:none!important}}',

    /* ===== Next.js pages (home, chapters, realms, arcade menu) — Tailwind v4 tokens ===== */
    'html.dl.dl-next{color-scheme:light;--color-ink:' + BG + ';--color-ink-2:#ffffff;--color-fg:' + INK + ';--color-muted:' + MUTED + ';',
    '  --color-line:rgba(21,23,43,.11);--color-white:' + INK + ';background:' + BG + '}',
    // text that sits on gold/colored buttons stays dark
    'html.dl.dl-next .text-ink{color:#07071a!important}',
    // accent TEXT gets deeper versions so it reads on white (backgrounds keep the bright ones)
    'html.dl.dl-next [class*="text-gold"]{color:#9a6400!important}',
    'html.dl.dl-next [class*="text-amber"]{color:#b45309!important}',
    'html.dl.dl-next [class*="text-emerald"]{color:#047857!important}',
    'html.dl.dl-next [class*="text-sky"]{color:#0369a1!important}',
    'html.dl.dl-next [class*="text-crimson"],html.dl.dl-next [class*="text-rose"]{color:#be123c!important}',
    'html.dl.dl-next [class*="text-violet"]{color:#7c3aed!important}',
    'html.dl.dl-next .text-gradient{background:linear-gradient(115deg,#d97706 0%,#ea580c 45%,#e11d48 100%);-webkit-background-clip:text;background-clip:text}',
    // faint white glass cards -> frosted white (hover: variants keep the dark tint from --color-white)
    'html.dl.dl-next [class^="bg-white/"],html.dl.dl-next [class*=" bg-white/"]{background-color:rgba(255,255,255,.74)!important}',
    'html.dl.dl-next .glass{background:rgba(255,255,255,.78);box-shadow:0 10px 30px -18px rgba(21,23,43,.35)}',
    'html.dl.dl-next ::selection{color:' + INK + ';background:rgba(255,184,0,.35)}',
    // gold buttons: keep dark label even when it is inherited
    'html.dl.dl-next a.bg-gold,html.dl.dl-next button.bg-gold,html.dl.dl-next [class*="from-gold"]{color:#07071a}',

    /* ===== quest.html (same tokens, plain CSS variables) ===== */
    'html.dl.dl-native:not(.dl-next){color-scheme:light;--ink:' + BG + ';--ink-2:#ffffff;--fg:' + INK + ';--muted:' + MUTED + ';--line:rgba(21,23,43,.11);',
    '  --gold-ink:#9a6400;--card:rgba(21,23,43,.035)}',
    'html.dl.dl-native:not(.dl-next) ::selection{color:' + INK + '}',
    'html.dl.dl-native:not(.dl-next) .aurora b{opacity:.0}',
    'html.dl.dl-native:not(.dl-next) .site-nav nav, html.dl.dl-native:not(.dl-next) .mobile-menu{background:rgba(255,255,255,.82)!important}',
    'html.dl.dl-native:not(.dl-next) .icon-btn{color:' + MUTED + '}',
    'html.dl.dl-native:not(.dl-next) .text-gradient{background:linear-gradient(115deg,#d97706 0%,#ea580c 45%,#e11d48 100%);-webkit-background-clip:text;background-clip:text}',

    /* ===== classic pages restyled by next_skin.js (html.nxp) ===== */
    'html.dl.nxp{--gold:#ffd166;--gold-dim:#8a6d00;--text:' + INK + ';--dim:rgba(21,23,43,.66);--border:rgba(21,23,43,.12);--line:rgba(21,23,43,.12);--bg:#ffffff;',
    '  color-scheme:light;background:radial-gradient(60% 50% at 10% 0%,rgba(56,191,255,.13),transparent 70%),radial-gradient(50% 45% at 95% 12%,rgba(168,85,247,.10),transparent 70%),',
    '  radial-gradient(60% 50% at 50% 110%,rgba(255,159,28,.10),transparent 70%),' + BG + ' fixed!important}',
    'html.dl.nxp body{color:' + INK + '}',
    'html.dl.nxp body::before{background:linear-gradient(rgba(21,23,43,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(21,23,43,.035) 1px,transparent 1px);background-size:64px 64px}',
    'html.dl.nxp ::selection{color:' + INK + ';background:rgba(255,184,0,.35)}',
    'html.dl.nxp #pin-gate{background:radial-gradient(60% 50% at 10% 0%,rgba(56,191,255,.13),transparent 70%),' + BG + '!important}',
    'html.dl .nxn{background:rgba(255,255,255,.84)!important;border-color:rgba(21,23,43,.09)!important;box-shadow:0 10px 40px -18px rgba(21,23,43,.35)!important}',
    'html.dl .nxn-brand{color:' + INK + '!important}html.dl .nxn-brand em{color:' + MUTED + '}',
    'html.dl .nxn-links a{color:' + MUTED + '!important}html.dl .nxn-links a:hover,html.dl .nxn-links a[aria-current]{color:' + INK + '!important}',
    'html.dl .nxn-ic{color:' + MUTED + '!important}html.dl .nxn-ic:hover{background:rgba(21,23,43,.06)!important;color:' + INK + '!important}',
    'html.dl .nxn-menu{background:rgba(255,255,255,.96)!important;border-color:rgba(21,23,43,.09)!important}',
    'html.dl .nxn-menu a{color:' + MUTED + '!important}html.dl .nxn-menu a:hover,html.dl .nxn-menu a[aria-current]{background:rgba(21,23,43,.05)!important;color:' + INK + '!important}'
  ].join('\n');
  var st = document.createElement('style');
  st.id = 'dl-theme-style';
  st.textContent = css;
  (document.head || root).appendChild(st);

  /* ---------------- faint white overlays -> faint dark (natively dark pages only) ---------------- */
  var swept = [];
  function rgba(s) {
    var m = s && s.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/);
    if (!m) return null;
    var a = m[4] == null ? 1 : (m[4].slice(-1) === '%' ? parseFloat(m[4]) / 100 : +m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a: a };
  }
  function whiteTint(c) { return c && c.r > 235 && c.g > 235 && c.b > 235 && c.a > 0 && c.a < 0.3; }
  function whiteCard(c) { return 'rgba(255,255,255,' + Math.min(0.9, 0.6 + c.a * 3).toFixed(2) + ')'; }   // faint glass -> frosted white
  function darkTint(c) { return 'rgba(21,23,43,' + Math.min(0.14, Math.max(0.035, c.a * 1.3)).toFixed(3) + ')'; }
  function set(el, p, v) {
    if (!el.__dl) { el.__dl = {}; swept.push(el); }
    if (!(p in el.__dl)) el.__dl[p] = [el.style.getPropertyValue(p), el.style.getPropertyPriority(p)];
    el.style.setProperty(p, v, 'important');
  }
  function sweep(top) {
    // Natively dark pages: overlays + text. Classic light-by-design pages: only fix pale accent text.
    if (!root.classList.contains('dl') || GAME || !top || top.nodeType !== 1) return;
    var nat = root.classList.contains('dl-native');
    var els = [top].concat(Array.prototype.slice.call(top.querySelectorAll('*')));
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.__dlDone || /^(SCRIPT|STYLE|IMG|CANVAS|VIDEO|svg|path|IFRAME)$/.test(el.tagName) || el.closest('.dl-tg')) continue;
      el.__dlDone = true;
      var cs = getComputedStyle(el), c;
      if (nat && whiteTint(c = rgba(cs.backgroundColor))) set(el, 'background-color', whiteCard(c));
      var bi = cs.backgroundImage;
      if (nat && bi && bi.indexOf('gradient') >= 0 && /rgba\(255, 255, 255, 0\.\d+\)/.test(bi) && !/url\(/.test(bi)) {
        set(el, 'background-image', bi.replace(/rgba\(255, 255, 255, (0\.\d+)\)/g, function (m, a) { return whiteCard({ a: +a }); }));
      }
      ['top', 'right', 'bottom', 'left'].forEach(function (s) {
        if (nat && parseFloat(cs['border-' + s + '-width']) > 0 && whiteTint(c = rgba(cs['border-' + s + '-color']))) set(el, 'border-' + s + '-color', 'rgba(21,23,43,.12)');
      });
      // plain near-white text that isn't on a dark/colored chip -> ink
      c = rgba(cs.color);
      if (!c || c.a < 0.5 || !hasText(el)) continue;
      if (c.r > 225 && c.g > 225 && c.b > 225) { if (nat && !onDark(el)) set(el, 'color', INK); continue; }
      // bright accent text (realm colors, gold labels) -> a deeper shade of the same hue
      if (0.299 * c.r + 0.587 * c.g + 0.114 * c.b > 140 && !onDark(el)) set(el, 'color', deepen(c));
    }
  }
  function hasText(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.textContent.trim()) return true;
    return false;
  }
  function deepen(c) {
    var r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0, s = 0, l = (mx + mn) / 2;
    if (d) { s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    var L = s < 0.2 ? 0.42 : (h >= 35 && h <= 75) ? 0.33 : (h > 75 && h < 200) ? 0.32 : 0.45;   // yellows/greens/cyans need to go darker to read on white
    return 'hsl(' + h.toFixed(0) + ',' + Math.min(100, s * 100).toFixed(0) + '%,' + (L * 100).toFixed(0) + '%)';
  }
  function onDark(el) {
    for (var n = el; n && n !== document.body && n.nodeType === 1; n = n.parentElement) {
      var cs = getComputedStyle(n), c = rgba(cs.backgroundColor);
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && !/rgba\(21, 23, 43/.test(cs.backgroundImage)) {
        if (/url\(/.test(cs.backgroundImage)) return true;
        var cols = cs.backgroundImage.match(/rgba?\([^)]*\)/g) || [];
        var solid = cols.map(rgba).filter(function (x) { return x && x.a > 0.5; });
        if (solid.length) return solid.some(function (x) { return (0.299 * x.r + 0.587 * x.g + 0.114 * x.b) < 170; });
      }
      if (c && c.a > 0.5) return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) < 170;
    }
    return false;
  }
  function resweep() { if (!root.classList.contains('dl')) return; Array.prototype.forEach.call(document.querySelectorAll('*'), function (el) { el.__dlDone = false; }); sweep(document.body); }
  function unsweep() {
    swept.forEach(function (el) {
      var o = el.__dl;
      for (var p in o) { if (o[p][0]) el.style.setProperty(p, o[p][0], o[p][1]); else el.style.removeProperty(p); }
      el.__dl = null;
    });
    swept = [];
    Array.prototype.forEach.call(document.querySelectorAll('*'), function (el) { el.__dlDone = false; });
  }
  var obs = null;
  function watch(on) {
    if (on && !obs && window.MutationObserver && document.body) {
      var q = [], t = null;
      obs = new MutationObserver(function (ms) {
        ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) q.push(n); }); });
        if (!t) t = setTimeout(function () { t = null; var a = q; q = []; a.forEach(function (n) { if (n.isConnected) sweep(n); }); placeButton(); }, 60);
      });
      obs.observe(document.body, { childList: true, subtree: true });
    } else if (!on && obs) { obs.disconnect(); obs = null; }
  }

  /* ---------------- apply ---------------- */
  function apply(light, fromUser) {
    root.classList.add('dl-switching');
    root.classList.toggle('dl', light);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) { if (!meta.__dlOrig) meta.__dlOrig = meta.content; meta.content = light ? '#f5f6fb' : meta.__dlOrig; }
    if (window.DoppTheme && window.DoppTheme.set && !GAME) window.DoppTheme.set(!light, true);   // classic pages: dark_mode.js
    if (document.body) {
      if (light) { sweep(document.body); watch(true); } else { watch(false); unsweep(); }
      if (light) setTimeout(function () { resweep(); }, 400);   // after next_skin/page scripts settle
    }
    paint();
    void root.offsetHeight;
    setTimeout(function () { root.classList.remove('dl-switching'); }, 30);
    if (fromUser) { try { document.dispatchEvent(new CustomEvent('dopp-theme', { detail: { light: light } })); } catch (e) {} }
  }
  function setLight(light) {
    try { localStorage.setItem(KEY, light ? 'light' : 'dark'); } catch (e) {}
    apply(light, true);
  }
  if (isLight()) root.classList.add('dl');   // before first paint

  /* ---------------- the nav button ---------------- */
  var SUN = '<svg class="dl-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
  var MOON = '<svg class="dl-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
  function paint() {
    var on = root.classList.contains('dl');
    Array.prototype.forEach.call(document.querySelectorAll('.dl-tg'), function (b) {
      b.setAttribute('aria-label', on ? 'Switch to dark mode' : 'Switch to light mode');
      b.title = on ? 'Dark mode' : 'Light mode';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function placeButton() {
    if (GAME || !document.body) return;
    var search = document.querySelector('.nxn-right a[href*="search"], #site-nav .nav-right a[href*="search"], header nav a[aria-label="Search"]');
    if (!search || !search.parentNode) return;
    if (search.previousElementSibling && search.previousElementSibling.classList.contains('dl-tg')) return;
    var old = document.querySelector('.dl-tg'); if (old) old.remove();
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'dl-tg';
    b.innerHTML = SUN + MOON;
    b.addEventListener('click', function () { setLight(!root.classList.contains('dl')); });
    search.parentNode.insertBefore(b, search);
    paint();
  }
  // Next.js pages: touching React's DOM before it hydrates breaks hydration, so wait until it has.
  // Next.js mounts <next-route-announcer> only after hydration has committed — the safe signal.
  // Fallback (if it ever goes away): the page has loaded and the footer has been hydrated.
  var loaded = document.readyState === 'complete';
  window.addEventListener('load', function () { loaded = true; });
  function hydrated() {
    if (!NEXT) return true;
    if (document.querySelector('next-route-announcer')) return true;
    var n = document.querySelector('footer') || document.querySelector('header nav');
    if (!loaded || !n) return false;
    for (var k in n) if (k.indexOf('__reactFiber') === 0) return tries > 20;
    return false;
  }
  var tries = 0;
  function start() {
    if (!hydrated() && tries++ < 200) { setTimeout(start, 50); return; }
    placeButton();
    if (isLight()) apply(true);
    // React (Next.js pages) can re-render the nav after hydration; keep the button there.
    if (window.MutationObserver) {
      var t = null;
      new MutationObserver(function () { if (t) return; t = setTimeout(function () { t = null; placeButton(); }, 80); })
        .observe(document.body, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.addEventListener('load', function () { if (!hydrated()) return; placeButton(); resweep(); });

  // other tabs
  window.addEventListener('storage', function (e) { if (e.key === KEY && !GAME) apply(e.newValue === 'light'); });

  window.DoppThemeUI = { set: setLight, isLight: function () { return root.classList.contains('dl'); } };
})();

/* Arcade Leaderboard links on the Next.js pages (added 2026-11-12).
   The Next.js build has no arcade leaderboard, so this adds:
   - "🏆 Leaderboard" in the top nav (desktop + phone menu), right after Arcade
   - on /arcade/: a gold button in the header, a leaderboard banner, and a tab in the sticky game bar
   Runs after React has hydrated and re-checks on client-side page changes. */
(function () {
  if (window.DoppArcadeLB) return; window.DoppArcadeLB = true;
  var URL = '/arcade_leaderboard.html';
  var css = '.alb-banner{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:28px;padding:18px 22px;border-radius:22px;text-decoration:none;color:#07071a;' +
    'background:linear-gradient(100deg,#ffd166,#ff9f1c 55%,#ff6b3d);box-shadow:0 14px 44px -14px rgba(255,159,28,.85);transition:transform .2s,box-shadow .2s}' +
    '.alb-banner:hover{transform:translateY(-2px);box-shadow:0 20px 54px -14px rgba(255,159,28,.95)}' +
    '.alb-banner .alb-ic{font-size:40px;line-height:1}' +
    '.alb-banner .alb-tx{flex:1;min-width:200px}' +
    '.alb-banner b{display:block;font:800 22px "Bricolage Grotesque",system-ui,sans-serif;letter-spacing:-.01em}' +
    '.alb-banner small{display:block;font-size:14px;font-weight:600;opacity:.8;margin-top:2px}' +
    '.alb-banner .alb-go{font-weight:800;background:#07071a;color:#ffd166;padding:10px 16px;border-radius:14px;white-space:nowrap}' +
    '.alb-tab{background:rgba(255,209,102,.16)!important;color:#ffd166!important;border:1px solid rgba(255,209,102,.5)!important;font-weight:800!important}' +
    'html.dl .alb-tab{color:#9a6400!important}' +
    '.alb-nav{color:#ffd166!important}html.dl .alb-nav{color:#9a6400!important}';
  function addCss() {
    if (document.getElementById('alb-css')) return;
    var st = document.createElement('style'); st.id = 'alb-css'; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }
  function navLinks() {
    Array.prototype.forEach.call(document.querySelectorAll('header a[href="/arcade/"], header a[href="/arcade"]'), function (a) {
      var n = a.nextElementSibling;
      if (n && n.getAttribute('href') === URL) return;
      // copy a plain (never-active) link from the same menu so it matches the desktop bar or the phone menu
      var tpl = a.parentNode.querySelector('a[href="/quest.html"]');
      if (!tpl) return;
      var c = tpl.cloneNode(false);
      c.setAttribute('href', URL);
      c.removeAttribute('aria-current');
      c.className = (c.className || '') + ' alb-nav';
      c.textContent = '🏆 Leaderboard';
      a.parentNode.insertBefore(c, a.nextSibling);
    });
  }
  function arcadePage() {
    if (!/^\/arcade\/?$/.test(location.pathname)) return;
    var bar = document.querySelector('main a[href="#sprite"]');
    bar = bar && bar.parentNode;
    if (bar && !bar.querySelector('.alb-tab')) {
      var t = bar.firstElementChild.cloneNode(false);
      t.setAttribute('href', URL); t.className += ' alb-tab'; t.textContent = '🏆 Leaderboard';
      bar.insertBefore(t, bar.firstChild);
    }
    if (bar && !document.querySelector('.alb-banner')) {
      var b = document.createElement('a');
      b.className = 'alb-banner'; b.href = URL;
      b.innerHTML = '<span class="alb-ic">🏆</span><span class="alb-tx"><b>Arcade Leaderboard</b><small>Top scores for every game, Arcade Champions and Class Wars. Is your name on the board?</small></span><span class="alb-go">See the leaderboard →</span>';
      bar.parentNode.insertBefore(b, bar);
    }
    var hall = document.querySelector('main a.glass[href="/leaderboard.html"]');
    if (hall && !hall.parentNode.querySelector('.alb-hdr')) {
      var g = hall.nextElementSibling ? hall.nextElementSibling.cloneNode(false) : hall.cloneNode(false);
      g.setAttribute('href', URL); g.className += ' alb-hdr'; g.textContent = '🏆 Arcade Leaderboard';
      hall.parentNode.insertBefore(g, hall);
    }
  }
  var queued = false;
  function run() { queued = false; addCss(); navLinks(); arcadePage(); }
  function schedule() { if (!queued) { queued = true; setTimeout(run, 60); } }
  function start() {
    // Next.js pages only (classic pages get the link from next_skin.js)
    if (!document.querySelector('link[href*="/_next/static/"], script[src*="/_next/static/"]')) return;
    run();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }
  // wait for React to hydrate first so we don't trip a hydration mismatch
  if (document.readyState === 'complete') setTimeout(start, 300);
  else window.addEventListener('load', function () { setTimeout(start, 300); });
})();

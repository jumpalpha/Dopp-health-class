// next_skin.js — restyles the original (classic HTML) pages to match the Next.js site ("aurora" look).
// Games get the game bar below; every other page gets pageSkin(). Loaded by pwa.js.
(function () {
  var file = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  if (/\/textreader\//.test(location.pathname)) file = 'textreader';
  var GAMES = 'art_studio sprite_flap sprite_dash sprite_run sprite_sling sprite_slice sprite_siege dopp_invaders dopp_pacman dopp_breakout dopp_snake field_day habit_showdown dopp_kong dopp_motomania dopp_wordle dopp_2048 dopp_match dopp_tetris dopp_drop vocab_slice dopp_corner dopp_dunk cup_pong immune_defense germ_sweeper tic_tac_toe blast_blocks how_smart trail germ_snipes team_hangman partner dopp_spin game01_jeopardy game02_deal_or_no_deal game03_wheel_of_fortune game04_millionaire game05_hot_takes game06_escape_room game07_survivor game08_price_is_right game09_family_feud game10_imposter game11_taboo game12_would_you_rather game13_pictionary game14_shark_tank game15_myth_busters'.split(' ');
  if (GAMES.indexOf(file) === -1) { pageSkin(file); return; }

  var root = document.documentElement;
  root.classList.add('nx');

  var font = document.createElement('link');
  font.rel = 'stylesheet';
  font.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Geist:wght@400;600;700;800&display=swap';
  document.head.appendChild(font);

  var css = `
  html.nx{background:#07071a;color-scheme:dark}
  html.nx body{background:
    radial-gradient(60% 50% at 10% 0%,rgba(56,191,255,.18),transparent 70%),
    radial-gradient(50% 45% at 95% 15%,rgba(168,85,247,.18),transparent 70%),
    radial-gradient(60% 50% at 50% 110%,rgba(255,159,28,.10),transparent 70%),
    #07071a fixed !important;
    color:#eef0ff;font-family:Geist,system-ui,sans-serif;padding-top:76px}
  html.nx body > .top, html.nx body > header:has(.back-btn){display:none !important}

  .nx-bar{position:fixed;top:10px;left:12px;right:12px;z-index:9999;max-width:1180px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px;
    padding:8px 10px 8px 12px;border-radius:16px;background:rgba(7,7,26,.78);border:1px solid rgba(255,255,255,.09);
    backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 10px 40px -15px rgba(0,0,0,.8);font-family:Geist,system-ui,sans-serif}
  .nx-brand{display:flex;align-items:center;gap:10px;color:#eef0ff;text-decoration:none;font:800 15px 'Bricolage Grotesque',sans-serif;letter-spacing:-.01em;white-space:nowrap}
  .nx-brand i{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;font-style:normal;color:#07071a;font-size:15px;
    background:linear-gradient(135deg,#ffd166,#ff9f1c,#ff3b5c);box-shadow:0 0 22px -4px rgba(255,159,28,.7)}
  .nx-title{font:800 17px 'Bricolage Grotesque',sans-serif;letter-spacing:-.01em;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .nx-back{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:12px;background:#ffd166;color:#07071a;font:700 14px Geist,sans-serif;text-decoration:none;white-space:nowrap;box-shadow:0 6px 24px -8px rgba(255,209,102,.9)}
  .nx-back:hover{filter:brightness(1.08)}
  .nx-back.nx-lb{background:rgba(255,209,102,.12);color:#ffd166;border:1px solid rgba(255,209,102,.45);box-shadow:none}
  @media (max-width:560px){.nx-lbt{display:none}}
  @media (max-width:560px){.nx-brand span{display:none}.nx-title{font-size:15px}}

  /* shared arcade engine (arcade_kit.js) */
  html.nx .ak-stage{border-radius:24px;box-shadow:0 0 0 1px rgba(255,255,255,.1),0 30px 80px -30px rgba(0,0,0,.9),0 0 60px -20px rgba(56,191,255,.35)}
  html.nx .ak-score{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;-webkit-text-stroke:0;text-shadow:0 4px 18px rgba(0,0,0,.55),0 2px 0 rgba(0,0,0,.4);letter-spacing:-.02em}
  html.nx .ak-btn-icon{border:1px solid rgba(255,255,255,.14);background:rgba(7,7,26,.6);backdrop-filter:blur(10px);color:#fff;border-radius:12px}
  html.nx .ak-toast{background:linear-gradient(135deg,#ffd166,#ff9f1c);border:0;color:#1a1000;font:700 16px Geist,sans-serif;box-shadow:0 10px 30px -10px rgba(255,159,28,.9);border-radius:999px}
  html.nx .ak-ov{background:rgba(7,7,26,.55);backdrop-filter:blur(6px)}
  html.nx .ak-card{background:linear-gradient(180deg,rgba(23,22,52,.92),rgba(12,12,32,.94));border:1px solid rgba(255,255,255,.1);
    box-shadow:0 30px 80px -20px rgba(0,0,0,.85),inset 0 1px 0 rgba(255,255,255,.06);border-radius:24px;font-family:Geist,system-ui,sans-serif;color:#eef0ff;padding:22px 20px 18px}
  html.nx .ak-title{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:30px;letter-spacing:-.02em;text-shadow:none;
    background:linear-gradient(115deg,#fff4d6,#ffd166 35%,#ff9f1c 70%,#ff3b5c);-webkit-background-clip:text;background-clip:text;color:transparent}
  html.nx .ak-sub,html.nx .ak-best,html.nx .ak-keys{color:#a3a6c8;font-weight:600}
  html.nx .ak-best b{color:#ffd166}
  html.nx .ak-how{color:#d9dbf3}
  html.nx .ak-sw{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);border-radius:14px}
  html.nx .ak-sw.sel{border-color:#ffd166;box-shadow:0 0 0 3px rgba(255,209,102,.25)}
  html.nx .ak-play{border:0;border-radius:16px;background:linear-gradient(90deg,#ffd166,#ff9f1c,#ff6b3d);color:#1a0d00;font:800 19px Geist,sans-serif;
    box-shadow:0 12px 34px -10px rgba(255,159,28,.85);transition:transform .15s,box-shadow .15s}
  html.nx .ak-play:hover{transform:translateY(-1px);box-shadow:0 16px 40px -10px rgba(255,159,28,.95)}
  html.nx .ak-play:active{transform:translateY(1px);box-shadow:0 6px 20px -8px rgba(255,159,28,.8)}
  html.nx .ak-final{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;-webkit-text-stroke:0;text-shadow:0 6px 24px rgba(0,0,0,.5);letter-spacing:-.03em}
  html.nx .ak-medal{background:rgba(255,209,102,.15);color:#ffd166;border:1px solid rgba(255,209,102,.4);font-weight:700}
  html.nx .ak-medal.dim{background:rgba(255,255,255,.05);color:#a3a6c8;border-color:rgba(255,255,255,.1)}
  html.nx .ak-fact{background:rgba(56,191,255,.08);border:1px solid rgba(56,191,255,.25);border-radius:14px;color:#d9dbf3}
  html.nx .ak-link{color:#ffd166;font-weight:700}
  html.nx .ak-net{color:#a3a6c8}
  html.nx .ak-net a{color:#00e5a0}
  html.nx .ak-pad button{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.07);color:#fff;border-radius:16px;box-shadow:0 6px 20px -8px rgba(0,0,0,.8);backdrop-filter:blur(8px)}
  html.nx .ak-pad button:active{transform:translateY(2px);background:rgba(255,209,102,.25)}
  `;
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  function bar() {
    if (document.querySelector('.nx-bar')) return;
    var h = document.querySelector('body > .top h1, body > header .game-title');
    var title = (h && h.textContent.trim()) || document.title.split(/\s[—|-]\s/)[0];
    var b = document.createElement('div');
    b.className = 'nx-bar';
    b.innerHTML = '<a class="nx-brand" href="/"><i>⚔</i><span>Legend of Wellness</span></a>' +
      '<div class="nx-title"></div><span style="display:flex;gap:6px"><a class="nx-back nx-lb" href="/arcade_leaderboard.html">🏆 <span class="nx-lbt">Leaderboard</span></a><a class="nx-back" href="/arcade">← Arcade</a></span>';
    b.querySelector('.nx-title').textContent = title;
    document.body.insertBefore(b, document.body.firstChild);
  }
  if (document.body) bar(); else document.addEventListener('DOMContentLoaded', bar);

  // Old "back to arcade / home" links (including ones the engine draws later) go to the new pages.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (href === 'arcade.html' || href.indexOf('arcade.html#') === 0) { e.preventDefault(); location.href = '/arcade'; }
    else if (href === 'index.html') { e.preventDefault(); location.href = '/'; }
  }, true);

  // ───────────────────────── Every other classic page ─────────────────────────
  // dark_mode.js (in <head>) already turns light pages dark. This adds the rest of the aurora look:
  // background glows, Geist/Bricolage fonts, the site's top nav, and gold gradient buttons.
  function pageSkin(file) {
    // Already native (quest.html), printables (stay paper-white), and old pages that now redirect.
    var SKIP = /^(quest|print_quest|sub_guide|cpr_checkoff|cpr_paper_aed|cpr_trainer_build|index|404|arcade|chapters|realm\d)$/;
    if (!file || SKIP.test(file)) return;
    var NO_NAV = /^(live|live_host|timer)$/;   // projector tools: full screen, no site nav
    var root = document.documentElement;
    root.classList.add('nxp');

    // Fonts: the pages ask for Nunito and Cinzel by name, so point those names at Geist and Bricolage.
    var CDN = 'https://cdn.jsdelivr.net/npm/@fontsource-variable/';
    var GEIST = CDN + 'geist@5.2.5/files/geist-latin-wght-normal.woff2';
    var BRIC = CDN + 'bricolage-grotesque@5.2.5/files/bricolage-grotesque-latin-wght-normal.woff2';
    var face = function (fam, url) { return "@font-face{font-family:'" + fam + "';src:url(" + url + ") format('woff2');font-weight:100 900;font-style:normal;font-display:swap}"; };
    Array.prototype.forEach.call(document.querySelectorAll('link[href*="fonts.googleapis.com"]'), function (l) {
      if (!/Nunito|Cinzel/.test(l.href)) return;
      if (/Patrick\+Hand/.test(l.href)) l.href = 'https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap';   // keep the handwriting font
      else l.remove();
    });

    var css = [
      face('Geist', GEIST), face('Nunito', GEIST), face('Bricolage Grotesque', BRIC), face('Cinzel', BRIC), face('Cinzel Decorative', BRIC),
      // colors: same tokens as src/app/globals.css
      'html.nxp{--gold:#ffd166;--gold-dim:#d9b45a;--text:#eef0ff;--dim:#a3a6c8;--border:rgba(255,255,255,.1);--line:rgba(255,255,255,.1);',
      '  color-scheme:dark;background:radial-gradient(60% 50% at 10% 0%,rgba(56,191,255,.16),transparent 70%),radial-gradient(50% 45% at 95% 12%,rgba(168,85,247,.16),transparent 70%),',
      '  radial-gradient(60% 50% at 50% 110%,rgba(255,159,28,.09),transparent 70%),#07071a fixed !important}',
      'html.nxp body{background:transparent !important;color:#eef0ff;-webkit-font-smoothing:antialiased}',
      'html.nxp body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(rgba(255,255,255,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.022) 1px,transparent 1px);',
      '  background-size:64px 64px;-webkit-mask-image:radial-gradient(ellipse at top,#000 15%,transparent 65%);mask-image:radial-gradient(ellipse at top,#000 15%,transparent 65%)}',
      'html.nxp :is(h1,h2,h3){letter-spacing:-.02em}',
      'html.nxp #pin-gate{background:radial-gradient(60% 50% at 10% 0%,rgba(56,191,255,.16),transparent 70%),radial-gradient(50% 45% at 95% 12%,rgba(168,85,247,.16),transparent 70%),#07071a !important}',
      'html.nxp ::selection{background:rgba(255,209,102,.35);color:#fff}',
      'html.nxp :focus-visible{outline:2px solid #ffd166;outline-offset:2px}',
      'html.nxp .nx-gold{background:linear-gradient(90deg,#ffd166,#ff9f1c,#ff6b3d) !important;color:#1a0d00 !important;border-color:transparent !important;',
      '  box-shadow:0 10px 30px -12px rgba(255,159,28,.85) !important;font-weight:800 !important}',
      'html.nxp .nx-gold:hover{filter:brightness(1.07)}',
      // nav (copy of components/nav.tsx, classes prefixed so they never clash with a page's own)
      'html.nxp.nxp-nav body{padding-top:76px !important}',
      'html.nxp.nxp-nav body > nav:not(.nxn), html.nxp.nxp-nav body > .topbar, html.nxp.nxp-nav body > header > nav:not(.nxn){display:none !important}',
      '.nxn-wrap{position:fixed;inset:0 0 auto 0;z-index:950;padding:10px 12px 0;font-family:Geist,system-ui,sans-serif;pointer-events:none}',
      '.nxn{pointer-events:auto;max-width:1280px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:9px 14px;border-radius:16px;',
      '  border:1px solid rgba(255,255,255,.09);background:rgba(7,7,26,.8);box-shadow:0 10px 40px -15px rgba(0,0,0,.8);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}',
      '.nxn a{text-decoration:none !important}',
      '.nxn-brand{display:flex;align-items:center;gap:10px;color:#eef0ff !important}',
      '.nxn-brand i{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;font-style:normal;font-size:17px;color:#07071a;',
      '  background:linear-gradient(135deg,#ffd166,#ff9f1c,#ff3b5c);box-shadow:0 0 24px -4px rgba(255,159,28,.7);transition:transform .2s}',
      '.nxn-brand:hover i{transform:rotate(-8deg)}',
      ".nxn-brand span{font:800 17px/1 'Bricolage Grotesque',sans-serif;letter-spacing:-.01em;white-space:nowrap}",
      '.nxn-brand em{font-style:normal;font-weight:500;color:#a3a6c8}',
      '.nxn-links{display:none;align-items:center;gap:2px}',
      '.nxn-links a{position:relative;padding:8px 12px;border-radius:8px;font-size:14px;font-weight:600;color:#a3a6c8 !important;transition:color .2s}',
      '.nxn-links a:hover,.nxn-links a[aria-current]{color:#eef0ff !important}',
      '.nxn-links a[aria-current]::after{content:"";position:absolute;left:12px;right:12px;bottom:-2px;height:2px;border-radius:2px;background:linear-gradient(90deg,#ffd166,#ff9f1c)}',
      '.nxn-right{display:flex;align-items:center;gap:8px}',
      '.nxn-ic{display:grid;place-items:center;width:36px;height:36px;border-radius:12px;color:#a3a6c8 !important;background:none;border:0;cursor:pointer;padding:0}',
      '.nxn-ic:hover{background:rgba(255,255,255,.06);color:#eef0ff !important}',
      '.nxn-ic svg{width:18px;height:18px}',
      '.nxn-cl{display:none;align-items:center;gap:6px;padding:8px 14px;border-radius:12px;background:#ffd166;color:#07071a !important;font-size:14px;font-weight:700;',
      '  box-shadow:0 6px 24px -8px rgba(255,209,102,.9)}',
      '.nxn-cl:hover{filter:brightness(1.1)}',
      '.nxn-menu{pointer-events:auto;display:none;max-width:1280px;margin:8px auto 0;padding:8px;border-radius:16px;border:1px solid rgba(255,255,255,.09);',
      '  background:rgba(13,13,38,.94);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}',
      '.nxn-wrap.open .nxn-menu{display:block}',
      '.nxn-menu a{display:block;padding:12px 16px;border-radius:12px;font-weight:600;color:#a3a6c8 !important;text-decoration:none}',
      '.nxn-menu a:hover,.nxn-menu a[aria-current]{background:rgba(255,255,255,.05);color:#eef0ff !important}',
      '@media (min-width:640px){.nxn-cl{display:flex}}',
      '@media (min-width:1024px){.nxn-links{display:flex}.nxn-burger,.nxn-wrap .nxn-menu{display:none !important}}',
      '@media print{.nxn-wrap{display:none !important}html.nxp.nxp-nav body{padding-top:0 !important}}'
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'nx-page-skin';
    st.textContent = css;
    document.head.appendChild(st);

    var LINKS = [['Home', '/'], ['Chapters', '/chapters'], ['Realms', '/realms'], ['Arcade', '/arcade'], ['🏆 Leaderboard', '/arcade_leaderboard.html'],
                 ['Quest', '/quest.html'], ['My Sprite', '/pet.html'], ['Hall', '/leaderboard.html']];
    var current = /^chapter\d/.test(file) ? 'Chapters' : /^pets?$/.test(file) ? 'My Sprite' : file === 'leaderboard' ? 'Hall' : file === 'arcade_leaderboard' ? '🏆 Leaderboard' : '';

    function nav() {
      if (NO_NAV.test(file) || document.querySelector('.nxn-wrap')) return;
      root.classList.add('nxp-nav');
      var links = LINKS.map(function (l) {
        return '<a href="' + l[1] + '"' + (l[0] === current ? ' aria-current="page"' : '') + '>' + l[0] + '</a>';
      }).join('');
      var w = document.createElement('header');
      w.className = 'nxn-wrap';
      w.setAttribute('data-keep-colors', '');
      w.innerHTML =
        '<nav class="nxn" aria-label="Main">' +
          '<a class="nxn-brand" href="/"><i>⚔</i><span>Legend <em>of</em> Wellness</span></a>' +
          '<div class="nxn-links">' + links + '</div>' +
          '<div class="nxn-right">' +
            '<a class="nxn-ic" href="/search.html" aria-label="Search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></a>' +
            '<a class="nxn-cl" href="/checklist.html"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/></svg> Checklist</a>' +
            '<button class="nxn-ic nxn-burger" type="button" aria-label="Menu" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>' +
          '</div>' +
        '</nav>' +
        '<div class="nxn-menu">' + links + '<a href="/checklist.html">Checklist</a></div>';
      var burger = w.querySelector('.nxn-burger');
      burger.addEventListener('click', function () {
        var open = w.classList.toggle('open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.body.insertBefore(w, document.body.firstChild);
    }

    // dark_mode.js paints the page body navy; clear that so the aurora shows through.
    function clearBody() {
      [document.body, root].forEach(function (el) {
        el.style.removeProperty('background-color');
        el.style.removeProperty('background-image');
      });
    }

    // Old bright-gold buttons (#FFD700 and friends) → the new gold gradient.
    function isGold(c) {
      var m = c && c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
      if (!m || (m[4] != null && +m[4] < 0.6)) return false;
      var r = +m[1], g = +m[2], b = +m[3];
      return r > 235 && g > 175 && g < 230 && b < 120;
    }
    function goldButtons(top) {
      var els = (top || document).querySelectorAll('button, a, input[type=submit], input[type=button], .btn');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.classList.contains('nx-gold') || el.closest('.nxn-wrap')) continue;
        var cs = getComputedStyle(el);
        if (isGold(cs.backgroundColor) || /255, 215, 0/.test(cs.backgroundImage)) el.classList.add('nx-gold');
      }
    }

    function go() {
      nav(); clearBody(); goldButtons();
      if (window.MutationObserver) {
        var t = null;
        new MutationObserver(function () {
          if (t) return;
          t = setTimeout(function () { t = null; goldButtons(); }, 120);
        }).observe(document.body, { childList: true, subtree: true });
      }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
    window.addEventListener('load', function () { clearBody(); goldButtons(); });
  }
})();

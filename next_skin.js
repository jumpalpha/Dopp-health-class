// next_skin.js — restyles the original game pages to match the Next.js site (local rebuild only).
(function () {
  var file = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  var GAMES = 'sprite_flap sprite_dash sprite_run sprite_sling sprite_slice sprite_siege dopp_invaders dopp_pacman dopp_breakout dopp_snake field_day habit_showdown dopp_kong dopp_motomania dopp_wordle dopp_2048 dopp_match dopp_tetris dopp_drop vocab_slice dopp_corner dopp_dunk cup_pong immune_defense germ_sweeper tic_tac_toe blast_blocks how_smart trail germ_snipes team_hangman partner dopp_spin game01_jeopardy game02_deal_or_no_deal game03_wheel_of_fortune game04_millionaire game05_hot_takes game06_escape_room game07_survivor game08_price_is_right game09_family_feud game10_imposter game11_taboo game12_would_you_rather game13_pictionary game14_shark_tank game15_myth_busters'.split(' ');
  if (GAMES.indexOf(file) === -1) return;

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
      '<div class="nx-title"></div><a class="nx-back" href="/arcade">← Arcade</a>';
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
})();

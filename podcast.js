/*
 * podcast.js — "Listen to this chapter" player on chapter pages (loaded by shared.js).
 * The episode list and the player itself live in listen-core.js — add new episodes there.
 * When an episode ends, the next chapter's episode starts after a short "Up next" countdown.
 */
(function () {
  var m = (location.pathname.match(/chapter(\d{2})\.html$/i) || location.pathname.match(/\/chapters\/(\d{1,2})\/?$/));
  if (!m) return;
  var n = parseInt(m[1], 10);

  function build() {
    var L = window.DoppListen;
    if (!L || !L.has(n)) return;
    var hero = document.querySelector('.ch-hero');
    if (!hero || document.getElementById('dopp-pod')) return;
    var css = document.createElement('style');
    css.textContent = '#dopp-pod{position:relative;z-index:2;max-width:1100px;margin:-20px auto 24px;padding:0 22px}' +
      '@media(max-width:600px){#dopp-pod{padding:0 16px;margin-top:6px}}';
    document.head.appendChild(css);
    var box = document.createElement('section');
    box.id = 'dopp-pod';
    box.setAttribute('aria-label', 'Chapter podcast');
    hero.parentNode.insertBefore(box, hero.nextSibling);
    L.player(box, n, { pageChapter: n });
    L.sync();
  }

  function ready() { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build(); }

  if (window.DoppListen) return ready();
  // listen-core.js normally loads just before this file (shared.js); load it ourselves if it didn't.
  var me = document.currentScript && document.currentScript.src;
  var s = document.createElement('script');
  s.src = me ? me.replace(/podcast\.js(\?.*)?$/, 'listen-core.js') : 'listen-core.js';
  s.onload = ready;
  document.head.appendChild(s);
})();

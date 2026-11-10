// hero_art.js — painted portraits for the 8 Quest heroes (2026-11).
// The database still stores the hero as an emoji (students.avatar); this only changes how it's drawn.
// Usage: DoppHero.html(emoji)  -> HTML string (an <img>, or the plain emoji if it isn't one of the 8)
//        DoppHero.fill(el, emoji) -> puts that into an element
(function () {
  if (window.DoppHero) return;
  var MAP = { '⚔': 'knight', '🛡': 'guardian', '🏹': 'archer', '🧙': 'wizard', '🦸': 'hero', '🧝': 'elf', '🦊': 'fox', '🐉': 'dragon' };
  var NAMES = { knight: 'Knight', guardian: 'Guardian', archer: 'Archer', wizard: 'Wizard', hero: 'Superhero', elf: 'Elf', fox: 'Fox', dragon: 'Dragon' };

  function key(e) { return String(e || '').replace(/[️‍]/g, '').replace(/[\u{1F3FB}-\u{1F3FF}♀♂]/gu, '').trim(); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function slug(e) { return MAP[key(e) || '⚔'] || null; }

  function html(e, extraClass) {
    var k = key(e) || '⚔', s = MAP[k];
    if (!s) return '<span class="hero-em">' + esc(e) + '</span>';
    // If the picture can't load, fall back to the emoji (k is one of the 8 known emoji, so it's safe as text).
    return '<img class="hero-art' + (extraClass ? ' ' + extraClass : '') + '" src="/art/hero-' + s + '.jpg" alt="' + NAMES[s] +
      '" title="' + NAMES[s] + '" draggable="false" onerror="this.replaceWith(document.createTextNode(\'' + k + '\'))">';
  }
  function fill(el, e, extraClass) { if (el) el.innerHTML = html(e, extraClass); }

  var st = document.createElement('style');
  st.textContent =
    // portrait cards: the art keeps its own dark backdrop, clipped to the container's rounded corners
    '.hero-art{display:block;width:100%;height:100%;object-fit:cover;border-radius:inherit;background:#07071a;pointer-events:none;user-select:none}' +
    '.hero-art-inline{display:inline-block;vertical-align:middle;width:1.6em;height:1.6em}';
  (document.head || document.documentElement).appendChild(st);

  window.DoppHero = { html: html, fill: fill, slug: slug, list: Object.keys(MAP) };
})();

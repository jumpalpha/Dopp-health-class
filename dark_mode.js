/* Dark mode for doppsclass.com
   - Loaded in <head> on every page (no white flash).
   - Remembers the choice per device (localStorage 'dopp_theme' = 'dark' | 'light').
     First visit follows the device's own dark-mode setting.
   - Only LIGHT backgrounds get darkened and only DARK text gets lightened, so parts of a page
     that are already dark (nav bar, hero, pop-ups, arcade games) are left exactly as designed.
   - Pages that are dark by design don't show the toggle.
*/
(function () {
  if (window.DoppTheme) return;
  var KEY = 'dopp_theme';
  var root = document.documentElement;
  var PROPS = ['background-color', 'background-image', 'color', 'border-top-color', 'border-right-color',
               'border-bottom-color', 'border-left-color', 'outline-color', 'fill', 'stroke'];
  var touched = [];         // elements we changed, so light mode can put them back
  var active = false, observer = null, gen = 0;

  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function wantsDark() {
    var s = saved();
    if (s === 'dark') return true;
    if (s === 'light') return false;
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; }
  }

  // ---------- color math ----------
  function parse(c) {
    var h = c && c.trim().match(/^#([0-9a-f]{3,8})$/i);
    if (h) {
      var x = h[1]; if (x.length <= 4) x = x.split('').map(function (d) { return d + d; }).join('');
      return { r: parseInt(x.substr(0, 2), 16), g: parseInt(x.substr(2, 2), 16), b: parseInt(x.substr(4, 2), 16),
               a: x.length === 8 ? parseInt(x.substr(6, 2), 16) / 255 : 1 };
    }
    var m = c && c.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/);
    if (!m) return null;
    var a = m[4] == null ? 1 : (m[4].slice(-1) === '%' ? parseFloat(m[4]) / 100 : +m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a: a };
  }
  function toHsl(c) {
    var r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    var h = 0, s = 0, l = (mx + mn) / 2, d = mx - mn;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return { h: h, s: s, l: l };
  }
  function hsla(h, s, l, a) {
    return 'hsla(' + h.toFixed(1) + ',' + (s * 100).toFixed(1) + '%,' + (l * 100).toFixed(1) + '%,' + (+a.toFixed(3)) + ')';
  }
  function lum(c) { return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255; }
  // Light enough to be a page/card surface (not a bright accent like gold or emerald).
  function isLightSurface(c) { var x = toHsl(c); return x.l > 0.8 || (lum(c) > 0.62 && x.s < 0.45); }

  // A light surface -> a dark one. Near-whites/creams become the site's deep navy.
  function darkSurface(c) {
    var x = toHsl(c);
    if (x.l > 0.88 || x.s < 0.5) return hsla(245, 0.24, 0.07 + (1 - x.l) * 0.35, c.a);
    return hsla(x.h, 0.45, 0.06 + (1 - x.l) * 0.6, c.a);
  }
  // Dark text/tint -> light.
  function lightInk(c) {
    var x = toHsl(c);
    return hsla(x.h, x.s * 0.7, Math.max(0.8, 1 - x.l), c.a);
  }
  function lightTint(c) {   // faint dark overlays (cards, borders) become faint light overlays
    var x = toHsl(c);
    return hsla(x.h, x.s * 0.5, 1 - x.l * 0.3, c.a);
  }

  // Background color rule
  function mapBg(str) {
    var c = parse(str); if (!c || c.a === 0) return null;
    var L = lum(c);
    if (c.a >= 0.5 && isLightSurface(c)) return darkSurface(c);            // solid light surface
    if (c.a < 0.5 && L < 0.3) return lightTint(c);                // faint dark tint on cream
    if (c.a < 0.5 && L > 0.85) return darkSurface(c);             // faint white wash
    return null;
  }
  function mapBorder(str) {
    var c = parse(str); if (!c || c.a === 0) return null;
    var L = lum(c);
    if (L < 0.3) return c.a < 0.5 ? lightTint(c) : hsla(toHsl(c).h, 0.15, 0.32, c.a);
    if (L > 0.85 && c.a >= 0.5) return hsla(245, 0.15, 0.25, c.a);
    return null;
  }
  function mapGradient(str) {
    if (!str || str === 'none' || str.indexOf('gradient') < 0) return null;
    var changed = false;
    var out = str.replace(/rgba?\([^)]*\)/g, function (m) {
      var c = parse(m); if (!c) return m;
      var L = lum(c), r = null;
      if (c.a >= 0.4 && isLightSurface(c)) r = darkSurface(c);
      else if (L < 0.3 && c.a < 0.4) r = lightTint(c);
      if (r) { changed = true; return r; }
      return m;
    });
    return changed ? out : null;
  }

  // ---------- applying ----------
  function setProp(el, prop, val) {
    if (!el.__doppOrig) { el.__doppOrig = {}; touched.push(el); }
    if (!(prop in el.__doppOrig)) el.__doppOrig[prop] = [el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)];
    el.style.setProperty(prop, val, 'important');
  }

  // Luminance of what's behind an element (after our changes), walking up to a solid background.
  function behindLum(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var cs = getComputedStyle(n);
      var bi = cs.backgroundImage;
      if (bi && bi !== 'none' && bi.indexOf('gradient') >= 0 && !/^url/.test(bi)) {
        var cols = bi.match(/rgba?\([^)]*\)|hsla?\([^)]*\)/g) || [], tot = 0, k = 0;
        cols.forEach(function (s) { var c = parse(s) || parseHsl(s); if (c && c.a > 0.4) { tot += lum(c); k++; } });
        if (k) return tot / k;
      }
      var c = parse(cs.backgroundColor) || parseHsl(cs.backgroundColor);
      if (c && c.a >= 0.5) return lum(c);
    }
    return 0.1;   // the page itself is dark now
  }
  function parseHsl(s) {
    var m = s && s.match(/hsla?\(\s*([\d.]+)[ ,]+([\d.]+)%[ ,]+([\d.]+)%(?:\s*[,/]\s*([\d.]+))?/);
    if (!m) return null;
    var h = +m[1] / 360, sa = +m[2] / 100, l = +m[3] / 100, a = m[4] == null ? 1 : +m[4];
    function f(t) { t = (t + 1) % 1; var q = l < 0.5 ? l * (1 + sa) : l + sa - l * sa, p = 2 * l - q;
      return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }
    return { r: f(h + 1 / 3) * 255, g: f(h) * 255, b: f(h - 1 / 3) * 255, a: a };
  }

  var SKIP = { SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, NOSCRIPT: 1, TEMPLATE: 1, CANVAS: 1, VIDEO: 1, IMG: 1,
               IFRAME: 1, PICTURE: 1, SOURCE: 1, BR: 1, TITLE: 1, HEAD: 1 };

  function processTree(top) {
    if (!active || !top || top.nodeType !== 1) return;
    // Pause CSS transitions so we read final colors, not mid-fade ones.
    root.classList.add('dopp-noanim'); void root.offsetHeight;
    try { processNow(top); } finally { void root.offsetHeight; root.classList.remove('dopp-noanim'); }
  }
  function processNow(top) {
    var all = [top].concat(Array.prototype.slice.call(top.querySelectorAll('*')))
      .filter(function (el) { if (el.__doppGen === gen) return false; el.__doppGen = gen; return true; });
    // Pass 1: surfaces (top-down so children see their parents' new colors)
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (SKIP[el.tagName] || el.id === 'dopp-theme-btn' || el.closest('[data-keep-colors]')) continue;
      var cs = getComputedStyle(el), v;
      if ((v = mapBg(cs.backgroundColor))) setProp(el, 'background-color', v);
      if ((v = mapGradient(cs.backgroundImage))) setProp(el, 'background-image', v);
      ['top', 'right', 'bottom', 'left'].forEach(function (side) {
        var w = parseFloat(cs['border-' + side + '-width']);
        if (w > 0) { var b = mapBorder(cs['border-' + side + '-color']); if (b) setProp(el, 'border-' + side + '-color', b); }
      });
      if (el.namespaceURI === 'http://www.w3.org/2000/svg') {
        // leave SVG art alone; only fix plain dark text inside SVG
        continue;
      }
    }
    // Pass 2: text
    for (var j = 0; j < all.length; j++) {
      var e = all[j];
      if (SKIP[e.tagName] || e.id === 'dopp-theme-btn' || e.closest('[data-keep-colors]')) continue;
      if (e.namespaceURI === 'http://www.w3.org/2000/svg' && e.tagName.toLowerCase() !== 'text') continue;
      var c = parse(getComputedStyle(e).color);
      if (!c || lum(c) >= 0.45) continue;
      if (behindLum(e) < 0.5) setProp(e, 'color', lightInk(c));
    }
  }

  function restoreAll() {
    touched.forEach(function (el) {
      var o = el.__doppOrig;
      for (var p in o) { if (o[p][0]) el.style.setProperty(p, o[p][0], o[p][1]); else el.style.removeProperty(p); }
      el.__doppOrig = null;
    });
    touched = [];
  }

  function startObserver() {
    if (observer || !window.MutationObserver) return;
    var queue = [], timer = null;
    observer = new MutationObserver(function (muts) {
      muts.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) queue.push(n); }); });
      if (!timer) timer = setTimeout(function () {
        timer = null; var q = queue; queue = [];
        q.forEach(function (n) { if (n.isConnected) processTree(n); });
      }, 30);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ---------- early styles (before the page paints) ----------
  var st = document.createElement('style');
  st.id = 'dopp-dark-style';
  st.textContent = [
    'html.dopp-dark{color-scheme:dark;background:#12111d}',
    'html.dopp-dark body{background-color:#12111d}',
    'html.dopp-pending body{visibility:hidden}',
    'html.dopp-noanim *,html.dopp-noanim *::before,html.dopp-noanim *::after{transition:none!important}',
    '#dopp-theme-btn{position:fixed;right:14px;bottom:14px;z-index:2147483000;width:46px;height:46px;border-radius:50%;',
    'border:2px solid rgba(255,215,0,.85)!important;background:#1C1A2E!important;color:#FFD700!important;font-size:22px;line-height:1;',
    'cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.35);padding:0;',
    '-webkit-tap-highlight-color:transparent;transition:transform .15s}',
    '#dopp-theme-btn:hover{transform:scale(1.08)}',
    '#dopp-theme-btn:focus-visible{outline:3px solid #38BFFF;outline-offset:2px}',
    'html.dopp-dark ::placeholder{color:rgba(230,228,245,.55)!important}',
    '@media print{#dopp-theme-btn{display:none}}'
  ].join('');
  (document.head || root).appendChild(st);

  if (wantsDark()) {
    root.classList.add('dopp-dark', 'dopp-pending');
    setTimeout(function () { root.classList.remove('dopp-pending'); }, 2500);   // safety net
  }

  // Is this page light by design? Arcade/game pages are already dark — skip them.
  function pageIsLight() {
    var c = parse(getComputedStyle(document.body).backgroundColor);
    if (!c || c.a < 0.5) c = parse(getComputedStyle(root).backgroundColor);
    var bi = getComputedStyle(document.body).backgroundImage;
    if (bi && bi.indexOf('gradient') >= 0) {
      var g = (bi.match(/rgba?\([^)]*\)/g) || []).map(parse).filter(function (x) { return x && x.a > 0.5; });
      if (g.length) return g.reduce(function (s, x) { return s + lum(x); }, 0) / g.length > 0.55;
    }
    return !c || c.a < 0.5 ? true : lum(c) > 0.55;
  }

  // Light color variables (used by ::before/::after decorations we can't reach directly) -> dark.
  function darkenVars() {
    var cs = getComputedStyle(root);
    for (var i = 0; i < cs.length; i++) {
      var name = cs[i];
      if (name.slice(0, 2) !== '--') continue;
      var c = parse(cs.getPropertyValue(name));
      if (c && c.a >= 0.5 && isLightSurface(c)) setProp(root, name, darkSurface(c));
    }
  }

  function turnOn() {
    if (active) return;
    active = true; gen++;
    root.classList.add('dopp-dark');
    darkenVars();
    processTree(document.body);
    startObserver();
  }
  function turnOff() {
    active = false;
    if (observer) { observer.disconnect(); observer = null; }
    restoreAll();
    root.classList.remove('dopp-dark');
  }

  var btn;
  function paintBtn() {
    if (!btn) return;
    btn.textContent = active ? '☀️' : '🌙';
    btn.setAttribute('aria-label', active ? 'Switch to light mode' : 'Switch to dark mode');
    btn.title = active ? 'Light mode' : 'Dark mode';
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
  function setDark(on) {
    save(on ? 'dark' : 'light');
    if (on) turnOn(); else turnOff();
    paintBtn();
  }

  var lightPage = true;
  function init() {
    // measure the page as designed (our early dark body color would fool the check)
    root.classList.remove('dopp-dark');
    lightPage = pageIsLight();
    if (!lightPage) { root.classList.remove('dopp-pending'); return; }
    if (wantsDark()) turnOn();
    root.classList.remove('dopp-pending');
    if (root.hasAttribute('data-no-theme-btn')) return;
    btn = document.createElement('button');
    btn.id = 'dopp-theme-btn';
    btn.type = 'button';
    btn.addEventListener('click', function () { setDark(!active); });
    document.body.appendChild(btn);
    paintBtn();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  // Late-loading styles/content: one more sweep after everything loads.
  window.addEventListener('load', function () { if (active) processTree(document.body); });

  // Keep other open tabs in sync.
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY || !lightPage) return;
    if (e.newValue === 'dark') turnOn(); else turnOff();
    paintBtn();
  });

  window.DoppTheme = { set: setDark, isDark: function () { return active; } };
})();

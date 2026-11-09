// local-guard.js — LOCAL PREVIEW ONLY (dopps-class-next). Loaded first on every classic page.
// On localhost the copied classic pages must never write to the live Supabase project, so any
// fetch or realtime socket to *.supabase.co is refused here. On doppsclass.com this does nothing.
(function () {
  if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;
  var blocked = function (u) { try { return /\.supabase\.co$/i.test(new URL(String(u && u.url || u), location.href).hostname); } catch (e) { return false; } };
  var realFetch = window.fetch;
  window.fetch = function (input, init) {
    if (blocked(input)) { console.warn('[local-guard] blocked live Supabase call:', String(input && input.url || input)); return Promise.reject(new TypeError('local preview: live database disabled')); }
    return realFetch.apply(this, arguments);
  };
  var RealWS = window.WebSocket;
  window.WebSocket = function (url, p) {
    if (blocked(String(url).replace(/^ws/, 'http'))) { console.warn('[local-guard] blocked live realtime socket'); throw new Error('local preview: live realtime disabled'); }
    return p === undefined ? new RealWS(url) : new RealWS(url, p);
  };
  window.WebSocket.prototype = RealWS.prototype;
  ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(function (k) { window.WebSocket[k] = RealWS[k]; });
  var realBeacon = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
  if (realBeacon) navigator.sendBeacon = function (u, d) { return blocked(u) ? false : realBeacon(u, d); };
  window.DOPP_LOCAL_GUARD = true;
})();

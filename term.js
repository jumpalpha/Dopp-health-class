// term.js — which trimester the site is in right now.
// The teacher switches trimesters from the Teacher Dashboard ("Start new trimester"); that
// updates the database, and every page picks it up here. Pages read window.TERM.id
// (e.g. "2026-T1") instead of typing the trimester themselves.
(function () {
  var URL = 'https://gmeyamrlqfrabtslsweu.supabase.co', KEY = 'sb_publishable_zClDCZZQEfC9DILpesPiHg_IcyRqW-c';
  var FALLBACK = { id: '2026-T1', label: 'Trimester 1 · 2026–27', prefix: '2627T1' };
  var cached = null;
  try { cached = JSON.parse(localStorage.getItem('dopp_term') || 'null'); } catch (e) {}
  var T = cached && cached.id ? cached : FALLBACK;
  window.TERM = { id: T.id, label: T.label || T.id, prefix: T.prefix || '' };
  window.TERM.periodCodes = function (n) { var o = []; for (var i = 1; i <= (n || 6); i++) o.push(window.TERM.prefix + 'P' + i); return o; };

  // Check the live setting in the background. If the trimester changed since this
  // browser last looked, save it and reload once so the whole page uses the new one.
  if (location.protocol === 'file:') return;
  fetch(URL + '/rest/v1/rpc/current_term', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: '{}' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (t) {
      if (!t || !t.id) return;
      try { localStorage.setItem('dopp_term', JSON.stringify({ id: t.id, label: t.label, prefix: t.prefix })); } catch (e) {}
      if (t.id !== window.TERM.id) {
        var k = 'dopp_term_reloaded_' + t.id, done = false;
        try { done = sessionStorage.getItem(k); sessionStorage.setItem(k, '1'); } catch (e) { done = true; }
        if (!done) location.reload();
      }
    })
    .catch(function () {});
})();

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

  // ── Remember me (one-to-one devices) ──
  // After a PIN login, quest.html saves the student's id + PIN hash here until the trimester ends,
  // so every page in every tab knows who they are without asking for the PIN again.
  // Restoring this NEVER counts as a streak login — only a PIN or the "Yes, I'm …" button does.
  var REM = 'dopp_remember';
  var TERM_END = { '2026-T1': '2026-11-20', '2026-T2': '2027-03-05', '2026-T3': '2027-06-03' };
  function remExpiry(tri) {
    var end = TERM_END[tri];
    return end ? Date.parse(end + 'T23:59:59-07:00') : Date.now() + 120 * 86400000;
  }
  window.DoppRemember = {
    get: function () {
      try {
        var r = JSON.parse(localStorage.getItem(REM) || 'null');
        if (!r || !r.sid || !r.pin) return null;
        if (r.tri !== window.TERM.id || Date.now() > r.exp) { localStorage.removeItem(REM); return null; }
        return r;
      } catch (e) { return null; }
    },
    save: function (sid, pin, name, avatar) {
      try {
        localStorage.setItem(REM, JSON.stringify({ sid: sid, pin: pin, name: name || '', avatar: avatar || '', tri: window.TERM.id, exp: remExpiry(window.TERM.id) }));
      } catch (e) {}
    },
    clear: function () {   // "Not you? Switch student" and Log out
      try {
        localStorage.removeItem(REM);
        localStorage.removeItem('qSID_' + window.TERM.id);
        sessionStorage.removeItem('qPIN_' + window.TERM.id);
        sessionStorage.removeItem('dopp_welcomed');
      } catch (e) {}
    },
    expires: function () { return remExpiry(window.TERM.id); }
  };
  (function restore() {
    var r = window.DoppRemember.get();
    if (!r) return;
    try {
      if (!localStorage.getItem('qSID_' + r.tri)) localStorage.setItem('qSID_' + r.tri, r.sid);
      if (localStorage.getItem('qSID_' + r.tri) === r.sid && !sessionStorage.getItem('qPIN_' + r.tri)) sessionStorage.setItem('qPIN_' + r.tri, r.pin);
    } catch (e) {}
  })();

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

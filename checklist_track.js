/*
 * checklist_track.js — quietly records real learning evidence for the trimester checklist.
 * Students see nothing from this file. It never awards XP.
 *
 *  • Chapter reader (chapterNN.html): a lesson section counts as READ only when
 *      - the student scrolled to the end of that section, AND
 *      - the section was on screen for enough ACTIVE time (tab visible + focused + the student
 *        scrolled/tapped/typed in the last 45 seconds) — about half the time a fast reader needs.
 *    Opening the page, clicking the PDF, or leaving the tab idle does not count.
 *  • Vocab games: vocab_engine.html calls ChecklistTrack.vocab(...) when a round really ends.
 *    The server only accepts it if 80%+ of the terms were actually answered (not skipped / revealed
 *    / timed out) at a human pace.
 *
 * Only signed-in students (Quest page login in this tab) are recorded. Any failure is silent.
 */
(function () {
  if (window.ChecklistTrack) return;
  var URL = 'https://gmeyamrlqfrabtslsweu.supabase.co', KEY = 'sb_publishable_zClDCZZQEfC9DILpesPiHg_IcyRqW-c';

  function term() {
    if (window.TERM && TERM.id) return TERM.id;
    try { var t = JSON.parse(localStorage.getItem('dopp_term') || 'null'); if (t && t.id) return t.id; } catch (e) {}
    return '2026-T1';
  }
  function session() {
    try {
      var T = term(), id = localStorage.getItem('qSID_' + T), pin = sessionStorage.getItem('qPIN_' + T);
      if (!pin) {   // remembered device (see term.js "Remember me"); chapter pages don't load term.js
        var r = JSON.parse(localStorage.getItem('dopp_remember') || 'null');
        if (r && r.tri === T && r.sid && r.pin && Date.now() < r.exp && (!id || id === r.sid)) { id = r.sid; pin = r.pin; }
      }
      return id && pin ? { id: id, pin: pin, tri: T } : null;
    } catch (e) { return null; }
  }
  function log(kind, chapter, item, meta) {
    var s = session();
    if (!s) return Promise.resolve({ ok: false, reason: 'not signed in' });
    return fetch(URL + '/rest/v1/rpc/cl_log', {
      method: 'POST', keepalive: true,
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_student_id: s.id, p_pin_hash: s.pin, p_trimester: s.tri, p_kind: kind, p_chapter: chapter, p_item: item, p_meta: meta || {} })
    }).then(function (r) { return r.json().then(function (j) { return r.ok ? j : { ok: false, reason: (j && j.message) || r.status }; }); })
      .catch(function () { return { ok: false, reason: 'offline' }; });
  }

  // ---------- reader ----------
  var READ = { MIN_SEC: 12, MAX_SEC: 120, WORDS_PER_SEC: 8, IDLE_MS: 45000 };   // 8 words/s ≈ half the time of a 240 wpm reader
  function needSeconds(words) { return Math.max(READ.MIN_SEC, Math.min(READ.MAX_SEC, Math.round(words / READ.WORDS_PER_SEC))); }

  function startReader() {
    var m = location.pathname.match(/chapter(\d{2})\.html$/i);
    if (!m) return;
    var chapter = parseInt(m[1], 10);
    var secs = Array.prototype.filter.call(document.querySelectorAll('.reader-scroll .reader-section'),
      function (el) { return !el.classList.contains('vocab-section'); });
    if (!secs.length || !('IntersectionObserver' in window)) return;

    var lastInput = 0;
    var bump = function () { lastInput = Date.now(); };
    ['scroll', 'wheel', 'touchstart', 'touchmove', 'keydown', 'pointerdown', 'pointermove'].forEach(function (ev) {
      document.addEventListener(ev, bump, { capture: true, passive: true });
    });

    var state = secs.map(function (el, i) {
      var words = (el.textContent || '').trim().split(/\s+/).length;
      var end = document.createElement('div');                       // invisible marker at the end of the section
      end.setAttribute('aria-hidden', 'true'); end.style.cssText = 'height:1px;width:1px;';
      el.appendChild(end);
      var doneKey = 'cl_read_' + term() + '_' + chapter + '_' + (i + 1);
      var done = false; try { done = sessionStorage.getItem(doneKey) === '1'; } catch (e) {}
      return { el: el, end: end, item: 's' + (i + 1), need: needSeconds(words), active: 0, seenEnd: false, onScreen: false, done: done, sending: false, key: doneKey };
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        state.forEach(function (s) {
          if (en.target === s.end && en.isIntersecting) s.seenEnd = true;
          if (en.target === s.el) {
            var vh = window.innerHeight || 700, h = en.intersectionRect.height;
            s.onScreen = en.isIntersecting && (h >= Math.min(en.boundingClientRect.height * 0.35, vh * 0.35));
          }
        });
      });
    }, { threshold: [0, 0.1, 0.2, 0.35, 0.5, 0.75, 1] });
    state.forEach(function (s) { io.observe(s.el); io.observe(s.end); });

    setInterval(function () {
      if (document.visibilityState !== 'visible') return;
      if (document.hasFocus && !document.hasFocus()) return;
      if (Date.now() - lastInput > READ.IDLE_MS) return;
      state.forEach(function (s) {
        if (s.done) return;
        if (s.onScreen) s.active++;
        if (s.seenEnd && s.active >= s.need && !s.sending && session()) {
          s.sending = true;
          log('read', chapter, s.item, { sec: s.active, of: state.length }).then(function (r) {
            s.sending = false;
            if (r && r.ok) { s.done = true; try { sessionStorage.setItem(s.key, '1'); } catch (e) {} }
          });
        }
      });
    }, 1000);
  }

  window.ChecklistTrack = {
    // vocab_engine.html: called once per finished round
    vocab: function (chapter, mode, stats) { return log('vocab', chapter, mode, stats); },
    signedIn: function () { return !!session(); },
    _needSeconds: needSeconds
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startReader); else startReader();
})();

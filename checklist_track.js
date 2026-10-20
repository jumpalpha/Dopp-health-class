/*
 * checklist_track.js — quietly records real learning evidence for the trimester checklist.
 * Students see nothing from this file. It never awards XP.
 *
 *  • Chapter reader (chapterNN.html): a lesson section counts as READ when
 *      - the student scrolled to the end of that section, AND
 *      - the section was on screen for at least 15 seconds while the tab was open.
 *    A short "how to check this off" note is shown above the reader.
 *    Opening the page or clicking the PDF alone does not count.
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
  var READ = { MIN_SEC: 15 };   // server (cl_log) requires 10+; site requires 15
  function needSeconds() { return READ.MIN_SEC; }

  function showHowTo(scroller) {
    if (document.getElementById('cl-read-howto')) return;
    var box = document.createElement('div');
    box.id = 'cl-read-howto';
    box.style.cssText = 'margin:0 0 12px;padding:10px 14px;border-radius:10px;background:rgba(255,215,0,0.14);' +
      'border:1px solid rgba(255,215,0,0.55);font:600 14px/1.45 Nunito,sans-serif;color:inherit;';
    box.innerHTML = '<b>📖 To check off this chapter\'s reading:</b> be signed in on the Quest page, then scroll to the ' +
      '<b>end of each lesson</b> and keep it on screen at least <b>15 seconds</b>.' +
      (session() ? '' : ' <b style="color:#c0392b">You are not signed in, so this reading will not be recorded.</b>') +
      '<br><b>Reading is how we learn. So read it!</b>' +
      '<div id="cl-read-status" style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;align-items:center"></div>';
    scroller.parentNode.insertBefore(box, scroller);
  }

  // lessons already recorded on the server for this chapter (works once the checklist is released)
  function fetchDone(chapter) {
    var s = session();
    if (!s) return Promise.resolve([]);
    return fetch(URL + '/rest/v1/rpc/cl_student', {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_student_id: s.id, p_pin_hash: s.pin, p_trimester: s.tri })
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var reads = (j && j.evidence && j.evidence.reads) || [];
      return reads.filter(function (x) { return x.c === chapter; }).map(function (x) { return x.i; });
    }).catch(function () { return []; });
  }

  var PILL = 'display:inline-block;padding:3px 10px;border-radius:999px;font:800 12.5px/1.4 Nunito,sans-serif;';
  function pillFor(s, n) {
    if (s.done) return { css: 'background:#00b37e;color:#fff;', text: '✓ Lesson ' + n + ' read' };
    var left = Math.max(0, s.need - s.active);
    if (left > 0 && s.active > 0) return { css: 'background:#38BFFF;color:#06263a;', text: '⏳ Lesson ' + n + ': ' + left + 's' };
    if (left === 0 && !s.seenEnd) return { css: 'background:#FFD700;color:#3a2c00;', text: '↓ Lesson ' + n + ': scroll to the end' };
    if (left === 0) return { css: 'background:#38BFFF;color:#06263a;', text: '⏳ Lesson ' + n + ': saving…' };
    return { css: 'background:rgba(28,26,46,0.08);color:inherit;border:1px solid rgba(28,26,46,0.2);', text: '○ Lesson ' + n + ' not read' };
  }

  function startReader() {
    var m = location.pathname.match(/chapter(\d{2})\.html$/i);
    if (!m) return;
    var chapter = parseInt(m[1], 10);
    var secs = Array.prototype.filter.call(document.querySelectorAll('.reader-scroll .reader-section'),
      function (el) { return !el.classList.contains('vocab-section'); });
    if (!secs.length || !('IntersectionObserver' in window)) return;
    try { showHowTo(document.querySelector('.reader-scroll')); } catch (e) {}

    var state = secs.map(function (el, i) {
      var end = document.createElement('div');                       // invisible marker at the end of the section
      end.setAttribute('aria-hidden', 'true'); end.style.cssText = 'height:1px;width:1px;';
      el.appendChild(end);
      var doneKey = 'cl_read_' + term() + '_' + chapter + '_' + (i + 1);
      var done = false; try { done = sessionStorage.getItem(doneKey) === '1'; } catch (e) {}
      var badge = document.createElement('div');                     // status pill at the top of each lesson
      badge.className = 'cl-lesson-badge'; badge.style.cssText = 'margin:0 0 8px;';
      el.insertBefore(badge, el.firstChild);
      return { el: el, end: end, badge: badge, item: 's' + (i + 1), need: needSeconds(), active: 0, seenEnd: false, onScreen: false, done: done, sending: false, key: doneKey };
    });

    var statusRow = document.getElementById('cl-read-status');
    function paint() {
      if (!session()) return;                                           // not signed in: nothing is recorded, so no badges
      var n = 0;
      state.forEach(function (s, i) {
        var p = pillFor(s, i + 1), html = '<span style="' + PILL + p.css + '">' + p.text + '</span>';
        if (s.badge.innerHTML !== html) s.badge.innerHTML = html;
        if (s.done) n++;
      });
      if (statusRow) {
        var row = '<b>Lessons read: ' + n + ' of ' + state.length + '</b> ' + state.map(function (s, i) {
          return '<span title="Lesson ' + (i + 1) + '" style="' + PILL + (s.done ? 'background:#00b37e;color:#fff;' : 'background:rgba(28,26,46,0.08);color:inherit;') + '">' +
            (s.done ? '✓ ' : '○ ') + (i + 1) + '</span>';
        }).join('');
        if (statusRow.innerHTML !== row) statusRow.innerHTML = row;
      }
    }
    paint();
    fetchDone(chapter).then(function (items) {
      state.forEach(function (s) { if (items.indexOf(s.item) >= 0) { s.done = true; try { sessionStorage.setItem(s.key, '1'); } catch (e) {} } });
      paint();
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        state.forEach(function (s) {
          if (en.target === s.end && en.isIntersecting) s.seenEnd = true;
          if (en.target === s.el) s.onScreen = en.isIntersecting;
        });
      });
    }, { threshold: [0, 0.1, 0.2, 0.35, 0.5, 0.75, 1] });
    state.forEach(function (s) { io.observe(s.el); io.observe(s.end); });

    setInterval(function () {
      if (document.visibilityState !== 'visible') return;
      state.forEach(function (s) {
        if (s.done) return;
        if (s.onScreen) s.active++;
        if (s.seenEnd && s.active >= s.need && !s.sending && session()) {
          s.sending = true;
          log('read', chapter, s.item, { sec: s.active, of: state.length }).then(function (r) {
            s.sending = false;
            if (r && r.ok) { s.done = true; try { sessionStorage.setItem(s.key, '1'); } catch (e) {} }
            paint();
          });
        }
      });
      paint();
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

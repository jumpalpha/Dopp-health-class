/*
 * quick_checks.js — Quick Checks in the chapter reader + the student's Review Deck.
 *
 * Needs quick_checks_data.js (window.QC_BANK). Uses student-save.js when it is loaded,
 * so answers follow a signed-in student to any device; otherwise they stay on this device.
 *
 * On chapterNN.html:
 *   • After each lesson in the reader, 2 multiple-choice questions appear.
 *   • Lessons are never locked. If a student scrolls past an unanswered Quick Check, a friendly
 *     reminder shows above the next lesson. A wrong answer shows the right one and why.
 *   • Any question missed on the first try goes into the student's Review Deck.
 *
 * Everywhere (review.html, pet.html, welcome.html, chapter sidebar):
 *   QuickChecks.ready            Promise, resolves once saved answers are loaded
 *   QuickChecks.deck()           missed questions still to review: [{ id, c, l, q, a, opts, why }]
 *   QuickChecks.review(id, ok)   record a review answer (2 right answers in a row clears it)
 *   QuickChecks.lessonsDone(c)   how many lessons of chapter c have their checks answered
 *   QuickChecks.lessonCount(c)   lessons in chapter c that have checks
 *   QuickChecks.question(id)     one question by id
 *   QuickChecks.onChange(fn)     called after anything is saved
 *
 * Quick Checks never award XP and never block the reading tracker; they are practice.
 */
(function () {
  if (window.QuickChecks) return;
  var BANK = window.QC_BANK || {};
  var KEY = 'quick_checks';
  var LOCAL = 'dopp_qc_local';          // fallback copy when student-save.js isn't on the page
  var CLEAR_AFTER = 2;                  // right answers in a row that take a card out of the deck
  var state = { a: {}, d: {} };         // a: id -> [rightFirstTry 0/1, time]   d: id -> right streak since missed
  var listeners = [];

  function id(c, i) { return c + ':' + i; }
  function parse(qid) { var p = String(qid).split(':'); return { c: +p[0], i: +p[1] }; }
  function row(qid) { var p = parse(qid), r = BANK[p.c] && BANK[p.c][p.i]; return r || null; }
  function question(qid) {
    var r = row(qid); if (!r) return null; var p = parse(qid);
    return { id: qid, c: p.c, l: r[0], q: r[1], a: r[2], opts: [r[2], r[3], r[4], r[5]], why: r[6] };
  }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // ---------- load / save ----------
  function merge(x) {
    if (!x || typeof x !== 'object') return;
    var a = x.a || {}, d = x.d || {};
    Object.keys(a).forEach(function (k) { if (!state.a[k]) state.a[k] = a[k]; });
    Object.keys(d).forEach(function (k) {
      // a card that is cleared in one copy but still in the other stays out only if both agree it was answered
      if (!(k in state.d)) state.d[k] = d[k]; else state.d[k] = Math.max(state.d[k], d[k]);
    });
    Object.keys(state.d).forEach(function (k) { if (state.d[k] >= CLEAR_AFTER) delete state.d[k]; });
  }
  function readLocal() { try { return JSON.parse(localStorage.getItem(LOCAL) || 'null'); } catch (e) { return null; } }
  function writeLocal() { try { localStorage.setItem(LOCAL, JSON.stringify(state)); } catch (e) {} }

  merge(readLocal());
  var ready = (window.StudentSave ? StudentSave.load(KEY).then(function (r) { merge(r && r.data); }).catch(function () {}) : Promise.resolve())
    .then(function () { writeLocal(); return api; });

  var saveTimer = null;
  function save() {
    writeLocal();
    listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
    if (!window.StudentSave) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { StudentSave.save(KEY, state).catch(function () {}); }, 400);
  }

  function answer(qid, ok) {
    if (!state.a[qid]) {
      state.a[qid] = [ok ? 1 : 0, Date.now()];
      if (!ok) state.d[qid] = 0;
    }
    save();
  }
  function review(qid, ok) {
    if (!(qid in state.d)) return;
    state.d[qid] = ok ? state.d[qid] + 1 : 0;
    if (state.d[qid] >= CLEAR_AFTER) delete state.d[qid];
    save();
  }
  function deck() { return Object.keys(state.d).map(question).filter(Boolean); }
  function lessonCount(c) { var s = {}; (BANK[c] || []).forEach(function (r) { s[r[0]] = 1; }); return Object.keys(s).length; }
  function lessonAnswered(c, l) {
    var rows = BANK[c] || [], any = false;
    for (var i = 0; i < rows.length; i++) if (rows[i][0] === l) { any = true; if (!state.a[id(c, i)]) return false; }
    return any;
  }
  function lessonsDone(c) { var n = 0, L = lessonCount(c); for (var l = 1; l <= L; l++) if (lessonAnswered(c, l)) n++; return n; }

  var api = {
    ready: ready, deck: deck, review: review, question: question, lessonsDone: lessonsDone, lessonCount: lessonCount,
    lessonAnswered: lessonAnswered, shuffle: shuffle,
    onChange: function (fn) { listeners.push(fn); },
    _state: state
  };
  window.QuickChecks = api;

  // ---------- chapter reader UI ----------
  var CSS = '' +
    '.qc{margin:18px 0 6px;padding:14px 14px 12px;border-radius:14px;background:rgba(56,191,255,.07);border:1.5px solid rgba(56,191,255,.35)}' +
    '.qc-h{display:flex;justify-content:space-between;gap:8px;align-items:baseline;flex-wrap:wrap;margin-bottom:8px}' +
    '.qc-h b{font:800 15px Nunito,sans-serif;color:#0a5f8f}.qc-h small{font-size:12px;color:rgba(28,26,46,.62);font-weight:700}' +
    '.qc-q{margin:10px 0 0}.qc-q p{font-weight:800;font-size:15px;line-height:1.4;margin:0 0 8px}' +
    '.qc-opts{display:grid;gap:7px}' +
    '.qc-opt{text-align:left;font:700 14.5px/1.35 Nunito,sans-serif;padding:10px 12px;border-radius:10px;border:2px solid rgba(28,26,46,.14);background:#fff;color:#1C1A2E;cursor:pointer;min-height:44px}' +
    '.qc-opt:hover:not([disabled]){border-color:#38BFFF;background:#eef9ff}' +
    '.qc-opt[disabled]{cursor:default}.qc-opt.right{border-color:#00b37e;background:#e3f8ef}.qc-opt.wrong{border-color:#e0365a;background:#fde8ec}' +
    '.qc-fb{font-size:13.5px;line-height:1.45;margin-top:7px;font-weight:700}.qc-fb.ok{color:#00704D}.qc-fb.no{color:#b3123a}' +
    '.qc-done{font-size:13px;font-weight:800;color:#00704D;margin-top:8px}' +
    '.qc-nudge{margin:4px 0 14px;padding:9px 12px;border-radius:10px;background:#fff8e1;border-left:4px solid #FFD700;font:700 13.5px/1.45 Nunito,sans-serif;color:#5a4300}' +
    '.qc-nudge a{color:#7a4b00}';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function startReader() {
    var m = location.pathname.match(/chapter(\d{2})\.html$/i);
    if (!m) return;
    var c = parseInt(m[1], 10), rows = BANK[c];
    if (!rows) return;
    var secs = Array.prototype.filter.call(document.querySelectorAll('.reader-scroll .reader-section'),
      function (el) { return !el.classList.contains('vocab-section'); });
    if (!secs.length) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

    var lessons = secs.map(function (el, k) {
      var L = k + 1, qs = [];
      rows.forEach(function (r, i) { if (r[0] === L) qs.push(i); });
      return { el: el, L: L, qs: qs, box: null, lock: null };
    });

    function feedback(q, a, picked) {
      var ok = picked ? picked === q.a : a[0] === 1;
      return ok ? '<div class="qc-fb ok">✓ Right! ' + esc(q.why) + '</div>'
        : '<div class="qc-fb no">❌ The answer is “' + esc(q.a) + '.” ' + esc(q.why) +
          (picked ? ' <i>It\'s now in your <a href="review.html">Review Deck</a> for practice.</i>' : '') + '</div>';
    }
    function lessonTitle(x) { var h = x.el.querySelector('h3'); return h ? h.textContent.trim() : 'Lesson ' + x.L; }

    function drawBox(x) {
      if (!x.qs.length) return;
      var answered = lessonAnswered(c, x.L);
      if (!x.box) { x.box = document.createElement('div'); x.box.className = 'qc'; x.el.appendChild(x.box); }
      var next = lessons[x.L];   // next lesson, if any
      var h = '<div class="qc-h"><b>✅ Quick Check · Lesson ' + x.L + '</b><small>' +
        (answered ? 'Done' : '2 questions · about 30 seconds') + '</small></div>';
      x.qs.forEach(function (i, n) {
        var qid = id(c, i), q = question(qid), a = state.a[qid];
        x.order = x.order || {};
        var opts = x.order[qid] || (x.order[qid] = shuffle(q.opts));
        h += '<div class="qc-q" data-qid="' + qid + '"><p>' + (n + 1) + '. ' + esc(q.q) + '</p><div class="qc-opts">' +
          opts.map(function (o) {
            var cls = '';
            if (a) { if (o === q.a) cls = ' right'; else if (x.picked && x.picked[qid] === o) cls = ' wrong'; }
            return '<button type="button" class="qc-opt' + cls + '" data-o="' + esc(o) + '"' + (a ? ' disabled' : '') + '>' + esc(o) + '</button>';
          }).join('') + '</div>' +
          (a ? feedback(q, a, x.picked && x.picked[qid]) : '') +
          '</div>';
      });
      if (answered) h += '<div class="qc-done">✓ Quick Check done' + (next ? ' — keep reading below.' : '. Nice work!') + '</div>';
      x.box.innerHTML = h;
    }

    function applyLocks() {
      // No locks: every lesson stays open. A gentle reminder sits above any lesson whose
      // previous lesson's Quick Check hasn't been answered yet.
      lessons.forEach(drawBox);
      lessons.forEach(function (x, k) {
        var next = lessons[k + 1]; if (!next) return;
        var need = x.qs.length && !lessonAnswered(c, x.L);
        if (need && !x.nudge) {
          x.nudge = document.createElement('div'); x.nudge.className = 'qc-nudge';
          next.el.parentNode.insertBefore(x.nudge, next.el);
        }
        if (need) x.nudge.innerHTML = '💡 Don\'t skip the <a href="#lesson-' + x.L + '-qc">Lesson ' + x.L + ' Quick Check</a> above — 2 questions, about 30 seconds.';
        else if (x.nudge) { x.nudge.remove(); x.nudge = null; }
      });
    }

    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.qc-opt');
      if (b && !b.disabled) {
        var wrap = b.closest('.qc-q'), qid = wrap.getAttribute('data-qid'), q = question(qid), o = b.getAttribute('data-o');
        var x = lessons.filter(function (y) { return y.box && y.box.contains(b); })[0];
        if (!x) return;
        x.picked = x.picked || {}; x.picked[qid] = o;
        answer(qid, o === q.a);
        applyLocks();
        return;
      }
      var nl = e.target.closest && e.target.closest('.qc-nudge a');
      if (nl) {
        e.preventDefault();
        var L = +nl.getAttribute('href').match(/lesson-(\d+)/)[1], bx = lessons[L - 1] && lessons[L - 1].box;
        if (bx) { try { bx.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (er) { bx.scrollIntoView(); } }
      }
    });

    applyLocks();
    ready.then(applyLocks);   // saved answers from another device may open more lessons

    // ── "Continue where you left off": remember the lesson the student is reading ──
    lessons.forEach(function (x) { if (!x.el.id) x.el.id = 'lesson-' + x.L; });
    function remember(L) {
      try {
        var last = JSON.parse(localStorage.getItem('lw_last_chapter') || 'null') || {};
        last.n = c; last.url = 'chapter' + m[1] + '.html'; last.lesson = L; last.lessons = lessons.length;
        var t = lessons[L - 1] && lessons[L - 1].el.querySelector('h3');
        last.lessonTitle = t ? t.textContent.trim() : ''; last.ts = Date.now();
        localStorage.setItem('lw_last_chapter', JSON.stringify(last));
      } catch (e) {}
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          var x = lessons.filter(function (y) { return y.el === en.target; })[0];
          if (x) remember(x.L);
        });
      }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });   // the lesson crossing the middle of the screen
      lessons.forEach(function (x) { io.observe(x.el); });
    }
    // chapterNN.html#lesson-3 opens the reader at that lesson (or at the lock in front of it)
    function jump() {
      var h = location.hash.match(/^#lesson-(\d+)$/);
      if (!h) return;
      var x = lessons[+h[1] - 1]; if (!x) return;
      var target = x.el;
      var sc = document.querySelector('.reader-scroll');
      setTimeout(function () {
        try { document.querySelector('.reader-shell').scrollIntoView({ block: 'start' }); } catch (e) {}
        if (sc && sc.scrollHeight > sc.clientHeight + 4) sc.scrollTop += target.getBoundingClientRect().top - sc.getBoundingClientRect().top - 8;
        else try { target.scrollIntoView({ block: 'start' }); } catch (e) {}
      }, 150);
    }
    ready.then(jump);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startReader); else startReader();
})();

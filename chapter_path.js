/*
 * chapter_path.js — the "Your Chapter Path" card in the sidebar of every chapterNN.html.
 *
 * Every step checks ITSELF off. Nothing here is self-reported and nothing needs the teacher:
 *   1. Read every lesson in the reader     (checklist_track.js: end of lesson + 15 s on screen, signed in)
 *   2. Answer every lesson's Quick Check     (quick_checks.js)
 *   3. Play the 4 vocab games, 70%+ correct  (vocab_engine.html → checklist_track.js)
 *   4. Pass the Chapter Mastery check, 8/10  (mastery.html, server-verified)
 *
 * Where the facts come from, best first:
 *   • the trimester checklist on the server (cl_student) — once the teacher opens it, or for TEST accounts
 *   • this device's copy of what the server accepted (localStorage dopp_ch_progress_<term>)
 *   • mastery_status (always available once signed in)
 * The realm badge card above it shows progress across all of the realm's chapters.
 */
(function () {
  var URL = 'https://gmeyamrlqfrabtslsweu.supabase.co', KEY = 'sb_publishable_zClDCZZQEfC9DILpesPiHg_IcyRqW-c';
  var REALMS = [[1, 2], [3, 4, 5], [6, 7, 8, 9], [10, 11, 12], [13, 14, 15, 16], [17, 18], [19, 20, 21, 22], [23, 24, 25], [26, 27, 28]];
  var LESSONS = { 3: 3, 7: 3, 8: 3 };
  var MODES = [['flashcard', 'Flashcards', ''], ['speedquiz', 'Speed Quiz', '#speedquiz'], ['wordbuild', 'Word Builder', '#wordbuild'], ['conceptmap', 'Concept Map', '#conceptmap']];
  var lessonsIn = function (c) { return LESSONS[c] || 4; };

  function term() {
    if (window.TERM && TERM.id) return TERM.id;
    try { var t = JSON.parse(localStorage.getItem('dopp_term') || 'null'); if (t && t.id) return t.id; } catch (e) {}
    return '2026-T1';
  }
  function session() {
    try {
      var T = term(), id = localStorage.getItem('qSID_' + T), pin = sessionStorage.getItem('qPIN_' + T);
      if (!pin) {
        var r = JSON.parse(localStorage.getItem('dopp_remember') || 'null');
        if (r && r.tri === T && r.sid && r.pin && Date.now() < r.exp && (!id || id === r.sid)) { id = r.sid; pin = r.pin; }
      }
      return id && pin ? { id: id, pin: pin, tri: T } : null;
    } catch (e) { return null; }
  }
  function rpc(name, s) {
    return fetch(URL + '/rest/v1/rpc/' + name, {
      method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_student_id: s.id, p_pin_hash: s.pin, p_trimester: s.tri })
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function local() { try { return JSON.parse(localStorage.getItem('dopp_ch_progress_' + term()) || '{}'); } catch (e) { return {}; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var m = location.pathname.match(/chapter(\d{2})\.html$/i);
  if (!m) return;
  var CH = parseInt(m[1], 10), PAD = m[1];
  var realm = REALMS.filter(function (r) { return r.indexOf(CH) >= 0; })[0] || [CH];

  // facts, filled in as they arrive
  var F = { reads: {}, vocab: {}, mastery: {}, server: false, signedIn: !!session() };

  function addLocal() {
    var p = local();
    Object.keys(p.read || {}).forEach(function (c) { F.reads[c] = F.reads[c] || {}; Object.keys(p.read[c]).forEach(function (i) { F.reads[c][i] = 1; }); });
    Object.keys(p.vocab || {}).forEach(function (c) { F.vocab[c] = F.vocab[c] || {}; Object.keys(p.vocab[c]).forEach(function (k) { F.vocab[c][k] = Math.max(F.vocab[c][k] || 0, +p.vocab[c][k] || 70); }); });
    try {   // lessons read in this tab (checklist_track marks them as soon as the server accepts)
      for (var i = 1; i <= lessonsIn(CH); i++) if (sessionStorage.getItem('cl_read_' + term() + '_' + CH + '_' + i) === '1') { F.reads[CH] = F.reads[CH] || {}; F.reads[CH]['s' + i] = 1; }
    } catch (e) {}
    try { var mc = JSON.parse(localStorage.getItem('dopp_mastery_cache_' + term()) || 'null'); if (mc) F.mastery = mc; } catch (e) {}
  }

  function steps(c) {
    var nL = lessonsIn(c), r = Object.keys(F.reads[c] || {}).length;
    var QC = window.QuickChecks, qn = QC ? QC.lessonCount(c) : 0, qd = QC ? QC.lessonsDone(c) : 0;
    var v = F.vocab[c] || {}, vd = MODES.filter(function (x) { return v[x[0]]; }).length;
    var ms = F.mastery[c] || {};
    return [
      { key: 'read', done: r >= nL, n: Math.min(r, nL), of: nL },
      { key: 'qc', done: qn > 0 && qd >= qn, n: qd, of: qn },
      { key: 'vocab', done: vd >= 4, n: vd, of: 4, v: v },
      { key: 'mastery', done: !!ms.passed, ms: ms }
    ];
  }

  function stepHTML(s) {
    var ic = s.done ? '✓' : (s.n ? '◐' : '○');
    var cls = s.done ? 'cp-done' : s.n ? 'cp-part' : '';
    var title = '', sub = '', act = '';
    if (s.key === 'read') {
      title = 'Read every lesson in the reader';
      sub = s.done ? 'All ' + s.of + ' lessons read' : s.n + ' of ' + s.of + ' lessons read · scroll to the end of each, 15+ seconds';
      act = '<a href="#cl-read-howto" data-cp-jump>Go to the reader ↓</a>';
    } else if (s.key === 'qc') {
      title = 'Answer each lesson\'s Quick Check';
      sub = s.done ? 'All ' + s.of + ' Quick Checks answered' : s.n + ' of ' + s.of + ' answered · they appear at the end of each lesson';
      var dk = window.QuickChecks ? QuickChecks.deck().filter(function (q) { return q.c === CH; }).length : 0;
      if (dk) act = '<a href="review.html?ch=' + CH + '">Review ' + dk + ' missed question' + (dk === 1 ? '' : 's') + ' →</a>';
    } else if (s.key === 'vocab') {
      title = 'Play all 4 vocab games (70%+)';
      sub = s.n + ' of 4 done';
      act = MODES.map(function (x) {
        var d = s.v[x[0]];
        return '<a class="cp-chip' + (d ? ' on' : '') + '" href="vocab_engine.html?ch=' + CH + x[2] + '">' + (d ? '✓ ' : '') + x[1] + '</a>';
      }).join('');
    } else if (s.key === 'mastery') {
      title = 'Pass the Chapter Mastery check';
      var ms = s.ms || {};
      sub = s.done ? 'Passed · +50 Verified XP earned' : ms.attempts ? 'Best ' + (ms.best || 0) + '/10 · need 8 · ' + ms.attempts + ' tr' + (ms.attempts === 1 ? 'y' : 'ies') : '10 vocab questions · 8 right passes · +50 Verified XP';
      act = s.done ? '' : '<a href="mastery.html?ch=' + CH + '">Take the Mastery check →</a>';
      if (!s.done) cls += ' cp-boss';
    }
    return '<li class="cp-step ' + cls + '"><span class="cp-ic">' + ic + '</span><div><b>' + title + '</b><small>' + esc(sub) + '</small>' +
      (act ? '<div class="cp-act">' + act + '</div>' : '') + '</div></li>';
  }

  function render() {
    var el = document.getElementById('ch-path');
    if (!el) return;
    var st = steps(CH), done = st.filter(function (s) { return s.done; }).length;
    el.innerHTML = '<div class="side-title">Your Chapter ' + CH + ' Path</div>' +
      '<div class="cp-top"><b>' + done + ' of 4</b> steps done' + (done === 4 ? ' · <span class="cp-win">Chapter complete! 🏆</span>' : '') + '</div>' +
      '<div class="progress-bar"><div class="progress-fill" style="width:' + (done * 25) + '%"></div></div>' +
      (F.signedIn ? '' : '<div class="cp-warn">You\'re not signed in, so reading, vocab and Mastery can\'t be recorded. <a href="quest.html">Sign in on the Quest page</a>.</div>') +
      '<ol class="cp-steps">' + st.map(stepHTML).join('') + '</ol>' +
      '<div class="cp-note">🔒 Every step checks itself off when you do it. Nothing to turn in.</div>';

    // realm badge card: progress across every chapter in this realm
    var fill = document.getElementById('progress-fill');
    if (fill) {
      var tot = 0, got = 0;
      realm.forEach(function (c) { steps(c).forEach(function (s) { tot++; if (s.done) got++; }); });
      var pct = tot ? Math.round(got * 100 / tot) : 0;
      fill.style.width = pct + '%';
      var lbl = document.getElementById('realm-pct');
      if (lbl) lbl.textContent = pct + '% of this realm\'s chapter paths done (' + got + ' of ' + tot + ' steps)';
    }
  }

  var CSS = '' +
    '.cp-top{font-size:13px;color:var(--dim);margin:-4px 0 8px}.cp-top b{color:var(--text)}.cp-win{color:#00875f;font-weight:800}' +
    '.realm-badge-card .progress-bar,#ch-path .progress-bar{height:7px;background:rgba(28,26,46,.1);border-radius:4px;overflow:hidden;margin-top:10px}' +
    '.realm-badge-card .progress-fill,#ch-path .progress-fill{height:100%;width:0;background:linear-gradient(90deg,#38BFFF,#00c48a);border-radius:4px;transition:width .8s ease}' +
    '#ch-path .progress-bar{margin:0 0 10px}' +
    '.cp-warn{font-size:12.5px;line-height:1.45;background:#fff4c2;border:1px solid #e2b04a;color:#5a4300;border-radius:9px;padding:8px 10px;margin-bottom:10px;font-weight:700}.cp-warn a{color:#7a4b00}' +
    '.cp-steps{list-style:none;display:flex;flex-direction:column;gap:10px;margin:0;padding:0}' +
    '.cp-step{display:grid;grid-template-columns:24px 1fr;gap:10px;align-items:start}' +
    '.cp-ic{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;border:1.5px solid rgba(28,26,46,.25);color:rgba(28,26,46,.5)}' +
    '.cp-done .cp-ic{background:#00b37e;border-color:#00b37e;color:#fff}.cp-part .cp-ic{border-color:#38BFFF;color:#0a72b5}' +
    '.cp-step b{display:block;font-size:13.5px;line-height:1.3}.cp-step small{display:block;font-size:12px;color:var(--dim);line-height:1.4;margin-top:2px}' +
    '.cp-done b{color:#00704D}' +
    '.cp-act{margin-top:5px;display:flex;flex-wrap:wrap;gap:5px}.cp-act a{font-size:12.5px;font-weight:800;color:#0a72b5;text-decoration:none}' +
    '.cp-act a:hover{text-decoration:underline}' +
    '.cp-chip{display:inline-block;padding:4px 9px;border-radius:999px;border:1px solid var(--border);background:#fff;color:var(--text)!important;font-size:12px!important}' +
    '.cp-chip.on{background:#e3f8ef;border-color:#00b37e;color:#00704D!important}' +
    '.cp-boss .cp-act a{display:inline-block;background:#1C1A2E;color:#FFD700!important;padding:7px 12px;border-radius:9px}' +
    '.cp-note{font-size:11.5px;color:var(--dim);margin-top:12px}';

  function start() {
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    addLocal(); render();
    if (window.QuickChecks) { QuickChecks.ready.then(render); QuickChecks.onChange(render); }
    setInterval(function () { addLocal(); render(); }, 5000);   // picks up lessons as the reader records them
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-cp-jump]');
      if (!a) return;
      var t = document.getElementById('cl-read-howto') || document.querySelector('.reader-shell');
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
    var s = session();
    if (!s) return;
    rpc('mastery_status', s).then(function (j) {
      if (!j || !j.chapters) return;
      F.mastery = j.chapters;
      try { localStorage.setItem('dopp_mastery_cache_' + term(), JSON.stringify(j.chapters)); } catch (e) {}
      render();
    });
    rpc('cl_student', s).then(function (j) {     // only answers once the checklist is open (or for TEST accounts)
      var ev = j && j.evidence; if (!ev) return;
      F.server = true;
      (ev.reads || []).forEach(function (x) { F.reads[x.c] = F.reads[x.c] || {}; F.reads[x.c][x.i] = 1; });
      (ev.vocab || []).forEach(function (x) { F.vocab[x.c] = F.vocab[x.c] || {}; F.vocab[x.c][x.m] = (x.meta && (x.meta.best_pct || x.meta.pct)) || 70; });
      (ev.mastery || []).forEach(function (x) { F.mastery[x.c] = Object.assign({}, F.mastery[x.c] || {}, { passed: x.passed || (F.mastery[x.c] || {}).passed }); });
      render();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

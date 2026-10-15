/*
 * checklist_teacher.js — Teacher Dashboard → "Student Checklist Draft".
 * Needs (from teacher.html): db (Supabase client), teacherPass(), TRIMESTER; and checklist.js.
 * Students cannot reach any of this: it lives behind the dashboard passphrase, and every
 * database call below is checked against that passphrase on the server.
 */
(function () {
  const C = window.Checklist;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = { loaded: false, tab: 'class', cfg: null, saved: {}, roster: [], ev: {}, student: '', period: 'all', bulkItem: 'boss:r1', demoManual: {}, err: '' };
  const DEMO = '__demo__';

  async function rpc(name, args) {
    const { data, error } = await db.rpc(name, Object.assign({ p_teacher_pass: teacherPass(), p_trimester: TRIMESTER }, args || {}));
    if (error) throw error;
    return data;
  }
  const missingDb = e => /does not exist|Could not find the function|schema cache/i.test((e && (e.message || e.details)) || '');

  async function load(all) {
    $('cl-root').innerHTML = '<p class="cl-loading">Loading real student records…</p>';
    try {
      const [cfg, roster] = await Promise.all([rpc('cl_teacher_config_get'), rpc('cl_teacher_roster')]);
      S.saved = cfg || {}; S.cfg = C.config(S.saved, TRIMESTER); S.roster = roster || [];
      if (all !== false) S.ev = (await rpc('cl_teacher_evidence', { p_student: null })) || {};
      S.loaded = true; S.err = '';
    } catch (e) {
      S.err = missingDb(e) ? 'db' : (e.message || String(e));
      S.cfg = C.config({}, TRIMESTER);
    }
    draw();
  }
  async function reloadStudent(id) {
    if (!id || id === DEMO) return draw();
    try { S.ev[id] = await rpc('cl_teacher_evidence', { p_student: id }); } catch (e) { alert('Could not refresh: ' + e.message); }
    draw();
  }

  const nameOf = s => s ? (s.first + ' ' + s.last) : '';
  const period = code => { const m = /P(\d+)$/i.exec(code || ''); return m ? 'Period ' + m[1] : (code || ''); };
  const isTest = s => s && /^TEST/i.test(s.code || '');

  // ───────── demo (clearly fake) ─────────
  function demoEvidence() {
    const reads = [], vocab = [];
    for (let c = 1; c <= 6; c++) for (let i = 1; i <= C.lessonsIn(c); i++) reads.push({ c, i: 's' + i, n: 1 });
    reads.push({ c: 7, i: 's1', n: 1 });
    [[1, 'flashcard', 90], [1, 'speedquiz', 75], [1, 'wordbuild', 82], [1, 'conceptmap', 100], [2, 'flashcard', 70], [2, 'speedquiz', 88], [3, 'speedquiz', 60]]
      .forEach(([c, m, p]) => vocab.push({ c, m, n: p < 80 ? 2 : 1, meta: { pct: p, best_pct: Math.max(p, 85), first_pct: p } }));
    return {
      reads, vocab,
      mastery: [{ c: 1, passed: true, attempts: 1, fails: 0, best: 9 }, { c: 2, passed: true, attempts: 2, fails: 1, best: 8 }, { c: 3, passed: false, attempts: 1, fails: 1, best: 6 }],
      arcade: [{ g: 'sprite_flap', plays: 6, best: 31, wins: 1 }, { g: 'word_quest', plays: 3, best: 1500, wins: 1 }, { g: 'cup_pong', plays: 2, best: 800, wins: 0 },
               { g: 'sprite_snake', plays: 1, best: 0, wins: 0 }, { g: 'connect4_duel', plays: 2, best: 100, wins: 1 }],
      trail: { days: ['2026-10-13', '2026-10-14'], finished: 0, miles: 380 },
      pet: { born: '2026-09-20T15:00:00Z', alive: true, care_points: 40, streak: 3, best_streak: 5 },
      care: Array.from({ length: 7 }, (_, i) => ({ d: '2026-10-0' + (i + 2), h: 3, q: 4 })),
      live: [{ t: 'showdown', answered: 8, correct: 6 }, { t: 'showdown', answered: 10, correct: 9 }],
      xp: { verified: { mastery: 100, arcade: 30, trail: 10, live: 75 }, quest_tasks: 6, quest_days: 9 },
      quest: ['r1_2', 'r1_3'], manual: Object.assign({ 'hw:ch1': { on: true }, 'test:realm1': { on: true } }, S.demoManual),
      verify: { 'boss:r1': 'done' }, bonus: { projects: [] }
    };
  }

  // ───────── drawing ─────────
  function tabs() {
    const t = [['class', 'Class overview'], ['student', 'Student view'], ['settings', 'Settings'], ['rules', 'How completion works']];
    return `<div class="clt-tabs">${t.map(([k, l]) => `<button class="clt-tab${S.tab === k ? ' on' : ''}" data-tab="${k}">${l}</button>`).join('')}
      <button class="clt-tab" data-act="refresh" title="Reload records">↻ Refresh</button></div>`;
  }
  function draw() {
    C.injectCSS();
    let h = `<div class="clt-draft">DRAFT for Mr. Dopp's review — students cannot see or open this checklist yet. Nothing here awards XP.</div>`;
    if (S.err === 'db') {
      h += `<div class="lb-error"><b>Database not set up yet.</b> The checklist tables haven't been added to Supabase, so no real records can load.
        Run <code>supabase/student_checklist.sql</code> in Supabase → SQL Editor, then press Refresh. You can still explore the
        <b>Student view → Demo student</b> (sample data).</div>`;
    } else if (S.err) {
      h += `<div class="lb-error">Could not load: ${esc(S.err)}</div>`;
    }
    h += tabs() + `<div id="clt-body"></div>`;
    $('cl-root').innerHTML = h;
    const body = $('clt-body');
    if (S.tab === 'class') body.innerHTML = classView();
    else if (S.tab === 'student') body.innerHTML = studentView();
    else if (S.tab === 'settings') body.innerHTML = settingsView();
    else body.innerHTML = rulesView();
  }

  function rosterBy() {
    const g = {};
    S.roster.forEach(s => { const p = /^TEST/i.test(s.code) ? 'TEST accounts' : period(s.code); (g[p] = g[p] || []).push(s); });
    return g;
  }
  function periodSelect(id, withAll) {
    const ps = Object.keys(rosterBy()).sort();
    return `<select id="${id}">${withAll ? `<option value="all">All periods</option>` : ''}${ps.map(p => `<option${S.period === p ? ' selected' : ''}>${esc(p)}</option>`).join('')}</select>`;
  }

  function classView() {
    if (S.err === 'db') return '<p class="cl-detail">Class records will appear here once the database is set up.</p>';
    const g = rosterBy(), rows = [];
    Object.keys(g).sort().forEach(p => {
      if (S.period !== 'all' && S.period !== p) return;
      g[p].forEach(s => {
        const v = C.build(S.ev[s.id] || {}, S.cfg);
        rows.push(`<tr><td>${esc(nameOf(s))}</td><td>${esc(p)}</td><td><b>${v.summary.pct}%</b> <small>${v.summary.done}/${v.summary.total}</small></td>
          <td>${v.summary.tally.in_progress || 0}</td><td>${v.summary.tally.needs_teacher || 0}</td><td>${v.summary.tally.reported || 0}</td>
          <td>${v.xp.verifiedTotal}</td><td><button class="clt-btn" data-open="${s.id}">Open</button></td></tr>`);
      });
    });
    const items = [];
    C.REALMS.forEach(r => { items.push(['boss:' + r.id, 'Realm ' + r.n + ' boss battle']); r.acts.forEach(([k, n]) => items.push(['act:' + r.id + '_' + k, 'Realm ' + r.n + ': ' + n])); });
    items.push(['class:discuss', 'Class discussion activities'], ['team:germ_snipes', 'Germ Snipes']);
    C.CLASSROOM.forEach(([k, t]) => items.push(['class:' + k, 'Classroom game: ' + t]));
    let bulk = '';
    if (S.period !== 'all') {
      const list = (g[S.period] || []);
      bulk = `<div class="clt-bulk">${list.map(s => {
        const st = (S.ev[s.id] && S.ev[s.id].verify || {})[S.bulkItem];
        return `<label><input type="checkbox" data-bulk="${s.id}"${st === 'done' ? ' checked' : ''}> ${esc(nameOf(s))}${st === 'excused' ? ' <small>(excused)</small>' : ''}</label>`;
      }).join('')}</div>`;
    } else bulk = '<p class="cl-detail">Pick one period above to tick students one by one.</p>';
    return `<div class="clt-row">${periodSelect('clt-period', true)}<span class="cl-detail">Only chapters 1–16 count. Bonus work never lowers a percentage.</span></div>
      <div class="card"><div class="card-title">Confirm participation (one student at a time)</div>
        <p class="cl-detail">For things the site can't see. Ticking a box confirms that one student. Running a class game never checks anyone off by itself.</p>
        <div class="clt-row"><select id="clt-bulk-item">${items.map(([k, l]) => `<option value="${k}"${k === S.bulkItem ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>${bulk}</div>
      <div class="card" style="overflow-x:auto"><table class="clt-table"><thead><tr><th>Student</th><th>Period</th><th>Required done</th><th>In progress</th><th>Needs you</th><th>Reported</th><th>Verified XP</th><th></th></tr></thead>
      <tbody>${rows.join('') || '<tr><td colspan="8">No students yet.</td></tr>'}</tbody></table></div>`;
  }

  function studentView() {
    const g = rosterBy();
    const opts = `<option value="${DEMO}"${S.student === DEMO ? ' selected' : ''}>⚠ DEMO student — sample data, not a real record</option>` +
      Object.keys(g).sort().map(p => `<optgroup label="${esc(p)}">${g[p].map(s => `<option value="${s.id}"${S.student === s.id ? ' selected' : ''}>${esc(nameOf(s))}</option>`).join('')}</optgroup>`).join('');
    if (!S.student) S.student = DEMO;
    const demo = S.student === DEMO, stu = S.roster.find(s => s.id === S.student);
    const ev = demo ? demoEvidence() : (S.ev[S.student] || {});
    const v = C.build(ev, S.cfg);
    const banner = demo ? 'DEMO DATA — invented sample student to preview the layout. Not a real record; changes here are not saved.'
      : isTest(stu) ? 'TEST account — real database record. The Schoology/test boxes work here so you can try them.'
      : 'Real student record (read-only preview of what the student will see, plus your teacher buttons).';
    const html = C.render(v, { teacher: true, manualEnabled: demo || isTest(stu), banner, title: demo ? 'Demo Student' : nameOf(stu) + ' · ' + period(stu && stu.code) });
    return `<div class="clt-row"><select id="clt-student">${opts}</select><button class="clt-btn" data-act="print">🖨 Print summary</button>
      <button class="clt-btn" data-act="expand">Expand all</button></div><div id="cl-print">${html}</div>`;
  }

  function settingsView() {
    const c = S.cfg;
    const hw = Array.from({ length: 16 }, (_, i) => i + 1).map(n => `<label class="clt-chk"><input type="checkbox" data-hw="${n}"${c.hw[n] !== false ? ' checked' : ''}> Ch ${n}</label>`).join('');
    const tests = c.tests.map(t => (t.chapters || []).join(',')).join('; ');
    const acts = C.REALMS.map(r => `<div><b>Realm ${r.n}</b> ` + r.acts.map(([k, n]) => `<label class="clt-chk"><input type="checkbox" data-act-on="${r.id}_${k}"${c.acts[r.id + '_' + k] !== false ? ' checked' : ''}> ${esc(n)}</label>`).join('') +
      ` <label class="clt-chk"><input type="checkbox" data-boss="${r.id}"${c.boss[r.id] !== false ? ' checked' : ''}> Boss: ${esc(r.boss[1])}</label></div>`).join('');
    const offList = [...C.SOLO.map(([k, t]) => ['game:' + k, t]), ...C.PARTNER.map(([k, t]) => ['partner:' + k, t + ' (partner)']), ['team:germ_snipes', 'Germ Snipes (team)']];
    const off = offList.map(([k, t]) => `<label class="clt-chk"><input type="checkbox" data-off="${k}"${c.off.includes(k) ? ' checked' : ''}> ${esc(t)}</label>`).join('');
    const num = (k, l, min, max) => `<label class="clt-num">${l} <input type="number" min="${min}" max="${max}" data-num="${k}" value="${esc(c[k])}"></label>`;
    return `<div class="card"><div class="card-title">Trimester dates (${esc(TRIMESTER)})</div>
      <div class="clt-row"><label class="clt-num">Start <input type="date" data-date="start" value="${esc(c.start)}"></label>
      <label class="clt-num">End <input type="date" data-date="end" value="${esc(c.end)}"></label></div>
      <p class="cl-detail">Chapters 1–16 get target dates spread evenly from start to 5 days before the end (a review week). School-year defaults: T1 Sep 2–Nov 20, T2 Dec 1–Mar 5, T3 Mar 8–Jun 3.</p></div>
      <div class="card"><div class="card-title">Schoology homework — untick chapters with no separate homework</div><div class="clt-wrapchk">${hw}</div></div>
      <div class="card"><div class="card-title">Formal tests (taken outside DoppsClass)</div>
        <p class="cl-detail">One test per group, separated by semicolons. Example: <code>1,2; 3,4,5; 6,7,8,9</code> = 3 tests. A chapter in no group has no test box. Leave empty for no test boxes.</p>
        <input type="text" id="clt-tests" value="${esc(tests)}" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border)"></div>
      <div class="card"><div class="card-title">Assigned realm activities & boss battles</div>${acts}</div>
      <div class="card"><div class="card-title">Minimums</div><div class="clt-row" style="flex-wrap:wrap">
        ${num('trail_days', 'Wellness Trail play days', 1, 30)}${num('sprite_days', 'Sprite care days', 1, 80)}${num('sprite_quiz', 'Sprite chapter questions', 0, 500)}
        ${num('live_min', 'Live games', 0, 30)}${num('review_min', 'Weak-area reviews', 0, 30)}
        ${num('excuse_before', 'Excuse everything before chapter', 1, 17)}
        <label class="clt-num">Solo games required <input type="text" data-num="solo_required" value="${esc(c.solo_required)}" style="width:70px"></label>
        <label class="clt-chk"><input type="checkbox" id="clt-partner"${c.partner_required ? ' checked' : ''}> Require partner games</label></div>
        <p class="cl-detail">"Excuse everything before chapter 5" excuses reading, vocab, mastery, homework, tests and realm activities for chapters 1–4 for the whole class (1 = excuse nothing). Work students already did still shows as done.</p>
        <p class="cl-detail">Solo games: "all" or a number. Pick games below to turn off for the whole class (excused for everyone).</p></div>
      <div class="card"><div class="card-title">Turn off for the whole class</div><div class="clt-wrapchk">${off}</div></div>
      <div class="clt-row"><button class="clt-btn clt-save" data-act="save">💾 Save settings</button><span id="clt-saved" class="cl-detail"></span></div>
      <div class="card"><div class="card-title">Student release</div>
        <label class="clt-chk" style="font-size:15px"><input type="checkbox" id="clt-release"${c.released ? ' checked' : ''}> <b>Open the checklist to students</b></label>
        <p class="cl-detail">${c.released ? 'OPEN: signed-in students see a "📋 My Trimester Checklist" button on their Quest page and can tick their two Schoology/test boxes.'
          : 'CLOSED: only TEST-class accounts can open <a href="checklist.html" target="_blank">checklist.html</a> (sign in on the Quest page as a TEST student to preview it). Real students see nothing.'}
          Press Save after changing this.</p></div>`;
  }

  function rulesView() {
    const R = [
      ['Read chapter lessons (Ch 1–16)', 'Each lesson section in the chapter reader must be scrolled to its end AND on screen for enough active time (tab visible, focused, student scrolling/tapping in the last 45 s; about half a fast reader\'s time, 12–120 s). Opening the page, the PDF, or an idle tab does not count.', 'checklist_events (kind read), via checklist_track.js'],
      ['Vocab: Flashcard Flip, Speed Quiz, Word Builder, Concept Map', 'A full round reaches the results screen with 80%+ of terms really answered (flipped cards; picked answers; typed answers; placed + checked chips). Skips, reveals and timeouts do not count; ~1.2 s per answer minimum.', 'checklist_events (kind vocab)'],
      ['Chapter Mastery practice', 'A saved passing attempt (8/10). Separate from formal tests.', 'mastery_attempts (existing)'],
      ['Homework in Schoology', 'Student ticks/unticks the box. Student reported; no XP; Schoology is the record.', 'checklist_manual'],
      ['Test outside DoppsClass', 'Student ticks/unticks per test group you set. Student reported; no XP.', 'checklist_manual'],
      ['Realm activities, boss battles, discussion, Germ Snipes, classroom games', 'The site has no per-student record, so they show "Needs teacher verification" until you confirm. A Quest-page self-check is shown only as a hint.', 'checklist_verify'],
      ['Hatch sprite', 'A sprite exists for the student this trimester.', 'student_pets (existing)'],
      ['Sprite care over time', 'Distinct days with at least one healthy habit logged. Habits are self-logged in the game.', 'pet_care_days (new trigger; backfilled from current streaks)'],
      ['Feed sprite knowledge', 'Total chapter questions answered right in the Sprite page (checked on the student\'s device).', 'pet_care_days.quiz'],
      ['Wellness Trail', 'Distinct real days with miles traveled. A full journey needs 6+ days; this asks for your minimum (default 3).', 'trail_daily (existing)'],
      ['Solo arcade games', '"Played" = a finished round with a score above 0. "Won" and "+10 XP" are shown separately.', 'arcade_scores (existing)'],
      ['Partner games', 'A finished game with both players signed in.', 'arcade_scores via duel games (existing)'],
      ['Live games', 'Joined signed-in and answered at least one question.', 'live_players + live_answers (existing)'],
      ['Revisit weak areas', 'A vocab mode replayed after a first score under 80%, or a Mastery check retaken after missing it.', 'checklist_events + mastery_attempts'],
      ['XP display', 'Verified XP by source and Quest XP shown separately. Checklist status changes never award XP.', 'xp_events, quest_progress, active_days (existing)']
    ];
    return `<div class="card" style="overflow-x:auto"><table class="clt-table"><thead><tr><th>Task</th><th>What changes its status</th><th>Where the evidence is saved</th></tr></thead><tbody>` +
      R.map(r => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td><code>${esc(r[2])}</code></td></tr>`).join('') + `</tbody></table></div>
      <div class="card"><div class="card-title">Honest limits</div><ul class="clt-ul">
        <li>Reading, vocab and sprite-care history only exist from <b>Oct 15, 2026</b>. Earlier work shows "No record yet" (grey), not missing.</li>
        <li>Only students signed in on the Quest page in that browser tab get credit.</li>
        <li>Everything a browser reports can be faked by a determined student with developer tools; it is evidence, not proof. Mastery answers are checked on the server and are the strongest record.</li>
        <li>Live games don't record which chapter was used, so they count as participation only.</li>
      </ul></div>
      <div class="card"><div class="card-title">Verified XP rules (checked in the database)</div><ul class="clt-ul">${Object.values(C.XP_RULES).map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
  }

  // ───────── actions ─────────
  async function onClick(e) {
    const t = e.target.closest('button,input');
    if (!t || !$('cl-root').contains(t)) return;
    if (t.dataset.tab) { S.tab = t.dataset.tab; return draw(); }
    if (t.dataset.open) { S.student = t.dataset.open; S.tab = 'student'; return draw(); }
    const act = t.dataset.act;
    if (act === 'refresh') return load();
    if (act === 'print') { document.body.classList.add('cl-printing'); window.print(); setTimeout(() => document.body.classList.remove('cl-printing'), 500); return; }
    if (act === 'expand') { document.querySelectorAll('#cl-print details').forEach(d => { d.open = true; }); return; }
    if (act === 'save') return saveSettings();
    if (t.dataset.verify !== undefined) {
      if (S.student === DEMO) return alert('Demo student: nothing is saved. Pick a real student to confirm or excuse.');
      t.disabled = true;
      try { await rpc('cl_teacher_verify', { p_student: S.student, p_item: t.dataset.verify, p_status: t.dataset.st || null }); }
      catch (err) { alert('Could not save: ' + err.message); }
      return reloadStudent(S.student);
    }
    if (t.dataset.manual !== undefined) {
      const key = t.dataset.manual, on = t.checked;
      if (S.student === DEMO) { S.demoManual[key] = { on }; return draw(); }
      try { await rpc('cl_teacher_manual_test', { p_student: S.student, p_key: key, p_checked: on }); }
      catch (err) { alert('Could not save: ' + err.message); }
      return reloadStudent(S.student);
    }
    if (t.dataset.bulk) {
      const id = t.dataset.bulk, on = t.checked;
      try { await rpc('cl_teacher_verify', { p_student: id, p_item: S.bulkItem, p_status: on ? 'done' : null }); await reloadStudent(id); }
      catch (err) { alert('Could not save: ' + err.message); t.checked = !on; }
    }
  }
  function onChange(e) {
    const t = e.target;
    if (t.id === 'clt-period') { S.period = t.value; draw(); }
    else if (t.id === 'clt-bulk-item') { S.bulkItem = t.value; draw(); }
    else if (t.id === 'clt-student') { S.student = t.value; draw(); }
  }
  async function saveSettings() {
    const c = JSON.parse(JSON.stringify(S.cfg));
    document.querySelectorAll('[data-date]').forEach(i => { if (i.value) c[i.dataset.date] = i.value; });
    document.querySelectorAll('[data-hw]').forEach(i => { c.hw[i.dataset.hw] = i.checked; });
    document.querySelectorAll('[data-act-on]').forEach(i => { c.acts[i.dataset.actOn] = i.checked; });
    document.querySelectorAll('[data-boss]').forEach(i => { c.boss[i.dataset.boss] = i.checked; });
    document.querySelectorAll('[data-num]').forEach(i => {
      if (i.dataset.num === 'solo_required') c.solo_required = /^all$/i.test(i.value.trim()) ? 'all' : Math.max(0, parseInt(i.value, 10) || 0);
      else c[i.dataset.num] = Math.max(0, parseInt(i.value, 10) || 0);
    });
    c.partner_required = $('clt-partner').checked;
    const rel = $('clt-release').checked;
    if (rel && !S.cfg.released && !confirm('Open the checklist to ALL students now? They will see a checklist button on their Quest page.')) return;
    c.released = rel;
    c.off = [...document.querySelectorAll('[data-off]')].filter(i => i.checked).map(i => i.dataset.off);
    const groups = $('clt-tests').value.split(';').map(g => g.split(/[ ,]+/).map(Number).filter(n => n >= 1 && n <= 16)).filter(g => g.length);
    c.tests = groups.map((g, i) => ({ id: 't' + (i + 1), label: 'Test ' + (i + 1), chapters: [...new Set(g)].sort((a, b) => a - b) }));
    if (c.end <= c.start) return alert('End date must be after the start date.');
    try { await rpc('cl_teacher_config_set', { p_config: c }); S.cfg = C.config(c, TRIMESTER); $('clt-saved').textContent = 'Saved ✓'; }
    catch (err) { alert(missingDb(err) ? 'The database is not set up yet, so settings cannot be saved.' : 'Could not save: ' + err.message); }
  }

  let wired = false;
  window.renderChecklistDraft = function () {
    if (!wired) { $('cl-root').addEventListener('click', onClick); $('cl-root').addEventListener('change', onChange); wired = true; }
    if (!teacherPass()) { $('cl-root').innerHTML = '<p class="cl-detail">Unlock the dashboard first.</p>'; return; }
    if (!S.loaded && !S.err) load(); else draw();
  };
})();

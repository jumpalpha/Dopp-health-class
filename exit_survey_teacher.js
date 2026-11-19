/*
 * exit_survey_teacher.js — Teacher Dashboard → "Exit Survey".
 * Results from exit_survey.html: totals per question (A–D bars) and every comment with the
 * student's name, filterable by trimester and class period (students are told their name is shown).
 * Needs (from teacher.html): db, teacherPass(), TRIMESTER. Server check: supabase/exit_survey.sql.
 */
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = ['A', 'B', 'C', 'D'];
  let R = [], tris = [], tri = null, cls = 'all', wired = false;

  async function fetchTri(t) {
    const { data, error } = await db.rpc('exit_survey_teacher_list', { p_teacher_pass: teacherPass(), p_trimester: t });
    if (error) throw error;
    return data || {};
  }
  function draw() {
    const S = window.EXIT_SURVEY, codes = [...new Set(R.map(r => r.class_code || '?'))].sort();
    const list = R.filter(r => cls === 'all' || (r.class_code || '?') === cls);
    const qs = S.questions.map((q, i) => {
      const k = 'q' + (i + 1), n = L.map(l => list.filter(r => r.answers && r.answers[k] === l).length);
      const tot = n.reduce((a, b) => a + b, 0) || 1;
      const notes = list.filter(r => r.comments && r.comments[k]).map(r => ({ who: r.name, cc: r.class_code, t: r.comments[k] }));
      return `<div class="card es-q"><div class="es-h"><b>${i + 1}.</b> ${esc(q.q)}</div>
        ${q.c.map((c, j) => `<div class="es-row"><span class="es-l">${L[j]}</span><span class="es-t">${esc(c)}</span>
          <span class="es-bar"><i style="width:${n[j] / tot * 100}%"></i></span><span class="es-n">${n[j]} · ${Math.round(n[j] / tot * 100)}%</span></div>`).join('')}
        ${notes.length ? `<details class="es-c"><summary>💬 ${notes.length} comment${notes.length > 1 ? 's' : ''}</summary>${notes.map(n => `<p><b>${esc(n.who)}</b> <small>${esc(n.cc)}</small><br>“${esc(n.t)}”</p>`).join('')}</details>` : ''}</div>`;
    }).join('');
    const finals = list.filter(r => r.comments && r.comments.final).map(r => ({ who: r.name, cc: r.class_code, t: r.comments.final }));
    $('es-root').innerHTML = `
      <div class="card"><p class="bt-note" style="margin:0">👤 <b>Named.</b> Students reach the survey from the link at the bottom of the Home page (password <b>exit</b>) and must be signed in.
        One response per student per trimester — if they resubmit, their newest answers replace the old ones. Students are told you will see their name. The CSV has one row per student.</p></div>
      <div class="rt-bar">
        <select id="es-tri">${(tris.length ? tris : [tri]).map(t => `<option${t === tri ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
        <select id="es-cls"><option value="all">All classes</option>${codes.map(c => `<option${c === cls ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <button class="btn btn-sm" data-es="refresh">↻ Refresh</button><button class="btn btn-sm" data-es="csv">⬇ CSV</button>
        <a class="btn btn-sm" href="exit_survey.html" target="_blank" rel="noopener">👁 Open survey</a>
        <span class="bt-note" style="margin:0"><b>${list.length}</b> response${list.length === 1 ? '' : 's'}</span></div>
      ${list.length ? qs + `<div class="card es-q"><div class="es-h"><b>✍ Anything else?</b> (${finals.length})</div>${finals.map(n => `<p class="es-f"><b>${esc(n.who)}</b> <small>${esc(n.cc)}</small><br>“${esc(n.t)}”</p>`).join('') || '<p class="bt-note">No final comments.</p>'}</div>`
        : '<p class="bt-note">No responses yet for this trimester.</p>'}`;
  }
  function csv() {
    const S = window.EXIT_SURVEY, list = R.filter(r => cls === 'all' || (r.class_code || '?') === cls);
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const head = ['name', 'class', 'day'].concat(S.questions.flatMap((_, i) => ['Q' + (i + 1), 'Q' + (i + 1) + ' comment']), ['final comment']);
    const rows = list.map(r => [r.name, r.class_code, r.day].concat(S.questions.flatMap((_, i) => [r.answers['q' + (i + 1)], (r.comments || {})['q' + (i + 1)]]), [(r.comments || {}).final]));
    const blob = new Blob([[head].concat(rows).map(a => a.map(q).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'exit_survey_' + tri + '.csv'; a.click();
  }
  async function load() {
    $('es-root').innerHTML = '<p class="bt-note">Loading…</p>';
    try {
      tri = tri || TRIMESTER;
      let d = await fetchTri(tri); tris = (d.trimesters || []).sort();
      // After a trimester switch, open the newest trimester that has responses.
      if (!(d.responses || []).length && tris.length && !tris.includes(tri)) { tri = tris[tris.length - 1]; d = await fetchTri(tri); }
      if (!tris.includes(tri)) tris.push(tri);
      R = d.responses || []; draw();
    } catch (e) { $('es-root').innerHTML = `<p class="bt-note">Could not load the Exit Survey (${esc(e.message)}). Unlock the dashboard again and retry.</p>`; }
  }
  function wire() {
    if (wired) return; wired = true;
    const st = document.createElement('style');
    st.textContent = `.es-q{margin-top:10px}.es-h{font-weight:700;margin-bottom:8px;line-height:1.4}
      .es-row{display:grid;grid-template-columns:22px 1fr minmax(80px,30%) 70px;gap:8px;align-items:center;font-size:13px;margin:4px 0}
      .es-l{font-weight:900}.es-bar{height:10px;background:rgba(127,127,127,.18);border-radius:99px;overflow:hidden}
      .es-bar i{display:block;height:100%;background:linear-gradient(90deg,#38BFFF,#00E5A0)}.es-n{text-align:right;font-weight:700;opacity:.8}
      .es-c{margin-top:8px;font-size:13px}.es-c summary{cursor:pointer;font-weight:800}.es-c p,.es-f{margin:6px 0 0;padding:6px 10px;border-left:3px solid #FFD700;font-size:13.5px}`;
    document.head.appendChild(st);
    $('es-root').addEventListener('change', e => {
      if (e.target.id === 'es-cls') { cls = e.target.value; draw(); }
      if (e.target.id === 'es-tri') { tri = e.target.value; cls = 'all'; load(); }
    });
    $('es-root').addEventListener('click', e => {
      const b = e.target.closest('[data-es]'); if (!b) return;
      if (b.dataset.es === 'refresh') load(); else csv();
    });
  }
  window.renderExitSurveyTeacher = function () { wire(); load(); };
})();

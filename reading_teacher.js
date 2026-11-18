/*
 * reading_teacher.js — Teacher Dashboard → "Reading Levels".
 * Private Reading Check results (reading_check.html). Teacher-only: every call is checked
 * against the teacher passphrase on the server (supabase/reading_check.sql).
 * Turned off for the demo account (not on demo_call's teacher list).
 * Needs (from teacher.html): db, teacherPass(), TRIMESTER.
 */
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const label = L => L == null ? '' : L <= 2 ? 'Below 3' : L >= 13 ? 'College' : 'Gr ' + L;
  let S = [], cls = 'all', sort = 'name', wired = false, open = null;

  async function rpc(name, args) {
    const { data, error } = await db.rpc(name, Object.assign({ p_teacher_pass: teacherPass(), p_trimester: TRIMESTER }, args || {}));
    if (error) throw error;
    return data;
  }
  // Cut points (relative to a 9th–12th grade class); change here if you want different bands.
  const band = L => L == null ? '' : L <= 6 ? 'rt-red' : L <= 8 ? 'rt-amber' : 'rt-green';

  function pctile(v, arr) { if (v == null || !arr.length) return ''; const below = arr.filter(x => x < v).length, eq = arr.filter(x => x === v).length; return Math.round((below + eq / 2) / arr.length * 100); }

  function draw() {
    const codes = [...new Set(S.map(s => s.class_code))].sort();
    const list = S.filter(s => cls === 'all' || s.class_code === cls);
    const taken = list.filter(s => s.latest);
    const speeds = taken.map(s => s.latest.sre_net).filter(v => v != null);
    const rows = list.slice().sort((a, b) => {
      if (sort === 'level') return ((a.latest ? a.latest.level : 99) - (b.latest ? b.latest.level : 99)) || a.name.localeCompare(b.name);
      if (sort === 'speed') return ((a.latest ? a.latest.sre_net : 999) - (b.latest ? b.latest.sre_net : 999));
      return (a.class_code + a.name).localeCompare(b.class_code + b.name);
    });
    const hist = {}; taken.forEach(s => { const k = label(s.latest.level); hist[k] = (hist[k] || 0) + 1; });
    const order = ['Below 3', 'Gr 3', 'Gr 4', 'Gr 5', 'Gr 6', 'Gr 7', 'Gr 8', 'Gr 9', 'Gr 10', 'Gr 11', 'Gr 12', 'College'];
    const maxH = Math.max(1, ...Object.values(hist));
    $('rt-root').innerHTML = `
      <div class="card"><p class="bt-note" style="margin:0">🔒 <b>Private.</b> Students take the Reading Check from the Quest page (about 7 minutes).
        Only you and that student can see a result — nothing goes on boards, badges, XP or the demo account.
        <b>Level</b> = highest passage level read comfortably (5 of 6 words right) just below a level that was too hard (adaptive maze, grade 3 → college).
        Students can retake any time; every try is kept and the newest is shown. <b>Speed</b> = sentences right minus wrong in 60 seconds (silent reading efficiency); the % is compared with this list only, not national norms.
        Treat it as a screener: a flag or a surprising score is a reason to check in with the student, not a diagnosis.</p></div>
      <div class="rt-bar">
        <select id="rt-cls"><option value="all">All classes</option>${codes.map(c => `<option${c === cls ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <select id="rt-sort">${[['name', 'Sort: class & name'], ['level', 'Sort: level (low first)'], ['speed', 'Sort: speed (slow first)']].map(([k, t]) => `<option value="${k}"${k === sort ? ' selected' : ''}>${t}</option>`).join('')}</select>
        <button class="btn btn-sm" data-rt="refresh">↻ Refresh</button><button class="btn btn-sm" data-rt="csv">⬇ CSV</button>
        <span class="bt-note" style="margin:0">${taken.length} of ${list.length} taken</span>
      </div>
      ${taken.length ? `<div class="card rt-hist">${order.map(k => `<div><i style="height:${(hist[k] || 0) / maxH * 70}px"></i><b>${hist[k] || ''}</b><small>${k}</small></div>`).join('')}</div>` : ''}
      <div class="card" style="overflow-x:auto"><table class="rt-tbl">
        <thead><tr><th>Student</th><th>Class</th><th>Level</th><th>Speed</th><th>Maze</th><th>Time</th><th>Taken</th><th>Flags</th><th></th></tr></thead>
        <tbody>${rows.map(s => {
          const l = s.latest, n = (s.history || []).length;
          const hist = n > 1 ? `<div class="rt-sm">${n} tries: ${s.history.map(h => label(h.level)).join(' → ')}</div>` : '';
          return `<tr data-id="${esc(s.id)}"><td><b>${esc(s.name)}</b>${hist}</td><td>${esc(s.class_code)}</td>
            ${l ? `<td><span class="rt-lv ${band(l.level)}">${label(l.level)}</span></td>
              <td>${esc(l.sre_net)}<span class="rt-sm"> · ${pctile(l.sre_net, speeds)}%</span></td>
              <td>${esc(l.maze_pct)}%</td><td>${esc(l.minutes)} min</td>
              <td>${esc(new Date(l.taken_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}</td>
              <td>${(l.flags || []).map(f => `<span class="rt-flag">${esc(f)}</span>`).join(' ')}</td>
              <td style="white-space:nowrap"><button class="btn btn-sm" data-rt="detail">${n > 1 ? 'All ' + n + ' tries' : 'Details'}</button></td>`
            : '<td colspan="7" class="rt-sm">Not taken yet</td><td></td>'}</tr>
            ${open === s.id && l ? `<tr><td colspan="9" class="rt-det">${detail(l)}${allTries(s.history || [])}</td></tr>` : ''}`;
        }).join('') || '<tr><td colspan="9" class="rt-sm">No students in this trimester yet.</td></tr>'}</tbody></table></div>`;
  }

  function detail(l) {
    const d = l.details || {}, st = d.steps || [], sr = d.sre || {};
    return `<b>Passages (form ${esc(d.form || 'A')}):</b> ` + st.map((s, i) => `${i + 1}. ${label(s.level)} — ${s.right}/${s.of} right, ${s.secs}s (~${s.wpm} wpm) ${s.right >= Math.min(5, s.of - 1) ? '✓' : '✗'}`).join(' &nbsp;→&nbsp; ') +
      `<br><b>Speed round:</b> ${esc(sr.right)} right, ${esc(sr.wrong)} wrong of ${esc(sr.answered)} answered (${esc(l.sre_acc)}% accurate).`;
  }

  function allTries(h) {
    if (h.length < 2) return '';
    return `<br><b>Every try (oldest first):</b><table class="rt-tbl" style="margin-top:4px"><tr><th>#</th><th>Date</th><th>Level</th><th>Speed</th><th>Maze</th><th>Time</th><th>Flags</th></tr>` +
      h.map((t, i) => `<tr><td>${i + 1}</td><td>${esc(new Date(t.taken_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</td>
        <td>${label(t.level)}</td><td>${esc(t.sre_net)}</td><td>${t.maze_pct == null ? '' : esc(t.maze_pct) + '%'}</td><td>${t.minutes == null ? '' : esc(t.minutes) + ' min'}</td>
        <td>${(t.flags || []).map(f => `<span class="rt-flag">${esc(f)}</span>`).join(' ')}</td></tr>`).join('') + '</table>';
  }

  function csv() {
    // One row per try (every score kept); students with no tries get one "Not taken" row.
    const head = ['Student', 'Class', 'Try #', 'Level', 'Speed (net/min)', 'Speed accuracy %', 'Maze %', 'Minutes', 'Taken', 'Flags'];
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lines = [];
    S.forEach(s => {
      const h = s.history || [];
      if (!h.length) lines.push([s.name, s.class_code, '', 'Not taken'].map(q).join(','));
      h.forEach((t, i) => lines.push([s.name, s.class_code, i + 1, label(t.level), t.sre_net, t.sre_acc, t.maze_pct, t.minutes,
        t.taken_at ? new Date(t.taken_at).toLocaleString('en-US') : '', (t.flags || []).join('; ')].map(q).join(',')));
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([[head.join(',')].concat(lines).join('\n')], { type: 'text/csv' }));
    a.download = 'reading-levels-' + TRIMESTER + '.csv'; a.click();
  }

  async function load() {
    $('rt-root').innerHTML = '<p class="bt-note">Loading…</p>';
    try { S = await rpc('reading_teacher_list') || []; draw(); }
    catch (e) { $('rt-root').innerHTML = `<p class="bt-note">Could not load reading levels (${esc(e.message)}). Unlock the dashboard again and retry.</p>`; }
  }

  window.renderReadingTeacher = function () {
    if (!wired) {
      $('rt-root').addEventListener('change', e => {
        if (e.target.id === 'rt-cls') { cls = e.target.value; draw(); }
        if (e.target.id === 'rt-sort') { sort = e.target.value; draw(); }
      });
      $('rt-root').addEventListener('click', async e => {
        const b = e.target.closest('[data-rt]'); if (!b) return;
        const k = b.dataset.rt, id = b.closest('tr') && b.closest('tr').dataset.id;
        if (k === 'refresh') return load();
        if (k === 'csv') return csv();
        if (k === 'detail') { open = open === id ? null : id; return draw(); }
        if (k === 'retake' || k === 'noretake') {
          if (k === 'retake' && !confirm('Let this student take the Reading Check again? Their old result is kept, and they get a different set of passages.')) return;
          try { await rpc('reading_teacher_retake', { p_student_id: id, p_allow: k === 'retake' }); await load(); }
          catch (err) { alert('Could not save: ' + err.message); }
        }
      });
      wired = true;
    }
    if (!teacherPass()) { $('rt-root').innerHTML = '<p class="bt-note">Unlock the dashboard first.</p>'; return; }
    load();
  };
})();

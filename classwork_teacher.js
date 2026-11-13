/*
 * classwork_teacher.js — Teacher Dashboard → "Unit Classwork" (classwork.html).
 * Pick a unit: every student's mastery, stories and final score, read the stories, return work,
 * and turn Unit Classwork on for everyone (until then only class TEST can see it).
 * Needs (from teacher.html): db (Supabase client), teacherPass(), TRIMESTER, periodLabel().
 * Every call is checked against the teacher passphrase on the server (supabase/classwork.sql).
 */
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = t => t ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
  const per = c => (typeof periodLabel === 'function' ? periodLabel(c) : c) || '—';
  let unit = 1, data = null, open = null, filter = 'all';

  async function rpc(name, args) {
    const { data, error } = await db.rpc(name, Object.assign({ p_teacher_pass: teacherPass() }, args || {}));
    if (error) throw error;
    return data;
  }
  async function load() {
    data = null; draw();
    try { data = await rpc('cw_teacher_list', { p_trimester: TRIMESTER, p_unit: unit }); }
    catch (e) { $('cwt-root').innerHTML = `<div class="card">Couldn't load Unit Classwork: ${esc(e.message)}<br><small>Has supabase/classwork.sql been run?</small></div>`; return; }
    draw();
  }
  const termName = n => { const t = (data.terms || []).find(x => x.n === n); return t ? t.term : '#' + n; };

  function draw() {
    const root = $('cwt-root');
    const tabs = (window.CLASSWORK_UNITS || [1, 2, 3, 4, 5, 6, 7, 8, 9].map(u => ({ unit: u }))).map(x => x.unit).map(u => `<button class="cwt-u${u === unit ? ' on' : ''}" data-u="${u}">Unit ${u}</button>`).join('');
    if (!data) { root.innerHTML = `<div class="cwt-tabs">${tabs}</div><div class="card">Loading…</div>`; wireTabs(); return; }
    const rows = data.rows.filter(r => filter === 'all' || r.status === filter);
    const n = k => data.rows.filter(r => r.status === k).length;
    root.innerHTML = `
      <div class="card" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <b>${data.live ? '🟢 Live for every student' : '🔒 Hidden: only class TEST can see it'}</b>
        <button class="cwt-btn" id="cwt-live">${data.live ? 'Hide it again (TEST only)' : 'Turn it on for everyone'}</button>
        <span style="color:#888;font-size:13px">Page: doppsclass.com/classwork.html</span>
      </div>
      <div class="cwt-tabs">${tabs}</div>
      <div class="cwt-tabs">${[['all', 'All ' + data.rows.length], ['submitted', 'Turned in ' + n('submitted')], ['draft', 'Working ' + n('draft')], ['not_started', 'Not started ' + n('not_started')]]
        .map(([k, l]) => `<button class="cwt-f${filter === k ? ' on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
      <div class="card" style="overflow-x:auto"><table class="cwt-t"><thead><tr><th>Student</th><th>Period</th><th>Learn avg</th><th>Stories</th><th>Story avg</th><th>Classwork</th><th>Unit Test</th><th>Status</th><th></th></tr></thead><tbody>` +
      rows.map(r => {
        const chs = data.chapters || [], cs = r.ch_stories || {};
        const UU = (window.CLASSWORK_UNITS || []).find(x => x.unit === unit);
        const needAll = chs.reduce((t, c) => t + (UU ? Math.min(3, Math.floor(UU.terms.filter(w => w.c === c && w.s).length / 2)) : 3), 0);
        const st = chs.reduce((t, c) => t + (cs[c] || []).filter(Boolean).length, 0);
        const status = r.status === 'submitted' ? `<span style="color:#0f7a4f;font-weight:800">Turned in</span><br><small>${when(r.submitted_at)}</small>`
          : r.status === 'draft' ? '<span style="color:#b77900;font-weight:800">Working</span>' : '<span style="color:#888">Not started</span>';
        const row = `<tr><td><b>${esc(r.first)} ${esc(r.last)}</b></td><td>${esc(per(r.code))}</td>
          <td>${r.status === 'not_started' ? '—' : (r.learn_avg || 0) + '%'}</td>
          <td>${r.status === 'not_started' ? '—' : st + '/' + needAll}</td><td>${r.story_avg == null ? '—' : r.story_avg + '%'}</td>
          <td>${r.final_score == null ? '—' : '<b>' + r.final_score + '%</b>'}${r.posted_at ? `<br><small>posted ${r.posted_score}</small>` : ''}</td>
          <td>${r.unit_tries ? r.unit_best + '%<br><small>' + r.unit_tries + ' tries</small>' : '—'}</td>
          <td>${status}</td><td>${r.status !== 'not_started' ? `<button class="cwt-btn" data-open="${r.id}">${open === r.id ? 'Close' : 'Read'}</button>` : ''}</td></tr>`;
        return row + (open === r.id ? `<tr><td colspan="9">${detail(r)}</td></tr>` : '');
      }).join('') + `</tbody></table></div>`;
    wireTabs();
    root.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; draw(); });
    root.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { open = open === b.dataset.open ? null : b.dataset.open; draw(); });
    root.querySelectorAll('[data-return]').forEach(b => b.onclick = async () => {
      if (!confirm('Return this unit so the student can change it and turn it in again?')) return;
      try { await rpc('cw_teacher_return', { p_trimester: TRIMESTER, p_student: b.dataset.return, p_unit: unit }); load(); } catch (e) { alert(e.message); }
    });
    $('cwt-live').onclick = async () => {
      const on = !data.live;
      if (!confirm(on ? 'Turn Unit Classwork on for EVERY student?' : 'Hide Unit Classwork again (TEST class only)?')) return;
      try { await rpc('cw_teacher_live', { p_live: on }); load(); } catch (e) { alert(e.message); }
    };
  }
  function detail(r) {
    const chs = data.chapters || [], cs = r.ch_stories || {}, lb = r.learn_best || {}, ct = r.ch_test || {};
    const per = chs.map(c => `<h4 style="margin:12px 0 4px">Chapter ${c} · Learn ${lb[c] || 0}% · Chapter Test ${ct[c] ? ct[c].best + '% (' + ct[c].tries + ' tries)' : '—'}</h4>` +
      (cs[c] || [null, null, null]).map((s, i) => !s ? `<p><b>Story ${i + 1}:</b> <i>not written yet</i></p>` :
        `<div class="cwt-story"><b>Story ${i + 1}</b> · ${esc(termName(s.a))} + ${esc(termName(s.b))} · <b>${s.score.total}/100</b>
         <small>(length ${s.score.length}/40, words ${s.score.used}/30, detail ${s.score.detail}/30)</small><p>${esc(s.text)}</p></div>`).join('')).join('');
    const swaps = (r.swapped || []).length ? '<p><b>No-story swaps:</b> ' + r.swapped.map(x => `${esc(termName(x.n))} (Ch ${x.ch || '?'}) — “${esc(x.reason)}”`).join('; ') + '</p>' : '';
    return per + swaps + (r.status === 'submitted' ? `<button class="cwt-btn" data-return="${r.id}">Return for changes</button>` : '');
  }
  function wireTabs() { $('cwt-root').querySelectorAll('[data-u]').forEach(b => b.onclick = () => { unit = +b.dataset.u; open = null; load(); }); }

  const css = document.createElement('style');
  css.textContent = `.cwt-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}.cwt-u,.cwt-f,.cwt-btn{font:inherit;font-weight:800;font-size:13px;padding:6px 12px;border-radius:9px;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;cursor:pointer}
  .cwt-u.on,.cwt-f.on{background:#FFD700;color:#1A1030;border-color:#b38600}.cwt-t{width:100%;border-collapse:collapse;font-size:14px}.cwt-t th,.cwt-t td{text-align:left;padding:8px;border-bottom:1px solid rgba(128,128,128,.25);vertical-align:top}
  .cwt-story{padding:8px 10px;border-left:3px solid #FFD700;margin:6px 0;background:rgba(128,128,128,.07);border-radius:6px}.cwt-story p{margin:4px 0 0;white-space:pre-wrap}`;
  document.head.appendChild(css);
  window.renderClassworkTeacher = function () { if (!data) load(); else draw(); };
})();

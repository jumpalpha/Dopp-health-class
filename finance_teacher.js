/*
 * finance_teacher.js — Teacher Dashboard → "Cost of Your Future".
 * Review of the Financial Health assignment (finance.html): status for every student, their
 * numbers and reflection, a printable copy, and the 100-point rubric with editable scores.
 * Needs (from teacher.html): db (Supabase client), teacherPass(), TRIMESTER, periodLabel().
 * Every call is checked against the teacher passphrase on the server (supabase/finance_quest.sql).
 * Suggested points are only suggestions: nothing is saved until the teacher presses Save score,
 * and the reflection (20 pts) is never suggested — it is always the teacher's call.
 */
(function () {
  const F = window.FinanceCalc;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const usd = n => (n < 0 ? '−' : '') + '$' + Math.abs(Math.round(n || 0)).toLocaleString('en-US');
  const when = t => t ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
  const per = c => (typeof periodLabel === 'function' ? periodLabel(c) : c) || '—';
  let rows = null, filter = 'all', open = null, wired = false;

  async function rpc(name, args) {
    const { data, error } = await db.rpc(name, Object.assign({ p_teacher_pass: teacherPass(), p_trimester: TRIMESTER }, args || {}));
    if (error) throw error;
    return data;
  }

  function calc(d) {
    d = d || {};
    const c = d.career || {}, vals = (d.research || {}).values || {};
    const cmp = F.compare(d.predicted || {}, vals);
    const a = F.affordability({ salary: c.salary, days: c.days, hours: c.hours, values: vals, tax: d.tax || { mode: 'simplified' } });
    return { cmp, a };
  }
  const total = sc => sc ? F.RUBRIC.reduce((t, [k]) => t + (sc[k] == null ? 0 : Number(sc[k])), 0) : null;
  const STATUS = { not_started: ['Not started', '#777'], draft: ['In progress', '#b77900'], submitted: ['Submitted', '#0f7a4f'] };

  function draw() {
    const root = $('ft-root');
    if (!rows) { root.innerHTML = '<div class="card">Loading…</div>'; return; }
    const n = k => rows.filter(r => r.status === k).length;
    const scored = rows.filter(r => r.scored_at).length;
    const list = rows.filter(r => filter === 'all' || r.status === filter || (filter === 'unscored' && r.status === 'submitted' && !r.scored_at));
    root.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;align-items:center">
          <div style="font-size:13px;color:var(--dim)">Students open it from <b>Side Quests → The Cost of Your Future</b> (<a href="finance.html" target="_blank">finance.html</a>). They must be signed in on the Quest page to save and submit.</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-sm" data-ft="csv">⬇ Download CSV</button>
            <button class="btn btn-gold btn-sm" data-ft="refresh">↻ Refresh</button>
          </div>
        </div>
        <div class="stat-row" style="margin:14px 0">
          <div class="stat-card"><div class="sc-num">${rows.length}</div><div class="sc-label">Students</div></div>
          <div class="stat-card"><div class="sc-num">${n('not_started')}</div><div class="sc-label">Not started</div></div>
          <div class="stat-card"><div class="sc-num">${n('draft')}</div><div class="sc-label">Saved, not submitted</div></div>
          <div class="stat-card highlight"><div class="sc-num">${n('submitted')}</div><div class="sc-label">Submitted</div></div>
          <div class="stat-card"><div class="sc-num">${scored}</div><div class="sc-label">Scored</div></div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
          ${[['all', 'All'], ['submitted', 'Submitted'], ['unscored', 'Needs scoring'], ['draft', 'In progress'], ['not_started', 'Not started']].map(([k, l]) =>
            `<button class="btn btn-sm ${filter === k ? 'btn-gold' : ''}" data-ft="filter" data-k="${k}">${l}</button>`).join('')}
        </div>
        <div style="overflow-x:auto"><table class="lb-table">
          <thead><tr><th>Student</th><th>Period</th><th>Status</th><th>Career</th><th>Salary</th><th>Est. / Real per month</th><th>Surplus / deficit</th><th>Submitted</th><th>Score</th><th></th></tr></thead>
          <tbody>${list.length ? list.map(rowHTML).join('') : '<tr><td colspan="10" class="lb-empty">Nobody here.</td></tr>'}</tbody>
        </table></div>
        <p style="font-size:12px;color:var(--dim);margin-top:8px">Surplus/deficit uses the tax method the student chose. Schoology is not connected: grades entered here stay on doppsclass.com — copy them into Schoology yourself (the CSV helps).</p>
      </div>
      <div id="ft-detail"></div>`;
    if (open) detail(open);
  }
  function rowHTML(r) {
    const [lab, col] = STATUS[r.status] || STATUS.not_started;
    const d = r.data || {}, c = d.career || {};
    const started = r.status !== 'not_started';
    const { cmp, a } = started ? calc(d) : {};
    const t = total(r.scores);
    return `<tr>
      <td style="font-weight:700">${esc(r.first)} ${esc(r.last)}</td>
      <td style="font-size:12px;color:var(--dim)">${esc(per(r.code))}</td>
      <td style="font-weight:800;color:${col};font-size:12px">${lab}${r.returned_at && r.status === 'draft' ? ' (returned)' : ''}</td>
      <td>${esc(c.job || '—')}</td>
      <td>${started && c.salary ? usd(c.salary) + (c.salarySource === 'researched' ? ' 📚' : c.salarySource === 'guess' ? ' 🤔' : '') : '—'}</td>
      <td>${started && r.pred_locked_at ? usd(cmp.predictedMonthly) + ' / ' + (cmp.researchedMonthly ? usd(cmp.researchedMonthly) : '—') : '—'}</td>
      <td style="font-weight:800;color:${started && cmp.researchedMonthly ? (a.surplus >= 0 ? '#0f7a4f' : '#b0243a') : 'inherit'}">${started && cmp.researchedMonthly ? usd(a.surplus) : '—'}</td>
      <td style="font-size:12px;color:var(--dim)">${when(r.submitted_at)}</td>
      <td style="font-weight:800">${t == null ? '—' : t + '/100'}</td>
      <td>${started ? `<button class="btn btn-sm" data-ft="open" data-id="${r.id}">Review</button>` : ''}</td></tr>`;
  }

  function detail(id) {
    const r = rows.find(x => x.id === id), box = $('ft-detail');
    if (!r || !box) return;
    open = id;
    const d = r.data || {}, c = d.career || {}, rs = d.research || {}, vals = rs.values || {};
    const { cmp, a } = calc(d);
    const sug = F.suggestScores(d, { submitted: r.status === 'submitted', hasImage: r.has_image });
    const sc = r.scores || {};
    const sent = F.sentences(d.reflection);
    const miss = F.missing(Object.assign({}, d, { predLockedAt: r.pred_locked_at || d.predLockedAt }));
    box.innerHTML = `<div class="card" style="margin-top:16px" id="ft-print">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:center">
        <div class="card-title" style="margin:0">${esc(r.first)} ${esc(r.last)} · ${esc(per(r.code))}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${r.status === 'submitted' ? '<button class="btn btn-sm" data-ft="return" data-id="' + r.id + '">↩ Return for changes</button>' : ''}
          <button class="btn btn-sm" data-ft="print">🖨 Print</button>
          <button class="btn btn-sm" data-ft="close">✕ Close</button>
        </div>
      </div>
      <div style="font-size:12px;color:var(--dim);margin:4px 0 12px">Status: <b>${(STATUS[r.status] || [])[0]}</b> · last saved ${when(r.updated_at)} · submitted ${when(r.submitted_at)} · estimates locked ${when(r.pred_locked_at)}${r.status !== 'submitted' ? ' · <i>showing their current draft</i>' : ''}</div>
      ${miss.length && r.status !== 'submitted' ? `<div style="font-size:12px;background:rgba(255,190,0,.12);padding:8px 10px;border-radius:8px;margin-bottom:10px"><b>Still missing (${miss.length}):</b> ${esc(miss.slice(0, 8).join('; '))}${miss.length > 8 ? '…' : ''}</div>` : ''}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;font-size:13px">
        <div><b>Career:</b> ${esc(c.job || '—')}<br><b>Salary:</b> ${usd(c.salary)} — ${c.salarySource === 'researched' ? 'researched' + (c.salaryUrl ? ` (<a href="${esc(c.salaryUrl)}" target="_blank" rel="noopener noreferrer">source</a>)` : ' (no source given)') : c.salarySource === 'guess' ? '<b>guess</b>' : '—'}<br>
          <b>Schedule:</b> ${F.num(c.days)} d × ${F.num(c.hours)} h = ${F.workHours(c.days, c.hours).annualHours.toLocaleString()} hrs/yr<br><b>Lives in:</b> ${esc(c.place || '—')}<br>
          <b>Interest question:</b> ${d.step0 && d.step0.quiz ? (d.step0.quiz === 'b' ? '✅ correct' : '❌ answered ' + esc(d.step0.quiz)) : '—'}</div>
        <div><b>Research:</b> ${esc(rs.location || '—')} · ${esc(rs.household || '—')} · ${esc(rs.date || '—')}<br>
          <b>Source:</b> ${rs.url ? `<a href="${esc(rs.url)}" target="_blank" rel="noopener noreferrer">${esc(rs.url)}</a>` : '—'}<br>
          <b>Screenshot:</b> ${r.has_image ? `<button class="btn btn-sm" data-ft="img" data-id="${r.id}">View</button>` : 'none'}<div id="ft-img"></div></div>
        <div><b>Taxes (${d.tax && d.tax.mode === 'realistic' ? '2026 estimate' : 'classroom 25%+6%'}):</b> ${usd(a.taxes.total)}<br><b>Take-home:</b> ${usd(a.takeHome)}<br>
          <b>Needs:</b> ${usd(a.annualNeed)} (savings ${usd(a.savingsAnnual)})<br><b>Required gross:</b> ${usd(a.requiredGross)}${a.requiredHourly != null ? ' · $' + a.requiredHourly.toFixed(2) + '/hr' : ''}<br>
          <b>Result:</b> <span style="font-weight:900;color:${a.surplus >= 0 ? '#0f7a4f' : '#b0243a'}">${a.meter.label} (${usd(a.surplus)}/yr)</span></div>
      </div>
      <div style="overflow-x:auto;margin-top:12px"><table class="lb-table"><thead><tr><th>Category</th><th>Estimate</th><th>Researched</th><th>Diff</th><th>Source</th></tr></thead><tbody>
        ${cmp.rows.map(x => { const v = vals[x.key] || {}; return `<tr><td>${esc(x.label)}</td><td>${usd(x.predicted)}</td><td>${F.isBlank(v.v) ? '—' : usd(x.researched)}</td><td style="color:${x.diff > 0 ? '#b0243a' : x.diff < 0 ? '#0f7a4f' : 'inherit'}">${x.diff > 0 ? '+' : ''}${usd(x.diff)}</td><td style="font-size:12px">${v.src === 'own' ? 'Own: ' + esc(v.note || '(no note)') : F.isBlank(v.v) ? '' : 'MIT'}</td></tr>`; }).join('')}
        <tr style="font-weight:900"><td>Monthly</td><td>${usd(cmp.predictedMonthly)}</td><td>${usd(cmp.researchedMonthly)}</td><td>${usd(cmp.diffMonthly)}</td><td></td></tr>
      </tbody></table></div>
      <div style="margin-top:12px"><b>Reflection</b> <span style="font-size:12px;color:var(--dim)">(${sent.meaningful} complete sentences, ${d.reflection ? sent.words : 0} words)</span>
        <div style="white-space:pre-wrap;background:rgba(28,26,46,.04);border:1px solid var(--border);border-radius:10px;padding:10px;margin-top:6px;font-size:14px">${esc(d.reflection || '—')}</div></div>
      <div style="margin-top:14px"><b>Score</b> <span style="font-size:12px;color:var(--dim)">Suggested points are based only on what was entered. Check the evidence and change anything. Reflection is yours to grade.</span>
        <table class="lb-table" style="margin-top:6px"><thead><tr><th>Rubric</th><th>Suggested</th><th>Final</th></tr></thead><tbody>
        ${F.RUBRIC.map(([k, l, m]) => `<tr><td>${esc(l)} (${m})</td><td>${sug[k] == null ? '<i>you decide</i>' : sug[k]}</td>
          <td><input type="number" min="0" max="${m}" step="1" data-sc="${k}" value="${sc[k] != null ? sc[k] : ''}" placeholder="${sug[k] == null ? '' : sug[k]}" style="width:80px"> / ${m}</td></tr>`).join('')}
        <tr style="font-weight:900"><td>Total</td><td></td><td id="ft-total">${total(sc) ?? '—'} / 100</td></tr></tbody></table>
        <textarea id="ft-note" rows="2" maxlength="1000" placeholder="Optional note to the student (they see it with their score)" style="width:100%;margin-top:8px">${esc(r.teacher_note || '')}</textarea>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
          <button class="btn btn-sm" data-ft="usesug">Fill blanks with suggestions</button>
          <button class="btn btn-gold btn-sm" data-ft="score" data-id="${r.id}">Save score</button>
          <span id="ft-msg" style="font-size:12px;align-self:center"></span>
        </div>
        ${r.scored_at ? `<div style="font-size:12px;color:var(--dim);margin-top:4px">Last scored ${when(r.scored_at)}. Students see the score and note on their Review step.</div>` : ''}
      </div></div>`;
    box.querySelectorAll('[data-sc]').forEach(i => i.addEventListener('input', liveTotal));
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function readScores() {
    const out = {}; let bad = null;
    F.RUBRIC.forEach(([k, l, m]) => {
      const el = document.querySelector(`#ft-detail [data-sc="${k}"]`), v = el.value.trim();
      if (v === '') out[k] = null;
      else { const n = Number(v); if (!Number.isFinite(n) || n < 0 || n > m) bad = l + ' must be 0–' + m; out[k] = n; }
    });
    return { out, bad };
  }
  function liveTotal() { const { out } = readScores(); $('ft-total').textContent = total(out) + ' / 100'; }

  function csv() {
    const head = ['Last', 'First', 'Period', 'Status', 'Career', 'Salary', 'Salary source', 'Est monthly', 'Real monthly', 'Surplus per year', 'Result', 'Submitted', ...F.RUBRIC.map(r => r[1]), 'Total'];
    const lines = [head];
    rows.forEach(r => {
      const d = r.data || {}, c = d.career || {}, st = r.status !== 'not_started', x = st ? calc(d) : null, sc = r.scores || {};
      lines.push([r.last, r.first, per(r.code), (STATUS[r.status] || [])[0], c.job || '', st ? F.num(c.salary) : '', c.salarySource || '',
        st ? Math.round(x.cmp.predictedMonthly) : '', st ? Math.round(x.cmp.researchedMonthly) : '', st ? Math.round(x.a.surplus) : '', st ? x.a.meter.label : '',
        r.submitted_at || '', ...F.RUBRIC.map(([k]) => sc[k] == null ? '' : sc[k]), r.scores ? total(sc) : '']);
    });
    const text = lines.map(l => l.map(v => { v = String(v == null ? '' : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    a.download = 'cost-of-your-future-' + TRIMESTER + '.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function load() {
    rows = null; draw();
    try { rows = await rpc('fin_teacher_list'); }
    catch (e) {
      $('ft-root').innerHTML = `<div class="card">Could not load: ${esc(e.message)}${/function .*does not exist|fin_teacher_list/.test(e.message) ? '<br><br><b>The database part isn’t installed yet.</b> Paste <code>supabase/finance_quest.sql</code> into Supabase → SQL Editor → Run.' : ''}</div>`;
      return;
    }
    draw();
  }

  function wire() {
    if (wired) return; wired = true;
    document.addEventListener('click', async e => {
      const b = e.target.closest('#page-finance [data-ft]'); if (!b) return;
      const act = b.dataset.ft;
      try {
        if (act === 'refresh') { open = null; await load(); }
        else if (act === 'filter') { filter = b.dataset.k; draw(); }
        else if (act === 'open') detail(b.dataset.id);
        else if (act === 'close') { open = null; $('ft-detail').innerHTML = ''; }
        else if (act === 'csv') csv();
        else if (act === 'print') {
          const w = window.open('', '_blank');
          w.document.write('<!doctype html><title>Cost of Your Future</title><style>body{font-family:Arial,sans-serif;font-size:13px;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:4px 6px;text-align:left}button,textarea,input{display:none}</style>' + $('ft-print').innerHTML);
          w.document.close(); w.focus(); w.print();
        }
        else if (act === 'img') {
          b.disabled = true;
          const src = await rpc('fin_teacher_image', { p_student: b.dataset.id });
          $('ft-img').innerHTML = src && /^data:image\/jpeg;base64,/.test(src) ? `<img src="${src}" alt="Student evidence" style="max-width:100%;border:1px solid var(--border);border-radius:8px;margin-top:6px">` : 'No picture.';
        }
        else if (act === 'usesug') {
          document.querySelectorAll('#ft-detail [data-sc]').forEach(i => { if (i.value === '' && i.placeholder !== '') i.value = i.placeholder; });
          liveTotal();
        }
        else if (act === 'score') {
          const { out, bad } = readScores();
          if (bad) { $('ft-msg').textContent = bad; return; }
          b.disabled = true;
          await rpc('fin_teacher_score', { p_student: b.dataset.id, p_scores: out, p_note: $('ft-note').value.trim() || null });
          const r = rows.find(x => x.id === b.dataset.id);
          Object.assign(r, { scores: out, teacher_note: $('ft-note').value.trim(), scored_at: new Date().toISOString() });
          draw();
          const m = $('ft-msg'); if (m) m.textContent = '✓ Saved';
        }
        else if (act === 'return') {
          if (!confirm('Return this assignment so the student can change it and submit again?\n\nTheir locked Step 2 estimates stay locked.')) return;
          await rpc('fin_teacher_return', { p_student: b.dataset.id });
          await load(); detail(b.dataset.id);
        }
      } catch (err) {
        b.disabled = false;
        if (/not allowed|passphrase/i.test(err.message) && typeof lockDashboard === 'function') { lockDashboard(); return; }
        alert(err.message);
      }
    });
  }

  window.renderFinanceTeacher = function () { wire(); if (!rows) load(); else draw(); };
})();

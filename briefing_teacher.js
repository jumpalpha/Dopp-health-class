/*
 * briefing_teacher.js — Teacher Dashboard → "Daily Briefing".
 * The announcement and Survey of the Day that students see on their Welcome screen (welcome.html).
 * Needs (from teacher.html): db (Supabase client), teacherPass(), TRIMESTER.
 * Every call is checked against the teacher passphrase on the server (supabase/daily_briefing.sql).
 */
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let B = null, wired = false;

  async function rpc(name, args) {
    const { data, error } = await db.rpc(name, Object.assign({ p_teacher_pass: teacherPass(), p_trimester: TRIMESTER }, args || {}));
    if (error) throw error;
    return data;
  }

  function results(s) {
    if (!s) return '';
    const total = s.total || 0;
    return `<div class="bt-results"><b>Answers so far: ${total}</b>` + s.opts.map((o, i) => {
      const n = (s.counts && s.counts[i]) || 0, pct = total ? Math.round(n * 100 / total) : 0;
      return `<div class="bt-bar"><span>${esc(o)}</span><i style="width:${pct}%"></i><em>${n} · ${pct}%</em></div>`;
    }).join('') + `<button class="btn btn-sm" data-bt="refresh" style="margin-top:8px">↻ Refresh results</button></div>`;
  }

  function draw() {
    const s = B && B.survey, opts = s ? s.opts : ['', ''];
    while (opts.length < 2) opts.push('');
    $('bt-root').innerHTML = `
      <div class="card"><div class="card-title">📣 Announcement</div>
        <textarea id="bt-ann" rows="4" maxlength="2000" placeholder="Example: Chapter 6 reading is due Friday. Bring headphones tomorrow!">${esc(B ? B.announcement : '')}</textarea>
        <p class="bt-note">Shows at the top of every student's Welcome screen until you change or clear it.${B && B.updated_at ? ' Last saved ' + esc(new Date(B.updated_at).toLocaleString()) + '.' : ''}</p></div>
      <div class="card"><div class="card-title">🗳 Survey of the Day</div>
        <p class="bt-note">${B && B.weekend ? 'No survey on weekends. A new question appears automatically each school day.' :
          s && s.bank_n ? 'Today\'s automatic question: #' + s.bank_n + ' of the 100-question bank. Students get the next one each school day, no repeats.' :
          s ? 'Today you\'re using your own question. Tomorrow goes back to the automatic list.' : 'Survey is off for today. Type a question to turn it back on.'}</p>
        <input id="bt-q" type="text" maxlength="300" placeholder="Question (leave empty for no survey today)" value="${esc(s ? s.q : '')}">
        <div id="bt-opts">${opts.map((o, i) => `<input class="bt-opt" type="text" maxlength="80" placeholder="Choice ${i + 1}" value="${esc(o)}">`).join('')}</div>
        <button class="btn btn-sm" data-bt="add">+ Add a choice</button>
        <p class="bt-note">2–6 choices. Students tap one and see the class totals right after. Fully anonymous: only totals are saved, never who picked what, so answers are final.
          Editing the question or choices replaces <b>today's</b> survey and resets its answers. Past days' totals show on each student's Quest calendar (🗳 pop-up).</p>
        ${results(s)}</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-gold" data-bt="save">💾 Save &amp; show to students</button>
        <button class="btn btn-sm" data-bt="clear">Clear both</button>
        <a class="btn btn-sm" href="welcome.html" target="_blank" rel="noopener">👀 Preview Welcome screen</a>
        <span id="bt-msg" class="bt-note"></span></div>`;
  }

  async function load() {
    $('bt-root').innerHTML = '<p class="bt-note">Loading…</p>';
    try { B = await rpc('briefing_teacher_get'); draw(); }
    catch (e) { $('bt-root').innerHTML = `<p class="bt-note">Could not load the briefing (${esc(e.message)}). Unlock the dashboard again and retry.</p>`; }
  }

  async function save(clear) {
    const ann = clear ? '' : $('bt-ann').value.trim();
    const q = clear ? '' : $('bt-q').value.trim();
    const opts = clear ? [] : [...document.querySelectorAll('.bt-opt')].map(i => i.value.trim()).filter(Boolean);
    if (q && (opts.length < 2 || opts.length > 6)) return alert('A survey needs 2 to 6 choices.');
    if (!q && opts.length && !confirm('There are choices but no question, so no survey will show. Save anyway?')) return;
    if (B && B.survey && q && (q !== B.survey.q || JSON.stringify(opts) !== JSON.stringify(B.survey.opts)) && B.survey.total &&
        !confirm('You changed the survey. That starts a new one and the ' + B.survey.total + ' answers so far won\'t show anymore. Continue?')) return;
    try {
      B = await rpc('briefing_teacher_set', { p_announcement: ann, p_survey_q: q || null, p_survey_opts: q ? opts : [] });
      draw(); $('bt-msg').textContent = 'Saved ✓ Students see it next time they open the site.';
    } catch (e) { alert('Could not save: ' + e.message); }
  }

  window.renderBriefing = function () {
    if (!wired) {
      $('bt-root').addEventListener('click', e => {
        const t = e.target.closest('[data-bt]'); if (!t) return;
        const a = t.dataset.bt;
        if (a === 'add') {
          if (document.querySelectorAll('.bt-opt').length >= 6) return alert('Up to 6 choices.');
          $('bt-opts').insertAdjacentHTML('beforeend', `<input class="bt-opt" type="text" maxlength="80" placeholder="Choice ${document.querySelectorAll('.bt-opt').length + 1}">`);
        }
        if (a === 'save') save(false);
        if (a === 'clear' && confirm('Remove the announcement and turn off today\'s survey?')) save(true);
        if (a === 'refresh') load();
      });
      wired = true;
    }
    if (!teacherPass()) { $('bt-root').innerHTML = '<p class="bt-note">Unlock the dashboard first.</p>'; return; }
    load();
  };
})();

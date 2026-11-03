/*
 * ask_teacher.js — Teacher Dashboard → "Ask Mr. Dopp".
 * Anonymous student questions from ask.html. Questions are saved with no student attached.
 * Needs (from teacher.html): db (Supabase client), teacherPass(), TRIMESTER.
 * Every call is checked against the teacher passphrase on the server (supabase/ask_dopp.sql).
 */
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LABEL = { new: '🆕 New', posted: '📌 Posted to class', in_class: '🗣 Answered in class', skipped: '⏭ Skipped' };
  let Q = [], view = 'new', wired = false;

  async function rpc(name, args) {
    const { data, error } = await db.rpc(name, Object.assign({ p_teacher_pass: teacherPass(), p_trimester: TRIMESTER }, args || {}));
    if (error) throw error;
    return data;
  }
  const day = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';

  function card(q) {
    return `<div class="card ak-card" data-id="${esc(q.id)}">
      <div class="ak-head"><span class="ak-tag">${esc(q.topic)}</span><span>${esc(day(q.day))}</span><span class="ak-st ak-${esc(q.status)}">${LABEL[q.status] || ''}</span></div>
      <textarea class="ak-body" rows="3" maxlength="1000" title="You can tidy the wording (typos, names) before posting">${esc(q.body)}</textarea>
      <textarea class="ak-ans" rows="4" maxlength="4000" placeholder="Your answer (needed to post it to the class board)">${esc(q.answer || '')}</textarea>
      <div class="ak-btns">
        <button class="btn btn-gold btn-sm" data-ak="posted">📌 Post answer to class</button>
        <button class="btn btn-sm" data-ak="in_class">🗣 Answered in class</button>
        ${q.status === 'new' ? '<button class="btn btn-sm" data-ak="skipped">⏭ Skip</button>' : '<button class="btn btn-sm" data-ak="new">↩ Back to New</button>'}
        <button class="btn btn-sm ak-del" data-ak="delete">🗑 Delete</button>
      </div></div>`;
  }

  function draw() {
    const n = s => Q.filter(q => q.status === s).length;
    const list = Q.filter(q => view === 'all' || q.status === view);
    const tabs = [['new', '🆕 New'], ['posted', '📌 Posted'], ['in_class', '🗣 In class'], ['skipped', '⏭ Skipped'], ['all', 'All']];
    $('ak-root').innerHTML = `
      <div class="card"><p class="bt-note" style="margin:0">Students ask from <a href="ask.html" target="_blank" rel="noopener">ask.html</a> (linked on their Welcome screen and the Home page).
        Questions are saved with <b>no name and no time</b>, so you can't reply to one person. <b>Post</b> puts the question and your answer on the class board;
        <b>Answered in class</b> keeps it off the board. You can edit the question's wording before posting.
        If a question suggests a student may be unsafe, consider addressing it with the whole class and pointing everyone to the counselor and 988.</p></div>
      <div class="ak-tabs">${tabs.map(([k, t]) => `<button class="btn btn-sm${view === k ? ' btn-gold' : ''}" data-view="${k}">${t}${k !== 'all' ? ' (' + n(k) + ')' : ''}</button>`).join('')}
        <button class="btn btn-sm" data-ak-refresh>↻ Refresh</button></div>
      ${list.length ? list.map(card).join('') : `<p class="bt-note">${view === 'new' ? 'No new questions. 🎉' : 'Nothing here yet.'}</p>`}`;
  }

  async function load() {
    $('ak-root').innerHTML = '<p class="bt-note">Loading…</p>';
    try { Q = await rpc('ask_teacher_list') || []; draw(); updateBadge(); }
    catch (e) { $('ak-root').innerHTML = `<p class="bt-note">Could not load questions (${esc(e.message)}). Unlock the dashboard again and retry.</p>`; }
  }

  function updateBadge() {
    const b = $('ak-badge'); if (!b) return;
    const n = Q.filter(q => q.status === 'new').length;
    b.textContent = n ? n : ''; b.style.display = n ? 'inline-block' : 'none';
  }

  async function act(id, what) {
    const el = document.querySelector(`.ak-card[data-id="${id}"]`);
    try {
      if (what === 'delete') {
        if (!confirm('Delete this question for good?')) return;
        Q = await rpc('ask_teacher_delete', { p_id: id });
      } else {
        const ans = el.querySelector('.ak-ans').value.trim();
        if (what === 'posted' && !ans) return alert('Write an answer first. Students will see the question and your answer.');
        Q = await rpc('ask_teacher_set', { p_id: id, p_answer: ans, p_status: what, p_body: el.querySelector('.ak-body').value });
      }
      draw(); updateBadge();
    } catch (e) { alert('Could not save: ' + e.message); }
  }

  // Red count of new questions on the sidebar button, loaded quietly after unlock.
  window.askBadge = async function () {
    if (!teacherPass()) return;
    try { Q = await rpc('ask_teacher_list') || []; updateBadge(); } catch (e) {}
  };

  window.renderAsk = function () {
    if (!wired) {
      $('ak-root').addEventListener('click', e => {
        const v = e.target.closest('[data-view]'); if (v) { view = v.dataset.view; return draw(); }
        if (e.target.closest('[data-ak-refresh]')) return load();
        const b = e.target.closest('[data-ak]'); if (!b) return;
        act(b.closest('.ak-card').dataset.id, b.dataset.ak);
      });
      wired = true;
    }
    if (!teacherPass()) { $('ak-root').innerHTML = '<p class="bt-note">Unlock the dashboard first.</p>'; return; }
    load();
  };
})();

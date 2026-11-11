/*
 * recipes_teacher.js — Teacher Dashboard → Weight Control Quest "Island Recipe Book".
 * The book learns on its own (supabase/wcq_learning.sql):
 *   • foods students taught it (they pick the type; most votes wins)
 *   • dishes students made (shared with everyone once 2 students make the same dish)
 * Nothing needs approval. This card only shows what was learned and lets Mr. Dopp remove junk.
 * Needs (from teacher.html): db, teacherPass().
 */
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BOOK = window.WCQ_BOOK;
  let F = [], DI = [];

  async function rpc(name, args) {
    const { data, error } = await db.rpc(name, Object.assign({ p_teacher_pass: teacherPass() }, args || {}));
    if (error) throw error;
    return data;
  }
  function msg(t, bad) { const el = $('wr-msg'); if (el) { el.textContent = t || ''; el.style.color = bad ? 'var(--crimson)' : 'var(--emerald)'; } }
  const ingName = k => String(k).startsWith('x:') ? BOOK.title(String(k).slice(2)) : (BOOK.ING[k] ? BOOK.ING[k][0] : k);
  const votes = v => Object.entries(v || {}).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${BOOK.CATS[c] || c} ${n}`).join(' · ');

  function render() {
    const box = $('wr-list'); if (!box) return;
    const row = 'display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;align-items:center';
    box.innerHTML =
      `<div style="font-size:13px;color:var(--dim);margin:6px 0">Built-in book: ${BOOK.RECIPES.length} dishes. Everything below was added by students automatically — remove anything that doesn't belong.</div>` +
      `<div style="font-weight:800;margin:10px 0 4px">New foods students taught it (${F.length})</div>` +
      (F.length ? F.map(f => `<div style="${row}" data-kind="food" data-n="${esc(f.n)}"><span><b>${esc(f.name)}</b> → ${esc(BOOK.CATS[f.cat] || f.cat)} <span style="color:var(--dim)">(${esc(votes(f.votes))})</span></span>
        <button class="btn btn-sm btn-danger" data-wr="remove" type="button">Remove</button></div>`).join('') : '<div style="font-size:13px;color:var(--dim)">None yet.</div>') +
      `<div style="font-weight:800;margin:14px 0 4px">Dishes students made (${DI.length})</div>` +
      (DI.length ? DI.map(d => `<div style="${row}" data-kind="dish" data-n="${esc(d.n)}"><span><b>${esc(d.name)}</b> — ${esc((d.ings || []).map(e => ingName(e[0]) + ' ×' + e[1]).join(', '))}
        <span style="color:${d.makers >= 2 ? 'var(--emerald)' : 'var(--dim)'}">· ${d.makers} student${d.makers === 1 ? '' : 's'}${d.makers >= 2 ? ' · shared with everyone' : ' · waiting for a 2nd student'}</span></span>
        <button class="btn btn-sm btn-danger" data-wr="remove" type="button">Remove</button></div>`).join('') : '<div style="font-size:13px;color:var(--dim)">None yet.</div>');
  }
  async function load() {
    const box = $('wr-list'); if (!box || !teacherPass() || !BOOK) return;
    try { const d = await rpc('wcq_teacher_learning'); F = d.foods || []; DI = d.dishes || []; msg(''); render(); }
    catch (e) { box.innerHTML = ''; msg(/function|schema/i.test(e.message) ? 'Needs the database update (supabase/wcq_learning.sql).' : 'Could not load: ' + e.message, true); }
  }
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-wr="remove"]'); if (!b || !$('wr-list') || !$('wr-list').contains(b)) return;
    const r = b.closest('[data-kind]');
    if (!confirm('Remove this from the recipe book?')) return;
    try { const d = await rpc('wcq_teacher_remove', { p_kind: r.dataset.kind, p_norm: r.dataset.n }); F = d.foods || []; DI = d.dishes || []; render(); msg('Removed.'); }
    catch (err) { msg(err.message, true); }
  });
  window.wrLoad = load;
  if (typeof teacherPass === 'function' && teacherPass()) load();
})();

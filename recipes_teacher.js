/*
 * recipes_teacher.js — Teacher Dashboard → Weight Control Quest "Island Recipe Book".
 * Students suggest dishes that aren't in the built-in book (wcq_recipes.js). Mr. Dopp turns a
 * suggestion into a recipe (pick ingredients + amounts) or rejects it. Approved dishes show up
 * for every student. Needs (from teacher.html): db, teacherPass(). SQL: supabase/wcq_recipes.sql.
 */
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BOOK = window.WCQ_BOOK;
  let S = [], R = [], editing = null;   // editing: suggestion id, or 'new'

  async function rpc(name, args) {
    const { data, error } = await db.rpc(name, Object.assign({ p_teacher_pass: teacherPass() }, args || {}));
    if (error) throw error;
    return data;
  }
  function msg(t, bad) { const el = $('wr-msg'); if (el) { el.textContent = t || ''; el.style.color = bad ? 'var(--crimson)' : 'var(--emerald)'; } }

  const ingOpts = sel => BOOK.ingList().map(i => `<option value="${i.k}" ${i.k === sel ? 'selected' : ''}>${esc(i.name)} (per ${esc(i.unit)})</option>`).join('');
  function row(k, a) {
    return `<div class="wr-row" style="display:flex;gap:6px;margin:4px 0;align-items:center">
      <select class="wr-k" style="flex:1;padding:6px;border-radius:8px">${ingOpts(k)}</select>
      <input class="wr-a" type="number" min="0.05" step="0.05" value="${a || 1}" style="width:80px;padding:6px;border-radius:8px" aria-label="Amount">
      <span class="wr-u" style="font-size:12px;color:var(--dim);width:60px">${esc((BOOK.ING[k] || BOOK.ING.egg)[1])}</span>
      <button class="btn btn-sm btn-danger" data-wr="rowdel" type="button">✕</button></div>`;
  }
  function guessRows(foods) {
    const rows = (foods || []).map(n => BOOK.matchFood(n, 'N')).filter(Boolean).filter((k, i, a) => a.indexOf(k) === i);
    return rows.length ? rows.map(k => row(k, 1)).join('') : row('egg', 1);
  }
  function editor(id, name, foods) {
    return `<div class="wr-ed" data-ed="${esc(id)}" style="margin-top:10px;padding:10px;border:1px dashed var(--border);border-radius:10px">
      <label class="form-label">Dish name</label><input class="wr-name" maxlength="60" value="${esc(name)}" style="width:100%;padding:8px;border-radius:8px;margin-bottom:6px">
      <div class="form-label">Ingredients for ONE plate (spices, salt, water, yeast are free — leave them out)</div>
      <div class="wr-rows">${guessRows(foods)}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        <button class="btn btn-sm" data-wr="rowadd" type="button">+ Ingredient</button>
        <button class="btn btn-gold btn-sm" data-wr="save" type="button">✅ Approve — add to recipe book</button>
        <button class="btn btn-sm" data-wr="cancel" type="button">Cancel</button></div></div>`;
  }
  function render() {
    const box = $('wr-list'); if (!box) return;
    const ingTxt = ings => (ings || []).map(e => { const k = String(e[0]).replace('?', ''); return (BOOK.ING[k] ? BOOK.ING[k][0] : k) + ' ' + BOOK.amountText(k, +e[1]); }).join(', ');
    box.innerHTML = `<div style="font-weight:800;margin:6px 0">Student suggestions (${S.length})</div>` +
      (S.length ? S.map(s => `<div class="card" style="padding:10px 12px;margin:6px 0" data-sid="${esc(s.id)}">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${esc(s.name)}</b>
          <span style="font-size:12px;color:var(--dim)">${s.n > 1 ? `🔥 suggested ${s.n} times · ` : ''}${esc(s.trimester || '')}</span></div>
        <div style="font-size:12px;color:var(--dim)">Foods they said it uses: ${esc((s.foods || []).join(', ') || '—')}</div>
        ${(s.notes || []).length ? `<div style="font-size:12px;margin-top:4px">“${(s.notes || []).map(esc).join('” · “')}”</div>` : ''}
        ${editing === s.id ? editor(s.id, s.name, s.foods) : `<div style="display:flex;gap:6px;margin-top:6px">
          <button class="btn btn-gold btn-sm" data-wr="build" type="button">🍳 Build recipe</button>
          <button class="btn btn-sm btn-danger" data-wr="reject" type="button">Reject</button></div>`}
      </div>`).join('') : '<div style="font-size:13px;color:var(--dim)">No new suggestions.</div>') +
      `<div style="margin-top:10px">${editing === 'new' ? editor('new', '', []) : '<button class="btn btn-sm" data-wr="newdish" type="button">+ Add a dish yourself</button>'}</div>` +
      `<div style="font-weight:800;margin:14px 0 6px">Class recipes you approved (${R.length}) <span style="font-weight:600;font-size:12px;color:var(--dim)">· plus ${BOOK.RECIPES.length} built-in</span></div>` +
      (R.length ? R.map(r => `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px" data-rid="${esc(r.id)}">
        <span><b>${esc(r.name)}</b> — ${esc(ingTxt(r.ings))}</span><button class="btn btn-sm btn-danger" data-wr="remove" type="button">Remove</button></div>`).join('')
        : '<div style="font-size:13px;color:var(--dim)">None yet.</div>');
  }
  async function load() {
    const box = $('wr-list'); if (!box || !teacherPass() || !BOOK) return;
    try { const d = await rpc('wcq_teacher_suggestions'); S = d.suggestions || []; R = d.recipes || []; msg(''); render(); }
    catch (e) { box.innerHTML = ''; msg(/function|schema/i.test(e.message) ? 'Recipe suggestions need the database update (supabase/wcq_recipes.sql).' : 'Could not load: ' + e.message, true); }
  }
  function apply(d) { S = d.suggestions || []; R = d.recipes || []; editing = null; render(); }

  document.addEventListener('change', e => {
    if (!e.target.classList.contains('wr-k')) return;
    const u = e.target.closest('.wr-row').querySelector('.wr-u'); u.textContent = BOOK.ING[e.target.value][1];
  });
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-wr]'); if (!b || !$('wr-list') || !$('wr-list').contains(b)) return;
    const act = b.dataset.wr, sid = b.closest('[data-sid]') && b.closest('[data-sid]').dataset.sid;
    try {
      if (act === 'build') { editing = sid; render(); }
      else if (act === 'newdish') { editing = 'new'; render(); }
      else if (act === 'cancel') { editing = null; render(); }
      else if (act === 'rowadd') b.closest('.wr-ed').querySelector('.wr-rows').insertAdjacentHTML('beforeend', row('egg', 1));
      else if (act === 'rowdel') b.closest('.wr-row').remove();
      else if (act === 'reject') { if (confirm('Reject this suggestion?')) apply(await rpc('wcq_teacher_reject', { p_suggestion_id: sid })); }
      else if (act === 'remove') { const rid = b.closest('[data-rid]').dataset.rid; if (confirm('Remove this dish from the recipe book?')) apply(await rpc('wcq_teacher_recipe_remove', { p_id: rid })); }
      else if (act === 'save') {
        const ed = b.closest('.wr-ed'), name = ed.querySelector('.wr-name').value.trim();
        const ings = [...ed.querySelectorAll('.wr-row')].map(r => [r.querySelector('.wr-k').value, +r.querySelector('.wr-a').value]).filter(x => x[1] > 0);
        if (name.length < 2 || !ings.length) { msg('Give the dish a name and at least one ingredient.', true); return; }
        apply(await rpc('wcq_teacher_approve', { p_suggestion_id: ed.dataset.ed === 'new' ? null : ed.dataset.ed, p_name: name, p_ings: ings }));
        msg('Added “' + name + '” to the recipe book.');
      }
    } catch (err) { msg(err.message, true); }
  });
  window.wrLoad = load;
  if (typeof teacherPass === 'function' && teacherPass()) load();
})();

// Circumpunct Book Studio — client.
// This file holds NO manuscript text and NO secrets. Everything is loaded after
// sign-in from the private backend, which checks the signed-in owner on the server.
// All manuscript/comment text is written to the page with textContent only.
(() => {
  'use strict';

  const CFG = window.BOOK_STUDIO_CONFIG || {};
  const CLASS_PROJECT_REF = 'gmeyamrlqfrabtslsweu';   // student-data project: must never be used here
  const $ = (id) => document.getElementById(id);
  const S = {
    sb: null, uid: null, title: 'Book Studio',
    chapters: [], current: null, paras: [],
    annotations: [], bookmarks: [], pending: [],
    tts: { idx: 0, playing: false, paused: false, token: 0 },
    lastActive: Date.now(),
  };

  // ------------------------------------------------------------ helpers
  function el(tag, props, ...kids) {
    const n = document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return n;
  }
  const fmtDate = (s) => new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  let toastTimer;
  function toast(msg, bad) {
    let t = $('toast');
    if (!t) { t = el('div', { id: 'toast', class: 'toast', role: 'status' }); document.body.append(t); }
    t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = 'toast'), bad ? 6000 : 3000);
  }
  function fail(e, fallback) { console.warn(e); toast((e && e.message) || fallback || 'Something went wrong', true); }
  function gateMsg(text, ok) { const m = $('gateMsg'); m.textContent = text || ''; m.classList.toggle('ok', !!ok); }
  function showOnly(formId) { $('loginForm').hidden = formId !== 'loginForm'; }

  // ------------------------------------------------------------ theme
  function applyTheme(t) { document.documentElement.dataset.theme = t || 'auto'; }
  applyTheme(store.get('bs-theme'));
  function toggleTheme() {
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    const cur = document.documentElement.dataset.theme;
    const isDark = cur === 'dark' || (cur === 'auto' && dark);
    const next = isDark ? 'light' : 'dark';
    applyTheme(next); store.set('bs-theme', next);
  }

  // ------------------------------------------------------------ dialog
  function dialog(title, body, buttons = []) {
    const d = $('dlg');
    $('dlgTitle').textContent = title;
    const b = $('dlgBody'); b.textContent = ''; b.append(...[].concat(body));
    const f = $('dlgFoot'); f.textContent = '';
    for (const btn of buttons) {
      f.append(el('button', { type: 'button', class: btn.cls || '', text: btn.label, onclick: async (ev) => {
        ev.target.disabled = true;
        try { const keep = await btn.onClick?.(); if (keep !== true) d.close(); }
        catch (e) { fail(e); }
        finally { ev.target.disabled = false; }
      } }));
    }
    if (!d.open) d.showModal();
  }
  const closeDialog = () => $('dlg').open && $('dlg').close();

  // ------------------------------------------------------------ auth
  async function init() {
    const url = String(CFG.supabaseUrl || ''), key = String(CFG.supabaseAnonKey || '');
    if (!url || !key || !window.supabase) {
      $('notConfigured').hidden = false;
      for (const i of $('loginForm').querySelectorAll('input,button')) i.disabled = true;
      return;
    }
    if (url.includes(CLASS_PROJECT_REF) || /service_role/.test(atobSafe(key.split('.')[1] || ''))) {
      $('notConfigured').hidden = false;
      $('notConfigured').textContent = 'Configuration refused: Book Studio must use its own dedicated project and a public (anon) key only.';
      for (const i of $('loginForm').querySelectorAll('input,button')) i.disabled = true;
      return;
    }
    S.sb = window.supabase.createClient(url, key, {
      auth: { storage: window.sessionStorage, storageKey: 'bs-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
    try { const m = sessionStorage.getItem('bs-msg'); if (m) { gateMsg(m); sessionStorage.removeItem('bs-msg'); } } catch { /* */ }
    S.sb.auth.onAuthStateChange((evt) => { if (evt === 'SIGNED_OUT') lock(); });
    const { data } = await S.sb.auth.getSession();
    if (data.session) await afterPassword(); else showOnly('loginForm');
  }
  function atobSafe(s) { try { return atob(s.replace(/-/g, '+').replace(/_/g, '/')); } catch { return ''; } }

  async function onLogin(ev) {
    ev.preventDefault(); gateMsg('');
    $('loginBtn').disabled = true;
    try {
      const { error } = await S.sb.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
      $('password').value = '';
      if (error) { gateMsg(error.status === 429 ? 'Too many attempts. Wait a few minutes and try again.' : 'Sign-in failed. Check your email and password.'); return; }
      await afterPassword();
    } finally { $('loginBtn').disabled = false; }
  }

  // Password-only sign-in (2FA step removed at the owner's request).
  async function afterPassword() { return enterStudio(); }

  async function enterStudio() {
    const { data: me, error } = await S.sb.rpc('bs_whoami');
    if (error || !me) { flash('Could not confirm sign-in. Please sign in again.'); return signOut(); }
    if (!me.owner_listed) { flash('This account is not authorized for the Book Studio.'); return S.sb.auth.signOut({ scope: 'local' }); }
    const { data: u } = await S.sb.auth.getUser();
    S.uid = u.user.id;
    $('gate').hidden = true; $('app').hidden = false;
    await loadAll();
  }

  function flash(msg) { try { sessionStorage.setItem('bs-msg', msg); } catch { /* */ } gateMsg(msg); }
  async function signOut() { try { await S.sb.auth.signOut(); } finally { lock(); } }
  function lock() {
    ttsStop();
    S.chapters = []; S.annotations = []; S.pending = []; S.bookmarks = [];
    $('reader').textContent = ''; $('commentList').textContent = '';
    location.replace(location.pathname);   // drop everything held in memory
  }

  // idle lock
  for (const evt of ['pointerdown', 'keydown', 'scroll', 'touchstart']) addEventListener(evt, () => (S.lastActive = Date.now()), { passive: true, capture: true });
  setInterval(() => {
    const mins = Number(CFG.idleLockMinutes) || 30;
    if (S.uid && !S.tts.playing && Date.now() - S.lastActive > mins * 60000) signOut();
  }, 30000);

  // ------------------------------------------------------------ data
  async function loadAll(keepChapterId) {
    const sb = S.sb;
    const [ms, ch, rs, bm, an, pr] = await Promise.all([
      sb.from('bs_manuscripts').select('title').order('created_at').limit(1).maybeSingle(),
      sb.from('bs_chapters').select('id,chapter_no,title,body,current_version_id,updated_at').order('chapter_no'),
      sb.from('bs_reading_state').select('chapter_id,scroll_pct').maybeSingle(),
      sb.from('bs_bookmarks').select('id,chapter_id,char_offset,label,created_at').order('created_at', { ascending: false }),
      sb.from('bs_annotations').select('*').order('start_offset'),
      sb.from('bs_proposals').select('id,chapter_id,base_version_id,proposed_title,proposed_body,rationale,author_label,created_at').eq('status', 'pending').order('created_at'),
    ]);
    const err = [ms, ch, rs, bm, an, pr].find((r) => r.error);
    if (err) return fail(err.error, 'Could not load the manuscript');

    S.title = ms.data?.title || 'Book Studio';
    $('bookTitle').textContent = S.title; document.title = 'Book Studio';
    S.chapters = ch.data || []; S.bookmarks = bm.data || []; S.annotations = an.data || []; S.pending = pr.data || [];
    $('proposalsBtn').textContent = S.pending.length ? `Proposals (${S.pending.length})` : 'Proposals';
    renderBookmarks();

    if (!S.chapters.length) {
      renderChapterList();
      const r = $('reader'); r.textContent = '';
      r.append(el('h2', { text: 'No manuscript yet' }),
        el('p', { text: 'Use ⋯ → “Import Word file…” to upload your master .docx. It goes straight into private, encrypted storage on the Book Studio server — never into the public website or GitHub.' }));
      return;
    }
    const wanted = keepChapterId || rs.data?.chapter_id;
    const target = S.chapters.find((c) => c.id === wanted) || S.chapters[0];
    openChapter(target, keepChapterId ? null : rs.data?.scroll_pct);
  }

  // ------------------------------------------------------------ reader
  function splitParas(body) {
    const out = []; let last = 0;
    const push = (s, e) => { if (body.slice(s, e).trim()) out.push({ start: s, text: body.slice(s, e) }); };
    for (const m of body.matchAll(/\n[ \t]*\n\s*/g)) { push(last, m.index); last = m.index + m[0].length; }
    push(last, body.length);
    return out;
  }

  function renderChapterList() {
    const ol = $('chapterList'); ol.textContent = '';
    for (const c of S.chapters) {
      ol.append(el('li', null, el('button', {
        'aria-current': S.current?.id === c.id ? 'true' : 'false',
        onclick: () => { openChapter(c, 0); $('nav').classList.remove('open'); },
      }, c.title, S.pending.some((p) => p.chapter_id === c.id) ? el('span', { class: 'pct', text: '✎' }) : null)));
    }
  }

  function openChapter(c, scrollPct) {
    ttsStop();
    S.current = c;
    S.paras = splitParas(c.body);
    const r = $('reader'); r.textContent = '';
    r.append(el('h2', { text: c.title }));
    const anns = S.annotations.filter((a) => a.chapter_id === c.id && a.version_id === c.current_version_id && !a.resolved);
    S.paras.forEach((p, i) => r.append(renderPara(p, i, anns)));
    renderChapterList(); renderComments();
    const idx = S.chapters.indexOf(c);
    $('progressLabel').textContent = `${idx + 1} of ${S.chapters.length}`;
    const wrap = document.querySelector('.reader-wrap');
    requestAnimationFrame(() => { wrap.scrollTop = scrollPct ? scrollPct * (wrap.scrollHeight - wrap.clientHeight) : 0; });
    saveProgress();
  }

  function renderPara(p, i, anns) {
    const node = el('p', { dataset: { start: p.start, idx: i } });
    const s0 = p.start, s1 = p.start + p.text.length;
    const hits = anns.filter((a) => a.end_offset > s0 && a.start_offset < s1);
    if (!hits.length) { node.textContent = p.text; return node; }
    const cuts = new Set([s0, s1]);
    for (const a of hits) { cuts.add(Math.max(s0, a.start_offset)); cuts.add(Math.min(s1, a.end_offset)); }
    const pts = [...cuts].sort((x, y) => x - y);
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1], text = p.text.slice(a - s0, b - s0);
      const on = hits.filter((h) => h.start_offset <= a && h.end_offset >= b);
      if (!on.length) node.append(document.createTextNode(text));
      else node.append(el('mark', { dataset: { ids: on.map((h) => h.id).join(',') }, onclick: () => focusComment(on[0].id), text }));
    }
    return node;
  }

  function step(delta) {
    const i = S.chapters.indexOf(S.current) + delta;
    if (S.chapters[i]) openChapter(S.chapters[i], 0);
  }

  let progTimer;
  function saveProgress() {
    clearTimeout(progTimer);
    progTimer = setTimeout(async () => {
      if (!S.current || !S.uid || !S.sb) return;
      const w = document.querySelector('.reader-wrap');
      const pct = Math.max(0, Math.min(1, w.scrollTop / Math.max(1, w.scrollHeight - w.clientHeight)));
      await S.sb.from('bs_reading_state').upsert({ user_id: S.uid, chapter_id: S.current.id, scroll_pct: pct, updated_at: new Date().toISOString() });
    }, 1500);
  }

  function firstVisibleParaIdx() {
    const w = document.querySelector('.reader-wrap'), top = w.getBoundingClientRect().top + 60;
    const ps = [...$('reader').querySelectorAll('p[data-idx]')];
    const p = ps.find((x) => x.getBoundingClientRect().bottom > top);
    return p ? Number(p.dataset.idx) : 0;
  }
  function scrollToOffset(off) {
    const ps = [...$('reader').querySelectorAll('p[data-start]')];
    const p = ps.reverse().find((x) => Number(x.dataset.start) <= off) || ps[ps.length - 1];
    p?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // ------------------------------------------------------------ bookmarks
  function renderBookmarks() {
    const ul = $('bookmarkList'); ul.textContent = '';
    if (!S.bookmarks.length) ul.append(el('li', { class: 'muted', text: 'None yet' }));
    for (const b of S.bookmarks) {
      const ch = S.chapters.find((c) => c.id === b.chapter_id);
      ul.append(el('li', null,
        el('button', { class: 'link', text: b.label || ch?.title || 'Bookmark', onclick: () => {
          if (ch) { if (S.current !== ch) openChapter(ch, 0); setTimeout(() => scrollToOffset(b.char_offset), 50); }
          $('nav').classList.remove('open');
        } }), ' ',
        el('button', { class: 'link', 'aria-label': 'Remove bookmark', text: '×', onclick: async () => {
          const { error } = await S.sb.from('bs_bookmarks').delete().eq('id', b.id);
          if (error) return fail(error);
          S.bookmarks = S.bookmarks.filter((x) => x !== b); renderBookmarks();
        } })));
    }
  }
  async function addBookmark() {
    if (!S.current) return;
    const p = S.paras[firstVisibleParaIdx()] || { start: 0, text: '' };
    const label = `${S.current.title} — “${p.text.trim().split(/\s+/).slice(0, 6).join(' ')}…”`;
    const { data, error } = await S.sb.from('bs_bookmarks').insert({ chapter_id: S.current.id, char_offset: p.start, label: label.slice(0, 200) }).select().single();
    if (error) return fail(error);
    S.bookmarks.unshift(data); renderBookmarks(); toast('Bookmarked');
  }

  // ------------------------------------------------------------ comments
  function renderComments() {
    const ul = $('commentList'); ul.textContent = '';
    const list = S.annotations.filter((a) => a.chapter_id === S.current?.id);
    if (!list.length) ul.append(el('li', { class: 'muted small', text: 'No comments on this chapter.' }));
    for (const a of list) {
      const old = a.version_id !== S.current.current_version_id;
      ul.append(el('li', { class: 'comment' + (a.resolved ? ' resolved' : ''), id: 'c-' + a.id },
        el('q', { text: a.quote.length > 220 ? a.quote.slice(0, 220) + '…' : a.quote }),
        el('div', { text: a.comment }),
        el('div', { class: 'small muted', text: fmtDate(a.updated_at) + (old ? ' · on an earlier version' : '') }),
        el('div', { class: 'row' },
          !old && !a.resolved ? el('button', { text: 'Show', onclick: () => scrollToOffset(a.start_offset) }) : null,
          el('button', { text: 'Edit', onclick: () => editComment(a) }),
          el('button', { text: a.resolved ? 'Reopen' : 'Resolve', onclick: () => updateComment(a, { resolved: !a.resolved }) }),
          el('button', { class: 'danger', text: 'Delete', onclick: () => {
            dialog('Delete comment?', el('p', { text: 'This removes the comment. A copy is kept in the edit log.' }), [
              { label: 'Cancel' },
              { label: 'Delete', cls: 'danger', onClick: async () => {
                const { error } = await S.sb.from('bs_annotations').delete().eq('id', a.id);
                if (error) throw error;
                S.annotations = S.annotations.filter((x) => x !== a); openChapterKeepScroll();
              } }]);
          } }))));
    }
  }
  function focusComment(id) {
    const li = $('c-' + id); if (!li) return;
    li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    li.animate([{ outline: '2px solid var(--accent)' }, { outline: '2px solid transparent' }], { duration: 1400 });
  }
  function openChapterKeepScroll() {
    const w = document.querySelector('.reader-wrap'), top = w.scrollTop;
    openChapter(S.current, null); requestAnimationFrame(() => (w.scrollTop = top));
  }
  async function updateComment(a, patch) {
    const { data, error } = await S.sb.from('bs_annotations').update(patch).eq('id', a.id).select().single();
    if (error) return fail(error);
    Object.assign(a, data); openChapterKeepScroll();
  }
  function editComment(a) {
    const ta = el('textarea', { rows: 6, class: 'short' }); ta.value = a.comment;
    dialog('Edit comment', [el('q', { class: 'small muted', text: a.quote }), ta], [
      { label: 'Cancel' },
      { label: 'Save', cls: 'primary', onClick: async () => { if (ta.value.trim()) await updateComment(a, { comment: ta.value.trim() }); } }]);
  }

  // selection -> comment button
  let pendingSel = null;
  function selectionOffsets() {
    const sel = getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !S.current) return null;
    const range = sel.getRangeAt(0);
    const pa = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement)?.closest('p[data-start]');
    const pb = (range.endContainer.nodeType === 1 ? range.endContainer : range.endContainer.parentElement)?.closest('p[data-start]');
    if (!pa || !pb || !$('reader').contains(pa)) return null;
    const off = (p, node, o) => { const r = document.createRange(); r.setStart(p, 0); r.setEnd(node, o); return Number(p.dataset.start) + r.toString().length; };
    const start = off(pa, range.startContainer, range.startOffset), end = off(pb, range.endContainer, range.endOffset);
    if (end <= start) return null;
    return { start, end, rect: range.getBoundingClientRect() };
  }
  function onSelection() {
    const fab = $('commentFab');
    const s = selectionOffsets();
    pendingSel = s;
    if (!s) { fab.hidden = true; return; }
    fab.hidden = false;
    const x = Math.min(innerWidth - 140, Math.max(16, s.rect.left + s.rect.width / 2 - 60));
    const y = s.rect.bottom + 10 > innerHeight - 50 ? s.rect.top - 48 : s.rect.bottom + 10;
    fab.style.left = x + 'px'; fab.style.top = y + 'px';
  }
  let selTimer;
  document.addEventListener('selectionchange', () => { clearTimeout(selTimer); selTimer = setTimeout(onSelection, 180); });

  function newComment() {
    const s = pendingSel; if (!s || !S.current) return;
    const quote = S.current.body.slice(s.start, s.end).slice(0, 5000);
    const ta = el('textarea', { rows: 6, class: 'short', placeholder: 'Private editorial note…' });
    dialog('Comment', [el('q', { class: 'small muted', text: quote.length > 400 ? quote.slice(0, 400) + '…' : quote }), ta], [
      { label: 'Cancel' },
      { label: 'Save comment', cls: 'primary', onClick: async () => {
        if (!ta.value.trim()) return true;
        const { data, error } = await S.sb.from('bs_annotations').insert({
          chapter_id: S.current.id, version_id: S.current.current_version_id,
          start_offset: s.start, end_offset: s.end, quote, comment: ta.value.trim(),
        }).select().single();
        if (error) throw error;
        S.annotations.push(data); getSelection().removeAllRanges(); $('commentFab').hidden = true;
        openChapterKeepScroll(); toast('Comment saved');
      } }]);
    setTimeout(() => ta.focus(), 50);
  }

  // ------------------------------------------------------------ proposals
  function proposeEdit() {
    const c = S.current; if (!c) return;
    const t = el('input', { 'aria-label': 'Chapter title' }); t.value = c.title;
    const ta = el('textarea', { 'aria-label': 'Chapter text' }); ta.value = c.body;
    const why = el('input', { placeholder: 'What changed and why (optional)', maxlength: 500 });
    dialog('Propose an edit — ' + c.title, [
      el('p', { class: 'small muted', text: 'Proposals never change the text by themselves. You review the differences and approve them first.' }),
      t, ta, why,
    ], [
      { label: 'Cancel' },
      { label: 'Save proposal', cls: 'primary', onClick: async () => {
        if (ta.value === c.body && t.value === c.title) { toast('No changes to propose'); return true; }
        const { error } = await S.sb.from('bs_proposals').insert({
          chapter_id: c.id, base_version_id: c.current_version_id,
          proposed_title: t.value.trim() || c.title, proposed_body: ta.value, rationale: why.value.trim() || null, author_label: 'owner',
        });
        if (error) throw error;
        toast('Saved as a proposal'); await loadAll(c.id);
      } }]);
  }

  function showProposals() {
    if (!S.pending.length) return dialog('Proposals', el('p', { class: 'muted', text: 'Nothing waiting for review.' }), [{ label: 'Close' }]);
    const list = el('ul', { class: 'list' });
    for (const p of S.pending) {
      const ch = S.chapters.find((c) => c.id === p.chapter_id);
      const stale = ch && ch.current_version_id !== p.base_version_id;
      list.append(el('li', null,
        el('div', { class: 'grow' },
          el('strong', { text: ch?.title || 'Chapter' }), ' ',
          el('span', { class: 'tag', text: p.author_label }), stale ? el('span', { class: 'tag', text: 'out of date' }) : null,
          el('div', { class: 'small muted', text: fmtDate(p.created_at) + (p.rationale ? ' · ' + p.rationale : '') })),
        el('button', { text: 'Review', onclick: () => reviewProposal(p) })));
    }
    dialog(`Proposals (${S.pending.length})`, list, [{ label: 'Close' }]);
  }

  function reviewProposal(p) {
    const ch = S.chapters.find((c) => c.id === p.chapter_id);
    const stale = ch.current_version_id !== p.base_version_id;
    const box = el('div');
    const n = window.StudioDiff.render(box, ch.body, p.proposed_body);
    const parts = [];
    if (stale) parts.push(el('div', { class: 'notice', text: 'This proposal was written against an older version of the chapter, so it can’t be approved as-is. Reject it, or copy what you like into a fresh proposal.' }));
    if (p.proposed_title !== ch.title) { const tb = el('div'); window.StudioDiff.render(tb, ch.title, p.proposed_title); parts.push(el('div', { class: 'small muted', text: 'Title' }), tb); }
    parts.push(el('div', { class: 'small muted', text: `${n} change${n === 1 ? '' : 's'} · green = added, red = removed` }), box);
    dialog('Review — ' + ch.title, parts, [
      { label: 'Back', onClick: () => { showProposals(); return true; } },
      { label: 'Reject', cls: 'danger', onClick: async () => {
        const { error } = await S.sb.rpc('bs_reject_proposal', { p_proposal: p.id }); if (error) throw error;
        toast('Proposal rejected'); await loadAll(S.current?.id);
      } },
      stale ? null : { label: 'Approve & replace text', cls: 'primary', onClick: async () => {
        const { error } = await S.sb.rpc('bs_approve_proposal', { p_proposal: p.id }); if (error) throw error;
        toast('Approved — new version saved'); await loadAll(ch.id);
      } },
    ].filter(Boolean));
  }

  // ------------------------------------------------------------ history
  async function showHistory() {
    const c = S.current; if (!c) return;
    const { data, error } = await S.sb.from('bs_chapter_versions').select('id,version_no,source,note,created_at').eq('chapter_id', c.id).order('version_no', { ascending: false });
    if (error) return fail(error);
    const list = el('ul', { class: 'list' });
    for (const v of data) {
      const isCur = v.id === c.current_version_id;
      list.append(el('li', null,
        el('div', { class: 'grow' }, el('strong', { text: 'Version ' + v.version_no }), ' ', el('span', { class: 'tag', text: v.source.replace('_', ' ') }),
          isCur ? el('span', { class: 'tag', text: 'current' }) : null,
          el('div', { class: 'small muted', text: fmtDate(v.created_at) + (v.note ? ' · ' + v.note : '') })),
        isCur ? null : el('button', { text: 'Compare', onclick: () => compareVersion(v) })));
    }
    dialog('History — ' + c.title, [el('p', { class: 'small muted', text: 'Every version is kept permanently. Restoring copies an old version forward as a new one.' }), list], [{ label: 'Close' }]);
  }
  async function compareVersion(v) {
    const c = S.current;
    const { data, error } = await S.sb.from('bs_chapter_versions').select('body').eq('id', v.id).single();
    if (error) return fail(error);
    const box = el('div'); const n = window.StudioDiff.render(box, data.body, c.body);
    dialog(`Version ${v.version_no} → current`, [el('div', { class: 'small muted', text: `${n} change${n === 1 ? '' : 's'} since version ${v.version_no} · green = added since, red = removed since` }), box], [
      { label: 'Back', onClick: () => { showHistory(); return true; } },
      { label: `Restore version ${v.version_no}`, cls: 'primary', onClick: async () => {
        const { error: e2 } = await S.sb.rpc('bs_rollback_chapter', { p_chapter: c.id, p_to_version: v.id }); if (e2) throw e2;
        toast(`Restored version ${v.version_no} as a new version`); await loadAll(c.id);
      } }]);
  }

  // ------------------------------------------------------------ masters, import, export, audit
  async function callFunction(name, body) {
    const { data: s } = await S.sb.auth.getSession();
    const res = await fetch(`${CFG.supabaseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${s.session?.access_token}`, apikey: CFG.supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) { let m = res.statusText; try { m = (await res.json()).error || m; } catch { /* */ } throw new Error(m); }
    return res;
  }
  function download(blob, name) {
    const a = el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function exportDocx(source = 'current') {
    toast('Building Word file…');
    try {
      const res = await callFunction('export-docx', { source });
      const cd = res.headers.get('Content-Disposition') || '';
      download(await res.blob(), (cd.match(/filename="([^"]+)"/) || [])[1] || 'manuscript.docx');
    } catch (e) { fail(e); }
  }
  function exportMd() {
    if (!S.chapters.length) return toast('Nothing to export yet', true);
    const md = ['# ' + S.title, '', ...S.chapters.flatMap((c) => ['## ' + c.title, '', c.body, ''])].join('\n');
    download(new Blob([md], { type: 'text/markdown' }), `${S.title.replace(/[^A-Za-z0-9]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.md`);
  }
  async function showMasters() {
    const { data, error } = await S.sb.from('bs_masters').select('id,label,master_date,source_filename,word_count,created_at').order('created_at', { ascending: false });
    if (error) return fail(error);
    const list = el('ul', { class: 'list' });
    if (!data.length) list.append(el('li', { class: 'muted', text: 'No masters yet. Import your Word file to create the first one.' }));
    for (const m of data) list.append(el('li', null,
      el('div', { class: 'grow' }, el('strong', { text: m.label }), el('div', { class: 'small muted', text: `${m.master_date} · ${m.word_count?.toLocaleString() ?? '?'} words · ${m.source_filename || ''}` })),
      el('button', { text: 'Download .docx', onclick: () => exportDocx(m.id) })));
    dialog('Dated masters (permanent, never edited)', list, [{ label: 'Close' }]);
  }
  function pickImport() { $('fileInput').value = ''; $('fileInput').click(); }
  function onFilePicked() {
    const file = $('fileInput').files[0]; if (!file) return;
    if (!/\.docx$/i.test(file.name)) return toast('Please choose a .docx Word file', true);
    if (file.size > 25 * 1024 * 1024) return toast('That file is over 25 MB', true);
    const guess = (file.name.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || new Date().toISOString().slice(0, 10);
    const label = el('input'); label.value = file.name.replace(/\.docx$/i, '').replace(/_/g, ' ');
    const date = el('input', { type: 'date' }); date.value = guess;
    const first = !S.chapters.length;
    dialog('Import Word file', [
      el('p', { text: `“${file.name}” (${(file.size / 1024).toFixed(0)} KB) will be uploaded to private storage and saved as a permanent dated master.` }),
      el('p', { class: 'small muted', text: first ? 'This first import sets up your chapters.' : 'Your current text will NOT be overwritten — any chapter that differs becomes a proposal for you to review.' }),
      el('label', { class: 'stack' }, 'Master label', label), el('label', { class: 'stack' }, 'Master date', date),
    ], [
      { label: 'Cancel' },
      { label: 'Upload securely', cls: 'primary', onClick: async () => {
        const safe = file.name.replace(/[^A-Za-z0-9._ -]+/g, '_').slice(-150);
        const path = `uploads/${new Date().toISOString().replace(/[:.]/g, '-')}_${safe}`;
        toast('Uploading…');
        const { error: upErr } = await S.sb.storage.from('bs-manuscripts').upload(path, file, { upsert: false, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        if (upErr) throw upErr;
        const res = await callFunction('import-docx', { storage_path: path, label: label.value.trim(), master_date: date.value, title: S.chapters.length ? S.title : 'The Circumpunct' });
        const r = await res.json();
        toast(`Imported ${r.chapters} sections · ${r.words?.toLocaleString()} words · ${r.seeded} new, ${r.proposed} proposed, ${r.unchanged} unchanged`);
        await loadAll(S.current?.id);
      } }]);
  }
  async function showAudit() {
    const { data, error } = await S.sb.from('bs_audit_log').select('at,action,entity,detail').order('id', { ascending: false }).limit(150);
    if (error) return fail(error);
    const list = el('ul', { class: 'list' });
    if (!data.length) list.append(el('li', { class: 'muted', text: 'No edits yet.' }));
    for (const a of data) {
      const d = { ...a.detail }; for (const k of ['old_comment', 'new_comment', 'comment', 'quote']) if (d[k]) d[k] = String(d[k]).slice(0, 60) + (String(d[k]).length > 60 ? '…' : '');
      list.append(el('li', null, el('div', { class: 'grow' }, el('strong', { text: a.action.replace(/_/g, ' ') }), el('div', { class: 'small muted', text: fmtDate(a.at) + ' · ' + JSON.stringify(d) }))));
    }
    dialog('Edit log', list, [{ label: 'Close' }]);
  }

  // ------------------------------------------------------------ text-to-speech
  const synth = window.speechSynthesis;
  function loadVoices() {
    if (!synth) { document.querySelector('.tts').hidden = true; return; }
    const sel = $('ttsVoice'), saved = store.get('bs-voice');
    const voices = synth.getVoices().filter((v) => /^en/i.test(v.lang)).concat(synth.getVoices().filter((v) => !/^en/i.test(v.lang)));
    sel.textContent = '';
    for (const v of voices) sel.append(el('option', { value: v.name, text: `${v.name} (${v.lang})`, selected: v.name === saved }));
    sel.hidden = !voices.length;
  }
  function ttsUtter(i) {
    const p = S.paras[i];
    const u = new SpeechSynthesisUtterance(p.text.replace(/\s+/g, ' '));
    const v = synth.getVoices().find((x) => x.name === $('ttsVoice').value); if (v) u.voice = v;
    u.rate = Number($('ttsRate').value) || 1;
    return u;
  }
  function markSpeaking(i) {
    for (const n of $('reader').querySelectorAll('p.speaking')) n.classList.remove('speaking');
    const n = $('reader').querySelector(`p[data-idx="${i}"]`);
    if (n) { n.classList.add('speaking'); const r = n.getBoundingClientRect(); if (r.top < 80 || r.bottom > innerHeight - 20) n.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }
  function ttsSpeakFrom(i) {
    if (!synth || !S.paras.length) return;
    if (i < 0) i = 0;
    if (i >= S.paras.length) return ttsStop();
    const token = ++S.tts.token;
    synth.cancel();
    Object.assign(S.tts, { idx: i, playing: true, paused: false });
    $('ttsPlay').textContent = '⏸'; $('ttsPlay').setAttribute('aria-label', 'Pause');
    markSpeaking(i);
    const u = ttsUtter(i);
    u.onend = () => { if (token === S.tts.token && S.tts.playing && !S.tts.paused) ttsSpeakFrom(i + 1); };
    synth.speak(u);
  }
  function ttsPlayPause() {
    if (!synth) return;
    if (S.tts.playing && !S.tts.paused) { synth.pause(); S.tts.paused = true; $('ttsPlay').textContent = '▶'; $('ttsPlay').setAttribute('aria-label', 'Resume'); return; }
    if (S.tts.paused) { synth.resume(); S.tts.paused = false; $('ttsPlay').textContent = '⏸'; $('ttsPlay').setAttribute('aria-label', 'Pause'); return; }
    ttsSpeakFrom(firstVisibleParaIdx());
  }
  function ttsStop() {
    if (!synth) return;
    S.tts.token++; Object.assign(S.tts, { playing: false, paused: false }); synth.cancel();
    $('ttsPlay').textContent = '▶'; $('ttsPlay').setAttribute('aria-label', 'Play');
    for (const n of $('reader').querySelectorAll('p.speaking')) n.classList.remove('speaking');
  }
  function ttsSkip(d) {
    const i = S.tts.idx + d;
    if (S.tts.playing) ttsSpeakFrom(i); else { S.tts.idx = Math.max(0, Math.min(S.paras.length - 1, i)); markSpeaking(S.tts.idx); }
  }

  // ------------------------------------------------------------ wiring
  const ACTIONS = {
    signout: signOut, theme: toggleTheme,
    'toggle-nav': () => $('nav').classList.toggle('open'),
    'prev-chapter': () => step(-1), 'next-chapter': () => step(1),
    bookmark: addBookmark, propose: proposeEdit, history: showHistory, proposals: showProposals,
    'export-docx': () => exportDocx('current'), 'export-md': exportMd,
    'show-masters': showMasters, 'import-docx': pickImport, 'show-audit': showAudit,
    'tts-play': ttsPlayPause, 'tts-stop': ttsStop, 'tts-prev': () => ttsSkip(-1), 'tts-next': () => ttsSkip(1),
  };
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-action]'); if (!b) return;
    const fn = ACTIONS[b.dataset.action]; if (!fn) return;
    ev.preventDefault();
    b.closest('details')?.removeAttribute('open');
    Promise.resolve(fn()).catch((e) => fail(e));
  });
  $('loginForm').addEventListener('submit', onLogin);
  $('commentFab').addEventListener('mousedown', (e) => e.preventDefault());   // keep the selection
  $('commentFab').addEventListener('click', newComment);
  $('fileInput').addEventListener('change', onFilePicked);
  document.querySelector('.reader-wrap').addEventListener('scroll', saveProgress, { passive: true });
  $('ttsVoice').addEventListener('change', () => { store.set('bs-voice', $('ttsVoice').value); if (S.tts.playing) ttsSpeakFrom(S.tts.idx); });
  $('ttsRate').addEventListener('change', () => { if (S.tts.playing) ttsSpeakFrom(S.tts.idx); });
  if (synth) { loadVoices(); synth.onvoiceschanged = loadVoices; }
  addEventListener('keydown', (e) => {
    if (e.target.closest('input,textarea,select,dialog')) return;
    if (e.key === 'ArrowRight' && e.altKey) step(1);
    if (e.key === 'ArrowLeft' && e.altKey) step(-1);
  });
  addEventListener('pagehide', () => synth && synth.cancel());

  init().catch((e) => { console.warn(e); gateMsg('Could not start the Book Studio.'); });

  // Local-only demo hook for automated UI tests and screenshots (synthetic text only).
  // Not available on doppsclass.com.
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]demo=1\b/.test(location.search)) {
    window.__studioDemo = (title, chapters, annotations = []) => {
      S.title = title; S.chapters = chapters; S.annotations = annotations; S.pending = []; S.bookmarks = [];
      $('bookTitle').textContent = title; $('gate').hidden = true; $('app').hidden = false;
      renderBookmarks(); openChapter(chapters[0], 0);
    };
  }
})();

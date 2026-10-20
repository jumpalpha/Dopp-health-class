/*
 * arcade_quiz.js — a quick health-vocab question between arcade rounds.
 * Used by arcade_kit.js (all solo Sprite arcade games except Vocab Slice and How Smart Am I?).
 *
 *  • After every 1–6 finished rounds (random, counted across ALL games on this device), the
 *    "Play again" step shows one question first. Questions come from chapters 1–28 vocab.
 *  • Right or wrong, the student can keep playing. Wrong → they see the right answer and its
 *    definition, and the "Got it — play again" button unlocks after 3 seconds.
 *  • Right answer + signed in → feeds their Wellness Sprite one chapter-question snack
 *    (same daily limit as the Sprite page). Never gives XP.
 */
(function () {
  if (window.ArcadeQuiz) return;
  const KEY = 'arcade_quiz_state';
  const MIN = 1, MAX = 6, WAIT_MS = 3000;
  const rnd = n => Math.floor(Math.random() * n);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.target && s.target <= MAX) return s; } catch (e) {}
    return { rounds: 0, target: MIN + rnd(MAX - MIN + 1) };
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }

  // load the vocab bank once (also cached for offline by the web app)
  let bankP = null;
  function bank() {
    if (window.PET_VOCAB) return Promise.resolve(window.PET_VOCAB);
    if (bankP) return bankP;
    bankP = new Promise(res => {
      const s = document.createElement('script'); s.src = 'pet_vocab.js';
      s.onload = () => res(window.PET_VOCAB || null); s.onerror = () => res(null);
      document.head.appendChild(s);
    });
    return bankP;
  }
  bank();

  function makeQuestion(V) {
    const chs = Object.keys(V).filter(k => V[k].terms && V[k].terms.length >= 4);
    const ch = chs[rnd(chs.length)], terms = V[ch].terms;
    const pick = terms[rnd(terms.length)];
    const others = shuffle(terms.filter(t => t[0] !== pick[0])).slice(0, 3);
    const reverse = Math.random() < 0.3;                         // sometimes: term → pick the definition
    const re = new RegExp(pick[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
    return {
      ch, title: V[ch].title, term: pick[0], def: pick[1], reverse,
      prompt: reverse ? pick[0] : pick[1].replace(re, '_____'),
      options: shuffle([pick, ...others]).map(t => ({ text: reverse ? t[1] : t[0], right: t[0] === pick[0] }))
    };
  }

  const CSS = `.aq-q{font-size:14.5px;line-height:1.35;background:rgba(255,255,255,.07);border-left:4px solid #38BFFF;border-radius:10px;padding:8px 10px;margin:8px 0;text-align:left}
.aq-tag{font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#FFD700;opacity:.9}
.aq-opts{display:grid;gap:6px;margin-top:4px}
.aq-opt{padding:8px 11px;border:2px solid rgba(255,255,255,.18);border-radius:11px;background:rgba(255,255,255,.06);color:#f4efff;font:800 14px Nunito,sans-serif;text-align:left;cursor:pointer;line-height:1.3}
.aq-opt:hover{border-color:#FFD700}.aq-opt.ok{background:#0b6b4c;border-color:#3ff0b5}.aq-opt.bad{background:#7a1830;border-color:#FF3B5C}.aq-opt:disabled{cursor:default}
.aq-fb{margin-top:8px;font-size:14px;line-height:1.45;text-align:left}.aq-fb b{color:#FFD700}
.aq-pet{margin-top:6px;font-size:13px;opacity:.9}
.aq-card .ak-play{margin-top:8px;padding:11px;font-size:18px}.ak-play:disabled{filter:grayscale(.7);opacity:.6;cursor:wait}`;
  function css() { if (document.getElementById('aq-css')) return; const s = document.createElement('style'); s.id = 'aq-css'; s.textContent = CSS; document.head.appendChild(s); }

  async function feedSprite(net, el) {
    const ses = net && net.session && net.session();
    if (!ses) return;
    try {
      const p = await net.rpc('pet_action', { p_student_id: ses.id, p_pin_hash: ses.pin, p_trimester: net.TRIMESTER, p_action: 'quiz' });
      el.textContent = (p && p.alive === false ? '✨ A spark of life for your sprite!' : '🌱 ' + ((p && p.name) || 'Your sprite') + ' munched that answer!') + ' +1 💡 Knowledge';
    } catch (e) {
      if (!/limit/i.test(e.message)) { el.textContent = ''; return; }
      try {   // sprite is full: the answer still earns Knowledge for the Sprite Shop
        await net.rpc('pet_action', { p_student_id: ses.id, p_pin_hash: ses.pin, p_trimester: net.TRIMESTER, p_action: 'study' });
        el.textContent = '💡 +1 Knowledge for the Sprite Shop!';
      } catch (e2) { el.textContent = '🌱 You hit today\'s Knowledge limit. Great studying!'; }
    }
  }

  window.ArcadeQuiz = {
    // call once per finished round
    roundDone() { const s = load(); s.rounds++; save(s); },
    due() { const s = load(); return s.rounds >= s.target; },
    // show a question inside the game-over overlay; onDone() starts the next round
    async show(overEl, net, onDone) {
      css();
      const V = await bank();
      const s = load(); s.rounds = 0; s.target = MIN + rnd(MAX - MIN + 1); save(s);   // reset either way
      if (!V) return onDone();                                                       // no questions available: never block play
      const q = makeQuestion(V);
      overEl.innerHTML = `<div class="ak-card aq-card">
        <div class="aq-tag">🧠 Quick question · Ch ${esc(q.ch)} ${esc(q.title)}</div>
        <div class="aq-q">${q.reverse ? 'What does <b>' + esc(q.prompt) + '</b> mean?' : esc(q.prompt)}</div>
        <div class="aq-opts">${q.options.map((o, i) => `<button class="aq-opt" data-i="${i}">${esc(o.text)}</button>`).join('')}</div>
        <div class="aq-fb"></div><div class="aq-pet"></div>
        <button class="ak-play" style="display:none">↻ Play again</button></div>`;
      overEl.classList.remove('hidden');
      const fb = overEl.querySelector('.aq-fb'), pet = overEl.querySelector('.aq-pet'), go = overEl.querySelector('.ak-play');
      overEl.querySelectorAll('.aq-opt').forEach(b => b.onclick = e => {
        e.stopPropagation();
        const o = q.options[+b.dataset.i];
        overEl.querySelectorAll('.aq-opt').forEach((x, i) => { x.disabled = true; if (q.options[i].right) x.classList.add('ok'); });
        go.style.display = '';
        setTimeout(() => go.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50);
        if (o.right) {
          b.classList.add('ok');
          fb.innerHTML = '✅ <b>Nice!</b>' + (q.reverse ? '' : ' It\'s <b>' + esc(q.term) + '</b>.');
          go.textContent = '↻ Play again';
          feedSprite(net, pet);
        } else {
          b.classList.add('bad');
          fb.innerHTML = q.reverse ? '❌ Not quite. <b>' + esc(q.term) + '</b> means: ' + esc(q.def)
                                   : '❌ Not quite. The answer is <b>' + esc(q.term) + '</b> (shown in green).';
          go.disabled = true;
          let left = Math.ceil(WAIT_MS / 1000);
          go.textContent = 'Read it… ' + left;
          const t = setInterval(() => {
            left--;
            if (left <= 0) { clearInterval(t); go.disabled = false; go.textContent = '👍 Got it — play again'; }
            else go.textContent = 'Read it… ' + left;
          }, 1000);
        }
      });
      go.onclick = e => { e.stopPropagation(); if (!go.disabled) onDone(); };
    },
    _makeQuestion: makeQuestion
  };
})();

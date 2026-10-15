// arcade_kit.js — shared engine for the Wellness Sprite arcade games.
// Needs pet_sprite.js loaded first. Usage:
//   const A = Arcade({ mount, title, W, H, storageKey, medals, winAt, facts, howTo, controls,
//                      reset(), update(dt), draw(ctx), input(type) });
// In update/draw use A.ctx, A.W, A.H, A.particles, A.shake(), A.float(), A.sfx(), A.drawHero().
(function () {
  const INK = '#1A1030';

  // ---------- class leaderboard (Supabase) ----------
  // Signed-in students (Quest page or Visitor page, same browser tab) post their result automatically.
  const NET = {
    URL: 'https://gmeyamrlqfrabtslsweu.supabase.co', KEY: 'sb_publishable_zClDCZZQEfC9DILpesPiHg_IcyRqW-c', TRIMESTER: ((window.TERM && TERM.id) || '2026-T1'),
    session() {
      try {
        const id = localStorage.getItem('qSID_' + NET.TRIMESTER), pin = sessionStorage.getItem('qPIN_' + NET.TRIMESTER);
        return id && pin ? { id, pin } : null;
      } catch (e) { return null; }
    },
    async rpc(name, args) {
      let r;
      try { r = await fetch(NET.URL + '/rest/v1/rpc/' + name, { method: 'POST', headers: { apikey: NET.KEY, Authorization: 'Bearer ' + NET.KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) }); }
      catch (e) { const err = new Error('offline'); err.offline = true; throw err; }
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error((j && j.message) || ('HTTP ' + r.status));
      return j;
    }
  };
  // Offline scores: if a result can't reach the server (no internet), keep the best one per game
  // on this device and post it the next time the site is online.
  const QKEY = 'dopp_score_queue';
  function readQ() { try { return JSON.parse(localStorage.getItem(QKEY) || '{}'); } catch (e) { return {}; } }
  function writeQ(q) { try { Object.keys(q).length ? localStorage.setItem(QKEY, JSON.stringify(q)) : localStorage.removeItem(QKEY); } catch (e) {} }
  NET.queue = function (args) {
    const q = readQ(), k = args.p_student_id + '|' + args.p_trimester + '|' + args.p_game, old = q[k];
    q[k] = old ? Object.assign({}, old, { p_score: Math.max(old.p_score, args.p_score), p_won: old.p_won || args.p_won, p_pin_hash: args.p_pin_hash }) : args;
    writeQ(q);
  };
  NET.queued = () => Object.keys(readQ()).length;
  let flushing = false;
  NET.flush = async function () {
    if (flushing || !navigator.onLine) return; flushing = true;
    try {
      for (const k of Object.keys(readQ())) {
        const args = readQ()[k]; if (!args) continue;
        try { await NET.rpc('arcade_submit', args); }
        catch (e) { if (e.offline) break; if (/too fast/.test(e.message)) { await new Promise(r => setTimeout(r, 3500)); continue; } }
        const q = readQ(); delete q[k]; writeQ(q);               // posted, or the server said no for good
        await new Promise(r => setTimeout(r, 400));
      }
    } finally { flushing = false; }
  };
  window.addEventListener('online', () => NET.flush());
  setTimeout(() => NET.flush(), 1500);
  window.ArcadeNet = NET;

  function Arcade(cfg) {
    const A = { W: cfg.W, H: cfg.H, state: 'menu', score: 0, time: 0, won: false, muted: false };
    // learning check between rounds (arcade_quiz.js); quiz games themselves are skipped
    const QUIZ = cfg.quiz !== false && ['vocab_slice', 'how_smart', 'immune_defense', 'sprite_siege'].indexOf(cfg.storageKey) === -1;
    if (QUIZ && !window.ArcadeQuiz && !document.querySelector('script[src="arcade_quiz.js"]')) {
      const qs = document.createElement('script'); qs.src = 'arcade_quiz.js'; document.head.appendChild(qs);
    }
    const store = {
      get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
      set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    };
    A.color = store.get('arcade_sprite_color', 'emerald');
    A.muted = store.get('arcade_muted', false);
    A.best = store.get(cfg.storageKey + '_best', 0);

    // ---------- DOM ----------
    const root = typeof cfg.mount === 'string' ? document.querySelector(cfg.mount) : cfg.mount;
    root.classList.add('ak-root');
    root.innerHTML =
      '<div class="ak-stage">' +
        '<canvas class="ak-canvas" aria-label="' + cfg.title + ' game"></canvas>' +
        '<div class="ak-hud"><div class="ak-score">0</div></div>' +
        '<button class="ak-btn-icon ak-mute" aria-label="Sound on or off"></button>' +
        '<button class="ak-btn-icon ak-pause" aria-label="Pause">❚❚</button>' +
        '<div class="ak-toast" aria-live="polite"></div>' +
        '<div class="ak-ov ak-menu"></div>' +
        '<div class="ak-ov ak-over hidden"></div>' +
        '<div class="ak-ov ak-paused hidden"><div class="ak-card"><div class="ak-title">Paused</div><button class="ak-play">▶ Resume</button></div></div>' +
      '</div>';
    const stage = root.querySelector('.ak-stage');
    const canvas = root.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    A.ctx = ctx; A.canvas = canvas;
    const scoreEl = root.querySelector('.ak-score');
    const menu = root.querySelector('.ak-menu'), over = root.querySelector('.ak-over'), paused = root.querySelector('.ak-paused');
    const toastEl = root.querySelector('.ak-toast');
    const muteBtn = root.querySelector('.ak-mute'), pauseBtn = root.querySelector('.ak-pause');

    // ---------- sizing: fixed logical size, crisp on any screen ----------
    let scale = 1;
    function resize() {
      const maxW = root.clientWidth || window.innerWidth;
      const padH = cfg.pad && (cfg.padAlways || matchMedia('(hover:none)').matches) ? 74 : 0;
      const maxH = Math.max(320, window.innerHeight - (cfg.reserveH || 150) - padH);
      scale = Math.min(maxW / A.W, maxH / A.H);
      const cw = Math.floor(A.W * scale), ch = Math.floor(A.H * scale);
      stage.style.width = cw + 'px'; stage.style.height = ch + 'px';
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(cw * dpr); canvas.height = Math.floor(ch * dpr);
      canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      ctx.imageSmoothingQuality = 'high';
    }
    window.addEventListener('resize', resize);

    // ---------- hero sprite images (from the Wellness Sprite art) ----------
    const heroImgs = {};
    function buildHero() {
      ['happy', 'sugar', 'ghost', 'tired'].forEach(m => {
        const svg = window.petSpriteSVG({ color: A.color, stage: 'child', mood_label: m, alive: m !== 'ghost' }, { tight: true });
        const img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        heroImgs[m] = img;
      });
    }
    A.drawHero = function (x, y, size, rot, mood) {
      const img = heroImgs[mood || 'happy'];
      if (!img || !img.complete) return;
      ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
    };

    // ---------- effects ----------
    const parts = [];
    A.particles = {
      burst(x, y, color, n, speed, size) {
        for (let i = 0; i < (n || 12); i++) {
          const a = Math.random() * Math.PI * 2, s = (speed || 160) * (0.4 + Math.random());
          parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0.6 + Math.random() * 0.4, t: 0, c: color, r: (size || 4) * (0.6 + Math.random() * 0.8) });
        }
      },
      trail(x, y, color) { parts.push({ x, y, vx: -60 - Math.random() * 40, vy: (Math.random() - 0.5) * 30, life: 0.4, t: 0, c: color, r: 2 + Math.random() * 2 }); }
    };
    const floats = [];
    A.float = (text, x, y, color) => floats.push({ text, x, y, t: 0, c: color || '#FFD700' });
    let shakeT = 0, shakeA = 0;
    A.shake = (amt, dur) => { shakeA = amt || 8; shakeT = dur || 0.3; };
    let flashT = 0; A.flash = d => { flashT = d || 0.15; };

    // ---------- sound (tiny synth, no files) ----------
    let ac = null;
    function tone(f, d, type, vol, slide) {
      if (A.muted) return;
      try {
        ac = ac || new (window.AudioContext || window.webkitAudioContext)();
        const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
        o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
        g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d);
      } catch (e) {}
    }
    A.sfx = name => {
      switch (name) {
        case 'flap': tone(420, 0.09, 'triangle', 0.07, 760); break;
        case 'jump': tone(300, 0.16, 'square', 0.05, 640); break;
        case 'coin': tone(880, 0.07, 'square', 0.05); setTimeout(() => tone(1320, 0.1, 'square', 0.05), 60); break;
        case 'point': tone(660, 0.06, 'triangle', 0.06); break;
        case 'swipe': tone(500, 0.07, 'sine', 0.06, 300); break;
        case 'hit': tone(160, 0.35, 'sawtooth', 0.12, 40); break;
        case 'win': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.08), i * 110)); break;
        case 'medal': [784, 988].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'triangle', 0.07), i * 90)); break;
      }
    };
    function drawMute() { muteBtn.textContent = A.muted ? '🔇' : '🔊'; }
    muteBtn.onclick = e => { e.stopPropagation(); A.muted = !A.muted; store.set('arcade_muted', A.muted); drawMute(); };

    // ---------- toast ----------
    let toastTimer;
    A.toast = (html, ms) => {
      toastEl.innerHTML = html; toastEl.classList.add('show');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms || 1800);
    };

    // ---------- medals ----------
    const medals = cfg.medals || [];
    function medalFor(s) { let m = null; medals.forEach(x => { if (s >= x.at) m = x; }); return m; }
    let lastMedal = null;
    A.addScore = n => {
      A.score += n; scoreEl.textContent = A.score.toLocaleString();
      if (n) { scoreEl.classList.remove('pop'); void scoreEl.offsetWidth; scoreEl.classList.add('pop'); }
      checkMilestones();
    };
    function checkMilestones() {
      const m = medalFor(A.score);
      if (m && m !== lastMedal){ lastMedal = m; A.sfx('medal'); A.toast(m.icon + ' ' + m.name + ' medal!'); }
      if (!A.won && cfg.winAt && A.score >= cfg.winAt) A.win();
    }
    // A.win(text): mark the quest complete (score-based games call it automatically via winAt)
    A.win = function (text) {
      if (A.won) return;
      A.won = true; A.sfx('win'); A.flash(0.25);
      A.toast('🏆 <b>Quest Complete!</b> ' + (text || cfg.winText || 'Keep going for a new best!'), 2800);
      const wins = store.get(cfg.storageKey + '_wins', 0); store.set(cfg.storageKey + '_wins', wins + 1);
    };
    A.setScore = n => { A.score = n; scoreEl.textContent = n.toLocaleString(); checkMilestones(); };

    // ---------- screens ----------
    const COLORS = window.PET_COLORS || ['emerald'];
    function heroPreview(c, big) {
      return window.petSpriteSVG({ color: c, stage: 'child', mood_label: 'happy' }, { tight: true })
        .replace('<svg ', '<svg width="' + (big ? 120 : 46) + '" height="' + (big ? 120 : 46) + '" ');
    }
    function renderMenu() {
      const m = medalFor(A.best);
      menu.innerHTML =
        '<div class="ak-card">' +
          '<div class="ak-title">' + cfg.title + '</div>' +
          '<div class="ak-sub">' + (cfg.subtitle || '') + '</div>' +
          '<div class="ak-hero ak-bob">' + heroPreview(A.color, true) + '</div>' +
          '<div class="ak-swatches">' + COLORS.map(c => '<button class="ak-sw' + (c === A.color ? ' sel' : '') + '" data-c="' + c + '" aria-label="' + c + ' sprite">' + heroPreview(c) + '</button>').join('') + '</div>' +
          '<div class="ak-how">' + (cfg.howTo || '') + '</div>' +
          '<div class="ak-best">Best: <b>' + A.best.toLocaleString() + '</b>' + (m ? ' · ' + m.icon + ' ' + m.name : '') + (cfg.winAt ? ' · Goal: ' + cfg.winAt.toLocaleString() : '') + '</div>' +
          '<button class="ak-play">▶ Play</button>' +
          '<div class="ak-keys">' + (cfg.controls || '') + '</div>' +
        '</div>';
      menu.querySelectorAll('.ak-sw').forEach(b => b.onclick = e => {
        e.stopPropagation(); A.color = b.dataset.c; store.set('arcade_sprite_color', A.color); buildHero(); renderMenu();
      });
      menu.querySelector('.ak-play').onclick = e => { e.stopPropagation(); start(); };
    }
    function showOver() {
      const isBest = A.score > A.best;
      if (isBest) { A.best = A.score; store.set(cfg.storageKey + '_best', A.best); }
      const m = medalFor(A.score), fact = (cfg.facts || [''])[Math.floor(Math.random() * (cfg.facts || ['']).length)];
      over.innerHTML =
        '<div class="ak-card">' +
          '<div class="ak-title">' + (A.won ? '🏆 Quest Complete!' : (cfg.overTitle || 'Game Over')) + '</div>' +
          '<div class="ak-final">' + A.score.toLocaleString() + '</div>' +
          '<div class="ak-best">' + (isBest ? '✨ New best!' : 'Best: <b>' + A.best.toLocaleString() + '</b>') + '</div>' +
          (m ? '<div class="ak-medal">' + m.icon + ' ' + m.name + ' medal</div>' : (medals[0] ? '<div class="ak-medal dim">' + medals[0].icon + ' ' + medals[0].name + ' at ' + medals[0].at + '</div>' : '')) +
          (fact ? '<div class="ak-fact">💡 ' + fact + '</div>' : '') +
          '<div class="ak-net"></div>' +
          '<button class="ak-play">↻ Play again</button>' +
          '<a class="ak-link" href="arcade.html">🎮 More games</a>' +
        '</div>';
      if (QUIZ && window.ArcadeQuiz) ArcadeQuiz.roundDone();
      over.querySelector('.ak-play').onclick = e => { e.stopPropagation(); replay(); };
      over.classList.remove('hidden');
      postScore(over.querySelector('.ak-net'));
    }
    function postScore(el) {
      if (cfg.noBoard || !el) return;
      const ses = NET.session();
      if (!ses) { el.innerHTML = '🏆 <a href="quest.html">Log in</a> (or <a href="visitor.html">join as a visitor</a>) to post scores to the class leaderboard.'; return; }
      if (A.score <= 0) return;
      el.textContent = '📡 Posting to the leaderboard…';
      NET.rpc('arcade_submit', { p_student_id: ses.id, p_pin_hash: ses.pin, p_trimester: NET.TRIMESTER, p_game: cfg.storageKey, p_score: A.score, p_won: !!A.won })
        .then(r => {
          if (!r) throw new Error('no reply');
          const where = r.visitor ? ' among visitors' : ' in all classes';
          el.innerHTML = '📡 Posted! <b>#' + r.rank + '</b>' + where + (r.visitor ? '' : ' · <b>#' + r.rank_group + '</b> in ' + r.group) +
            (r.xp ? '<br>⭐ +' + r.xp + ' Verified XP for your first quest win!' : '') +
            '<br><a href="arcade.html#stats">See leaderboards →</a>';
        })
        .catch(err => { if (err.offline) { NET.queue({ p_student_id: ses.id, p_pin_hash: ses.pin, p_trimester: NET.TRIMESTER, p_game: cfg.storageKey, p_score: A.score, p_won: !!A.won }); el.textContent = '📴 No internet right now. Your score is saved on this device and will post to the leaderboard when you\'re back online.'; return; }
          el.textContent = /too fast/.test(err.message) ? '' : /not signed/.test(err.message) ? '🔒 Your login expired. Log in again on the Quest page to post scores.' : '⚠ Couldn\'t post your score right now.'; });
    }

    // ---------- flow ----------
    // from the game-over screen: every few rounds, one quick question first (never blocks play)
    function replay() {
      if (QUIZ && window.ArcadeQuiz && ArcadeQuiz.due()) { A.state = 'quiz'; ArcadeQuiz.show(over, NET, start); return; }
      start();
    }
    function start() {
      A.state = 'play'; A.score = 0; A.time = 0; A.won = false; lastMedal = null;
      scoreEl.textContent = '0'; parts.length = 0; floats.length = 0;
      menu.classList.add('hidden'); over.classList.add('hidden'); paused.classList.add('hidden');
      cfg.reset && cfg.reset(A);
      overLock = Date.now() + 250;
    }
    let overLock = 0;
    // A.gameOver(quiet): end the run. quiet = true skips the crash sound/shake (for games that simply finish)
    A.gameOver = function (quiet) {
      if (A.state !== 'play') return;
      A.state = 'dying'; if (!quiet) { A.sfx('hit'); A.shake(12, 0.4); A.flash(0.2); }
      setTimeout(() => { A.state = 'over'; showOver(); overLock = Date.now() + 600; }, cfg.deathDelay || 700);
    };
    function pause() { if (A.state === 'play'){ A.state = 'paused'; paused.classList.remove('hidden'); } }
    function resume() { if (A.state === 'paused'){ A.state = 'play'; paused.classList.add('hidden'); last = performance.now(); } }
    paused.querySelector('.ak-play').onclick = e => { e.stopPropagation(); resume(); };
    pauseBtn.onclick = e => { e.stopPropagation(); A.state === 'paused' ? resume() : pause(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

    // ---------- input: tap / keys / swipe ----------
    function send(type) {
      if (A.state === 'menu' && (type === 'tap' || type === 'up')) return;   // menu uses the Play button
      if (A.state === 'over') { if ((type === 'tap' || type === 'up') && Date.now() > overLock) replay(); return; }
      if (A.state === 'paused') return;
      if (A.state === 'play' && cfg.input) cfg.input(type, A);
    }
    const KEYS = { Space: 'tap', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
    document.addEventListener('keydown', e => {
      if (e.code === 'KeyP' || e.code === 'Escape'){ A.state === 'paused' ? resume() : pause(); return; }
      if (e.code === 'Enter' && A.state === 'menu'){ start(); return; }
      if (e.code === 'Enter' && A.state === 'over' && Date.now() > overLock){ replay(); return; }
      const t = KEYS[e.code]; if (!t) return;
      e.preventDefault(); if (e.repeat && !cfg.repeatKeys) return;
      send(t);
      if (t === 'up' && cfg.upIsTap) send('tap');
    });
    document.addEventListener('keyup', e => { const t = KEYS[e.code]; if (t) send('release-' + t); });
    let sx = 0, sy = 0, st = 0, swiped = false;
    function logical(e) { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * A.W, (e.clientY - r.top) / r.height * A.H]; }
    let ptrDown = false;
    // cfg.pointer(type, x, y, A): optional raw pointer feed in game coordinates ('down' | 'move' | 'up')
    if (cfg.pointer) {
      stage.addEventListener('pointerdown', e => { if (e.target.closest('button,a') || A.state !== 'play') return; ptrDown = true; cfg.pointer('down', ...logical(e), A); });
      stage.addEventListener('pointermove', e => { if (A.state === 'play' && (ptrDown || e.pointerType === 'mouse')) cfg.pointer(ptrDown ? 'drag' : 'move', ...logical(e), A); });
      window.addEventListener('pointerup', e => { if (ptrDown && A.state === 'play') cfg.pointer('up', ...logical(e), A); ptrDown = false; });
    }
    stage.addEventListener('pointerdown', e => {
      if (e.target.closest('button,a')) return;
      sx = e.clientX; sy = e.clientY; st = Date.now(); swiped = false;
      if (!cfg.swipe) send('tap');
    });
    stage.addEventListener('pointermove', e => {
      if (!cfg.swipe || swiped || !st) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 28){
        swiped = true;
        send(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      }
    });
    stage.addEventListener('pointerup', e => {
      if (e.target.closest('button,a')) return;
      if (cfg.swipe && st && !swiped && Date.now() - st < 300) send('tap');
      send('release-tap'); st = 0;
    });
    stage.addEventListener('touchmove', e => { if (A.state === 'play') e.preventDefault(); }, { passive: false });

    // ---------- loop ----------
    let last = performance.now();
    function frame(now) {
      let dt = Math.min(0.033, (now - last) / 1000); last = now;
      if (A.state === 'paused') dt = 0;
      const live = A.state === 'play' || A.state === 'dying';
      if (A.state === 'play') A.time += dt;
      if (live || A.state === 'menu' || A.state === 'over') cfg.update && cfg.update(A.state === 'play' ? dt : (A.state === 'dying' ? dt * 0.25 : dt * 0.35), A);

      ctx.save();
      if (shakeT > 0){ shakeT -= dt; const k = shakeA * (shakeT > 0 ? 1 : 0); ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k); }
      cfg.draw && cfg.draw(ctx, A);
      // particles
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.t += dt; if (p.t > p.life){ parts.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt;
        ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // floating text
      ctx.textAlign = 'center'; ctx.font = '900 22px Nunito, system-ui, sans-serif'; ctx.lineJoin = 'round';
      for (let i = floats.length - 1; i >= 0; i--) {
        const f = floats[i]; f.t += dt; if (f.t > 0.9){ floats.splice(i, 1); continue; }
        ctx.globalAlpha = 1 - f.t / 0.9; ctx.lineWidth = 5; ctx.strokeStyle = INK;
        ctx.strokeText(f.text, f.x, f.y - f.t * 50); ctx.fillStyle = f.c; ctx.fillText(f.text, f.x, f.y - f.t * 50);
      }
      ctx.globalAlpha = 1;
      if (flashT > 0){ flashT -= dt; ctx.fillStyle = 'rgba(255,255,255,' + Math.max(0, flashT * 3) + ')'; ctx.fillRect(-20, -20, A.W + 40, A.H + 40); }
      ctx.restore();
      requestAnimationFrame(frame);
    }

    // ---------- shared drawing helpers ----------
    A.rr = function (x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
    A.ink = function (fill, lw) { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw || 4; ctx.strokeStyle = INK; ctx.stroke(); };
    A.INK = INK;
    A.store = store;

    if (cfg.pad) {
      const pad = document.createElement('div'); pad.className = 'ak-pad' + (cfg.padAlways ? ' always' : '');
      cfg.pad.forEach(b => {
        const el = document.createElement('button'); el.type = 'button'; el.innerHTML = b.label; if (b.wide) el.className = 'wide';
        el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture && el.setPointerCapture(e.pointerId); send(b.type); if (b.type === 'up' && cfg.upIsTap) send('tap'); });
        const up = e => { e.preventDefault(); send('release-' + b.type); };
        el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
        pad.appendChild(el);
      });
      root.appendChild(pad);
    }
    buildHero(); drawMute(); renderMenu(); resize();
    cfg.reset && cfg.reset(A);
    requestAnimationFrame(frame);
    return A;
  }

  // ---------- shared page styles ----------
  const css = `
  .ak-root{display:flex;flex-direction:column;align-items:center;width:100%;user-select:none;-webkit-user-select:none;touch-action:none}
  .ak-stage{position:relative;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.5),0 0 0 3px #1A1030,0 0 0 6px rgba(255,215,0,.35)}
  .ak-canvas{display:block}
  .ak-hud{position:absolute;top:10px;left:0;right:0;text-align:center;pointer-events:none}
  .ak-score{display:inline-block;font-family:Cinzel,serif;font-weight:900;font-size:44px;color:#fff;-webkit-text-stroke:2px #1A1030;text-shadow:0 4px 0 #1A1030;line-height:1}
  .ak-score.pop{animation:akpop .25s ease}
  @keyframes akpop{50%{transform:scale(1.25)}}
  .ak-btn-icon{position:absolute;top:10px;width:40px;height:40px;border-radius:12px;border:2px solid #1A1030;background:rgba(255,255,255,.85);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:900;color:#1A1030}
  .ak-mute{right:10px}.ak-pause{left:10px;font-size:14px}
  .ak-toast{position:absolute;top:70px;left:50%;transform:translate(-50%,-20px);opacity:0;transition:all .3s;background:#FFD700;color:#2a1d00;border:3px solid #1A1030;border-radius:14px;padding:8px 16px;font:800 17px Nunito,sans-serif;white-space:nowrap;pointer-events:none;box-shadow:0 4px 0 #1A1030}
  .ak-toast.show{opacity:1;transform:translate(-50%,0)}
  .ak-ov{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(10,6,24,.55);backdrop-filter:blur(2px);padding:14px}
  .ak-ov.hidden{display:none}
  .ak-card{background:linear-gradient(180deg,#22164a,#140d2c);border:3px solid #1A1030;box-shadow:0 0 0 3px rgba(255,215,0,.45),0 10px 30px rgba(0,0,0,.5);border-radius:20px;padding:18px 18px 16px;text-align:center;color:#f4efff;font-family:Nunito,sans-serif;max-width:340px;width:100%;max-height:100%;overflow:auto}
  .ak-title{font-family:Cinzel,serif;font-weight:900;font-size:28px;color:#FFD700;text-shadow:0 3px 0 #000}
  .ak-sub{color:#b9b0d6;font-weight:700;font-size:14px;margin-top:2px}
  .ak-hero{margin:8px auto 4px;width:120px;height:120px}
  .ak-bob{animation:akbob 1.6s ease-in-out infinite}
  @keyframes akbob{50%{transform:translateY(-8px)}}
  .ak-swatches{display:flex;gap:6px;justify-content:center;margin:6px 0 10px}
  .ak-sw{width:50px;height:50px;padding:2px;border-radius:12px;border:2px solid #3b2f66;background:#0f0a22;cursor:pointer}
  .ak-sw.sel{border-color:#FFD700;box-shadow:0 0 0 2px rgba(255,215,0,.4)}
  .ak-how{font-size:14px;line-height:1.45;color:#e6e0ff}
  .ak-best{margin-top:8px;color:#b9b0d6;font-weight:700;font-size:14px}
  .ak-best b{color:#FFD700}
  .ak-play{margin-top:12px;width:100%;padding:14px;border:3px solid #1A1030;border-radius:14px;background:linear-gradient(180deg,#3ff0b5,#00c98a);color:#05261a;font:900 20px Nunito,sans-serif;cursor:pointer;box-shadow:0 5px 0 #1A1030}
  .ak-play:active{transform:translateY(3px);box-shadow:0 2px 0 #1A1030}
  .ak-keys{margin-top:8px;font-size:12px;color:#8f86b3;font-weight:700}
  .ak-final{font-family:Cinzel,serif;font-weight:900;font-size:60px;color:#fff;-webkit-text-stroke:2px #1A1030;text-shadow:0 4px 0 #1A1030;line-height:1.1;margin-top:4px}
  .ak-medal{display:inline-block;margin-top:8px;background:#FFD700;color:#2a1d00;border:2px solid #1A1030;border-radius:99px;padding:4px 12px;font-weight:900}
  .ak-medal.dim{background:#2a2050;color:#b9b0d6}
  .ak-fact{margin-top:12px;background:#0f0a22;border:1px solid #3b2f66;border-radius:12px;padding:10px;font-size:14px;line-height:1.4;text-align:left}
  .ak-link{display:block;margin-top:10px;color:#FFD700;font-weight:800;text-decoration:none}
  .ak-net{margin-top:10px;font-size:13px;line-height:1.45;color:#cfc6ef;font-weight:700}
  .ak-net:empty{display:none}
  .ak-net a{color:#7CFFB2;font-weight:900}
  .ak-net b{color:#FFD700}
  .ak-pad{display:none;gap:10px;justify-content:center;padding:10px 0 4px;width:100%}
  .ak-pad.always{display:flex}
  @media (hover:none){.ak-pad{display:flex}}
  .ak-pad button{flex:1;max-width:96px;height:58px;font:900 20px Nunito,sans-serif;border-radius:16px;border:3px solid #1A1030;background:#FFD700;color:#2a1d00;box-shadow:0 5px 0 #1A1030;touch-action:none;-webkit-user-select:none;user-select:none}
  .ak-pad button.wide{max-width:150px}
  .ak-pad button:active{transform:translateY(3px);box-shadow:0 2px 0 #1A1030}
  @media (prefers-reduced-motion: reduce){.ak-bob,.ak-score.pop{animation:none}}
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  window.Arcade = Arcade;
})();

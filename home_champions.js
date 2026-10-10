// Home page: "Champions" section + once-a-day reminder popup.
// Needs supabase-js and pet_sprite.js loaded first, and <div id="champions"></div> on the page.
(function () {
  const SUPABASE_URL = 'https://gmeyamrlqfrabtslsweu.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_zClDCZZQEfC9DILpesPiHg_IcyRqW-c';
  const TRIMESTER = '2026-T1';
  const XP_PER_TASK = 25;
  const POPUP_KEY = 'dopp_daily_popup';
  const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const idahoDate = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver' }).format(d);
  const periodLabel = code => { const m = String(code || '').match(/P(\d+)$/i); return m ? 'Period ' + m[1] : ''; };
  const sprite = (p, size) => window.petSpriteSVG ? petSpriteSVG(p, { tight: true }) : '';
  const ago = iso => {
    const h = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3600000));
    if (h < 24) return h <= 1 ? 'just now' : h + 'h ago';
    const d = Math.round(h / 24); return d + ' day' + (d === 1 ? '' : 's') + ' ago';
  };

  // ---------- styles ----------
  const css = `
  .champ-wrap{position:relative;z-index:1;max-width:1200px;margin:0 auto;padding:36px 32px 8px}
  .champ-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:16px}
  .champ-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
  @media(max-width:900px){.champ-grid{grid-template-columns:1fr}.champ-wrap{padding:28px 16px 4px}}
  .champ-card{background:#fff;border:1px solid rgba(28,26,46,.12);border-radius:16px;padding:16px;box-shadow:0 4px 18px rgba(28,26,46,.06)}
  .champ-card h3{font-family:'Cinzel',serif;font-size:16px;color:#1C1A2E;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px}
  .champ-card h3 a{font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;color:#6b5400;text-decoration:none;white-space:nowrap}
  .champ-row{display:grid;grid-template-columns:30px 44px 1fr auto;gap:10px;align-items:center;padding:6px 0;border-top:1px solid rgba(28,26,46,.07)}
  .champ-row:first-of-type{border-top:0}
  .champ-row .rk{font-size:20px;text-align:center}
  .champ-row .av{font-size:26px;text-align:center;line-height:1}
  .champ-row svg{width:44px;height:44px;display:block}
  .champ-row b{display:block;font-size:15px;color:#1C1A2E}
  .champ-row span{font-size:12px;color:rgba(28,26,46,.65);font-weight:700}
  .champ-row .val{font-family:'Cinzel',serif;font-weight:700;font-size:15px;color:#6b5400;white-space:nowrap}
  .champ-row .ok{color:#0a8f63;font-family:'Nunito',sans-serif;font-weight:900;font-size:12px}
  .champ-row .ghost{color:#c0213f;font-family:'Nunito',sans-serif;font-weight:900;font-size:12px}
  .champ-empty{font-size:14px;color:rgba(28,26,46,.65);padding:6px 0}
  /* popup */
  .dq-back{position:fixed;inset:0;z-index:2000;background:rgba(10,6,24,.72);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(3px)}
  .dq{position:relative;width:100%;max-width:520px;max-height:92vh;overflow:auto;background:linear-gradient(180deg,#1c1240,#120c24);color:#f4efff;border:2px solid rgba(255,215,0,.5);border-radius:20px;padding:22px 20px 18px;box-shadow:0 20px 60px rgba(0,0,0,.5);font-family:'Nunito',sans-serif}
  .dq h2{font-family:'Cinzel',serif;color:#FFD700;text-shadow:0 2px 0 #000;font-size:24px;text-align:center}
  .dq .sub{text-align:center;color:#b9b0d6;font-size:14px;margin-top:2px}
  .dq-x{position:absolute;top:10px;right:12px;background:transparent;border:0;color:#b9b0d6;font-size:26px;line-height:1;cursor:pointer;padding:4px 8px}
  .dq-pet{display:grid;grid-template-columns:110px 1fr;gap:14px;align-items:center;background:#0f0a22;border:1px solid #3b2f66;border-radius:14px;padding:10px 12px;margin-top:14px}
  .dq-pet svg{width:110px;height:110px;display:block}
  .dq-pet b{font-size:18px;color:#FFD700}
  .dq-pet p{font-size:15px;margin-top:4px;line-height:1.35}
  .dq-hp{height:10px;background:#0b0716;border:1px solid #3b2f66;border-radius:99px;overflow:hidden;margin-top:8px}
  .dq-hp>div{height:100%;border-radius:99px}
  .dq-list{list-style:none;margin-top:14px;display:flex;flex-direction:column;gap:8px}
  .dq-list a{display:flex;gap:10px;align-items:center;background:#0f0a22;border:1px solid #3b2f66;border-radius:12px;padding:10px 12px;color:#f4efff;text-decoration:none;font-weight:800}
  .dq-list a:hover{border-color:#FFD700}
  .dq-list .ic{font-size:22px}
  .dq-list small{display:block;color:#b9b0d6;font-weight:700}
  .dq-warn{margin-top:12px;background:rgba(255,59,92,.12);border:1px solid rgba(255,59,92,.4);border-radius:12px;padding:8px 12px;font-size:14px;font-weight:700;color:#ffd6de}
  .dq-go{display:block;width:100%;margin-top:14px;background:#FFD700;color:#2a1d00;font-family:'Nunito',sans-serif;font-weight:900;font-size:18px;border:0;border-radius:14px;padding:13px;cursor:pointer}
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // ---------- data ----------
  async function getData() {
    if (!db) return { heroes: [], sprites: [], fallen: [] };
    const [lb, gal, fal] = await Promise.all([
      db.rpc('get_leaderboard_data', { p_trimester: TRIMESTER }),
      db.rpc('pet_gallery', { p_trimester: TRIMESTER }),
      db.rpc('pet_fallen', { p_trimester: TRIMESTER, p_days: 7 })
    ]);
    const heroes = (lb.data || [])
      .filter(s => !/test/i.test(s.class_code || '') && Number(s.task_count) > 0)
      .map(s => ({ name: s.display_name, avatar: s.avatar, period: periodLabel(s.class_code), xp: Number(s.task_count) * XP_PER_TASK }))
      .sort((a, b) => b.xp - a.xp);
    const sprites = (gal.data || []).filter(p => p.alive && p.stage !== 'egg')
      .sort((a, b) => b.health - a.health || b.streak - a.streak);
    return { heroes, sprites, fallen: fal.data || [], allSprites: gal.data || [] };
  }

  // ---------- champions section ----------
  function renderChampions(el, d) {
    const medal = i => ['🥇', '🥈', '🥉'][i];
    const heroes = d.heroes.slice(0, 3).map((h, i) =>
      '<div class="champ-row"><div class="rk">' + medal(i) + '</div><div class="av">' + esc(h.avatar || '⚔') + '</div>' +
      '<div><b>' + esc(h.name) + '</b><span>' + esc(h.period) + '</span></div><div class="val">' + h.xp.toLocaleString() + ' XP</div></div>').join('');
    const sprites = d.sprites.slice(0, 3).map((p, i) =>
      '<div class="champ-row"><div class="rk">' + medal(i) + '</div>' + sprite(p) +
      '<div><b>' + esc(p.name) + '</b><span>' + esc(p.owner) + ' · 🔥 ' + p.streak + '</span></div><div class="val">❤️ ' + p.health + '</div></div>').join('');
    const fallen = d.fallen.slice(0, 4).map(f =>
      '<div class="champ-row"><div class="rk">🪦</div>' + sprite({ color: f.color, stage: 'child', alive: false, name: f.name }) +
      '<div><b>' + esc(f.name) + '</b><span>' + esc(f.owner) + ' · ' + ago(f.died_at) + '</span></div>' +
      '<div class="' + (f.revived ? 'ok">✨ Revived' : 'ghost">👻 Ghost') + '</div></div>').join('');
    el.innerHTML =
      '<div class="champ-wrap"><div class="champ-head"><div><div class="section-label">This Week</div>' +
      '<div class="section-title" style="margin-bottom:0">Champions of Wellness</div></div></div>' +
      '<div class="champ-grid">' +
      '<div class="champ-card"><h3>🏆 Top Heroes <a href="leaderboard.html">Hall →</a></h3>' + (heroes || '<div class="champ-empty">No quests completed yet. Be the first!</div>') + '</div>' +
      '<div class="champ-card"><h3>🌱 Healthiest Sprites <a href="pets.html">Gallery →</a></h3>' + (sprites || '<div class="champ-empty">No sprites hatched yet. <a href="pet.html">Get your egg →</a></div>') + '</div>' +
      '<div class="champ-card"><h3>🪦 Recently Fallen <a href="pets.html">All →</a></h3>' + (fallen || '<div class="champ-empty">No sprites have fallen this week. 🎉</div>') + '</div>' +
      '</div></div>';
  }

  // ---------- daily popup ----------
  function questSession() {
    try {
      const studentId = localStorage.getItem('qSID_' + TRIMESTER), pinHash = sessionStorage.getItem('qPIN_' + TRIMESTER);
      return studentId && pinHash ? { studentId, pinHash } : null;
    } catch (e) { return null; }
  }
  function shouldShowPopup() {
    try {
      if (new URLSearchParams(location.search).get('popup') === '1') return true;
      return localStorage.getItem(POPUP_KEY) !== idahoDate(new Date());
    } catch (e) { return false; }   // no storage = don't nag every visit
  }
  const MOOD = {
    happy: n => n + ' is doing great. Keep the streak going!',
    hungry: n => n + ' is hungry! Log a meal or answer some questions.',
    tired: n => n + ' is exhausted. Did you get enough sleep?',
    dirty: n => n + ' needs some hygiene!',
    sad: n => n + ' feels down. Try some stress relief.',
    sick: n => n + ' is sick! It needs your healthy habits today.',
    sugar: n => n + ' is on a sugar crash…',
    ghost: n => n + ' has faded away! Answer 10 questions to revive it.'
  };
  async function showPopup(d) {
    let petHtml = '';
    const s = questSession();
    if (s && db) {
      try {
        const { data: p } = await db.rpc('pet_get', { p_student_id: s.studentId, p_pin_hash: s.pinHash, p_trimester: TRIMESTER });
        if (p) {
          const mood = !p.alive ? 'ghost' : p.stage === 'egg' ? null : p.mood_label;
          const col = p.health >= 60 ? '#00E5A0' : p.health >= 30 ? '#FFD700' : '#FF3B5C';
          petHtml = '<div class="dq-pet">' + sprite(p) + '<div><b>' + esc(p.name) + '</b>' +
            '<p>' + esc(mood ? MOOD[mood](p.name) : 'Your egg is waiting to hatch!') + '</p>' +
            '<div class="dq-hp"><div style="width:' + p.health + '%;background:' + col + '"></div></div></div></div>';
        } else {
          petHtml = '<div class="dq-pet">' + sprite({ color: 'emerald', stage: 'egg' }) + '<div><b>No sprite yet!</b><p>Hatch your Wellness Sprite and raise it all trimester.</p></div></div>';
        }
      } catch (e) {}
    }
    if (!petHtml) {
      petHtml = '<div class="dq-pet">' + sprite({ color: 'emerald', stage: 'child', mood_label: 'hungry' }) +
        '<div><b>Your sprite is waiting…</b><p>Feed it today with healthy habits and chapter questions.</p></div></div>';
    }
    const ghosts = d.fallen.filter(f => !f.revived).length;
    const warn = d.fallen.length
      ? '<div class="dq-warn">🪦 ' + d.fallen.length + ' sprite' + (d.fallen.length === 1 ? '' : 's') + ' faded this week' +
        (ghosts ? ' (' + ghosts + ' still a ghost)' : '') + '. Don\'t let yours be next!</div>' : '';
    const back = document.createElement('div');
    back.className = 'dq-back';
    back.innerHTML =
      '<div class="dq" role="dialog" aria-modal="true" aria-labelledby="dq-title">' +
      '<button class="dq-x" aria-label="Close">×</button>' +
      '<h2 id="dq-title">⚔ Daily Check-in</h2><div class="sub">Your quest for today</div>' +
      petHtml +
      '<ul class="dq-list">' +
      '<li><a href="pet.html"><span class="ic">🌱</span><span>Feed your Wellness Sprite<small>Log today\'s healthy habits and answer chapter questions</small></span></a></li>' +
      '<li><a href="quest.html"><span class="ic">⚔</span><span>Do today\'s Quest tasks<small>Earn XP and climb the Hall of Heroes</small></span></a></li>' +
      '<li><a href="chapters.html"><span class="ic">📚</span><span>Keep up with your chapter<small>Read, review vocab and play the games</small></span></a></li>' +
      '</ul>' + warn +
      '<button class="dq-go">Let\'s go! ⚔</button></div>';
    document.body.appendChild(back);
    document.body.style.overflow = 'hidden';
    const close = () => {
      try { localStorage.setItem(POPUP_KEY, idahoDate(new Date())); } catch (e) {}
      back.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', onKey);
    };
    const onKey = e => { if (e.key === 'Escape') close(); };
    back.querySelector('.dq-x').onclick = close;
    back.querySelector('.dq-go').onclick = close;
    back.querySelectorAll('.dq-list a').forEach(a => a.addEventListener('click', () => { try { localStorage.setItem(POPUP_KEY, idahoDate(new Date())); } catch (e) {} }));
    document.addEventListener('keydown', onKey);
    back.querySelector('.dq-go').focus();
  }

  // ---------- start ----------
  (async function init() {
    const el = document.getElementById('champions');
    let d = { heroes: [], sprites: [], fallen: [] };
    try { d = await getData(); } catch (e) {}
    if (el) renderChampions(el, d);
    if (shouldShowPopup()) showPopup(d);
  })();
})();

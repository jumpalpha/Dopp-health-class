/*
 * checklist.js — Trimester Task Checklist: rules + renderer.
 * Pure logic (no network). Used by the Teacher Dashboard draft now, and by a student page later.
 *
 *   const cfg = Checklist.config(savedConfig, trimesterId);   // fills in defaults
 *   const view = Checklist.build(evidence, cfg, { today });    // statuses for one student
 *   el.innerHTML = Checklist.render(view, { teacher: true });
 *
 * Status meanings (shown to people):
 *   complete        site saw the real activity (or Schoology/test box ticked = "Reported")
 *   in_progress     some real evidence, not enough yet
 *   not_started     no evidence yet
 *   no_record       no evidence, and the site wasn't recording this yet when it was due (neutral)
 *   needs_teacher   the site can't see this; the teacher confirms it
 *   teacher_done    confirmed / substituted by the teacher
 *   reported        student-reported box ticked (NOT verified, no XP)
 *   excused         teacher excused it for this student or the class
 */
(function (root) {
  // ───────────── course data (verified against the site, Oct 2026) ─────────────
  const CHAPTERS = {
    1: 'Understanding Health & Wellness', 2: 'Skills for a Healthy Life', 3: 'Mental and Emotional Health',
    4: 'Managing Stress', 5: 'Mental and Emotional Problems', 6: 'Building Healthy Relationships',
    7: 'Family Relationships', 8: 'Peer Relationships', 9: 'Resolving Conflicts and Preventing Violence',
    10: 'Nutrition for Health', 11: 'Managing Weight', 12: 'Physical Activity', 13: 'Personal Health Care',
    14: 'Skeletal, Muscular & Nervous Systems', 15: 'Cardiovascular, Respiratory & Digestive Systems',
    16: 'Endocrine & Reproductive Health',
    17: 'The Beginning of the Life Cycle', 18: 'The Life Cycle Continues', 19: 'Medicines & Drugs', 20: 'Tobacco',
    21: 'Alcohol', 22: 'Illegal Drugs', 23: 'Communicable Diseases', 24: 'STIs & HIV/AIDS',
    25: 'Noncommunicable Diseases & Disabilities', 26: 'Safety & Injury Prevention', 27: 'First Aid & Emergencies',
    28: 'Community & Environmental Health'
  };
  // lesson sections in each chapter's interactive reader (counted from chapterNN.html)
  const LESSONS = { 3: 3, 7: 3, 8: 3 };
  const lessonsIn = c => LESSONS[c] || 4;

  // Realms 1–5 = required. Activities and boss battles copied from the Quest page (quest.html REALMS),
  // with their Quest task keys so the teacher can see what a student self-checked there.
  const REALMS = [
    { id: 'r1', n: 1, name: 'Foundation Keep', icon: '🏰', color: '#38BFFF', chapters: [1, 2],
      acts: [[2, 'Health Triangle Self-Assessment'], [3, 'Health in the News Activity'], [6, '2-Week Habit Tracker']],
      boss: [7, 'Health Jeopardy', 'game01_jeopardy.html'] },
    { id: 'r2', n: 2, name: 'Mind Citadel', icon: '🧠', color: '#a855f7', chapters: [3, 4, 5],
      acts: [[2, 'Emotion Mapping Activity'], [5, 'Stress Management Plan'], [8, 'Mental Health Resource Research']],
      boss: [9, 'Who Wants to Be a Millionaire', 'game04_millionaire.html'] },
    { id: 'r3', n: 3, name: 'Relationship Realm', icon: '💞', color: '#FF3B5C', chapters: [6, 7, 8, 9],
      acts: [[2, 'Healthy Relationship Reflection'], [5, 'Family Dynamics Discussion'], [10, 'Conflict Resolution Role-Play']],
      boss: [11, 'Health Jeopardy', 'game01_jeopardy.html'] },
    { id: 'r4', n: 4, name: 'Nourish Dungeon', icon: '🥗', color: '#00E5A0', chapters: [10, 11, 12],
      acts: [[2, 'MyPlate Meal Planning Activity'], [5, 'Fad Diet De-bunker Challenge'], [8, 'One-Week Fitness Log']],
      boss: [9, 'Who Wants to Be a Millionaire', 'game04_millionaire.html'] },
    { id: 'r5', n: 5, name: 'Body Labyrinth', icon: '⚙️', color: '#FF8C00', chapters: [13, 14, 15, 16],
      acts: [[4, 'Body System Diagram Activity'], [9, 'Diagnose-the-Patient Challenge']],
      boss: [10, 'Health Jeopardy', 'game01_jeopardy.html'] }
  ];

  const VOCAB_MODES = [['flashcard', 'Flashcard Flip'], ['speedquiz', 'Speed Quiz'], ['wordbuild', 'Word Builder'], ['conceptmap', 'Concept Map']];

  // Arcade inventory (arcade.html): 26 solo + 4 partner + 2 team = 32 student games, + 16 classroom games = 48
  const SOLO = [['sprite_flap', 'Sprite Flap'], ['sprite_dash', 'Sprite Dash'], ['sprite_run', 'Sprite Run'], ['sprite_sling', 'Sprite Slingshot'],
    ['germ_invaders', 'Germ Invaders'], ['sprite_maze', 'Sprite Maze'], ['habit_breaker', 'Habit Breaker'], ['sprite_snake', 'Sprite Snake'],
    ['field_day', 'Field Day'], ['habit_showdown', 'Habit Showdown'], ['sprite_climb', 'Sprite Climb'], ['sprite_rider', 'Sprite Rider'],
    ['word_quest', 'Word Quest'], ['snack_2048', 'Snack 2048'], ['sprite_memory', 'Sprite Memory'], ['snack_stack', 'Snack Stack'],
    ['sprite_catch', 'Sprite Catch'], ['sprite_slice', 'Sprite Slice'], ['vocab_slice', 'Vocab Slice'], ['sprite_dodge', 'Sprite Dodge'],
    ['sprite_hoops', 'Sprite Hoops'], ['cup_pong', 'Cup Pong'], ['germ_sweeper', 'Germ Sweeper'], ['tic_tac_toe', 'Tic-Tac-Toe'],
    ['blast_blocks', 'Blast Blocks'], ['how_smart', 'How Smart Am I?']];
  const PARTNER = [['connect4_duel', 'Connect 4'], ['tictactoe_duel', 'Tic-Tac-Toe vs. a Friend'], ['battleship_duel', 'Battleship'], ['memory_duel', 'Dopp Memory']];
  const CLASSROOM = [['game01_jeopardy', 'Health Jeopardy', 'Boss'], ['game02_deal_or_no_deal', 'Deal or No Deal', 'Solo · Ch 19–22'],
    ['game03_wheel_of_fortune', 'Wheel of Fortune', 'Team'], ['game04_millionaire', 'Who Wants to Be a Millionaire', 'Boss'],
    ['game05_hot_takes', 'Hot Takes Buzzer Battle', 'Daily'], ['game06_escape_room', 'Health Escape Room', 'Team'],
    ['game07_survivor', 'Health Survivor', 'Wild'], ['game08_price_is_right', 'The Price Is Right', 'Daily'],
    ['game09_family_feud', 'Health Family Feud', 'Team'], ['game10_imposter', 'Health Imposter', 'Wild · Ch 23–25'],
    ['game11_taboo', 'Health Taboo', 'Team'], ['game12_would_you_rather', 'Would You Rather', 'Daily'],
    ['game13_pictionary', 'Health Pictionary Blitz', 'Team'], ['game14_shark_tank', 'Health Shark Tank', 'Boss · Ch 28'],
    ['dopp_spin', 'Dopp Spin', 'Daily'], ['game15_myth_busters', 'Myth Busters', 'Daily']];
  const SIDE_QUESTS = [['wcq', 'Weight Control Quest', 'weight-control-quest.html'], ['reflection', 'Reflection Paper Coach', 'side_quests.html'],
    ['whatif', 'The "What If" Game', 'side_quests.html'], ['song', 'Song Maker', 'song_maker.html']];

  // Verified XP rules (checked in the database, Oct 15 2026). Quest XP is separate and self-reported.
  const XP_RULES = {
    mastery: 'Chapter Mastery: +50 per chapter passed (8/10), once per chapter',
    arcade: 'Arcade: +10 the first time you WIN each game (once per game)',
    trail: 'Wellness Trail: +5 per day you play',
    live: 'Live games: +5 per correct answer',
    live_bonus: 'Live games: +25 end-of-game bonus when you qualify',
    quest: 'Quest XP (separate): +25 per Quest task you check, +5 per login day — self-reported, not verified'
  };

  const TERM_DATES = {
    '2026-T1': ['2026-09-02', '2026-11-20'], '2026-T2': ['2026-12-01', '2027-03-05'], '2026-T3': ['2027-03-08', '2027-06-03']
  };
  const TRACK_START = '2026-10-15';   // reading + vocab + sprite-history evidence starts the day this went live

  // ───────────── config ─────────────
  function defaults(tri) {
    const d = TERM_DATES[tri] || TERM_DATES['2026-T1'];
    const hw = {}; for (let c = 1; c <= 16; c++) hw[c] = true;
    const acts = {}; REALMS.forEach(r => r.acts.forEach(([k]) => { acts[r.id + '_' + k] = true; }));
    const boss = {}; REALMS.forEach(r => { boss[r.id] = true; });
    return {
      start: d[0], end: d[1], track_start: TRACK_START, released: false,
      hw,                                    // chapter → has a Schoology homework
      tests: REALMS.map(r => ({ id: 'realm' + r.n, label: 'Realm ' + r.n + ' test', chapters: r.chapters.slice() })),
      acts, boss,
      trail_days: 3, sprite_days: 10, sprite_quiz: 30, live_min: 3, review_min: 2,
      solo_required: 'all',                  // 'all' or a number of different solo games
      partner_required: true,
      off: []                                // items turned off for the whole class (e.g. 'partner:battleship_duel')
    };
  }
  function config(saved, tri) {
    const base = defaults(tri), s = saved && typeof saved === 'object' ? saved : {};
    const out = Object.assign({}, base, s);
    ['hw', 'acts', 'boss'].forEach(k => { out[k] = Object.assign({}, base[k], s[k] || {}); });
    if (!Array.isArray(out.tests)) out.tests = base.tests;
    if (!Array.isArray(out.off)) out.off = [];
    return out;
  }

  // ───────────── helpers ─────────────
  const DAY = 86400000;
  const iso = d => new Date(d).toISOString().slice(0, 10);
  const addDays = (s, n) => iso(Date.parse(s + 'T12:00:00Z') + n * DAY);
  const fmt = s => { if (!s) return ''; const d = new Date(s + 'T12:00:00Z'); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); };

  // spread chapters 1–16 evenly from start to (end − 5 days, leaving a review week)
  function targets(cfg) {
    const t0 = Date.parse(cfg.start + 'T12:00:00Z'), t1 = Date.parse(addDays(cfg.end, -5) + 'T12:00:00Z');
    const out = {};
    for (let c = 1; c <= 16; c++) out[c] = (cfg.targets && cfg.targets[c]) || iso(t0 + (t1 - t0) * (c / 16));
    return out;
  }

  const DONE = { complete: 1, teacher_done: 1, reported: 1 };
  const LABEL = {
    complete: 'Complete', in_progress: 'In progress', not_started: 'Not started', no_record: 'No record yet',
    needs_teacher: 'Needs teacher verification', teacher_done: 'Teacher confirmed', reported: 'Student reported',
    excused: 'Excused'
  };

  // ───────────── build one student's checklist ─────────────
  function build(ev, cfg, opts) {
    ev = ev || {}; opts = opts || {};
    const today = opts.today || iso(Date.now());
    const verify = ev.verify || {}, manual = ev.manual || {};
    const off = new Set(cfg.off || []);
    const tgt = targets(cfg);

    // index evidence
    const reads = {}; (ev.reads || []).forEach(r => { (reads[r.c] = reads[r.c] || new Set()).add(r.i); });
    const vocab = {}; (ev.vocab || []).forEach(v => { vocab[v.c + ':' + v.m] = v; });
    const mastery = {}; (ev.mastery || []).forEach(m => { mastery[m.c] = m; });
    const arcade = {}; (ev.arcade || []).forEach(a => { arcade[a.g] = a; });
    const quest = new Set(ev.quest || []);

    function finish(it) {
      it.id = it.id || '';
      if (off.has(it.id)) { it.status = 'excused'; it.why = 'Turned off for the whole class'; }
      else if (verify[it.id] === 'excused') { it.status = 'excused'; it.why = 'Excused by teacher'; }
      else if (verify[it.id] === 'done' && !DONE[it.status]) { it.status = 'teacher_done'; }
      it.label_status = LABEL[it.status];
      it.done = !!DONE[it.status];
      return it;
    }
    // missing evidence for something due before tracking existed is neutral, not a failure
    function untracked(it, due) {
      if (it.status === 'not_started' && due && due < cfg.track_start) { it.status = 'no_record'; it.note = 'Site began recording this on ' + fmt(cfg.track_start); }
      return it;
    }

    function chapterItems(c, required) {
      const items = [];
      const nL = lessonsIn(c), got = reads[c] ? reads[c].size : 0;
      items.push(untracked({ id: 'read:ch' + c, kind: 'auto', label: 'Read all ' + nL + ' lessons in the chapter reader',
        status: got >= nL ? 'complete' : got ? 'in_progress' : 'not_started', detail: got + ' of ' + nL + ' lessons read',
        href: 'chapter' + String(c).padStart(2, '0') + '.html' }, required && tgt[c]));
      VOCAB_MODES.forEach(([m, name]) => {
        const v = vocab[c + ':' + m];
        items.push(untracked({ id: 'vocab:ch' + c + ':' + m, kind: 'auto', label: name,
          status: v ? 'complete' : 'not_started',
          detail: v ? ('best ' + (v.meta && v.meta.best_pct != null ? v.meta.best_pct : v.meta && v.meta.pct) + '% · finished ' + v.n + '×') : 'finish a full round',
          href: 'vocab_engine.html?ch=' + c + (m === 'flashcard' ? '' : '#' + m), group: 'vocab' }, required && tgt[c]));
      });
      const ms = mastery[c];
      items.push({ id: 'mastery:ch' + c, kind: 'auto', label: 'Chapter Mastery practice (not your formal test)',
        status: ms && ms.passed ? 'complete' : ms && ms.attempts ? 'in_progress' : 'not_started',
        detail: ms ? (ms.passed ? 'passed' : 'best ' + (ms.best || 0) + '/10 · need 8') + ' · ' + ms.attempts + ' attempt' + (ms.attempts === 1 ? '' : 's') : 'pass with 8/10',
        href: 'mastery.html?ch=' + c });
      if (!required) return items.map(finish);
      if (cfg.hw[c] !== false) {
        const mk = 'hw:ch' + c;
        items.push({ id: mk, kind: 'manual', label: 'Homework completed in Schoology',
          status: manual[mk] && manual[mk].on ? 'reported' : 'not_started', key: mk,
          detail: 'Student reported · Schoology is the official record' });
      }
      cfg.tests.forEach(t => {
        const chs = (t.chapters || []).map(Number);
        if (!chs.length || Math.max.apply(null, chs) !== c) return;     // show a test on its last chapter
        const mk = 'test:' + t.id;
        items.push({ id: mk, kind: 'manual', label: 'Test completed outside DoppsClass — ' + t.label + (chs.length > 1 ? ' (Ch ' + chs.join(', ') + ')' : ''),
          status: manual[mk] && manual[mk].on ? 'reported' : 'not_started', key: mk,
          detail: 'Student reported · not a grade' });
      });
      return items.map(finish);
    }

    const realms = REALMS.map(r => {
      const chapters = r.chapters.map(c => ({ n: c, title: CHAPTERS[c], target: tgt[c], items: chapterItems(c, true) }));
      const due = tgt[r.chapters[r.chapters.length - 1]];
      const items = [];
      r.acts.forEach(([k, name]) => {
        const qk = r.id + '_' + k;
        if (cfg.acts[qk] === false) return;
        items.push(finish({ id: 'act:' + qk, kind: 'teacher', label: name, status: 'needs_teacher',
          detail: quest.has(qk) ? 'Student checked it on the Quest page (self-reported)' : 'Assigned activity' }));
      });
      if (cfg.boss[r.id] !== false) {
        const qk = r.id + '_' + r.boss[0];
        items.push(finish({ id: 'boss:' + r.id, kind: 'teacher', label: 'Boss battle — ' + r.boss[1], status: 'needs_teacher',
          detail: 'Classroom game: the teacher confirms who took part' + (quest.has(qk) ? ' · student self-checked on Quest page' : '') }));
      }
      return { id: r.id, n: r.n, name: r.name, icon: r.icon, color: r.color, due, chapters, items };
    });

    // ── all trimester long ──
    const care = ev.care || [];
    const careDays = care.filter(d => d.h > 0).length, quizTotal = care.reduce((s, d) => s + (d.q || 0), 0);
    const trailDays = (ev.trail && ev.trail.days) || [];
    const liveIn = (ev.live || []).filter(l => l.answered > 0);
    let reviews = 0;
    (ev.vocab || []).forEach(v => { if (v.n >= 2 && v.meta && v.meta.first_pct != null && v.meta.first_pct < 80) reviews++; });
    (ev.mastery || []).forEach(m => { if (m.fails > 0 && m.attempts > m.fails) reviews++; else if (m.fails > 1) reviews++; });

    const ongoing = [
      finish({ id: 'sprite:hatch', kind: 'auto', label: 'Hatch your Wellness Sprite', status: ev.pet ? 'complete' : 'not_started',
        detail: ev.pet ? 'hatched ' + fmt(iso(ev.pet.born)) + (ev.pet.alive === false ? ' · needs reviving' : '') : 'Sprite page', href: 'pet.html' }),
      finish({ id: 'sprite:care', kind: 'auto', label: 'Care for your sprite on ' + cfg.sprite_days + ' different days',
        status: careDays >= cfg.sprite_days ? 'complete' : careDays ? 'in_progress' : 'not_started',
        detail: careDays + ' of ' + cfg.sprite_days + ' days · healthy habits are self-logged · best streak ' + ((ev.pet && ev.pet.best_streak) || 0),
        href: 'pet.html' }),
      finish({ id: 'sprite:quiz', kind: 'auto', label: 'Feed your sprite knowledge: ' + cfg.sprite_quiz + ' chapter questions right',
        status: quizTotal >= cfg.sprite_quiz ? 'complete' : quizTotal ? 'in_progress' : 'not_started',
        detail: quizTotal + ' of ' + cfg.sprite_quiz + ' · answers are checked on the student\'s device', href: 'pet.html' }),
      finish({ id: 'trail:days', kind: 'auto', label: 'Wellness Trail: play on ' + cfg.trail_days + ' different days',
        status: trailDays.length >= cfg.trail_days ? 'complete' : trailDays.length ? 'in_progress' : 'not_started',
        detail: trailDays.length + ' of ' + cfg.trail_days + ' play days · a full 1,200-mile journey takes 6+ days' +
          (ev.trail && ev.trail.finished ? ' · ' + ev.trail.finished + ' journey(s) finished' : ''), href: 'trail.html' }),
      finish({ id: 'live:games', kind: 'auto', label: 'Take part in ' + cfg.live_min + ' live class games',
        status: liveIn.length >= cfg.live_min ? 'complete' : liveIn.length ? 'in_progress' : 'not_started',
        detail: liveIn.length + ' of ' + cfg.live_min + ' (joined signed-in and answered at least once)' }),
      finish({ id: 'class:discuss', kind: 'teacher', label: 'Participate in class discussion activities', status: 'needs_teacher',
        detail: 'The teacher confirms this' }),
      finish({ id: 'review:weak', kind: 'auto', label: 'Revisit weak areas (' + cfg.review_min + ' reviews)',
        status: reviews >= cfg.review_min ? 'complete' : reviews ? 'in_progress' : 'not_started',
        detail: reviews + ' of ' + cfg.review_min + ' · counts a vocab round replayed after scoring under 80%, or a Mastery check retaken after missing it' })
    ];

    // ── games ──
    const played = a => a && a.plays > 0 && a.best > 0;
    const soloRows = SOLO.map(([k, t]) => {
      const a = arcade[k];
      return { key: k, title: t, played: played(a), won: !!(a && a.wins > 0), plays: a ? a.plays : 0, xp: !!(a && a.wins > 0), off: off.has('game:' + k) };
    });
    const soloNeed = cfg.solo_required === 'all' ? soloRows.filter(r => !r.off).length : Math.min(Number(cfg.solo_required) || 0, soloRows.length);
    const soloDone = soloRows.filter(r => r.played && !r.off).length;
    const partnerRows = PARTNER.map(([k, t]) => { const a = arcade[k]; return { key: k, title: t, played: !!(a && a.plays > 0), won: !!(a && a.wins > 0), plays: a ? a.plays : 0, off: off.has('partner:' + k) }; });
    const partnerNeed = partnerRows.filter(r => !r.off).length, partnerDone = partnerRows.filter(r => r.played && !r.off).length;
    const games = {
      solo: soloRows, partner: partnerRows, classroom: CLASSROOM.map(([k, t, tag]) => ({ key: k, title: t, tag, done: verify['class:' + k] === 'done' })),
      items: [
        finish({ id: 'games:solo', kind: 'auto', label: cfg.solo_required === 'all' ? 'Play every solo arcade game at least once' : 'Play ' + soloNeed + ' different solo arcade games',
          status: soloDone >= soloNeed ? 'complete' : soloDone ? 'in_progress' : 'not_started',
          detail: soloDone + ' of ' + soloNeed + ' played (a finished round with a score) · winning is separate', href: 'arcade.html' }),
        cfg.partner_required ? finish({ id: 'games:partner', kind: 'auto', label: 'Play each partner game with a classmate',
          status: partnerDone >= partnerNeed ? 'complete' : partnerDone ? 'in_progress' : 'not_started',
          detail: partnerDone + ' of ' + partnerNeed + ' · counts only when both players are signed in', href: 'arcade.html' }) : null,
        finish({ id: 'team:germ_snipes', kind: 'teacher', label: 'Germ Snipes (team maze game)', status: 'needs_teacher',
          detail: 'The site does not save who played — teacher confirms or excuses' })
      ].filter(Boolean)
    };

    // ── XP (display only; nothing here awards XP) ──
    const vx = (ev.xp && ev.xp.verified) || {};
    const verifiedTotal = Object.keys(vx).reduce((s, k) => s + (vx[k] || 0), 0);
    const questTasks = (ev.xp && ev.xp.quest_tasks) || 0, questDays = (ev.xp && ev.xp.quest_days) || 0;
    const xp = { verified: vx, verifiedTotal, questTasks, questDays, questTotal: questTasks * 25 + questDays * 5 };

    // ── bonus (never required) ──
    const bonusCh = [];
    for (let c = 17; c <= 28; c++) {
      const its = chapterItems(c, false);
      bonusCh.push({ n: c, title: CHAPTERS[c], items: its, any: its.some(i => i.done || i.status === 'in_progress') });
    }
    const b = ev.bonus || {}, projects = new Set(b.projects || []);
    const quests = SIDE_QUESTS.map(([k, t, href]) => {
      let st = 'not_started', detail = 'Optional';
      if (k === 'wcq' && b.wcq) { st = b.wcq.submitted ? 'complete' : 'in_progress'; detail = b.wcq.submitted ? 'submitted' : 'stage ' + (b.wcq.stage || 0); }
      if (k === 'song' && [...projects].some(p => /song/.test(p))) { st = 'in_progress'; detail = 'saved work found (not verified)'; }
      if (k === 'reflection' || k === 'whatif') detail = 'Opens an AI guide — opening it is not proof of finishing';
      return { key: k, title: t, href, status: st, detail, label_status: LABEL[st] };
    });

    // ── required totals (chapters 1–16 + realm + ongoing + games). Bonus never counts. ──
    const required = [];
    realms.forEach(r => { r.chapters.forEach(ch => required.push(...ch.items)); required.push(...r.items); });
    required.push(...ongoing, ...games.items);
    const counted = required.filter(i => i.status !== 'excused');
    const done = counted.filter(i => i.done).length;
    const tally = {}; counted.forEach(i => { tally[i.status] = (tally[i.status] || 0) + 1; });
    return {
      cfg, today, targets: tgt, realms, ongoing, games, xp, bonus: { chapters: bonusCh, quests },
      summary: { done, total: counted.length, pct: counted.length ? Math.round(done * 100 / counted.length) : 0, tally,
                 excused: required.length - counted.length }
    };
  }

  // ───────────── render ─────────────
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ICON = { complete: '✓', teacher_done: '✓', reported: '☑', in_progress: '◐', not_started: '○', no_record: '–', needs_teacher: '👁', excused: '⤫' };

  function itemHTML(it, o) {
    const kindTag = it.kind === 'manual' ? '<span class="cl-tag cl-tag-rep">Student reported</span>'
      : it.kind === 'teacher' ? '<span class="cl-tag cl-tag-tch">Teacher</span>'
      : '<span class="cl-tag cl-tag-auto">Auto</span>';
    let control = '';
    if (it.kind === 'manual') {
      const can = !!o.manualEnabled;
      control = `<label class="cl-box"><input type="checkbox" data-manual="${esc(it.key)}"${it.status === 'reported' ? ' checked' : ''}${can ? '' : ' disabled'}>` +
        `<span>${it.status === 'reported' ? 'Checked' : 'Not checked'}</span></label>`;
    } else {
      control = `<span class="cl-lock" title="Checks itself off from site activity">🔒</span>`;    // never a checkbox
    }
    const tctl = o.teacher ? `<span class="cl-tctl">` +
      (it.kind !== 'manual' && it.status !== 'teacher_done' && !it.done ? `<button data-verify="${esc(it.id)}" data-st="done">Confirm</button>` : '') +
      (it.status === 'teacher_done' ? `<button data-verify="${esc(it.id)}" data-st="">Undo confirm</button>` : '') +
      (it.status === 'excused' && it.why !== 'Turned off for the whole class' ? `<button data-verify="${esc(it.id)}" data-st="">Un-excuse</button>`
        : it.status !== 'excused' ? `<button data-verify="${esc(it.id)}" data-st="excused">Excuse</button>` : '') + `</span>` : '';
    const label = it.href && !o.teacher ? `<a href="${esc(it.href)}">${esc(it.label)}</a>` : esc(it.label);
    return `<li class="cl-item cl-${it.status}"><span class="cl-ic" aria-hidden="true">${ICON[it.status] || '○'}</span>
      <span class="cl-main"><span class="cl-label">${label} ${kindTag}</span>
      <span class="cl-detail">${esc(it.detail || '')}${it.note ? ' · ' + esc(it.note) : ''}</span></span>
      <span class="cl-st">${esc(it.label_status)}</span>${control}${tctl}</li>`;
  }

  function render(v, o) {
    o = o || {};
    const s = v.summary, xp = v.xp;
    const tallyHTML = ['complete', 'reported', 'teacher_done', 'in_progress', 'needs_teacher', 'not_started', 'no_record']
      .filter(k => s.tally[k]).map(k => `<span class="cl-pill cl-${k}">${esc(LABEL[k])}: ${s.tally[k]}</span>`).join('');
    let h = `<div class="cl-wrap">`;
    if (o.banner) h += `<div class="cl-banner">${o.banner}</div>`;
    h += `<div class="cl-head">
      <div><div class="cl-name">${esc(o.title || 'My Trimester Checklist')}</div>
        <div class="cl-sub">${esc(fmt(v.cfg.start))} – ${esc(fmt(v.cfg.end))} · Required: Chapters 1–16 (Realms 1–5). Chapters 17–28 are bonus only.</div></div>
      <div class="cl-pct"><b>${s.pct}%</b><span>${s.done} of ${s.total} required done</span></div></div>
      <div class="cl-bar"><i style="width:${s.pct}%"></i></div>
      <div class="cl-pills">${tallyHTML}${s.excused ? `<span class="cl-pill cl-excused">Excused: ${s.excused}</span>` : ''}</div>
      <div class="cl-xp">
        <div><b>${xp.verifiedTotal}</b><span>Verified XP</span><small>${Object.keys(xp.verified).map(k => esc(k) + ' ' + xp.verified[k]).join(' · ') || 'none yet'}</small></div>
        <div><b>${xp.questTotal}</b><span>Quest XP</span><small>${xp.questTasks} self-checked tasks × 25 + ${xp.questDays} login days × 5</small></div>
        <div class="cl-xpnote">Checklist boxes never give XP. Student-reported boxes are reminders, not grades — Schoology is the official record.</div>
      </div>`;

    v.realms.forEach(r => {
      h += `<section class="cl-realm" style="--rc:${r.color}"><h3>${r.icon} Realm ${r.n} · ${esc(r.name)} <small>wrap up by ${esc(fmt(r.due))}</small></h3>`;
      r.chapters.forEach(ch => {
        const d = ch.items.filter(i => i.done).length, t = ch.items.filter(i => i.status !== 'excused').length;
        h += `<details class="cl-ch"${o.open ? ' open' : ''}><summary><span class="cl-chn">Ch ${ch.n}</span> ${esc(ch.title)}
          <span class="cl-chm">target ${esc(fmt(ch.target))} · ${d}/${t}</span></summary><ul>${ch.items.map(i => itemHTML(i, o)).join('')}</ul></details>`;
      });
      if (r.items.length) h += `<div class="cl-sub2">Realm activities & boss battle</div><ul>${r.items.map(i => itemHTML(i, o)).join('')}</ul>`;
      h += `</section>`;
    });

    h += `<section class="cl-realm" style="--rc:#00E5A0"><h3>🌱 All trimester long</h3><ul>${v.ongoing.map(i => itemHTML(i, o)).join('')}</ul></section>`;

    const g = v.games;
    const chip = (on, t) => `<span class="cl-gc${on ? ' on' : ''}">${t}</span>`;
    h += `<section class="cl-realm" style="--rc:#FFD700"><h3>🎮 Games</h3><ul>${g.items.map(i => itemHTML(i, o)).join('')}</ul>
      <details class="cl-ch"${o.open ? ' open' : ''}><summary>Solo arcade games (${g.solo.filter(x => x.played).length}/${g.solo.length} played)</summary><div class="cl-games">` +
      g.solo.map(x => `<div class="cl-game${x.off ? ' off' : ''}"><b>${esc(x.title)}</b>${chip(x.played, 'Played')}${chip(x.won, 'Won')}${chip(x.xp, '+10 XP earned')}</div>`).join('') +
      `</div></details><details class="cl-ch"${o.open ? ' open' : ''}><summary>Partner games — need a classmate (${g.partner.filter(x => x.played).length}/${g.partner.length})</summary><div class="cl-games">` +
      g.partner.map(x => `<div class="cl-game${x.off ? ' off' : ''}"><b>${esc(x.title)}</b>${chip(x.played, 'Played')}${chip(x.won, 'Won')}</div>`).join('') +
      `</div></details><details class="cl-ch"><summary>Classroom games (teacher-run, ${g.classroom.length})</summary>
      <p class="cl-detail" style="padding:6px 10px">Played together on the board. Launching one never checks anyone off. Required ones are the realm boss battles above.</p><div class="cl-games">` +
      g.classroom.map(x => `<div class="cl-game"><b>${esc(x.title)}</b><span class="cl-gc">${esc(x.tag)}</span></div>`).join('') + `</div></details></section>`;

    h += `<section class="cl-realm cl-bonus" style="--rc:#a855f7"><h3>⭐ Bonus XP — optional <small>never required, never overdue</small></h3>
      <details class="cl-ch"><summary>Chapters 17–28 (${v.bonus.chapters.filter(c => c.any).length} started)</summary>` +
      v.bonus.chapters.map(c => `<details class="cl-ch"><summary><span class="cl-chn">Ch ${c.n}</span> ${esc(c.title)}</summary><ul>${c.items.map(i => itemHTML(i, Object.assign({}, o, { teacher: false }))).join('')}</ul></details>`).join('') +
      `</details><ul>` + v.bonus.quests.map(q => `<li class="cl-item cl-${q.status}"><span class="cl-ic">${ICON[q.status]}</span><span class="cl-main"><span class="cl-label">${esc(q.title)} <span class="cl-tag">Side quest</span></span><span class="cl-detail">${esc(q.detail)}</span></span><span class="cl-st">${esc(q.label_status)}</span></li>`).join('') +
      `</ul></section></div>`;
    return h;
  }

  const CSS = `
.cl-wrap{--cl-bg:#fff;--cl-tx:#1C1A2E;--cl-dim:rgba(28,26,46,.66);--cl-bd:rgba(28,26,46,.13);font-family:'Nunito',sans-serif;color:var(--cl-tx);max-width:980px}
.cl-banner{background:#fff4c2;border:2px dashed #b38600;color:#5a4300;border-radius:12px;padding:10px 14px;font-weight:800;margin-bottom:12px;font-size:14px}
.cl-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;flex-wrap:wrap}
.cl-name{font-family:'Cinzel',serif;font-size:20px;font-weight:700}.cl-sub{font-size:13px;color:var(--cl-dim);margin-top:2px}
.cl-pct{text-align:right}.cl-pct b{font-size:30px;display:block;line-height:1}.cl-pct span{font-size:12px;color:var(--cl-dim)}
.cl-bar{height:10px;border-radius:6px;background:rgba(28,26,46,.08);overflow:hidden;margin:10px 0}.cl-bar i{display:block;height:100%;background:linear-gradient(90deg,#00b37d,#00E5A0)}
.cl-pills{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}.cl-pill{font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;background:rgba(28,26,46,.06)}
.cl-xp{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0 16px}.cl-xp>div{background:var(--cl-bg);border:1px solid var(--cl-bd);border-radius:12px;padding:10px 12px}
.cl-xp b{font-size:22px;display:block}.cl-xp span{font-weight:800;font-size:13px}.cl-xp small{display:block;font-size:11.5px;color:var(--cl-dim);margin-top:2px}
.cl-xp .cl-xpnote{grid-column:1/-1;font-size:12.5px;color:var(--cl-dim);background:transparent;border-style:dashed}
.cl-realm{background:var(--cl-bg);border:1px solid var(--cl-bd);border-left:5px solid var(--rc);border-radius:14px;padding:12px 14px;margin-bottom:14px}
.cl-realm h3{font-size:16px;font-weight:800;margin-bottom:8px}.cl-realm h3 small{font-weight:600;color:var(--cl-dim);font-size:12px;margin-left:6px}
.cl-sub2{font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--cl-dim);margin:10px 0 4px}
.cl-ch{border:1px solid var(--cl-bd);border-radius:10px;margin:6px 0;background:rgba(28,26,46,.015)}
.cl-ch>summary{cursor:pointer;padding:9px 10px;font-weight:700;font-size:14px;list-style-position:inside}
.cl-chn{display:inline-block;min-width:44px;font-weight:800;color:var(--rc,#7a5c00)}.cl-chm{float:right;font-size:12px;color:var(--cl-dim);font-weight:600}
.cl-ch ul,.cl-realm>ul{list-style:none;margin:0;padding:0 6px 6px}
.cl-item{display:grid;grid-template-columns:24px 1fr auto auto;gap:4px 10px;align-items:center;padding:8px 6px;border-top:1px solid var(--cl-bd);font-size:14px}
.cl-ic{font-weight:900;text-align:center}.cl-label{font-weight:700}.cl-label a{color:inherit}.cl-detail{display:block;font-size:12px;color:var(--cl-dim)}
.cl-st{font-size:12px;font-weight:800;white-space:nowrap}
.cl-tag{font-size:10px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:1px 6px;border-radius:5px;background:rgba(28,26,46,.07);margin-left:4px;vertical-align:middle}
.cl-tag-rep{background:#ffe9c2;color:#7a4b00}.cl-tag-tch{background:#e7dcff;color:#4b2a99}.cl-tag-auto{background:#d6f6ea;color:#035c40}
.cl-complete .cl-ic,.cl-complete .cl-st,.cl-teacher_done .cl-ic,.cl-teacher_done .cl-st{color:#00875f}
.cl-reported .cl-ic,.cl-reported .cl-st{color:#a86400}.cl-in_progress .cl-ic,.cl-in_progress .cl-st{color:#0a72b5}
.cl-needs_teacher .cl-st{color:#6b3fd1}.cl-no_record .cl-st,.cl-not_started .cl-st{color:var(--cl-dim)}.cl-excused{opacity:.6}.cl-excused .cl-label{text-decoration:line-through}
.cl-pill.cl-complete{background:#d6f6ea}.cl-pill.cl-reported{background:#ffe9c2}.cl-pill.cl-in_progress{background:#d8efff}.cl-pill.cl-needs_teacher{background:#e7dcff}
.cl-box{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;cursor:pointer}.cl-box input{width:20px;height:20px;accent-color:#a86400}
.cl-lock{font-size:13px;opacity:.55}
.cl-tctl{grid-column:2/-1;display:flex;gap:6px;flex-wrap:wrap}.cl-tctl button{font:700 11.5px 'Nunito',sans-serif;border:1px solid var(--cl-bd);background:#fff;border-radius:7px;padding:3px 9px;cursor:pointer}
.cl-tctl button:hover{border-color:#6b3fd1;color:#6b3fd1}
.cl-games{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px;padding:6px 10px 10px}
.cl-game{border:1px solid var(--cl-bd);border-radius:9px;padding:7px 9px;font-size:13px;background:#fff}.cl-game b{display:block;margin-bottom:4px}.cl-game.off{opacity:.45}
.cl-gc{display:inline-block;font-size:10.5px;font-weight:800;padding:1px 6px;border-radius:5px;margin:0 4px 2px 0;background:rgba(28,26,46,.06);color:var(--cl-dim)}.cl-gc.on{background:#d6f6ea;color:#035c40}
@media(max-width:640px){.cl-item{grid-template-columns:22px 1fr;}.cl-st,.cl-box,.cl-lock{grid-column:2}.cl-xp{grid-template-columns:1fr}.cl-chm{float:none;display:block;margin-top:2px}.cl-pct{text-align:left}}
@media print{.cl-tctl,.cl-lock{display:none!important}.cl-ch{break-inside:avoid}.cl-realm{break-inside:avoid-page}.cl-banner{border-style:solid}}
`;
  function injectCSS() {
    if (typeof document === 'undefined' || document.getElementById('cl-css')) return;
    const st = document.createElement('style'); st.id = 'cl-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  root.Checklist = { CHAPTERS, REALMS, VOCAB_MODES, SOLO, PARTNER, CLASSROOM, SIDE_QUESTS, XP_RULES, TERM_DATES, LABEL,
    lessonsIn, defaults, config, targets, build, render, injectCSS, fmt };
})(typeof window !== 'undefined' ? window : globalThis);

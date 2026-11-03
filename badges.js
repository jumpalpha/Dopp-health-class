// badges.js — one source of truth for realm badges + achievements.
// Used by quest.html (full grid), leaderboard.html (Hall of Heroes) and pets.html (Sprite Gallery).
(function () {
var REALMS = [
  { id:'r1', name:'Foundation Keep', icon:'🏰', color:'#38BFFF', badge:'Wellness Apprentice',
    days:'Days 1–4', chapters:[1,2],
    tasks:['Read Chapter 1 PDF','Complete Ch 1 Vocab Games (all 4)','Health Triangle Self-Assessment','Health in the News Activity','Read Chapter 2 PDF','Complete Ch 2 Vocab Games (all 4)','2-Week Habit Tracker Started','Boss Battle — Health Jeopardy'] },
  { id:'r2', name:'Mind Citadel', icon:'🧠', color:'#a855f7', badge:'Mind Knight',
    days:'Days 5–10', chapters:[3,4,5],
    tasks:['Read Chapter 3 PDF','Complete Ch 3 Vocab Games','Emotion Mapping Activity','Read Chapter 4 PDF','Complete Ch 4 Vocab Games','Stress Management Plan','Read Chapter 5 PDF','Complete Ch 5 Vocab Games','Mental Health Resource Research','Boss Battle — Millionaire'] },
  { id:'r3', name:'Relationship Realm', icon:'💞', color:'#FF3B5C', badge:'Social Champion',
    days:'Days 11–18', chapters:[6,7,8,9],
    tasks:['Read Chapter 6 PDF','Complete Ch 6 Vocab Games','Healthy Relationship Reflection','Read Chapter 7 PDF','Complete Ch 7 Vocab Games','Family Dynamics Discussion','Read Chapter 8 PDF','Complete Ch 8 Vocab Games','Read Chapter 9 PDF','Complete Ch 9 Vocab Games','Conflict Resolution Role-Play','Boss Battle — Health Jeopardy'] },
  { id:'r4', name:'Nourish Dungeon', icon:'🥗', color:'#00E5A0', badge:'Body Warrior',
    days:'Days 19–24', chapters:[10,11,12],
    tasks:['Read Chapter 10 PDF','Complete Ch 10 Vocab Games','MyPlate Meal Planning Activity','Read Chapter 11 PDF','Complete Ch 11 Vocab Games','Fad Diet De-bunker Challenge','Read Chapter 12 PDF','Complete Ch 12 Vocab Games','One-Week Fitness Log','Boss Battle — Millionaire'] },
  { id:'r5', name:'Body Labyrinth', icon:'⚙️', color:'#FF8C00', badge:'System Sage',
    days:'Days 25–32', chapters:[13,14,15,16],
    tasks:['Read Chapter 13 PDF','Complete Ch 13 Vocab Games','Read Chapter 14 PDF','Complete Ch 14 Vocab Games','Body System Diagram Activity','Read Chapter 15 PDF','Complete Ch 15 Vocab Games','Read Chapter 16 PDF','Complete Ch 16 Vocab Games','Diagnose-the-Patient Challenge','Boss Battle — Health Jeopardy'] },
  { id:'r6', name:'Life Cycle Shrine', icon:'🌱', color:'#38BFFF', badge:'Life Keeper',
    days:'Days 33–36', chapters:[17,18],
    tasks:['Read Chapter 17 PDF','Complete Ch 17 Vocab Games','Prenatal Health Decision Tree','Read Chapter 18 PDF','Complete Ch 18 Vocab Games','Teen Brain Reflection Activity','Boss Battle — Millionaire'] },
  { id:'r7', name:'Shadow World', icon:'💀', color:'#FF3B5C', badge:'Shadow Slayer',
    days:'Days 37–44', chapters:[19,20,21,22],
    tasks:['Read Chapter 19 PDF','Complete Ch 19 Vocab Games','Fentanyl Awareness Mission','Read Chapter 20 PDF','Complete Ch 20 Vocab Games','Read Chapter 21 PDF','Complete Ch 21 Vocab Games','Refusal Skills Role-Play','Read Chapter 22 PDF','Complete Ch 22 Vocab Games','Substance Risk Scenario Cards','Boss Battle — Health Jeopardy'] },
  { id:'r8', name:'Disease Fortress', icon:'🏥', color:'#aaaaaa', badge:'Health Guardian',
    days:'Days 45–50', chapters:[23,24,25],
    tasks:['Read Chapter 23 PDF','Complete Ch 23 Vocab Games','Epidemic Simulation Activity','Read Chapter 24 PDF','Complete Ch 24 Vocab Games','HIV Prevention Awareness','Read Chapter 25 PDF','Complete Ch 25 Vocab Games','Heart Disease Risk Calculator','Boss Battle — Millionaire'] },
  { id:'r9', name:'The Final Tower', icon:'★', color:'#FFD700', badge:'★ Master of Wellness',
    days:'Days 51–55', chapters:[26,27,28],
    tasks:['Read Chapter 26 PDF','Complete Ch 26 Vocab Games','Home Safety Assessment','Read Chapter 27 PDF','Complete Ch 27 Vocab Games','CPR Hands-Only Demonstration','Read Chapter 28 PDF','Complete Ch 28 Vocab Games','Community Health Advocacy Project','FINAL BOSS — Grand Wellness Assessment'] },
];
var XP_PER_TASK = 25, XP_PER_DAY = 5;
var TOTAL_TASKS = REALMS.reduce(function (a, r) { return a + r.tasks.length; }, 0);
var ACHIEVEMENTS = [
  { id:'first_step', icon:'🌟', name:'First Step', desc:'Complete your first task', req: s => s.totalTasks >= 1 },
  { id:'week1', icon:'📅', name:'Week One Warrior', desc:'Complete 7 days of activity', req: s => s.totalDays >= 7 },
  { id:'realm1', icon:'🏰', name:'Keep Cleared', desc:'Finish Realm I', req: s => s.badges.includes('Wellness Apprentice') },
  { id:'vocab100', icon:'📚', name:'Vocab Master', desc:'Complete all 28 vocab tasks', req: s => s.vocabTasks >= 28 },
  { id:'halfway', icon:'⚡', name:'Halfway There', desc:'Complete 4 realms', req: s => s.badges.length >= 4 },
  { id:'shadow', icon:'💀', name:'Shadow Slayer', desc:'Beat the Shadow World', req: s => s.badges.includes('Shadow Slayer') },
  { id:'no_hints', icon:'🧠', name:'XP Hunter', desc:'Earn 500 XP', req: s => s.xp >= 500 },
  { id:'streak7', icon:'🔥', name:'On Fire', desc:'7-day streak', req: s => s.streak >= 7 },
  { id:'boss5', icon:'👑', name:'Boss Slayer', desc:'Complete 5 boss battles', req: s => s.bossTasks >= 5 },
  { id:'master', icon:'⚔️', name:'Master of Wellness', desc:'Complete ALL 9 realms', req: s => s.badges.length >= 9 },
  { id:'streak30', icon:'🌙', name:'Month of Mastery', desc:'30-day activity streak', req: s => s.streak >= 30 },
  { id:'perfect', icon:'💎', name:'Perfect Hero', desc:'Complete every single task', req: s => s.totalTasks >= TOTAL_TASKS },
  { id:'arcade10', icon:'🕹️', name:'Arcade Explorer', desc:'Play 10 different arcade games', req: s => (s.arcadeGames || 0) >= 10 },
  { id:'arcade_top', icon:'🏆', name:'Arcade Champion', desc:'Hold the #1 score on any arcade game', req: s => (s.arcadeTops || 0) >= 1 },
  { id:'trail', icon:'🐂', name:'Trail Blazer', desc:'Finish the trail game', req: s => (s.trailFinishes || 0) >= 1 },
  { id:'stylist', icon:'🛍️', name:'Sprite Stylist', desc:'Buy 5 Sprite Shop upgrades', req: s => (s.upgrades || 0) >= 5 },
  { id:'mastery5', icon:'🎓', name:'Mastery Scholar', desc:'Pass 5 Chapter Mastery Checks', req: s => (s.mastered || 0) >= 5 },
  { id:'mastery16', icon:'📜', name:'Mastery Legend', desc:'Pass Mastery Checks for all of chapters 1–16', req: s => (s.masteredCore || 0) >= 16 },
  { id:'voice', icon:'🗳️', name:'Class Voice', desc:'Vote in 20 Surveys of the Day', req: s => (s.surveyVotes || 0) >= 20 },
  { id:'money', icon:'💰', name:'Money Smart', desc:'Submit The Cost of Your Future', req: s => !!s.financeDone },
];

var idahoDate = function (d) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver' }).format(d); };
function streakFrom(daySet) {
  var d = new Date();
  if (!daySet.has(idahoDate(d))) d.setDate(d.getDate() - 1);
  var n = 0;
  while (daySet.has(idahoDate(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// Extra counts from get_badge_data (arcade, trail, shop, mastery, surveys, finance)
var EXTRA_KEYS = ['arcadeGames','arcadeTops','trailFinishes','upgrades','mastered','masteredCore','surveyVotes','financeDone'];
function withExtra(s, extra) { EXTRA_KEYS.forEach(function (k) { if (extra && extra[k] != null) s[k] = extra[k]; }); return s; }

// Same math as the Quest page, from raw task keys + login days.
function stats(taskKeys, dayDates, extra) {
  var keys = new Set(taskKeys || []), days = new Set((dayDates || []).map(String));
  var xp = 0, badges = [], totalTasks = 0, bossTasks = 0, vocabTasks = 0, realms = [];
  REALMS.forEach(function (r) {
    var done = 0;
    r.tasks.forEach(function (task, ti) {
      if (keys.has(r.id + '_' + ti)) {
        done++; xp += XP_PER_TASK; totalTasks++;
        if (task.toLowerCase().indexOf('vocab') > -1) vocabTasks++;
        if (task.toLowerCase().indexOf('boss') > -1) bossTasks++;
      }
    });
    if (done === r.tasks.length) { badges.push(r.badge); realms.push(r); }
  });
  xp += days.size * XP_PER_DAY;
  var s = { xp: xp, badges: badges, realms: realms, totalTasks: totalTasks, bossTasks: bossTasks, vocabTasks: vocabTasks,
            streak: streakFrom(days), totalDays: days.size };
  withExtra(s, extra);
  s.achievements = ACHIEVEMENTS.filter(function (a) { try { return a.req(s); } catch (e) { return false; } });
  s.count = s.badges.length + s.achievements.length;
  return s;
}

var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };

// Small inline chip: newest realm title (or best achievement) + total badge count.
// opts.max: how many achievement icons to show (default 3)
function chip(s, opts) {
  if (!s || !s.count) return '';
  opts = opts || {};
  var max = opts.max == null ? 3 : opts.max;
  var top = s.realms.length ? s.realms[s.realms.length - 1] : null;
  var title = top ? (top.badge.indexOf(top.icon) === 0 ? top.badge : top.icon + ' ' + top.badge) : '';
  var icons = s.achievements.slice(-max).map(function (a) {
    return '<span title="' + esc(a.name + ': ' + a.desc) + '">' + a.icon + '</span>';
  }).join('');
  var tip = s.badges.concat(s.achievements.map(function (a) { return a.name; })).join(', ');
  return '<span class="dbadge" title="' + esc(tip) + '">' +
    (title ? '<span class="dbadge-t">' + esc(title) + '</span>' : '') +
    (icons ? '<span class="dbadge-i">' + icons + '</span>' : '') +
    '<span class="dbadge-n">🏅' + s.count + '</span></span>';
}

// Inject chip styles once
if (typeof document !== 'undefined' && !document.getElementById('dbadge-css')) {
  var st = document.createElement('style'); st.id = 'dbadge-css';
  st.textContent = '.dbadge{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;font-family:Nunito,sans-serif;font-size:11px;font-weight:700;line-height:1.3;vertical-align:middle}' +
    '.dbadge-t{color:#c9930a;background:rgba(255,215,0,.12);border:1px solid rgba(255,215,0,.35);border-radius:999px;padding:1px 8px;white-space:nowrap}' +
    '.dbadge-i{letter-spacing:1px;font-size:13px}.dbadge-n{color:inherit;opacity:.75;white-space:nowrap}';
  (document.head || document.documentElement).appendChild(st);
}

// Fetch badge stats for every student this term: { student_id: stats }
async function loadAll(db, trimester) {
  var out = {};
  try {
    var res = await db.rpc('get_badge_data', { p_trimester: trimester });
    (res.data || []).forEach(function (r) { out[r.id] = stats(r.task_keys, r.day_dates, r.extra); });
  } catch (e) {}
  return out;
}

// Extra counts for one student (Quest page)
async function loadExtra(db, trimester, studentId) {
  try {
    var res = await db.rpc('get_badge_data', { p_trimester: trimester, p_student_id: studentId });
    return (res.data && res.data[0] && res.data[0].extra) || {};
  } catch (e) { return {}; }
}

window.DoppBadges = { REALMS: REALMS, ACHIEVEMENTS: ACHIEVEMENTS, TOTAL_TASKS: TOTAL_TASKS, stats: stats, chip: chip, loadAll: loadAll, loadExtra: loadExtra, withExtra: withExtra };
})();

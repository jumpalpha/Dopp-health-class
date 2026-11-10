/*
 * listen-core.js — shared podcast data, player and listening progress.
 * Used by podcast.js (the player on chapter pages) and listen.html (the "Listen" page).
 *
 * To add an episode: put the MP3 in podcasts/ and add a line to EPISODES below. That's it —
 * the chapter page player, the Listen page, "up next" and the realm badges all pick it up.
 * Episodes are AI Audio Overviews made in NotebookLM from the chapter page, reviewed by Mr. Dopp.
 *
 * Listening badges are saved with StudentSave (project "listening") when the student is signed in,
 * so they follow them across devices. They are NOT XP: XP only comes from things the server can
 * check itself (see supabase/verified_xp.sql), and the server can't check that someone listened.
 */
(function () {
  if (window.DoppListen) return;

  var EPISODES = {
    1: { src: '/podcasts/ch01.mp3', title: 'Health Literacy and Cumulative Risk' },
    2: { src: '/podcasts/ch02.mp3', title: 'Refusal Skills, SMART Goals and Health Consumerism' },
    3: { src: '/podcasts/ch03.mp3', title: 'How Sleep Deprivation Sabotages Teen Resilience' },
    4: { src: '/podcasts/ch04.mp3', title: 'How Stress Hormones Affect Your Body' },
    5: { src: '/podcasts/ch05.mp3', title: 'Recognizing Mental Disorders and Crisis Signs' },
    6: { src: '/podcasts/ch06.mp3', title: 'Setting Boundaries with Assertive Communication' }
  };

  var CHAPTERS = [null,
    'Understanding Health and Wellness', 'Taking Charge of Your Health', 'Achieving Mental and Emotional Health',
    'Managing Stress and Coping with Loss', 'Mental and Emotional Problems', 'Skills for Healthy Relationships',
    'Family Relationships', 'Peer Relationships', 'Resolving Conflicts and Preventing Violence',
    'Nutrition for Health', 'Managing Weight and Eating Behaviors', 'Physical Activity and Fitness',
    'Personal Health Care', 'Skeletal, Muscular and Nervous Systems', 'Cardiovascular, Respiratory and Digestive Systems',
    'Endocrine and Reproductive Health', 'The Beginning of the Life Cycle', 'The Life Cycle Continues',
    'Medicines and Drugs', 'Tobacco', 'Alcohol', 'Illegal Drugs', 'Communicable Diseases', 'STIs and HIV/AIDS',
    'Noncommunicable Diseases and Disabilities', 'Safety and Injury Prevention', 'First Aid and Emergencies',
    'Community and Environmental Health'];

  var REALMS = [
    { num: 'I',    name: 'Foundation Keep',    icon: '🏰', chapters: [1, 2] },
    { num: 'II',   name: 'Mind Citadel',       icon: '🧠', chapters: [3, 4, 5] },
    { num: 'III',  name: 'Relationship Realm', icon: '💞', chapters: [6, 7, 8, 9] },
    { num: 'IV',   name: 'Nourish Dungeon',    icon: '🥗', chapters: [10, 11, 12] },
    { num: 'V',    name: 'Body Labyrinth',     icon: '⚙️', chapters: [13, 14, 15, 16] },
    { num: 'VI',   name: 'Life Cycle Shrine',  icon: '🌱', chapters: [17, 18] },
    { num: 'VII',  name: 'Shadow World',       icon: '💀', chapters: [19, 20, 21, 22] },
    { num: 'VIII', name: 'Disease Fortress',   icon: '🏥', chapters: [23, 24, 25] },
    { num: 'IX',   name: 'The Final Tower',    icon: '★',  chapters: [26, 27, 28] }
  ];

  var DONE_KEY = 'dopp_pod_done', LAST_KEY = 'dopp_pod_last', SAVE_KEY = 'listening';
  var POS = function (n) { return 'dopp_pod_pos_' + n; };      // same key the old player used, so resume points carry over
  var HEARD = function (n) { return 'dopp_pod_heard_' + n; };   // seconds actually played (skipping ahead doesn't count)
  var FINISH_SHARE = 0.75;                                       // must actually hear 75% of an episode for it to count
  var COUNTDOWN = 5;

  function get(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function fmt(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return ('0' + n).slice(-2); }

  function has(n) { return !!EPISODES[n]; }
  function chapterUrl(n) { return '/chapter' + pad(n) + '.html'; }
  function realmOf(n) { for (var i = 0; i < REALMS.length; i++) if (REALMS[i].chapters.indexOf(n) > -1) return REALMS[i]; return null; }
  function nextAfter(n) { for (var i = n + 1; i <= 28; i++) if (has(i)) return i; return null; }
  function allEpisodes() { var a = []; for (var i = 1; i <= 28; i++) if (has(i)) a.push(i); return a; }

  // ── progress ──
  function doneList() { var d = get(DONE_KEY, []); return Array.isArray(d) ? d : []; }
  function isDone(n) { return doneList().indexOf(n) > -1; }
  function position(n) { var p = parseFloat(get(POS(n), 0)); return isFinite(p) ? p : 0; }
  function last() { return get(LAST_KEY, null); }

  // A realm's badge needs every chapter in it to have an episode, and all of them finished.
  function realmStatus(r) {
    var eps = r.chapters.filter(has), done = eps.filter(isDone);
    return { eps: eps.length, done: done.length, soon: r.chapters.length - eps.length,
             earned: eps.length === r.chapters.length && done.length === eps.length };
  }

  // Where "Continue listening" should go: a half-finished episode first, then the next one not finished yet.
  function continueTarget() {
    var l = last();
    if (l && has(l.n) && !isDone(l.n) && position(l.n) > 5) return { n: l.n, resume: true };
    var start = l && has(l.n) ? l.n : 0, list = allEpisodes();
    for (var i = 0; i < list.length; i++) if (list[i] > start && !isDone(list[i])) return { n: list[i], resume: false };
    for (i = 0; i < list.length; i++) if (!isDone(list[i])) return { n: list[i], resume: false };
    return null;
  }

  var listeners = [];
  function onChange(fn) { listeners.push(fn); }
  function changed() { listeners.forEach(function (fn) { try { fn(); } catch (e) {} }); }

  function cloudSave() {
    if (!window.StudentSave) return;
    try { StudentSave.save(SAVE_KEY, { done: doneList() }); } catch (e) {}
  }

  // Merge this browser's progress with the signed-in student's saved progress (union of both).
  function sync() {
    if (!window.StudentSave) return Promise.resolve();
    return StudentSave.load(SAVE_KEY).then(function (r) {
      var cloud = (r && r.data && Array.isArray(r.data.done)) ? r.data.done : [], local = doneList();
      var merged = local.slice();
      cloud.forEach(function (n) { if (typeof n === 'number' && merged.indexOf(n) === -1) merged.push(n); });
      merged.sort(function (a, b) { return a - b; });
      if (merged.length !== local.length) { set(DONE_KEY, merged); changed(); }
      if (merged.length !== cloud.length) cloudSave();
    }).catch(function () {});
  }

  function markDone(n) {
    if (isDone(n)) return;
    var r = realmOf(n), before = r && realmStatus(r).earned;
    var d = doneList(); d.push(n); d.sort(function (a, b) { return a - b; }); set(DONE_KEY, d);
    cloudSave();
    if (r && !before && realmStatus(r).earned) toast('🏅', 'Badge earned: ' + r.name + ' Listener',
      'You finished every episode in Realm ' + r.num + '.');
    else toast('🎧', 'Episode finished', 'Chapter ' + n + ' marked as heard on your Listen page.');
    changed();
  }

  // ── small toast ──
  var css = false;
  function addCss() {
    if (css) return; css = true;
    var s = document.createElement('style');
    s.textContent =
      '.dl-pod{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:16px 18px;border-radius:18px;color:#fff;' +
      'background:radial-gradient(circle at 15% 0%,#3b2a7a 0%,#1C1A2E 65%),#1C1A2E;box-shadow:0 8px 26px rgba(28,26,46,.22);border:1px solid rgba(255,215,0,.35)}' +
      '.dl-pod .play{flex:0 0 54px;height:54px;border-radius:50%;border:none;cursor:pointer;font-size:22px;color:#1C1A2E;' +
      'background:linear-gradient(180deg,#FFE34D,#FFC400);box-shadow:0 3px 0 #a37d00}' +
      '.dl-pod .play:active{transform:translateY(2px);box-shadow:0 1px 0 #a37d00}' +
      '.dl-pod .play:disabled{opacity:.5;cursor:default}' +
      '.dl-pod .info{flex:1 1 220px;min-width:0}' +
      '.dl-pod .kick{font:800 11px Nunito,sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:#FFD700}' +
      '.dl-pod .ttl{font:800 16px Nunito,sans-serif;margin:2px 0 8px;color:#fff}' +
      '.dl-pod input[type=range]{width:100%;accent-color:#FFD700;cursor:pointer}' +
      '.dl-pod .row{display:flex;justify-content:space-between;font:700 12px Nunito,sans-serif;color:rgba(255,255,255,.7);margin-top:2px}' +
      '.dl-pod .side{display:flex;flex-direction:column;gap:6px;align-items:flex-end}' +
      '.dl-pod .spd,.dl-pod .skip,.dl-pod .auto{font:800 12px Nunito,sans-serif;color:#fff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:5px 11px;cursor:pointer}' +
      '.dl-pod .auto[aria-pressed=false]{opacity:.6}' +
      '.dl-pod .lnk{font:800 12.5px Nunito,sans-serif;color:#FFD700;text-decoration:none}' +
      '.dl-pod .lnk:hover{text-decoration:underline}' +
      '.dl-pod .note{flex-basis:100%;font:600 11.5px Nunito,sans-serif;color:rgba(255,255,255,.55)}' +
      '.dl-pod .next{flex-basis:100%;display:none;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;border-radius:12px;background:rgba(255,215,0,.12);border:1px solid rgba(255,215,0,.4);font:700 13.5px Nunito,sans-serif}' +
      '.dl-pod .next.on{display:flex}' +
      '.dl-pod .next b{color:#FFD700}' +
      '.dl-pod .next span{flex:1 1 200px}' +
      '.dl-pod .next button{font:800 12.5px Nunito,sans-serif;border-radius:999px;padding:6px 12px;cursor:pointer;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff}' +
      '.dl-pod .next button.go{background:#FFD700;color:#1C1A2E;border-color:#FFD700}' +
      '.dl-toast{position:fixed;left:50%;bottom:22px;transform:translate(-50%,30px);opacity:0;z-index:9999;max-width:min(92vw,420px);' +
      'display:flex;gap:12px;align-items:center;padding:12px 16px;border-radius:14px;background:#1C1A2E;color:#fff;border:1px solid rgba(255,215,0,.5);' +
      'box-shadow:0 10px 30px rgba(0,0,0,.3);font:600 13.5px Nunito,sans-serif;transition:opacity .3s,transform .3s}' +
      '.dl-toast.on{opacity:1;transform:translate(-50%,0)}' +
      '.dl-toast .i{font-size:26px}.dl-toast b{display:block;color:#FFD700;font-size:14.5px}' +
      '@media(max-width:600px){.dl-pod .side{flex-direction:row;align-items:center;flex-wrap:wrap}}' +
      '@media(prefers-reduced-motion:reduce){.dl-toast{transition:none}}';
    document.head.appendChild(s);
  }

  function toast(icon, title, body) {
    addCss();
    var t = document.createElement('div');
    t.className = 'dl-toast'; t.setAttribute('role', 'status');
    t.innerHTML = '<span class="i" aria-hidden="true">' + icon + '</span><span><b>' + esc(title) + '</b>' + esc(body) + '</span>';
    document.body.appendChild(t);
    requestAnimationFrame(function () { requestAnimationFrame(function () { t.classList.add('on'); }); });
    setTimeout(function () { t.classList.remove('on'); setTimeout(function () { t.remove(); }, 400); }, 5000);
  }

  /*
   * player(mount, n, opts) — builds the player inside `mount` and returns { load(n, play), audio }.
   * opts.chapterLink: show "Open Chapter N" when the player is not on that chapter's page.
   * opts.onEpisode(n): called whenever a new episode is loaded (the Listen page uses it to highlight the list).
   */
  function player(mount, startN, opts) {
    opts = opts || {};
    addCss();
    var SPEEDS = [1, 1.25, 1.5, 2], si = 0, n = null, seeking = false, lastSave = 0, lastT = 0, heard = 0, timer = null;
    var auto = get('dopp_pod_autonext', true) !== false;

    var box = document.createElement('div');
    box.className = 'dl-pod';
    box.innerHTML =
      '<button class="play" type="button" aria-label="Play">▶</button>' +
      '<div class="info"><div class="kick">🎧 Listen to this chapter</div>' +
        '<div class="ttl"></div>' +
        '<input type="range" min="0" max="100" step="1" value="0" aria-label="Seek">' +
        '<div class="row"><span class="cur">0:00</span><span class="dur">--:--</span></div></div>' +
      '<div class="side"><div><button class="skip" type="button" aria-label="Back 15 seconds">↺ 15</button> ' +
        '<button class="spd" type="button" aria-label="Playback speed">1×</button> ' +
        '<button class="auto" type="button" aria-pressed="' + auto + '" title="Play the next chapter\'s episode automatically">⏭ Auto</button></div>' +
        '<a class="lnk chap" href="#" hidden></a>' +
        '<a class="lnk" href="/listen.html">📻 All episodes</a>' +
        '<a class="lnk" href="/ask.html">🙋 Got a question? Ask Mr. Dopp</a></div>' +
      '<div class="next" aria-live="polite"><span></span><button class="go" type="button">▶ Play now</button><button class="stop" type="button">Cancel</button></div>' +
      '<div class="note">AI-generated recap of this chapter, reviewed by Mr. Dopp. It doesn\'t replace the reading — your Quick Checks come from the text.</div>';
    mount.appendChild(box);

    var q = function (s) { return box.querySelector(s); };
    var a = new Audio(); a.preload = 'metadata';
    var play = q('.play'), bar = q('input'), cur = q('.cur'), dur = q('.dur'), spd = q('.spd'),
        autoBtn = q('.auto'), chap = q('.chap'), next = q('.next'), ttl = q('.ttl'), kick = q('.kick');

    function cancelNext() { clearInterval(timer); timer = null; next.classList.remove('on'); }

    function load(newN, andPlay) {
      if (!has(newN)) return;
      cancelNext();
      n = newN; heard = parseFloat(get(HEARD(n), 0)) || 0; lastT = 0;
      var ep = EPISODES[n];
      ttl.textContent = 'Chapter ' + n + ' Podcast: ' + ep.title;
      var onPage = opts.pageChapter === n;
      kick.textContent = onPage ? '🎧 Listen to this chapter' : '🎧 Now playing · Chapter ' + n;
      chap.hidden = onPage;
      if (!onPage) { chap.href = chapterUrl(n); chap.textContent = '📖 Open Chapter ' + n; }
      bar.value = 0; cur.textContent = '0:00'; dur.textContent = '--:--'; play.disabled = false; play.style.opacity = '';
      a.src = ep.src; a.playbackRate = SPEEDS[si];
      a.load();
      if (andPlay) { var p = a.play(); if (p && p.catch) p.catch(function () {}); }
      set(LAST_KEY, { n: n, ts: Date.now() });
      if (opts.onEpisode) opts.onEpisode(n);
    }

    function showNext() {
      var nx = nextAfter(n);
      if (!auto || !nx) return;
      var left = COUNTDOWN, label = next.querySelector('span');
      var draw = function () { label.innerHTML = 'Up next: <b>Chapter ' + nx + ' · ' + esc(EPISODES[nx].title) + '</b> — playing in ' + left + '…'; };
      draw(); next.classList.add('on');
      timer = setInterval(function () { left -= 1; if (left <= 0) { load(nx, true); } else draw(); }, 1000);
      next.querySelector('.go').onclick = function () { load(nx, true); };
      next.querySelector('.stop').onclick = cancelNext;
    }

    a.addEventListener('loadedmetadata', function () {
      dur.textContent = fmt(a.duration);
      var p = position(n); if (p > 5 && p < a.duration - 10) a.currentTime = p;
      lastT = a.currentTime;
    });
    a.addEventListener('timeupdate', function () {
      if (!seeking && a.duration) bar.value = a.currentTime / a.duration * 100;
      cur.textContent = fmt(a.currentTime);
      var d = a.currentTime - lastT; lastT = a.currentTime;
      if (!a.paused && d > 0 && d < 1 + a.playbackRate * 1.5) heard += d;   // only time actually played counts, not jumps
      if (Date.now() - lastSave > 3000) { lastSave = Date.now(); set(POS(n), a.currentTime); set(HEARD(n), Math.round(heard)); }
      if (a.duration && heard >= a.duration * FINISH_SHARE && a.currentTime >= a.duration * 0.9) markDone(n);
    });
    a.addEventListener('seeked', function () { lastT = a.currentTime; });
    a.addEventListener('play', function () { play.textContent = '❚❚'; play.setAttribute('aria-label', 'Pause'); cancelNext(); });
    a.addEventListener('pause', function () { play.textContent = '▶'; play.setAttribute('aria-label', 'Play'); });
    a.addEventListener('ended', function () {
      del(POS(n)); set(HEARD(n), Math.round(heard));
      if (a.duration && heard >= a.duration * FINISH_SHARE) markDone(n);
      showNext();
    });
    a.addEventListener('error', function () { if (!a.getAttribute('src')) return; dur.textContent = 'unavailable'; play.disabled = true; });

    play.addEventListener('click', function () { if (a.paused) a.play(); else a.pause(); });
    bar.addEventListener('input', function () { seeking = true; if (a.duration) cur.textContent = fmt(bar.value / 100 * a.duration); });
    bar.addEventListener('change', function () { if (a.duration) a.currentTime = bar.value / 100 * a.duration; seeking = false; });
    q('.skip').addEventListener('click', function () { a.currentTime = Math.max(0, a.currentTime - 15); });
    spd.addEventListener('click', function () { si = (si + 1) % SPEEDS.length; a.playbackRate = SPEEDS[si]; spd.textContent = SPEEDS[si] + '×'; });
    autoBtn.addEventListener('click', function () {
      auto = !auto; set('dopp_pod_autonext', auto); autoBtn.setAttribute('aria-pressed', auto);
      if (!auto) cancelNext();
    });

    if (startN) load(startN, false);
    return { load: load, audio: a, current: function () { return n; } };
  }

  window.DoppListen = {
    EPISODES: EPISODES, CHAPTERS: CHAPTERS, REALMS: REALMS,
    has: has, chapterUrl: chapterUrl, realmOf: realmOf, nextAfter: nextAfter, allEpisodes: allEpisodes,
    isDone: isDone, doneList: doneList, position: position, last: last, realmStatus: realmStatus,
    continueTarget: continueTarget, sync: sync, onChange: onChange, player: player,
    fmt: fmt, esc: esc
  };
})();

/* demo_tour.js — guided tour + "DEMO" badge for the demo account (added 2026-11-10).
   Loaded by local-guard.js only when the demo account is signed in.
   Tour position lives in localStorage 'dopp_tour' = { i: stepIndex }. A fresh demo sign-in
   sets it to step 0 (quest.html); "Skip" removes it; the 🧭 Tour button restarts it. */
(function () {
  if (window.top !== window.self || window.DoppTour) return;

  var STEPS = [
    { page: 'quest', title: 'Welcome to the demo!',
      text: "You're signed in as Pilot, a sample student who is about 65% of the way through the trimester. Click, play and explore as much as you like. Nothing you do here is saved, and classmates' names are hidden." },
    { page: 'quest', sel: '.hero', title: 'Your hero',
      text: "Each student has a hero with XP, a level, chapters finished and a login streak. XP comes from real work: reading, mastery quizzes, vocab games and class activities." },
    { page: 'quest', sel: '#next-up', title: 'Next up',
      text: "When a student signs in, they land here: today's briefing, what's due today and soon, and about how long each item will take." },
    { page: 'quest', sel: '#survey-cal', title: 'Streak + Survey of the Day',
      text: "Each real login adds to the streak. Every school day has a quick anonymous survey, and the class totals show up on that day's square." },
    { page: 'quest', sel: '#realm-grid', title: 'The realms',
      text: "The course is split into realms (units). Each realm holds its chapters, games and boss battle." },
    { page: 'quest', sel: '#ach-grid', title: 'Achievements',
      text: "Badges are earned automatically as students play, read and master chapters." },
    { page: 'checklist', sel: '.cl-pct', title: 'Trimester checklist',
      text: "This is the whole trimester on one page. Chapters 1–16 are required and 17–28 are bonus. Almost everything is checked off automatically as the student works. Pilot is about 65% done." },
    { page: 'chapter01', title: 'Chapter reader',
      text: "Chapters are short on purpose. A section counts as read once the student scrolls to the end, with a 60-second minimum. Quick Checks are for practice, and each chapter has a podcast." },
    { page: 'mastery', title: 'Mastery quizzes',
      text: "Students prove they understand each chapter here. Passing a chapter earns verified XP." },
    { page: 'arcade/', title: 'The arcade',
      text: "Health-themed arcade games. Every few plays, a chapter question pops up before the next round." },
    { page: 'pet', title: 'Wellness Sprite',
      text: "Each student raises a sprite that thrives on healthy habits and quiz answers, and slips when it's ignored." },
    { page: 'trail', title: 'The Wellness Trail',
      text: "An Oregon Trail–style journey through chapters 1–16. Students can travel alone or in small teams." },
    { page: 'leaderboard', title: 'Hall of Heroes',
      text: "The class leaderboard. In this demo, real students show up as \"Student 12\" and so on." },
    { page: 'ask', title: 'Ask Mr. Dopp',
      text: "An anonymous question box. Students can ask anything, and the teacher answers from the dashboard." },
    { page: 'side_quests', title: 'Side quests',
      text: "Projects outside the chapters, like the PSA Video Challenge, the family project and The Cost of Your Future." },
    { page: 'weight-control-quest', sel: '.path', title: 'Weight Control Quest',
      text: "The island side quest. A group picks 15 foods to live on for life, reads the labels, plans 3 days of meals, sees how a few foods make up most of what they eat, then passes a test on their own foods." },
    { page: 'weight-control-quest', title: 'Island Kitchen',
      text: "The Meals step shows every dish the group can cook from its 15 foods (285 built-in recipes), using the numbers from their own labels. The book keeps learning: students tell it what type a new food is, and a dish students make is shared with everyone once two students make it. It's refreshed automatically at the end of each trimester." },
    { page: 'weight-control-quest', title: 'Energy + balance check',
      text: "The Energy step works like a TDEE calculator: maintenance calories, BMI, ideal weight and macro splits. The menu has to land within 10 lb a year of maintenance before the test unlocks. If it doesn't, students see how to fix it and why gaining or losing too fast is a problem." },
    { page: 'teacher', tab: 'overview', title: 'Now the teacher side',
      text: "This is the real teacher dashboard with real class data, but names are hidden. The buttons respond, but nothing is ever changed." },
    { page: 'teacher', tab: 'progress', title: 'Class progress',
      text: "Every student's XP, streak and badges, sortable by class period." },
    { page: 'teacher', tab: 'progress', sel: '#wr-card', title: 'Island Recipe Book',
      text: "Lower on this page: Weight Control Quest progress, plus the new foods and dishes students have taught the recipe book. Nothing needs approval. Just remove anything that doesn't belong." },
    { page: 'teacher', tab: 'checklist', title: 'Student checklists',
      text: "Open any student to see exactly what they've done and what's missing. These numbers feed the Checklist Progress grade." },
    { page: 'teacher', tab: 'briefing', title: 'Daily briefing',
      text: "The teacher writes a short daily message that every student sees when they sign in." },
    { page: 'teacher', tab: 'ask', title: 'Question inbox',
      text: "Anonymous questions from Ask Mr. Dopp show up here to answer." },
    { page: 'teacher', tab: 'finance', title: 'Grading projects',
      text: "Projects like The Cost of Your Future are reviewed and scored here." },
    { page: 'quest', title: "That's the tour!",
      text: "Keep exploring as long as you like. You can restart the tour anytime with the 🧭 Tour button at the top." }
  ];

  function here() {
    var p = location.pathname;
    if (/\/arcade\/?$/.test(p) || /\/arcade\/index\.html$/.test(p)) return 'arcade/';
    var f = (p.split('/').pop() || 'index').replace(/\.html$/, '');
    return f || 'index';
  }
  function urlFor(page) { return page === 'arcade/' ? '/arcade/' : '/' + page + '.html'; }
  function getI() { try { var t = JSON.parse(localStorage.getItem('dopp_tour') || 'null'); return t && typeof t.i === 'number' ? t.i : -1; } catch (e) { return -1; } }
  function setI(i) { try { if (i < 0) localStorage.removeItem('dopp_tour'); else localStorage.setItem('dopp_tour', JSON.stringify({ i: i })); } catch (e) {} }

  var css = '' +
    '.dt-bar{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483000;display:flex;gap:6px;align-items:center;' +
    'background:#1b1036;color:#FFD700;border:1px solid rgba(255,215,0,.55);border-radius:999px;padding:5px 6px 5px 12px;' +
    'font:800 12px/1.2 Nunito,system-ui,sans-serif;box-shadow:0 8px 24px -8px rgba(0,0,0,.7)}' +
    '.dt-bar span{white-space:nowrap}.dt-bar button{font:800 12px Nunito,system-ui,sans-serif;border:0;border-radius:999px;padding:5px 10px;cursor:pointer;background:#FFD700;color:#1b1036}' +
    '.dt-card{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483001;width:min(440px,calc(100vw - 24px));' +
    'background:#14102a;color:#f3f0ff;border:1px solid rgba(255,215,0,.5);border-radius:16px;padding:16px 18px 14px;' +
    'font:500 15px/1.45 Nunito,system-ui,sans-serif;box-shadow:0 20px 60px -15px rgba(0,0,0,.85)}' +
    '.dt-card h3{margin:0 0 6px;font:900 17px Nunito,system-ui,sans-serif;color:#FFD700}.dt-card p{margin:0}' +
    '.dt-row{display:flex;align-items:center;gap:8px;margin-top:12px}.dt-n{font-size:12px;color:#a9a3c9;margin-right:auto}' +
    '.dt-row button{font:800 13px Nunito,system-ui,sans-serif;border-radius:10px;padding:7px 13px;cursor:pointer;border:1px solid rgba(255,255,255,.2);background:transparent;color:#f3f0ff}' +
    '.dt-row .dt-go{background:linear-gradient(90deg,#FFD700,#ff9f1c);color:#1b1036;border:0}' +
    '.dt-hi{outline:3px solid #FFD700!important;outline-offset:4px!important;border-radius:12px;box-shadow:0 0 0 9999px rgba(5,3,15,.45)!important;position:relative;z-index:2147482999}' +
    '.dt-toast{position:fixed;top:52px;left:50%;transform:translateX(-50%);z-index:2147483002;background:#00E5A0;color:#06281d;' +
    'font:800 13px Nunito,system-ui,sans-serif;padding:8px 14px;border-radius:10px;box-shadow:0 10px 30px -10px rgba(0,0,0,.6);transition:opacity .4s}' +
    '@media print{.dt-bar,.dt-card,.dt-toast{display:none!important}}';

  var card = null, hi = null;
  function clearHi() { if (hi) { hi.classList.remove('dt-hi'); hi = null; } }
  function close() { clearHi(); if (card) { card.remove(); card = null; } }

  function go(i) {
    if (i >= STEPS.length) { setI(-1); close(); return; }
    if (i < 0) i = 0;
    setI(i);
    var st = STEPS[i];
    if (st.page !== here()) { location.href = urlFor(st.page); return; }
    show(i);
  }

  function show(i) {
    close();
    var st = STEPS[i];
    if (st.tab && typeof window.showPage === 'function') {
      var b = document.querySelector('.sb-btn[onclick*="\'' + st.tab + '\'"]');
      try { window.showPage(st.tab, b); } catch (e) {}
    }
    card = document.createElement('div');
    card.className = 'dt-card'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'Guided tour');
    card.innerHTML = '<h3></h3><p></p><div class="dt-row"><span class="dt-n"></span>' +
      (i > 0 ? '<button class="dt-back">Back</button>' : '') +
      '<button class="dt-skip">' + (i === STEPS.length - 1 ? 'Close' : 'Skip tour') + '</button>' +
      (i < STEPS.length - 1 ? '<button class="dt-go">Next →</button>' : '') + '</div>';
    card.querySelector('h3').textContent = st.title;
    card.querySelector('p').textContent = st.text;
    card.querySelector('.dt-n').textContent = (i + 1) + ' / ' + STEPS.length;
    document.body.appendChild(card);
    var bk = card.querySelector('.dt-back'); if (bk) bk.onclick = function () { go(i - 1); };
    card.querySelector('.dt-skip').onclick = function () { setI(-1); close(); };
    var nx = card.querySelector('.dt-go'); if (nx) nx.onclick = function () { go(i + 1); };
    if (st.sel) {
      var tries = 0;
      (function find() {
        var el = document.querySelector(st.sel);
        if (el && el.offsetParent !== null) {
          hi = el; el.classList.add('dt-hi');
          try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { el.scrollIntoView(); }
        } else if (++tries < 20 && card) setTimeout(find, 250);   // wait for the page to finish loading
      })();
    } else { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {} }
  }

  function toast(msg) {
    var t = document.createElement('div'); t.className = 'dt-toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 450); }, 2600);
  }

  function boot() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var bar = document.createElement('div'); bar.className = 'dt-bar';
    bar.innerHTML = '<span>DEMO · nothing is saved</span><button type="button">🧭 Tour</button>';
    bar.querySelector('button').onclick = function () { go(0); };
    document.body.appendChild(bar);
    var last = 0;
    window.addEventListener('dopp-demo-note', function (e) { if (Date.now() - last > 1500) { last = Date.now(); toast(e.detail); } });
    var i = getI();
    if (i >= 0 && i < STEPS.length) {
      if (STEPS[i].page === here()) setTimeout(function () { show(i); }, 600);
      // on another page mid-tour (e.g. the student clicked a link): leave a way back
      else if (i > 0) { var r = document.createElement('button'); r.textContent = 'Resume tour'; r.onclick = function () { go(i); }; bar.appendChild(r); }
    }
  }
  window.DoppTour = { start: function () { go(0); }, steps: STEPS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

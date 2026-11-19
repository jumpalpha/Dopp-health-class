/* guide_data.js — the student guide's shared data (added 2026-11-18, T2 prep).
 * Used by tour.html (interactive tour + "Where do I find…?"), start.html (Start Here guide)
 * and student_guide.js (the ❓ Help button on every page).
 * To change an answer, edit FAQ below. Each entry: q = the question as students ask it,
 * k = extra search words, a = the answer, href = where to send them, go = button text.
 */
(function (root) {
  if (root.DoppGuide) return;

  // ── Tour stops, in the order a new student meets them ──
  var STOPS = [
    { id: 'home', icon: '🏠', title: 'The Home page', href: '/',
      why: 'Your front door. Every page has the same top menu, so you can always get back here.',
      look: ['The top menu: Today, Chapters, ✏️ Classwork, Arcade, Quest, My Sprite, Hall', 'The gold Checklist button (top right) is your to-do list', 'The 🔍 magnifying glass searches the whole site'] },
    { id: 'quest', icon: '⚔', title: 'Sign in on the Quest page', href: '/quest.html',
      why: 'Day one, you sign in here with the class code Mr. Dopp gives your period. Your device remembers you until the trimester ends. Your realms and badges fill in as you finish your Checklist.',
      look: ['Gold "Sign in with my class code" button', 'New? Create your hero with your REAL first and last name and a 4-digit PIN', 'Write your PIN down somewhere safe'] },
    { id: 'today', icon: '📣', title: 'Today: your daily start screen', href: '/welcome.html',
      why: 'Start every class here. Your first visit each day opens it for you. It shows today\'s briefing, the Survey of the Day, and what\'s due today and soon, with how long each takes.',
      look: ['📣 Today\'s briefing from Mr. Dopp', '🔥 Due today and 🗓 Coming up soon', 'Reach it any time from "Today" in the top menu'] },
    { id: 'checklist', icon: '📋', title: 'Your Trimester Checklist', href: '/checklist.html',
      why: 'The one list of everything you need to do this trimester, in order. Most items check themselves off when you do the work.',
      look: ['Chapters 1–16 in order; 17–28 are a light track you can do any time', '🔒 items check themselves when the site sees you do them', 'Your checklist % is part of your grade'] },
    { id: 'chapters', icon: '📖', title: 'Chapters: read and learn', href: '/chapters/',
      why: 'Every chapter has the reading, the PDF, a podcast recap, vocab games and Quick Checks.',
      look: ['Read every lesson all the way to the end; that\'s how reading gets checked off', 'Answer the Quick Check after each lesson', 'Vocab games are under the reading'] },
    { id: 'classwork', icon: '✏️', title: 'Classwork: Learn, Test, Stories', href: '/classwork.html',
      why: 'For each chapter: learn the words, take the Chapter Test, and write three short true stories using vocab words.',
      look: ['Learn the words first (80% opens the next chapter)', 'Chapter Test, then 3 stories (25+ words each)', '✏️ Classwork is in the top menu'] },
    { id: 'mastery', icon: '🎓', title: 'Chapter Mastery', href: '/mastery.html',
      why: 'A 10-question practice check for each chapter. Get 8 right to pass. It\'s practice, not your real test.',
      look: ['Pick your chapter', 'Retake as often as you like', 'Passing earns XP'] },
    { id: 'sprite', icon: '🐣', title: 'My Sprite', href: '/pet.html',
      why: 'Your Wellness Sprite grows from an egg to an adult in 30 care days. Pick up to 6 of 12 real healthy habits a day; 3 or more makes a care day. If it fades you lose growth and XP.',
      look: ['Hatch it on day one', 'Read "How your sprite works" at the top', 'Answer chapter questions to earn 💡 for the Care Kit and Shop'] },
    { id: 'arcade', icon: '🕹️', title: 'The Arcade', href: '/arcade/',
      why: 'Health games starring your sprite. Playing them is part of your checklist, and they quiz you between rounds.',
      look: ['Solo games, partner games and Activities like Art Studio', '🏆 Leaderboard shows top scores', 'Sign in first so your plays count'] },
    { id: 'side', icon: '🗺', title: 'Side Quests', href: '/side_quests.html',
      why: 'Projects and bonus missions: the family project, PSA videos, The Cost of Your Future, CPR & AED and more.',
      look: ['Some are assigned in class (Mr. Dopp will tell you)', 'Others are optional bonus', 'Turn in screenshots/photos on Schoology when asked'] },
    { id: 'ask', icon: '💬', title: 'Ask Mr. Dopp', href: '/ask.html',
      why: 'Ask any health question anonymously. Mr. Dopp posts answers for the whole class.',
      look: ['No name attached', 'Read answers to other students\' questions'] },
    { id: 'hall', icon: '🏆', title: 'Hall of Heroes', href: '/leaderboard.html',
      why: 'See every hero\'s sprite, badges and XP for your class.',
      look: ['Badges you earn show up here', 'The Arcade Leaderboard is separate (🏆 in the menu)'] }
  ];

  // ── "Where do I find…?" answers ──
  var FAQ = [
    { q: 'How do I sign in?', k: 'login log in sign up account class code join register pin', a: 'Go to the Quest page and tap "Sign in with my class code." Enter the code Mr. Dopp gives your period, then tap your name and type your 4-digit PIN. New? Create your hero with your real first and last name.', href: '/quest.html', go: 'Open the Quest page' },
    { q: 'I forgot my PIN', k: 'pin forgot reset password lost cant sign in locked', a: 'Ask Mr. Dopp. He can reset your PIN from the Teacher Dashboard. Don\'t make a second account; your progress is on the first one.', href: '/quest.html', go: 'Quest page' },
    { q: 'What is the class code?', k: 'class code period code join', a: 'Mr. Dopp gives each period its own class code on the first day. It\'s usually on the board. Ask him if you missed it.', href: '/quest.html', go: 'Quest page' },
    { q: 'What do I do today?', k: 'today daily start due assignment homework now plan briefing what should', a: 'Open Today. It shows Mr. Dopp\'s briefing, the Survey of the Day, and what\'s due today and soon, with time estimates.', href: '/welcome.html', go: 'Open Today' },
    { q: 'Where is my to-do list?', k: 'checklist todo to-do tasks list progress what is left missing percent grade', a: 'Your Trimester Checklist, the gold Checklist button at the top right of every page. It lists everything in order and most items check themselves off.', href: '/checklist.html', go: 'Open my Checklist' },
    { q: 'Why didn\'t my reading check off?', k: 'reading not counted check off read lesson scroll credit', a: 'Scroll to the end of each lesson and keep it on screen at least 15 seconds. Answer the Quick Check after each lesson. Make sure you\'re signed in on that device.', href: '/checklist.html', go: 'Check my Checklist' },
    { q: 'Where are the chapters?', k: 'chapter reading read book lesson textbook', a: 'Tap Chapters in the top menu, then pick your chapter. Each one has the reading, the PDF, a podcast and vocab games.', href: '/chapters/', go: 'Open Chapters' },
    { q: 'Where is the chapter PDF?', k: 'pdf print download textbook file', a: 'Open the chapter. The PDF is the first box at the top, and also on the right side of the page.', href: '/chapters/', go: 'Open Chapters' },
    { q: 'Can the site read to me?', k: 'listen audio read aloud podcast text reader voice hear', a: 'Yes. Each chapter has a podcast recap at the top of the reading. The Text Reader reads any text, file or web link out loud.', href: '/textreader/', go: 'Open the Text Reader' },
    { q: 'Where are the vocab games?', k: 'vocab vocabulary words flashcard speed quiz word builder concept map terms games', a: 'Open the chapter and scroll past the reading to Vocabulary Games. Your checklist wants all 4 (Flashcard, Speed Quiz, Word Builder, Concept Map) at 70% or better.', href: '/chapters/', go: 'Open Chapters' },
    { q: 'Where is Classwork?', k: 'classwork class work learn stories story chapter test unit test vocab mastery turn in', a: 'Tap ✏️ Classwork in the top menu (it\'s also linked from each chapter on your Checklist). Order: Learn the words → Chapter Test → 3 stories.', href: '/classwork.html', go: 'Open Classwork' },
    { q: 'How do the Classwork stories work?', k: 'story stories write words personal true 25 words', a: 'Write 3 short stories per chapter, each using 2 vocab words you pick (all 6 different), 25+ words each. They should be true or based on real life. Only Mr. Dopp reads them.', href: '/classwork.html', go: 'Open Classwork' },
    { q: 'Where is the Unit Test?', k: 'unit test exam realm test', a: 'Unit Tests are in Classwork after you finish all the unit\'s chapters. You need 80% and you can retake it.', href: '/classwork.html', go: 'Open Classwork' },
    { q: 'What is Chapter Mastery?', k: 'mastery practice quiz 8 of 10 check', a: 'A 10-question practice quiz for each chapter. Get 8 right to pass. Retake as much as you want.', href: '/mastery.html', go: 'Open Chapter Mastery' },
    { q: 'Where do I turn things in?', k: 'turn in submit upload schoology screenshot photo drawing video', a: 'Work done on doppsclass.com saves itself. Files (drawings, screenshots, videos) still go to the matching assignment in Schoology. Schoology is the gradebook.', href: '/checklist.html', go: 'See what\'s due' },
    { q: 'Where are my grades?', k: 'grade grades score points schoology gradebook', a: 'Grades are in Schoology. Your Checklist % here counts toward your grade, so keep it climbing.', href: '/checklist.html', go: 'Open my Checklist' },
    { q: 'My sprite died / faded', k: 'sprite died dead faded ghost revive bring back', a: 'Answer 10 chapter questions right on the My Sprite page to revive it. Fading costs 3 care days of growth and 25 Quest XP, and growth is frozen until it\'s back.', href: '/pet.html', go: 'Open My Sprite' },
    { q: 'Do I have to do chapters 17–28?', k: 'chapter 17 18 19 20 21 22 23 24 25 26 27 28 light track bonus required later chapters', a: 'Yes, as a light track. They\'re open from day one, in any order. For each one: read it, pass Classwork Learn (80%), and pass Chapter Mastery. About 40 minutes each. Your Checklist shows an "aim by" Friday for each to keep you on pace (about one a week); the real deadline is the end of the trimester.', href: '/checklist.html', go: 'See them on my Checklist' },
    { q: 'Where is my sprite?', k: 'sprite pet tamagotchi companion hatch feed care', a: 'Tap My Sprite in the top menu. Hatch it, then each day pick up to 6 of 12 healthy habits you really did (3+ = a care day). 30 care days makes it an adult. If it fades, answer 10 chapter questions to revive it.', href: '/pet.html', go: 'Open My Sprite' },
    { q: 'Where are the games?', k: 'arcade games play fun game', a: 'Tap Arcade in the top menu. Sign in first so your plays count on your checklist.', href: '/arcade/', go: 'Open the Arcade' },
    { q: 'Where is the leaderboard?', k: 'leaderboard high score top scores best rank', a: 'The 🏆 Leaderboard in the top menu shows arcade high scores. The Hall shows every hero\'s sprite, badges and XP.', href: '/arcade_leaderboard.html', go: 'Open the Leaderboard' },
    { q: 'Where can I see my XP and badges?', k: 'xp badges achievements trophies level points hall heroes', a: 'Your badges and achievements are on the Quest page after you sign in. The Hall of Heroes shows the whole class.', href: '/quest.html', go: 'Open the Quest page' },
    { q: 'What are Side Quests?', k: 'side quest project projects bonus extra credit optional mission', a: 'Projects and bonus missions: Roots & Branches (family project), PSA Video Challenge, The Cost of Your Future, CPR & AED and more. Mr. Dopp tells you which ones are assigned.', href: '/side_quests.html', go: 'Open Side Quests' },
    { q: 'Where is the family project?', k: 'family project roots branches unit 3 drawing familysearch', a: 'Roots & Branches is the Unit 3 project, after Chapter 9. Photograph your drawing and attach it to the Schoology assignment.', href: '/family_quest.html', go: 'Open Roots & Branches' },
    { q: 'Where is the PSA video project?', k: 'psa video challenge group project film', a: 'The PSA Video Challenge instructions are in Side Quests.', href: '/psa_challenge.html', go: 'Open PSA Challenge' },
    { q: 'Where is The Cost of Your Future?', k: 'finance money budget cost of your future financial health', a: 'The Cost of Your Future is the money and financial health assignment. Finish it, then screenshot your certificate for Schoology.', href: '/finance.html', go: 'Open it' },
    { q: 'Where is the Weight Control Quest?', k: 'weight control quest island food calories nutrition 15 foods', a: 'The Weight Control Quest is in Side Quests. Your group picks 15 foods for the island and builds 3 days of meals.', href: '/weight-control-quest.html', go: 'Open the quest' },
    { q: 'Where is the CPR stuff?', k: 'cpr aed first aid chapter 27 hands only', a: 'The CPR & AED Side Quest gets you ready. The hands-on part happens in class and Mr. Dopp checks it off.', href: '/cpr_aed_quest.html', go: 'Open CPR & AED' },
    { q: 'How do I ask Mr. Dopp a question?', k: 'ask question anonymous private help teacher', a: 'Use Ask Mr. Dopp. It\'s anonymous, and he posts answers for the class.', href: '/ask.html', go: 'Open Ask Mr. Dopp' },
    { q: 'Where is the debate / Pick a Side?', k: 'debate pick a side discuss opinion bell ringer topic', a: 'Pick a Side has the daily debate question.', href: '/pick_a_side.html', go: 'Open Pick a Side' },
    { q: 'How do I join the live game?', k: 'live game join kahoot gimkit coin quest live play along in class', a: 'When Mr. Dopp starts a live game, open Join Live Game and enter the code on the board. Sign in first so it counts.', href: '/live.html', go: 'Join Live Game' },
    { q: 'Where is the Survey of the Day?', k: 'survey poll vote question of the day', a: 'It\'s on your Today screen. Vote, then see the class results.', href: '/welcome.html', go: 'Open Today' },
    { q: 'Where is the Wellness Trail?', k: 'trail oregon wagon journey', a: 'The Wellness Trail is in the Arcade. Playing on 3 different days is on your checklist.', href: '/trail.html', go: 'Open the Trail' },
    { q: 'Where is the Reading Check?', k: 'reading level reading test reading check', a: 'After you sign in, the Reading Check link is on your Quest page. Your result is private: only you and Mr. Dopp see it.', href: '/reading_check.html', go: 'Open Reading Check' },
    { q: 'How do I review weak spots?', k: 'review weak spots study practice again retake', a: 'Replay a vocab game you scored under 80% on, or retake a Mastery check you missed. The Review Deck helps too.', href: '/review.html', go: 'Open Review Deck' },
    { q: 'How do I find something fast?', k: 'search find look up magnifying glass', a: 'Tap the 🔍 at the top right of any page and type what you\'re looking for.', href: '/search.html', go: 'Open Search' },
    { q: 'How do I switch light and dark mode?', k: 'dark mode light mode theme bright sun moon', a: 'Tap the sun/moon button next to the search icon. Each page remembers your choice.', href: '/', go: 'Home' },
    { q: 'I was in this class last trimester', k: 'last trimester old account visitor past student graduate', a: 'Use the Visitors page with your old last name and PIN to see your old hero.', href: '/visitor.html', go: 'Open Visitors' },
    { q: 'What are Realms?', k: 'realm realms unit units map badge', a: 'Each Realm is a unit of chapters (Realm I = Chapters 1–2, and so on). Finishing a realm earns its badge.', href: '/realms/', go: 'Open Realms' },
    { q: 'Can I use ChatGPT for the AI Guide activities?', k: 'ai guide chatgpt outside site', a: 'AI Guide activities open ChatGPT, an outside site not run by Dopps Class. Never type your name or personal information there.', href: '/chapters/', go: 'Chapters' },
    { q: 'How do I take the tour again?', k: 'tour help new start here guide instructions how does this work', a: 'Open the tour any time from the ❓ Help button or Start Here.', href: '/tour.html', go: 'Take the tour' },
    { q: 'Where are the beginning instructions?', k: 'instructions start here guide new student first day', a: 'Start Here explains the whole site and how the trimester flows.', href: '/start.html', go: 'Open Start Here' }
  ];

  function norm(s) { return String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  var STOP = /^(the|a|an|is|are|do|does|i|my|me|to|of|in|on|for|where|how|what|can|find|get|it|this|that|and|or|go|when|whats|wheres|im)$/;

  // Simple word-match scoring: no AI, works offline, never sends what students type anywhere.
  function find(query, max) {
    var words = norm(query).split(' ').filter(function (w) { return w && !STOP.test(w); });
    if (!words.length) return [];
    var out = FAQ.map(function (f) {
      var hayQ = ' ' + norm(f.q) + ' ', hayK = ' ' + norm(f.k) + ' ', s = 0;
      words.forEach(function (w) {
        var stem = w.length > 4 ? w.replace(/(ing|es|s)$/, '') : w;
        if (hayQ.indexOf(' ' + w + ' ') > -1) s += 3; else if (hayQ.indexOf(stem) > -1) s += 2;
        if (hayK.indexOf(' ' + w + ' ') > -1) s += 2; else if (stem.length > 2 && hayK.indexOf(stem) > -1) s += 1;
      });
      return { f: f, s: s };
    }).filter(function (x) { return x.s > 0; });
    out.sort(function (a, b) { return b.s - a.s; });
    return out.slice(0, max || 3).map(function (x) { return x.f; });
  }

  root.DoppGuide = { STOPS: STOPS, FAQ: FAQ, find: find };
})(window);

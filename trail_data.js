// The Wellness Trail — content (landmarks, events, tips). Used by trail.html.
// Mostly chapters 1–16 (Realms 1–5). A few later chapters appear only as occasional extras.
//
// Event format:
//   { id, realm (1-5, or 0 = any realm), ch, title, text, choices: [ [label, good?, effects, feedback], ... ] }
// Effects (all optional): body / mind / social (health triangle), food, water, meds, parts, coins,
//   day (lose a trail day), hurt / sick (a random traveler gets hurt / sick), heal (cure one), hp (random traveler hp change)
// A good answer also earns +5 coins and counts toward the score.
(function () {

window.TRAIL_TOTAL = 1200;
window.TRAIL_DAY_CAP = 200;

window.TRAIL_REALMS = [
  { n: 1, name: 'Foundation Keep',    chs: [1, 2],           color: '#7FB069', sky: ['#8ec5ff', '#f6e7b4'] },
  { n: 2, name: 'Mind Citadel',       chs: [3, 4, 5],        color: '#9B8CE0', sky: ['#9fb6ff', '#f2d6ff'] },
  { n: 3, name: 'Relationship Realm', chs: [6, 7, 8, 9],     color: '#E58FA8', sky: ['#ffb38a', '#ffe1b8'] },
  { n: 4, name: 'Nourish Dungeon',    chs: [10, 11, 12],     color: '#E8B04A', sky: ['#7fd3c8', '#fff0b3'] },
  { n: 5, name: 'Body Labyrinth',     chs: [13, 14, 15, 16], color: '#5FB7D4', sky: ['#5a7fd6', '#ffc9a3'] }
];

// kind: fort (trading post + Realm Trial), river (crossing + water), spring (water), sight (scenic), forage, steep, finish
window.TRAIL_LANDMARKS = [
  { mi: 0,    name: 'Foundation Keep',   kind: 'start',  icon: '🏰', text: 'Your journey begins. Five realms and 1,200 miles stand between you and Wellness Valley.' },
  { mi: 80,   name: 'Crossroads Creek',  kind: 'spring', icon: '💧', text: 'A clear creek where the trail splits. Good place to refill water.' },
  { mi: 160,  name: 'Goal Mesa',         kind: 'sight',  icon: '⛰️', text: 'From the top of Goal Mesa you can see the whole road ahead. Your party feels motivated.' },
  { mi: 240,  name: 'Mind Citadel',      kind: 'fort',   icon: '🏯', realm: 1, text: 'The gates of the Mind Citadel. A trading post, and a Realm Trial on Chapters 1–2.' },
  { mi: 320,  name: 'Stress River',      kind: 'river',  icon: '🌊', text: 'Stress River runs fast and loud. You have to get across.' },
  { mi: 400,  name: 'Calm Springs',      kind: 'spring', icon: '♨️', text: 'Warm, quiet springs. Your party breathes easier here.' },
  { mi: 480,  name: 'Relationship Realm',kind: 'fort',   icon: '🏘️', realm: 2, text: 'A busy frontier town. A trading post, and a Realm Trial on Chapters 3–5.' },
  { mi: 560,  name: 'Peer Pass',         kind: 'sight',  icon: '🪨', text: 'A narrow pass where wagon trains bunch up. Everyone has an opinion about how to go.' },
  { mi: 640,  name: 'Family River',      kind: 'river',  icon: '🌊', text: 'Family River is wide and muddy. Time to decide how to cross.' },
  { mi: 720,  name: 'Nourish Dungeon',   kind: 'fort',   icon: '🏚️', realm: 3, text: 'An old stone fort full of food stalls. A trading post, and a Realm Trial on Chapters 6–9.' },
  { mi: 800,  name: 'Orchard Valley',    kind: 'forage', icon: '🍎', text: 'Fruit trees and berry bushes everywhere. Great foraging, and a spring for water.' },
  { mi: 880,  name: 'Hydration River',   kind: 'river',  icon: '🌊', text: 'Snowmelt makes Hydration River cold and deep.' },
  { mi: 960,  name: 'Body Labyrinth',    kind: 'fort',   icon: '🏛️', realm: 4, text: 'A maze-like mountain fort. A trading post, and a Realm Trial on Chapters 10–12.' },
  { mi: 1040, name: 'Backbone Ridge',    kind: 'sight',  icon: '🦴', text: 'A long rocky spine of a ridge. Watch your footing.' },
  { mi: 1120, name: 'Heartbeat Pass',    kind: 'steep',  icon: '❤️', text: 'The steepest climb on the trail. Hearts pound, lungs burn. A spring waits at the top.' },
  { mi: 1200, name: 'Wellness Valley',   kind: 'finish', icon: '🌄', realm: 5, text: 'You made it to Wellness Valley! One last Realm Trial on Chapters 13–16.' }
];

window.TRAIL_PACE = {
  steady:   { label: 'Steady',   mi: 12, body: 0,  mind: 0,  note: '12 mi/day · easy on the body' },
  brisk:    { label: 'Brisk',    mi: 16, body: -1, mind: -1, note: '16 mi/day · a little tiring' },
  grueling: { label: 'Grueling', mi: 20, body: -3, mind: -2, note: '20 mi/day · fastest, wears you down' }
};
window.TRAIL_RATIONS = {
  balanced: { label: 'Balanced meals', food: 2, body: 1,  mind: 0,  note: '2 lb per person · keeps you strong' },
  light:    { label: 'Light meals',    food: 1, body: -1, mind: -1, note: '1 lb per person · saves food' },
  skip:     { label: 'Skip meals',     food: 0, body: -4, mind: -3, note: 'no food · energy and mood crash fast' }
};
window.TRAIL_PRICES = { food: [25, 8, 'lb of food'], water: [5, 4, 'days of water'], meds: [1, 12, 'medicine kit'], parts: [1, 10, 'spare wagon part'] };

window.TRAIL_BOT_NAMES = ['Rosa', 'Eli', 'Maya', 'Theo', 'Ana', 'Sam', 'Jade', 'Leo', 'Nia', 'Owen'];
window.TRAIL_COMPANIONS = ['Jake', 'Brielle', 'Marcus', 'Hazel', 'Tomas', 'Kenzie'];

// Preset tips for trail markers (no free text, so nothing inappropriate can be posted)
window.TRAIL_TIPS = [
  'Boil or filter river water before you drink it.',                       // 0
  'Wash hands for 20 seconds before you eat.',                             // 1
  'Balanced meals keep your body side of the triangle strong.',            // 2
  'Skipping meals crashes your energy and your mood.',                     // 3
  'Rest days are part of training, not a waste of time.',                  // 4
  'Talk it out. Bottling up stress makes it worse.',                       // 5
  'Never cross moving water deeper than your knees.',                      // 6
  'Sunscreen SPF 30+, and reapply every 2 hours.',                         // 7
  'Sprain? Rest, Ice, Compression, Elevation.',                            // 8
  'Hit your head? Stop, rest, and get checked.',                           // 9
  'Drink water before you feel thirsty.',                                  // 10
  'Pushing too hard every day wears the whole party down.',                // 11
  'Check food labels: 5% DV is low, 20% DV is high.',                      // 12
  'Leftovers out more than 2 hours? Toss them.',                           // 13
  'A friend who controls you is not a healthy friend.',                    // 14
  'Say no, give a reason, and offer something better.',                    // 15
  'Use I-messages: "I feel ___ when ___."',                                // 16
  'Get a trusted adult when someone is struggling.',                       // 17
  'Grief takes time. Let people remember out loud.',                       // 18
  'SMART goals beat "go really far soon."',                                // 19
  'Calcium and vitamin D build strong bones.',                             // 20
  'Fiber and water keep digestion moving.',                                // 21
  'Low blood sugar? Fast sugar first, then a snack.',                      // 22
  'Warm up before hard work, cool down after.',                            // 23
  'Lightning? Get off ridges and away from lone trees.',                   // 24
  'Drown, stir, feel: make sure the campfire is out.',                     // 25
  'Burns: cool running water, never butter.',                              // 26
  'Bleeding: press firmly on the wound.',                                  // 27
  'Carbs are your main fuel for hard climbs.',                             // 28
  'Fad diets skip food groups. Skip the fad diet.',                        // 29
  'Heat exhaustion: shade, water, rest.',                                  // 30
  'Include the new kid. Cliques hurt everyone.',                           // 31
  'Ask for evidence before you buy a "miracle" cure.',                     // 32
  'Sleep is when your body and brain recover.',                            // 33
  'Help your convoy and the whole convoy does better.',                    // 34
  'Positive self-talk: be as kind to yourself as to a friend.',            // 35
  'Medicine is for the person it was meant for.',                          // 36
  'Brush twice a day and floss.',                                          // 37
  'Aerobic exercise makes your heart stronger.',                           // 38
  'Keep your health triangle balanced: body, mind, social.'                // 39
];

const E = (id, realm, ch, title, text, choices) => ({ id, realm, ch, title, text, choices });

window.TRAIL_EVENTS = [
// ───────────── Realm 1 · Chapters 1–2 ─────────────
E('r1-fork', 1, 2, 'Fork in the Trail',
  'The trail splits. A hand-drawn sign points left to a "shortcut" through a swamp. The main road goes right. Your party is arguing. What do you do?',
  [['Stop. List the options, weigh the pros and cons of each, then decide.', true, { mind: 4 }, 'That\'s the decision-making process (Ch 2): state the situation, list options, weigh outcomes, decide, then evaluate. You take the main road and avoid a muddy mess.'],
   ['Take the shortcut. Shortcuts are always faster.', false, { day: 1, body: -3 }, 'Snap decisions skip the "weigh the outcomes" step (Ch 2). The swamp swallows a full day and leaves everyone soaked.'],
   ['Go whichever way the loudest traveler wants.', false, { day: 1, social: -3 }, 'Letting volume decide isn\'t a decision process (Ch 2). The loud choice was the swamp. You lose a day.']]),
E('r1-tonic', 1, 2, 'The Miracle Tonic',
  'A smooth-talking peddler waves a bottle: "Dr. Sparkle\'s Miracle Tonic! Cures EVERYTHING! Only 30 coins!"',
  [['Ask what\'s in it and what evidence shows it works, then walk away.', true, { mind: 3 }, 'Health literacy (Ch 1–2): reliable products show real ingredients and real evidence. "Cures everything" is a classic false-advertising claim.'],
   ['Buy one. It says it cures everything!', false, { coins: -30 }, 'Claims that sound too good to be true usually are (Ch 2, analyzing influences). It\'s flavored creek water. 30 coins gone.'],
   ['Buy two, so the whole party is covered.', false, { coins: -40, mind: -2 }, 'Double the money, zero the benefit. Always check the source and the evidence (Ch 2).']]),
E('r1-triangle', 1, 1, 'Something\'s Off',
  'One of your travelers is strong and eating well, but hasn\'t talked to anyone in days and sits alone at meals. Which side of the health triangle needs attention?',
  [['Social. Invite them in, sit with them, and talk.', true, { social: 8 }, 'Right. The health triangle has physical, mental/emotional, and social sides (Ch 1). Being fit doesn\'t cover a lonely week.'],
   ['Physical. Give them extra food.', false, { food: -6 }, 'Their body side is fine. The gap is social (Ch 1). They eat the food and stay lonely.'],
   ['None. If they\'re not sick, they\'re healthy.', false, { social: -4 }, 'Health is more than not being sick (Ch 1). It\'s a balance of body, mind, and social well-being.']]),
E('r1-goal', 1, 2, 'Setting a Goal',
  'Your party wants to make real progress this week. Which goal is a SMART goal?',
  [['"Travel 60 miles in the next 4 days, checking our progress each night."', true, { mind: 5 }, 'Specific, Measurable, Achievable, Realistic, Time-bound (Ch 2). Everyone knows exactly what "on track" looks like.'],
   ['"Go really far soon."', false, { mind: -2 }, 'Not specific, not measurable, no deadline (Ch 2). Nobody can tell if you\'re succeeding.'],
   ['"Travel 500 miles by tomorrow."', false, { mind: -3, body: -2 }, 'That\'s not achievable or realistic (Ch 2). The party feels defeated before you even start.']]),
E('r1-cliff', 1, 1, 'Selfie at the Edge',
  'A traveler wants to climb out onto a crumbling cliff edge for the perfect view. No rope. Everyone\'s watching.',
  [['Stay back. The view isn\'t worth the risk.', true, { mind: 2 }, 'That\'s avoiding a risk behavior (Ch 1): an action that raises the chance of injury for very little reward.'],
   ['Go for it, but be quick.', false, { hurt: 1 }, 'The edge crumbles. A short fall and a banged-up traveler. Risk behaviors add up (Ch 1).'],
   ['Dare someone else to do it instead.', false, { hurt: 1, social: -4 }, 'Pressuring others into risk behaviors hurts the group too (Ch 1). Someone gets hurt.']]),
E('r1-heredity', 1, 1, '"It Runs in My Family"',
  'A traveler shrugs: "Heart problems run in my family, so it doesn\'t matter what I eat or do." What\'s true?',
  [['Heredity matters, but lifestyle choices can still lower your risk a lot.', true, { body: 3, mind: 3 }, 'Heredity is one influence on health; lifestyle factors like diet, activity, and not smoking are others you control (Ch 1).'],
   ['They\'re right. Genes decide everything.', false, { mind: -3 }, 'Heredity raises or lowers risk, but your habits still make a big difference (Ch 1).'],
   ['Only exercise matters; food doesn\'t.', false, { body: -2 }, 'Both diet and activity are lifestyle factors that affect heart health (Ch 1, Ch 10–12).']]),
E('r1-prevent', 1, 1, 'Before the Long Road',
  'You pass a trader selling wide-brim hats and spare socks before a long sunny stretch. You have a few coins.',
  [['Buy them now. Preventing blisters and sunburn is easier than treating them.', true, { coins: -6, body: 4 }, 'That\'s prevention (Ch 1): taking action before a problem happens.'],
   ['Skip it. Deal with problems when they show up.', false, { hp: -8 }, 'Three days later: sunburn and blisters. Prevention beats treatment (Ch 1).'],
   ['Buy fancy boots for 40 coins instead.', false, { coins: -40 }, 'Expensive isn\'t the same as effective. Simple prevention works (Ch 1).']]),
E('r1-advocacy', 1, 2, 'Polluted Spring',
  'Someone has been washing muddy gear right in the spring everyone drinks from. Other wagons are getting sick.',
  [['Post a sign and talk to the other wagons about keeping the spring clean.', true, { social: 6, mind: 2 }, 'That\'s advocacy (Ch 2): speaking up to help the health of your whole community.'],
   ['Ignore it. Not your gear, not your problem.', false, { sick: 1 }, 'Community health affects you too (Ch 1–2). One of your travelers gets sick from the water.'],
   ['Wash your gear there too, since everyone else does.', false, { sick: 1, social: -3 }, 'Following the crowd into a bad habit spreads the problem (Ch 2).']]),

// ───────────── Realm 2 · Chapters 3–5 ─────────────
E('r2-cope', 2, 4, 'The Roar of Stress River',
  'You can hear the rapids from camp. Your party is tense and snapping at each other. What\'s the healthiest way to handle it?',
  [['Take slow deep breaths together, then make a clear crossing plan.', true, { mind: 6 }, 'Relaxation plus planning are healthy coping strategies for stress (Ch 4). The camp settles down.'],
   ['Yell at whoever looks scared.', false, { social: -6, mind: -3 }, 'Taking stress out on others makes everyone\'s stress worse (Ch 4).'],
   ['Avoid thinking about it and stay up all night.', false, { mind: -5, body: -3 }, 'Avoidance and lost sleep make stress hit harder tomorrow (Ch 4).']]),
E('r2-fightflight', 2, 4, 'Howl in the Dark',
  'A howl echoes through camp. Your traveler\'s heart pounds and they suddenly feel wide awake. What\'s happening in their body?',
  [['The fight-or-flight response: adrenaline speeds up heart rate and breathing.', true, { mind: 3 }, 'Right (Ch 4). It\'s the body getting ready to face danger or escape it. It calms down once the threat passes.'],
   ['They\'re catching a cold.', false, { mind: -2 }, 'A pounding heart right after a scare is the stress response, not an illness (Ch 4).'],
   ['Their body is shutting down to save energy.', false, { mind: -2 }, 'The opposite: fight-or-flight revs the body up (Ch 4).']]),
E('r2-selftalk', 2, 3, '"I Can\'t Do Anything Right"',
  'After dropping a water barrel, a traveler mutters, "I\'m useless. I ruin everything."',
  [['"Everyone drops things. You\'ve carried this team all week. Let\'s fix it together."', true, { mind: 6, social: 4 }, 'Helping someone replace negative self-talk with realistic, positive self-talk builds self-esteem and resilience (Ch 3).'],
   ['"Yeah, that was pretty useless."', false, { mind: -6, social: -4 }, 'Piling on makes negative self-talk louder (Ch 3).'],
   ['Say nothing and walk away.', false, { mind: -2 }, 'Silence can feel like agreement. A few kind, true words help (Ch 3).']]),
E('r2-sleep', 2, 4, 'Running on Empty',
  'Your party has slept about 5 hours a night for a week to cover more ground. People are cranky and making mistakes.',
  [['Take a full rest night. Sleep is when the body and brain recover.', true, { day: 1, mind: 10, body: 6 }, 'Teens need about 8–10 hours. Lack of sleep raises stress and lowers focus and judgment (Ch 4).'],
   ['Push on. Sleep is for the weak.', false, { mind: -6, hurt: 1 }, 'A tired traveler stumbles and gets hurt. Sleep loss makes stress and accidents worse (Ch 4).'],
   ['Drink coffee all night instead.', false, { mind: -4, body: -3 }, 'Caffeine can\'t replace sleep and makes it harder to fall asleep later (Ch 4).']]),
E('r2-grief', 2, 4, 'Swept Away',
  'A traveler\'s keepsake from their grandmother falls into the river and is gone. They\'re quiet and sad.',
  [['Sit with them, let them talk about their grandmother, and give them time.', true, { social: 6, mind: 4 }, 'Grief is a normal response to loss (Ch 4). Listening and remembering together helps people heal.'],
   ['"It was just a thing. Get over it."', false, { social: -6, mind: -4 }, 'Rushing someone through grief makes them feel alone (Ch 4).'],
   ['Keep everyone too busy to think about it.', false, { mind: -3 }, 'Distraction can help briefly, but feelings need space too (Ch 4).']]),
E('r2-signs', 2, 5, 'More Than a Bad Day',
  'For about two weeks, one traveler has seemed sad most of the time, stopped enjoying things they used to love, and barely talks. What should you do?',
  [['Tell them you care, listen, and help them talk to a trusted adult or the trail doctor.', true, { social: 6, mind: 6 }, 'Sadness that lasts two weeks or more and loss of interest can be warning signs of depression (Ch 5). Getting a trusted adult involved is the right move.'],
   ['Leave them alone. They\'ll snap out of it.', false, { mind: -6 }, 'Lasting sadness often needs support and help to improve (Ch 5).'],
   ['Joke around until they cheer up.', false, { mind: -3 }, 'Kind intentions, but it skips the real step: caring, listening, and getting a trusted adult (Ch 5).']]),
E('r2-eustress', 2, 4, 'Good Nerves',
  'Before a big climb, a traveler says, "I\'m nervous, but it\'s exciting. I want to see the top!" What kind of stress is that?',
  [['Eustress: positive stress that motivates you.', true, { mind: 4 }, 'Eustress pushes you toward a goal (Ch 4). Distress is the negative kind that wears you down.'],
   ['Distress: harmful stress.', false, {}, 'Distress feels overwhelming and draining. This traveler is motivated, which is eustress (Ch 4).'],
   ['That isn\'t stress at all.', false, {}, 'Excitement before a challenge is a kind of stress, the helpful kind: eustress (Ch 4).']]),
E('r2-anger', 2, 3, 'Broken Wheel, Hot Temper',
  'The wagon wheel cracks and a traveler kicks the wagon, yelling. What\'s a healthy way to handle anger?',
  [['Cool down first (walk, breathe), then talk about the problem.', true, { mind: 4, social: 2 }, 'Recognizing anger and calming down before acting is a healthy way to manage emotions (Ch 3).'],
   ['Keep kicking until the anger is gone.', false, { hurt: 1 }, 'Lashing out physically often makes things worse. Now they have a sore foot too (Ch 3).'],
   ['Pretend everything is fine.', false, { mind: -3 }, 'Bottling feelings up lets them build (Ch 3).']]),
E('r2-time', 2, 4, 'Too Many Chores',
  'Fix the wheel, cook, fetch water, mend a tent... it\'s getting dark and nothing is done. Everyone is stressed.',
  [['Make a list, put the most important first, and split the work.', true, { mind: 5, social: 3 }, 'Time management and prioritizing are strong stress-management skills (Ch 4).'],
   ['Try to do everything at once.', false, { mind: -4 }, 'Multitasking under stress usually means nothing gets finished (Ch 4).'],
   ['Give up and go to bed.', false, { food: -6, mind: -2 }, 'Avoidance leaves tomorrow even more stressful (Ch 4).']]),
E('r2-needs', 2, 3, 'Hungry and Cranky',
  'Your travelers are cold, hungry, and tired, and you\'re trying to get them excited about a team-building game. Nobody cares. Why?',
  [['Basic needs like food, warmth, and rest come first.', true, { mind: 3, food: -4, body: 3 }, 'Maslow\'s hierarchy of needs (Ch 3): physical needs and safety have to be met before people can focus on belonging and growth.'],
   ['They just don\'t like games.', false, { social: -2 }, 'It\'s about needs, not personality (Ch 3).'],
   ['Make the game longer so they get into it.', false, { mind: -3 }, 'Without basic needs met, more game won\'t help (Ch 3).']]),

// ───────────── Realm 3 · Chapters 6–9 ─────────────
E('r3-imsg', 3, 6, 'Fight Over the Water Barrel',
  'Two travelers are arguing: one keeps drinking more than their share. You want to say something that won\'t make it worse.',
  [['"I feel worried when the water runs low. Can we agree on a share for everyone?"', true, { social: 6, water: 1 }, 'That\'s an I-message (Ch 6): your feeling + the situation + a request, without blaming.'],
   ['"You\'re so selfish. You always do this."', false, { social: -6 }, 'You-statements and "always" sound like attacks and escalate conflict (Ch 6).'],
   ['Say nothing and hide the barrel.', false, { social: -3 }, 'Avoiding the issue doesn\'t solve it (Ch 6, 9).']]),
E('r3-listen', 3, 6, 'Stories by the Fire',
  'A traveler starts telling a long story about home. What does active listening look like?',
  [['Eye contact, nodding, and asking follow-up questions.', true, { social: 6 }, 'Active listening shows you care and understand (Ch 6).'],
   ['Look at your map while they talk.', false, { social: -4 }, 'Distracted listening tells people they don\'t matter (Ch 6).'],
   ['Wait for a pause so you can tell your own better story.', false, { social: -3 }, 'That\'s waiting to talk, not listening (Ch 6).']]),
E('r3-race', 3, 8, 'The Downhill Dare',
  'Kids from another wagon dare your party to race wagons down a steep hill. "Unless you\'re scared."',
  [['"No thanks, wagons flip on hills like that. Want to race to the creek on foot instead?"', true, { social: 3, mind: 3 }, 'Refusal skills (Ch 8): say no clearly, give a reason, and suggest a better option.'],
   ['Race them. You\'re not scared.', false, { hurt: 1, parts: -1 }, 'Negative peer pressure wins. The wagon tips and a traveler is hurt (Ch 8).'],
   ['Say "maybe later" and hope they forget.', false, { mind: -2 }, 'A vague answer invites more pressure (Ch 8). Be clear.']]),
E('r3-bully', 3, 9, 'Trouble at the Trading Post',
  'An older traveler keeps knocking a younger kid\'s hat off and laughing. Others are watching.',
  [['Tell the post keeper (a trusted adult) and invite the kid to stand with your group.', true, { social: 7 }, 'Being an upstander means getting help and supporting the target, not joining in (Ch 9).'],
   ['Laugh along so the bully doesn\'t pick on you.', false, { social: -6, mind: -3 }, 'Bystanders who laugh give bullying an audience (Ch 9).'],
   ['Start a fistfight with the bully.', false, { hurt: 1, social: -2 }, 'Violence usually makes it worse and someone gets hurt (Ch 9). Get an adult.']]),
E('r3-letter', 3, 7, 'Letter from Home',
  'A letter catches up with you: one traveler\'s family is moving to a new town. They feel confused and a little left out.',
  [['Encourage them to write back about how they feel and ask questions.', true, { social: 6, mind: 4 }, 'Family changes are easier when family members talk openly (Ch 7).'],
   ['"Don\'t think about it. Nothing you can do."', false, { mind: -4 }, 'Ignoring feelings about family changes makes them heavier (Ch 7).'],
   ['Tear up the letter so they stop worrying.', false, { social: -5 }, 'That cuts off communication with family (Ch 7).']]),
E('r3-clique', 3, 8, 'The Closed Circle',
  'A new kid joins the wagon train. The group around the fire scoots closer so there\'s no room.',
  [['Make room and introduce yourself.', true, { social: 7 }, 'Cliques exclude people. Including others builds a healthy peer group (Ch 8).'],
   ['Go along with the group.', false, { social: -4 }, 'Exclusion hurts the person left out and the group\'s trust (Ch 8).'],
   ['Make fun of the new kid\'s wagon.', false, { social: -7 }, 'That turns exclusion into bullying (Ch 8–9).']]),
E('r3-shove', 3, 9, 'It\'s Getting Physical',
  'Two travelers are shouting, and one just shoved the other. What\'s the safest move?',
  [['Don\'t join in. Help separate them calmly and get an adult if it continues.', true, { social: 5, mind: 2 }, 'Conflicts can escalate to violence. Calming things down and getting help prevents injury (Ch 9).'],
   ['Cheer them on.', false, { hurt: 1, social: -5 }, 'Crowds egg fights on. Someone ends up hurt (Ch 9).'],
   ['Jump in swinging to stop it.', false, { hurt: 1 }, 'Adding violence rarely ends violence (Ch 9).']]),
E('r3-mediate', 3, 9, 'The Trade Dispute',
  'Your party and another wagon both say a lost ox is theirs. Nobody will budge.',
  [['Ask a neutral wagon master to hear both sides and help you agree (mediation).', true, { social: 5, coins: 5 }, 'Mediation uses a neutral third party to help solve conflict fairly (Ch 9).'],
   ['Grab the ox and run.', false, { social: -6, day: 1 }, 'Now you\'re being chased and lose a day (Ch 9).'],
   ['Argue louder until they give up.', false, { social: -4 }, 'Shouting matches rarely lead to fair solutions (Ch 9).']]),
E('r3-control', 3, 6, 'A Friend Who Controls',
  'A traveler from another wagon insists on choosing what your traveler eats, wears, and who they talk to, and gets angry when they don\'t.',
  [['Recognize it as unhealthy, set a clear boundary, and talk to a trusted adult.', true, { mind: 5, social: 3 }, 'Healthy relationships are built on respect. Controlling behavior is a warning sign (Ch 6).'],
   ['Go along with it to keep the peace.', false, { mind: -6 }, 'Giving in to control usually leads to more control (Ch 6).'],
   ['Assume it means they really care.', false, { mind: -4 }, 'Caring doesn\'t look like control (Ch 6).']]),
E('r3-compromise', 3, 6, 'Which Way Tomorrow?',
  'Half the party wants to travel at dawn, half wants to sleep in. Both have good reasons.',
  [['Find a compromise: leave an hour after dawn and take a longer lunch.', true, { social: 5 }, 'Compromise means each side gives a little to reach a shared solution (Ch 6, 9).'],
   ['Your way, no discussion.', false, { social: -5 }, 'Ignoring others\' needs hurts trust (Ch 6).'],
   ['Split up into two groups.', false, { social: -6, day: 1 }, 'Splitting up costs a day and the team\'s strength (Ch 6).']]),

// ───────────── Realm 4 · Chapters 10–12 ─────────────
E('r4-label', 4, 10, 'Reading the Label',
  'Two kinds of jerky at the trading post. Brand A: 25% Daily Value of sodium. Brand B: 5%. Which is the healthier pick?',
  [['Brand B. 5% DV or less is low; 20% or more is high.', true, { body: 4 }, 'Use %DV to compare (Ch 10). High sodium can raise blood pressure.'],
   ['Brand A. More is better.', false, { body: -3, water: -2 }, 'For sodium, more isn\'t better (Ch 10). All that salt makes everyone extra thirsty.'],
   ['They\'re the same; labels don\'t matter.', false, { body: -2 }, 'Labels let you compare nutrients quickly (Ch 10).']]),
E('r4-carbs', 4, 10, 'Fuel for the Climb',
  'A steep stretch is coming. Which nutrient is your body\'s main source of energy?',
  [['Carbohydrates (like oats, bread, fruit).', true, { body: 4 }, 'Carbs are the body\'s preferred energy source (Ch 10). Complex carbs give longer-lasting energy.'],
   ['Vitamins.', false, {}, 'Vitamins help body processes but don\'t provide calories for energy (Ch 10).'],
   ['Water.', false, {}, 'Water is essential, but it has no calories. Carbs are the main fuel (Ch 10).']]),
E('r4-protein', 4, 10, 'Building Back',
  'After days of hauling, your travelers\' muscles are sore. Which nutrient builds and repairs muscle?',
  [['Protein (beans, eggs, meat, nuts).', true, { body: 5, food: -3 }, 'Protein builds and repairs body tissues (Ch 10).'],
   ['Sugar.', false, { body: -2 }, 'Sugar gives quick energy but doesn\'t rebuild tissue (Ch 10).'],
   ['Sodium.', false, { water: -1 }, 'Sodium is a mineral; too much makes you thirsty. Protein rebuilds muscle (Ch 10).']]),
E('r4-plate', 4, 10, 'Building a Trail Plate',
  'You\'re planning dinner with MyPlate in mind. About how much of the plate should be fruits and vegetables?',
  [['About half.', true, { body: 5, food: -2 }, 'MyPlate: half fruits and vegetables, plus grains and protein, with dairy on the side (Ch 10).'],
   ['Just a bite, for color.', false, { body: -2 }, 'Fruits and veggies should fill about half the plate (Ch 10).'],
   ['None. Meat and bread are enough.', false, { body: -3 }, 'Skipping whole food groups means missing vitamins, minerals, and fiber (Ch 10).']]),
E('r4-stew', 4, 10, 'Leftover Stew',
  'Last night\'s stew sat out in the warm sun all afternoon. Everyone is hungry. Eat it?',
  [['Toss it. Food left in the "danger zone" (40–140°F) over 2 hours can grow bacteria.', true, { food: -5 }, 'Food safety (Ch 10): clean, separate, cook, chill. When in doubt, throw it out.'],
   ['Eat it. Smells fine.', false, { sick: 1 }, 'Many foodborne germs don\'t change the smell. A traveler gets food poisoning (Ch 10).'],
   ['Heat it a little and eat it.', false, { sick: 1 }, 'Some bacteria make toxins that reheating won\'t remove (Ch 10).']]),
E('r4-fad', 4, 11, 'The Cactus Diet',
  'A traveler is selling a plan: "Eat only cactus for 10 days and get trail-ready fast!"',
  [['Pass. Fad diets cut out food groups and aren\'t safe or lasting.', true, { mind: 3 }, 'Healthy weight management uses balanced eating and activity, not fad diets (Ch 11).'],
   ['Try it for the whole party.', false, { body: -8, mind: -4 }, 'The party runs out of energy fast. Fad diets skip nutrients your body needs (Ch 11).'],
   ['Try it for just a few days.', false, { body: -4 }, 'Even short fad diets can leave you weak and low on nutrients (Ch 11).']]),
E('r4-hydrate', 4, 12, 'Scorching Afternoon',
  'It\'s hot and the trail is dusty. What should your travelers drink?',
  [['Water, regularly, before they feel thirsty.', true, { body: 5, water: -1 }, 'Water regulates body temperature (Ch 10, 12). Thirst means you\'re already a little dehydrated.'],
   ['Soda from the trading post.', false, { body: -3, coins: -4 }, 'Sugary drinks don\'t hydrate as well as water (Ch 10).'],
   ['Nothing until camp, to save water.', false, { body: -6, hp: -6 }, 'Skipping water in heat risks heat illness (Ch 12).']]),
E('r4-warmup', 4, 12, 'Heavy Lifting',
  'The wagon is stuck and everyone has to push it uphill. What first?',
  [['A quick warm-up: light movement and stretching.', true, { body: 3 }, 'Warming up raises muscle temperature and lowers injury risk (Ch 12).'],
   ['Go straight to full effort.', false, { hurt: 1 }, 'Cold muscles strain easily. A traveler pulls a muscle (Ch 12).'],
   ['Sit and rest for an hour first.', false, { day: 1 }, 'Rest is good, but it doesn\'t prepare muscles for hard work. You lose the day (Ch 12).']]),
E('r4-fitt', 4, 12, 'Trail Training',
  'A traveler wants a plan to get stronger for the mountains. What does the FITT principle stand for?',
  [['Frequency, Intensity, Time, Type.', true, { body: 4, mind: 2 }, 'FITT helps build a fitness plan: how often, how hard, how long, and what kind (Ch 12).'],
   ['Food, Ice, Tape, Tea.', false, {}, 'Nice try. It\'s Frequency, Intensity, Time, Type (Ch 12).'],
   ['Fast, Intense, Tough, Tired.', false, { body: -2 }, 'That\'s a recipe for injury. FITT is Frequency, Intensity, Time, Type (Ch 12).']]),
E('r4-heat', 4, 12, 'Dizzy in the Heat',
  'A traveler is pale, sweating heavily, dizzy, and has a headache after a long hot climb.',
  [['Move them to shade, loosen clothing, have them sip water and rest.', true, { water: -1, heal: 1, body: 3 }, 'Those are signs of heat exhaustion (Ch 12). If they get confused or stop sweating, that can be heat stroke, an emergency.'],
   ['Keep walking. They\'ll toughen up.', false, { hp: -15 }, 'Heat exhaustion can turn into heat stroke (Ch 12).'],
   ['Give them a salty snack and keep moving.', false, { hp: -8 }, 'They need cooling, water, and rest first (Ch 12).']]),
E('r4-image', 4, 11, 'Comparing Bodies',
  'A traveler keeps comparing their body to other travelers and says they hate how they look.',
  [['Remind them bodies come in many healthy shapes and focus on what their body can do.', true, { mind: 6, social: 3 }, 'A positive body image focuses on health and ability, not comparison (Ch 11).'],
   ['Suggest they stop eating to look different.', false, { mind: -6, body: -6 }, 'Restricting food is harmful and doesn\'t fix body image (Ch 11). Talk to a trusted adult if this worry continues.'],
   ['Agree with them.', false, { mind: -6 }, 'Piling on hurts self-esteem (Ch 3, 11).']]),
E('r4-breakfast', 4, 11, 'Rushing Out of Camp',
  'You\'re running late. A traveler wants to skip breakfast to get moving.',
  [['Grab a quick breakfast: oats and fruit. It fuels the morning.', true, { body: 3, food: -2 }, 'Breakfast restores energy after the overnight fast and helps focus (Ch 10–11).'],
   ['Skip it. You\'ll eat a big lunch.', false, { body: -3, mind: -2 }, 'Skipping breakfast often leads to low energy and overeating later (Ch 11).'],
   ['Eat a handful of candy instead.', false, { body: -2 }, 'Sugar gives a quick spike and then a crash (Ch 10).']]),

// ───────────── Realm 5 · Chapters 13–16 ─────────────
E('r5-sun', 5, 13, 'High Mountain Sun',
  'The air is thin and the sun is strong up here. How do you protect your travelers\' skin?',
  [['Sunscreen SPF 30 or higher, reapplied every 2 hours, plus hats.', true, { body: 4 }, 'UV is stronger at high altitude. Sunscreen and covering up prevent sunburn and lower skin cancer risk (Ch 13).'],
   ['Sunscreen once in the morning is enough.', false, { hp: -6 }, 'Sunscreen wears off; reapply about every 2 hours (Ch 13).'],
   ['A sunburn now builds a "base tan" for later.', false, { hp: -10 }, 'A base tan doesn\'t protect you, and any tan is skin damage (Ch 13).']]),
E('r5-teeth', 5, 13, 'The Toothache',
  'A traveler has a sore tooth. They admit they stopped brushing a week ago.',
  [['Start brushing twice a day for 2 minutes and floss daily.', true, { body: 3 }, 'Brushing and flossing remove plaque, which causes cavities and gum disease (Ch 13).'],
   ['Brush once a week, really hard.', false, { hp: -5 }, 'Brushing hard can damage gums. Twice daily is what works (Ch 13).'],
   ['Chew on the other side forever.', false, { hp: -6 }, 'Avoiding the problem lets the cavity grow (Ch 13).']]),
E('r5-ankle', 5, 14, 'Twisted Ankle',
  'On Backbone Ridge a traveler rolls their ankle. It\'s swelling, but they can wiggle their toes.',
  [['R.I.C.E.: Rest, Ice, Compression, Elevation.', true, { heal: 1, day: 1 }, 'RICE reduces swelling for sprains (Ch 14, 27). If it can\'t bear weight or looks bent, it may be a fracture.'],
   ['Walk it off.', false, { hurt: 1 }, 'Walking on a sprain can make it worse (Ch 14).'],
   ['Put it in hot water.', false, { hp: -6 }, 'Heat increases swelling early on. Use ice (Ch 14, 27).']]),
E('r5-bones', 5, 14, 'Strong Bones',
  'The trail doctor says growing teens need strong bones for a trip like this. Which nutrients build bone?',
  [['Calcium and vitamin D.', true, { body: 4 }, 'Calcium builds bone and vitamin D helps the body absorb it (Ch 14). Teens build most of their bone mass now.'],
   ['Sugar and salt.', false, {}, 'Neither builds bone (Ch 14).'],
   ['Caffeine.', false, {}, 'No. Calcium and vitamin D are the bone builders (Ch 14).']]),
E('r5-head', 5, 14, 'A Bump on the Head',
  'A traveler slips and hits their head on a rock. They seem dazed, have a headache, and keep asking what happened.',
  [['Stop for the day, keep them resting, and get them checked by the trail doctor.', true, { day: 1, heal: 1 }, 'Those can be signs of a concussion (Ch 14). Stop activity, rest, and get checked.'],
   ['They seem fine. Keep going.', false, { hp: -15 }, 'Pushing through a possible concussion risks a worse injury (Ch 14).'],
   ['Let them nap alone and check later.', false, { hp: -8 }, 'Someone should watch them closely and get them checked (Ch 14).']]),
E('r5-heart', 5, 15, 'Heartbeat Pass',
  'The climb has everyone\'s heart pounding. Which kind of activity makes the heart stronger over time?',
  [['Regular aerobic activity, like hiking, biking, or swimming.', true, { body: 5 }, 'Aerobic exercise strengthens the heart muscle so it pumps more blood with each beat (Ch 15).'],
   ['Sitting still to save the heart\'s energy.', false, { body: -2 }, 'The heart is a muscle. It gets stronger with use (Ch 15).'],
   ['Only very short bursts once a month.', false, {}, 'Regular aerobic activity most days is what builds heart health (Ch 12, 15).']]),
E('r5-asthma', 5, 15, 'Smoky Campfire',
  'Wind blows campfire smoke across camp. A traveler with asthma starts coughing and wheezing.',
  [['Move them out of the smoke and help them use their inhaler.', true, { heal: 1 }, 'Smoke is a common asthma trigger. Avoiding triggers and using prescribed medicine help (Ch 15).'],
   ['Have them sit closer to the fire to warm up.', false, { hp: -12 }, 'More smoke means a worse attack (Ch 15).'],
   ['Tell them to just stop coughing.', false, { hp: -6 }, 'Asthma narrows the airways. They need to get away from the trigger (Ch 15).']]),
E('r5-dysentery', 5, 15, 'Dysentery!',
  'Uh oh. A traveler has stomach cramps and diarrhea after drinking unboiled creek water. Classic trail trouble. What helps most?',
  [['Lots of clean fluids and rest, use medicine if you have it, and boil water from now on.', true, { heal: 1, water: -2, day: 1 }, 'Dysentery is an intestinal infection from contaminated food or water (Ch 15, 23). Losing fluids is the big danger, so rehydrate and prevent it next time.'],
   ['Stop drinking to make it stop.', false, { hp: -20 }, 'Diarrhea already drains fluids; cutting water risks dehydration (Ch 15).'],
   ['Keep going at a grueling pace.', false, { hp: -15, body: -4 }, 'Their body needs rest and fluids to recover (Ch 15).']]),
E('r5-fiber', 5, 15, 'Jerky for Days',
  'After a week of only jerky and crackers, a traveler is uncomfortably "backed up." What helps digestion?',
  [['Fiber (fruit, veggies, beans, whole grains) and plenty of water.', true, { body: 4, food: -2 }, 'Fiber and water keep the digestive system moving (Ch 15).'],
   ['More jerky.', false, { body: -3 }, 'Low-fiber food is the problem (Ch 15).'],
   ['Skip water to save it.', false, { body: -4 }, 'Fiber needs water to do its job (Ch 15).']]),
E('r5-sugar', 5, 16, 'Shaky and Sweaty',
  'A traveler with type 1 diabetes suddenly feels shaky, sweaty, and confused. They think their blood sugar is low.',
  [['Give fast sugar right away (juice or glucose tabs), then a snack once they feel better.', true, { heal: 1, food: -1 }, 'Low blood sugar (hypoglycemia) needs quick sugar first (Ch 16). Insulin, from the pancreas or as medicine, lowers blood sugar.'],
   ['Give them insulin.', false, { hp: -20 }, 'Insulin lowers blood sugar even more. That\'s the wrong direction here (Ch 16).'],
   ['Let them sleep it off.', false, { hp: -15 }, 'Low blood sugar needs fast action (Ch 16).']]),
E('r5-growth', 5, 16, 'Always Hungry, Always Tired',
  'A teen traveler is suddenly hungry all the time, sleeping more, and has grown out of their boots.',
  [['That\'s normal adolescent growth. Feed them balanced meals and let them sleep.', true, { body: 4, food: -3 }, 'Hormones from the endocrine system drive growth spurts in the teen years (Ch 16). Growing bodies need more food and sleep.'],
   ['They must be sick. Use your medicine.', false, { meds: -1 }, 'Growth spurts aren\'t illness. That medicine is wasted (Ch 16).'],
   ['Put them on light rations so they stop growing.', false, { body: -5 }, 'Growing teens need enough food (Ch 11, 16).']]),
E('r5-noise', 5, 13, 'The Roaring Falls',
  'Your camp is right next to a thundering waterfall, and a traveler\'s ears are ringing.',
  [['Move camp farther away. Loud noise for a long time can damage hearing.', true, { body: 2, mind: 2 }, 'Ringing ears are a warning sign of noise exposure. Distance and ear protection help (Ch 13).'],
   ['Ringing means their ears are getting stronger.', false, { hp: -5 }, 'Ringing is a warning, not a workout (Ch 13).'],
   ['Stuff grass in their ears.', false, { hp: -3 }, 'Never put things into the ear canal (Ch 13). Move away from the noise.']]),

// ───────────── Any realm · occasional, from later chapters ─────────────
E('x-water', 0, 23, 'Cloudy Water',
  'The only water nearby is a cloudy, slow creek. Everyone is thirsty.',
  [['Boil or filter it before drinking.', true, { water: 4, day: 0 }, 'Untreated water can carry germs that cause diseases like dysentery (Ch 23, 28).'],
   ['Drink it straight. It\'s just a little cloudy.', false, { water: 4, sick: 1 }, 'Germs are invisible. A traveler gets sick (Ch 23).'],
   ['Wait for rain.', false, { day: 1, body: -3 }, 'You lose a day thirsty. Boiling would have worked (Ch 28).']]),
E('x-hands', 0, 23, 'Dinner Time',
  'Dinner is ready. Your travelers just finished greasing the wagon axle.',
  [['Wash hands with soap for at least 20 seconds first.', true, { body: 2 }, 'Handwashing is one of the best ways to stop the spread of germs (Ch 23).'],
   ['Wipe them on your pants.', false, { sick: 1 }, 'That moves germs around, it doesn\'t remove them (Ch 23).'],
   ['Rinse quickly with water only.', false, { hp: -3 }, 'Soap and 20 seconds of scrubbing make the difference (Ch 23).']]),
E('x-lightning', 0, 26, 'Storm on the Ridge',
  'Thunder booms and lightning flashes. You\'re on a high, open ridge. Where do you go?',
  [['Get down off the ridge to lower ground, away from lone trees.', true, { day: 1 }, 'Lightning strikes high points and isolated tall objects (Ch 26). Shelter in a building or hard-topped vehicle if you can.'],
   ['Stand under the tallest tree.', false, { hurt: 1 }, 'Lone tall trees attract lightning (Ch 26).'],
   ['Keep walking along the ridge top.', false, { hurt: 1 }, 'Ridges are the most dangerous place in a lightning storm (Ch 26).']]),
E('x-fire', 0, 26, 'Breaking Camp',
  'You\'re packing up. The campfire is down to glowing coals.',
  [['Drown it with water, stir the ashes, and feel for heat.', true, { mind: 2 }, 'Drown, stir, feel. Embers can restart a fire hours later (Ch 26).'],
   ['Leave it. It\'s almost out.', false, { coins: -10, social: -4 }, 'The wind kicks up the coals and a ranger fines your party (Ch 26).'],
   ['Kick some dirt on it and go.', false, { coins: -5 }, 'Dirt alone can trap heat. Drown, stir, feel (Ch 26).']]),
E('x-burn', 0, 27, 'Hot Pot!',
  'A traveler grabs the cooking pot and burns their palm.',
  [['Cool it under running water for about 10 minutes, then cover loosely.', true, { heal: 1, water: -1 }, 'Cool water stops the burning. No butter, no ice (Ch 27).'],
   ['Rub butter on it.', false, { hp: -8 }, 'Butter traps heat and can cause infection (Ch 27).'],
   ['Put ice directly on it.', false, { hp: -6 }, 'Ice can damage burned skin more (Ch 27).']]),
E('x-cut', 0, 27, 'Deep Cut',
  'While fixing the wheel, a traveler slices their arm on sharp metal. It\'s bleeding steadily.',
  [['Press firmly on the wound with a clean cloth and keep pressure on.', true, { heal: 1, meds: 0 }, 'Direct pressure is the first step to control bleeding (Ch 27).'],
   ['Let it bleed to clean it out.', false, { hp: -15 }, 'Losing blood is the danger. Apply pressure (Ch 27).'],
   ['Wash it in the muddy river.', false, { sick: 1 }, 'Dirty water can infect a wound (Ch 27).']]),
E('x-pills', 0, 19, 'The "Energy Pills"',
  'A stranger at a trading post offers your travelers some pills: "Keeps you going all night. Everyone on the trail uses them."',
  [['"No thanks. We don\'t take pills that weren\'t prescribed for us." Walk away.', true, { mind: 4 }, 'Medicine misuse is risky, and "everyone uses them" is pressure, not a reason (Ch 8, 19). Refusal skills work.'],
   ['Take one to see what happens.', false, { hp: -15, mind: -5 }, 'Unknown pills from a stranger can be dangerous (Ch 19).'],
   ['Buy a bottle to sell later.', false, { coins: -15, social: -5 }, 'That spreads the risk to others (Ch 19).']])
];

// Events that aren't questions — the luck of the trail
window.TRAIL_LUCK = [
  { id: 'l-wheel',  text: 'A wagon wheel cracks on a rock.', parts: true },
  { id: 'l-rain',   text: 'Heavy rain turns the trail to mud. You lose a day.', fx: { day: 1, mind: -2 } },
  { id: 'l-mule',   text: 'Your mule wandered off in the night. It takes a day to find it.', fx: { day: 1 } },
  { id: 'l-trader', text: 'Friendly travelers share some of their food with you.', fx: { food: 15, social: 3 } },
  { id: 'l-berries',text: 'You spot a patch of wild berries by the trail. (+10 lb food)', fx: { food: 10 } },
  { id: 'l-spring', text: 'A small clear spring bubbles up beside the trail. (+4 water)', fx: { water: 4 } },
  { id: 'l-view',   text: 'A gorgeous sunset over the hills lifts everyone\'s mood.', fx: { mind: 4 } },
  { id: 'l-song',   text: 'Someone starts a song around the fire and everyone joins in.', fx: { social: 4, mind: 2 } },
  { id: 'l-coins',  text: 'You find a dropped coin purse by the trail. (+8 coins)', fx: { coins: 8 } },
  { id: 'l-thief',  text: 'Raccoons raided the food bag overnight. (-12 lb food)', fx: { food: -12 } }
];

})();

// Rigs: each finish this trimester upgrades the student's wagon team. Shown to everyone next to their name.
window.TRAIL_RIGS = [
  { n: 0, icon: '🐂', animal: 'Ox',          wagon: 'Canvas wagon',  title: 'Greenhorn' },
  { n: 1, icon: '🐎', animal: 'Horse',       wagon: 'Bronze wagon',  title: 'Trailblazer' },
  { n: 2, icon: '🦬', animal: 'Bison',       wagon: 'Silver wagon',  title: 'Pathfinder' },
  { n: 3, icon: '🦕', animal: 'Triceratops', wagon: 'Gold wagon',    title: 'Legend of the Trail' },
  { n: 4, icon: '🐉', animal: 'Dragon',      wagon: 'Diamond wagon', title: 'Mythic Voyager' },
  { n: 5, icon: '👑', animal: 'Crowned Dragon', wagon: 'Diamond wagon', title: 'Grand Wagon Master' }
];

// tools/build_classwork.js — builds the Unit Classwork word lists.
//   node tools/build_classwork.js
// Writes:
//   classwork_data.js            (the page's copy of the word lists)
//   supabase/classwork_terms.sql (the database copy the mastery check is graded against)
// Chapter words come from pet_vocab.js (the site's chapter vocabulary). EXTRAS are the
// Schoology Classwork words the chapter lists don't have (approved by Mr. Dopp 2026-11-12).
// NO_STORY words stay in vocab and the mastery check but can't be picked for a story.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

global.window = {};
require(path.join(root, 'pet_vocab.js'));
const V = window.PET_VOCAB;

const UNITS = [
  { unit: 1, title: 'Health & Skills', chapters: [1, 2] },
  { unit: 2, title: 'Mental & Emotional Health', chapters: [3, 4, 5] },
  { unit: 3, title: 'Relationships', chapters: [6, 7, 8, 9] },
  { unit: 4, title: 'Nutrition, Weight & Exercise', chapters: [10, 11, 12] },
  { unit: 5, title: 'Your Body', chapters: [13, 14, 15, 16] },
  // Units 6–9 match Realms 6–9 (ready in case Classwork expands past chapter 16)
  { unit: 6, title: 'The Life Cycle', chapters: [17, 18] },
  { unit: 7, title: 'Medicines, Tobacco, Alcohol & Drugs', chapters: [19, 20, 21, 22] },
  { unit: 8, title: 'Diseases & Disorders', chapters: [23, 24, 25] },
  { unit: 9, title: 'Safety, First Aid & Community', chapters: [26, 27, 28] }
];

const EXTRAS = {
  4: [['Perception', 'The way you see, understand and interpret a situation.'],
      ['Psychosomatic Response', 'A physical reaction, like a headache or upset stomach, caused by stress or emotions instead of an injury or illness.'],
      ['Coping', 'Dealing successfully with difficult changes or problems in your life.']],
  5: [['Apathy', 'A lack of strong feeling, interest or concern about things.'],
      ['Alienation', 'Feeling isolated and separated from everyone else.'],
      ['Cognitive Therapy', 'Therapy that helps a person notice and change negative or unhelpful ways of thinking.']],
  6: [['Compromise', 'A solution where each person gives up something to reach an agreement that works for everyone.'],
      ['Stereotype', 'An exaggerated or oversimplified belief about people who belong to a certain group.'],
      ['Body Language', 'Messages you send with your posture, gestures, facial expressions and eye contact.']],
  10: [['Appetite', 'A desire to eat that comes from emotions or the look and smell of food, not physical need.'],
       ['Nutrient-Dense', 'Foods with a lot of nutrients compared with the number of calories they have.'],
       ['Cross-Contamination', 'The spread of bacteria or other germs from one food or surface to another.']],
  11: [['Weight Cycling', 'Repeatedly losing and then regaining weight.'],
       ['Dietary Supplements', 'Pills, powders or liquids taken to add nutrients to your diet.'],
       ['Performance Enhancers', 'Substances taken to try to improve athletic performance, many of them unsafe.']],
  12: [['Sedentary', 'Spending most of the day sitting or inactive.'],
       ['Resting Heart Rate', 'How many times your heart beats per minute while you are at rest.'],
       ['Sprain', 'An injury where a ligament at a joint is stretched or torn.']],
  13: [['Cornea', 'The clear front part of the eye that bends and focuses light.'],
       ['Hair Follicle', 'The small sac in the skin that holds the root of a hair.'],
       ['Malocclusion', "When the upper and lower teeth don't line up correctly (a misaligned bite)."]],
  14: [['Flexor', 'A muscle that bends (closes) a joint, like the biceps at the elbow.'],
       ['Extensor', 'A muscle that straightens (opens) a joint, like the triceps at the elbow.'],
       ['Hernia', 'When an organ or tissue pushes through a weak spot in the muscle around it.']],
  15: [['Pathogen', 'A germ, such as a virus or bacteria, that causes disease.'],
       ['Bronchi', 'The two main air tubes that carry air from the trachea into the lungs.'],
       ['Bile', 'A fluid made by the liver that helps break down fats during digestion.']],
  16: [['Parathyroid Glands', 'Small glands in the neck that control the calcium level in your blood and bones.'],
       ['Fallopian Tubes', 'The tubes that carry eggs from the ovaries to the uterus.'],
       ['Sterility', 'Not being able to reproduce.']]
};

// Not pickable for a personal story (mandatory-reporting / very private topics).
const NO_STORY = new Set([
  'suicide', 'suicide prevention', 'crisis line', 'eating disorder', 'anorexia nervosa', 'bulimia nervosa',
  'binge eating disorder', 'orthorexia', 'ptsd',
  'abuse', 'domestic violence', 'spousal abuse', 'child abuse', 'neglect', 'elder abuse', 'cycle of violence', 'crisis center',
  'intimacy', 'sexually transmitted infections (stis)',
  'assault', 'homicide', 'sexual violence', 'physical abuse', 'emotional abuse', 'verbal abuse', 'stalking', 'hate crime',
  'testes', 'ovaries', 'uterus', 'ovulation', 'menstruation', 'menstrual cycle', 'fertilization', 'fallopian tubes', 'sterility',
  // units 6–9
  'implantation', 'zygote',
  'medicine misuse', 'medicine abuse', 'drug overdose', 'drug misuse', 'drug abuse', 'addiction', 'fentanyl', 'opioid',
  'e-cigarettes', 'vaping', 'smokeless tobacco',
  'intoxication', 'binge drinking', 'alcohol poisoning', 'alcohol use disorder', 'underage drinking',
  'substance abuse', 'illegal drugs', 'marijuana', 'inhalants', 'anabolic steroids', 'hallucinogens', 'opiates',
  'counterfeit pills', 'thc', 'methamphetamine', 'mdma', 'gateway drug',
  'sexually transmitted infection', 'asymptomatic', 'hpv', 'chlamydia', 'gonorrhea', 'syphilis', 'hiv', 'aids',
  'antiretroviral therapy', 'u=u', 'prep', 'gardasil 9', 'herpes', 'hepatitis b', 'trichomoniasis', 'cd4 t-cells',
  'partner notification', 'sti testing'
]);

const out = [];
for (const u of UNITS) {
  const terms = [];
  const seen = new Set();
  for (const c of u.chapters) {
    const list = V[c].terms.map(([t, d]) => ({ t, d, x: 0 }))
      .concat((EXTRAS[c] || []).map(([t, d]) => ({ t, d, x: 1 })));
    for (const w of list) {
      const key = w.t.toLowerCase();
      if (seen.has(key)) continue;            // same word twice in one unit (e.g. Peer pressure): keep the first
      seen.add(key);
      terms.push({ c, t: w.t, d: w.d, x: w.x, s: NO_STORY.has(key) ? 0 : 1 });
    }
  }
  out.push({ unit: u.unit, title: u.title, chapters: u.chapters, terms });
}

// ---- page copy ----
fs.writeFileSync(path.join(root, 'classwork_data.js'),
  '// Generated by tools/build_classwork.js. Do not edit by hand.\n' +
  '// t = term, d = definition, c = chapter, x = 1 for a Schoology extra, s = 0 when it can\'t be used in a story.\n' +
  'window.CLASSWORK_UNITS = ' + JSON.stringify(out) + ';\n');

// ---- database copy ----
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
let sql = '-- Generated by tools/build_classwork.js. Do not edit by hand. Safe to re-run.\n' +
  '-- Run AFTER supabase/classwork.sql. Replaces the Unit Classwork word lists.\n' +
  'begin;\ndelete from public.cw_terms;\ninsert into public.cw_terms (unit, chapter, n, term, def, extra, story_ok) values\n';
const rows = [];
for (const u of out) u.terms.forEach((w, i) => rows.push(`(${u.unit},${w.c},${i + 1},${q(w.t)},${q(w.d)},${!!w.x},${!!w.s})`));
sql += rows.join(',\n') + ';\ncommit;\n';
fs.writeFileSync(path.join(root, 'supabase', 'classwork_terms.sql'), sql);

for (const u of out) console.log(`Unit ${u.unit}: ${u.terms.length} words (${u.terms.filter(w => w.x).length} extras, ${u.terms.filter(w => !w.s).length} not for stories)`);

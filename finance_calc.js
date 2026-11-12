/*
 * finance_calc.js — all the math for "The Cost of Your Future" (finance.html).
 * Pure functions only (no page code), so the formulas can be tested on their own:
 *   node tools/test_finance_calc.js
 *
 * Money is in dollars. "Monthly" values are per month; "annual" values are per year.
 * Nothing in here ever mixes the two: every annual figure is monthly x 12, once.
 */
(function (root) {
  'use strict';

  // ── The 12 categories from the original Google Sheet, in the same order ──
  // mit:   how the category relates to MIT's Living Wage Calculator "typical expenses" list
  //        'direct'  = MIT shows a matching line
  //        'partial' = MIT has a related line that covers only part of it (or lumps it with others)
  //        'none'    = MIT has no line for it — students research their own number
  const CATS = [
    { key: 'housing',        label: 'Housing',              mit: 'direct',  mitLine: 'Housing',
      note: 'MIT lists Housing directly. MIT bases it on fair-market rent, which usually already includes basic utilities — see Utilities.' },
    { key: 'healthcare',     label: 'Healthcare',           mit: 'direct',  mitLine: 'Medical',
      note: 'MIT calls this "Medical" (insurance premiums plus typical out-of-pocket costs).' },
    { key: 'utilities',      label: 'Utilities',            mit: 'partial', mitLine: 'Internet & Mobile (+ part of Housing)',
      note: 'MIT shows Internet & Mobile. Power/heat/water are usually counted inside MIT Housing — don’t count them twice.' },
    { key: 'childcare',      label: 'Childcare',            mit: 'direct',  mitLine: 'Child Care',
      note: 'MIT lists Child Care. It is $0 for a household with no children.' },
    { key: 'transportation', label: 'Transportation',       mit: 'direct',  mitLine: 'Transportation',
      note: 'MIT lists Transportation directly.' },
    { key: 'education',      label: 'Education & Training', mit: 'none',    mitLine: '—',
      note: 'MIT has no line for this. Look up a real cost (student loan payment, certification, classes).' },
    { key: 'clothing',       label: 'Clothing',             mit: 'partial', mitLine: 'Other (lumped)',
      note: 'MIT folds clothing into "Other" with several things. Make your own estimate or explain your split.' },
    { key: 'entertainment',  label: 'Entertainment',        mit: 'partial', mitLine: 'Civic (part)',
      note: 'MIT’s "Civic" line covers some recreation and culture, not everything. Research your own number.' },
    { key: 'food',           label: 'Food',                 mit: 'direct',  mitLine: 'Food',
      note: 'MIT lists Food directly (groceries for a basic diet, not eating out every day).' },
    { key: 'personal',       label: 'Personal',             mit: 'partial', mitLine: 'Other (lumped)',
      note: 'Personal care items are part of MIT’s "Other." Make your own estimate or explain your split.' },
    { key: 'misc',           label: 'Miscellaneous',        mit: 'partial', mitLine: 'Other (lumped)',
      note: 'Whatever is left of MIT’s "Other" can go here.' },
    { key: 'savings',        label: 'Savings',              mit: 'none',    mitLine: '—',
      note: 'MIT’s living wage does NOT include savings. Set your own monthly savings goal.' }
  ];
  const KEYS = CATS.map(c => c.key);
  const ESSENTIAL_KEYS = KEYS.filter(k => k !== 'savings');

  // ── Simplified classroom assumptions from the original worksheet ──
  // Here they are applied to GROSS income (that is how income tax works).
  const SIMPLE = { federal: 0.25, state: 0.06 };

  // ── 2026 tax figures (single filer), verified Nov 2, 2026 ──
  //   Federal brackets + standard deduction: IRS 2026 inflation adjustments (reported by Kiplinger).
  //   Social Security 6.2% up to $184,500; Medicare 1.45% (+0.9% over $200,000): SSA 2026.
  //   Idaho: flat 5.3% on taxable income (Tax Foundation, 2026).
  const TAX2026 = {
    year: 2026,
    standardDeduction: 16100,
    brackets: [ // [upper limit of taxable income, rate]
      [12400, 0.10], [50400, 0.12], [105700, 0.22], [201775, 0.24],
      [256225, 0.32], [640600, 0.35], [Infinity, 0.37]
    ],
    ssRate: 0.062, ssWageBase: 184500,
    medicareRate: 0.0145, addlMedicareRate: 0.009, addlMedicareOver: 200000,
    idahoRate: 0.053
  };

  const WEEKS_PER_YEAR = 52;

  // ── helpers ──
  function num(v) {
    if (v === '' || v === null || v === undefined) return 0;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,\s]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  function isBlank(v) { return v === '' || v === null || v === undefined || (typeof v === 'string' && v.trim() === ''); }
  function round2(x) { return Math.round(x * 100) / 100; }

  // Valid money input: blank, or a number from 0 to max (no negatives).
  function checkMoney(v, max) {
    if (isBlank(v)) return { ok: true, blank: true, value: 0 };
    const n = Number(String(v).replace(/[$,\s]/g, ''));
    if (!Number.isFinite(n)) return { ok: false, msg: 'Numbers only' };
    if (n < 0) return { ok: false, msg: 'Can’t be negative' };
    if (n > (max || 1e7)) return { ok: false, msg: 'That number is too large' };
    return { ok: true, blank: false, value: n };
  }

  // ── Step 0: simple interest ──
  function simpleInterest(principal, ratePct, years) {
    return num(principal) * (num(ratePct) / 100) * (years === undefined ? 1 : num(years));
  }
  // For comparison only: interest compounded once a year.
  function compoundInterest(principal, ratePct, years) {
    const p = num(principal), r = num(ratePct) / 100, y = years === undefined ? 1 : num(years);
    return p * Math.pow(1 + r, y) - p;
  }

  // ── Step 1: work hours ──
  function workHours(days, hours, weeks) {
    const d = num(days), h = num(hours), w = weeks === undefined ? WEEKS_PER_YEAR : num(weeks);
    const annualHours = d * h * w;
    return { weeklyHours: d * h, annualHours };
  }
  function hourlyFrom(salary, annualHours) {
    return annualHours > 0 ? num(salary) / annualHours : null;
  }

  // ── Steps 2–4: budgets ──
  function totals(values) {
    let monthly = 0, essential = 0;
    KEYS.forEach(k => {
      const v = val(values, k);
      monthly += v;
      if (k !== 'savings') essential += v;
    });
    const savings = monthly - essential;
    return {
      monthly, annual: monthly * 12,
      essentialMonthly: essential, essentialAnnual: essential * 12,
      savingsMonthly: savings, savingsAnnual: savings * 12
    };
  }
  function val(values, k) {
    const x = values && values[k];
    return num(x !== null && typeof x === 'object' ? x.v : x);
  }
  // diff = researched − predicted. Positive = you UNDERestimated (reality costs more).
  // pct  = diff as a percent of the researched (real) cost. null when the real cost is $0.
  function compare(predicted, researched) {
    const rows = CATS.map(c => {
      const p = val(predicted, c.key), r = val(researched, c.key), diff = r - p;
      return { key: c.key, label: c.label, predicted: p, researched: r, diff, pct: r > 0 ? (diff / r) * 100 : null };
    });
    const tp = totals(predicted), tr = totals(researched);
    const diff = tr.monthly - tp.monthly;
    let under = null, over = null;
    rows.forEach(row => {
      if (row.diff > 0 && (!under || row.diff > under.diff)) under = row;
      if (row.diff < 0 && (!over || row.diff < over.diff)) over = row;
    });
    return {
      rows,
      predictedMonthly: tp.monthly, researchedMonthly: tr.monthly,
      predictedAnnual: tp.annual, researchedAnnual: tr.annual,
      diffMonthly: diff, diffAnnual: diff * 12,
      pct: tr.monthly > 0 ? (diff / tr.monthly) * 100 : null,
      under, over
    };
  }

  // ── Step 5: taxes ──
  function federalIncomeTax(gross, T) {
    T = T || TAX2026;
    const taxable = Math.max(0, num(gross) - T.standardDeduction);
    let tax = 0, lower = 0;
    for (const [upper, rate] of T.brackets) {
      if (taxable <= lower) break;
      tax += (Math.min(taxable, upper) - lower) * rate;
      lower = upper;
    }
    return { taxable, tax };
  }
  // opts.mode: 'simplified' | 'realistic'
  // opts.state: 'ID' (Idaho 5.3%) | 'none' (state has no income tax) | 'custom' (opts.customRate, %)
  function taxes(gross, opts) {
    const g = Math.max(0, num(gross));
    opts = opts || {};
    if (opts.mode !== 'realistic') {
      const federal = g * SIMPLE.federal, state = g * SIMPLE.state;
      return { mode: 'simplified', federal, state, socialSecurity: 0, medicare: 0,
               total: federal + state, takeHome: g - federal - state };
    }
    const T = TAX2026;
    const fed = federalIncomeTax(g, T);
    const stateRate = opts.state === 'none' ? 0
      : opts.state === 'custom' ? Math.min(Math.max(num(opts.customRate), 0), 20) / 100
      : T.idahoRate;
    const state = fed.taxable * stateRate;                 // flat rate on taxable income (Idaho follows the federal standard deduction)
    const socialSecurity = Math.min(g, T.ssWageBase) * T.ssRate;
    const medicare = g * T.medicareRate + Math.max(0, g - T.addlMedicareOver) * T.addlMedicareRate;
    const total = fed.tax + state + socialSecurity + medicare;
    return { mode: 'realistic', taxable: fed.taxable, federal: fed.tax, state, stateRate,
             socialSecurity, medicare, total, takeHome: g - total };
  }

  // Smallest gross salary whose take-home covers `annualNeed`.
  function requiredGross(annualNeed, opts) {
    const need = Math.max(0, num(annualNeed));
    if (need === 0) return 0;
    if (!opts || opts.mode !== 'realistic') {
      return need / (1 - SIMPLE.federal - SIMPLE.state);    // take-home = 69% of gross
    }
    let lo = 0, hi = Math.max(need * 3, 50000);
    while (taxes(hi, opts).takeHome < need) hi *= 2;
    for (let i = 0; i < 80; i++) {                          // bisection to well under a cent
      const mid = (lo + hi) / 2;
      if (taxes(mid, opts).takeHome >= need) hi = mid; else lo = mid;
    }
    return hi;
  }

  // The original sheet's method, shown only as a comparison: it added 25% + 6% OF EXPENSES.
  // Because taxes are really taken from income, this comes out lower than the honest answer.
  function sheetMethodIncome(annualExpenses) {
    const e = num(annualExpenses);
    return { federal: e * SIMPLE.federal, state: e * SIMPLE.state, total: e * (1 + SIMPLE.federal + SIMPLE.state) };
  }

  // Everything the Step 5 dashboard shows.
  function affordability(input) {
    const salary = Math.max(0, num(input.salary));
    const t = totals(input.values);
    const tx = taxes(salary, input.tax);
    const annualNeed = t.essentialAnnual + t.savingsAnnual;  // = t.annual (savings kept separate for display)
    const surplus = tx.takeHome - annualNeed;
    const reqGross = requiredGross(annualNeed, input.tax);
    const hrs = workHours(input.days, input.hours).annualHours;
    return {
      salary, taxes: tx, takeHome: tx.takeHome,
      essentialAnnual: t.essentialAnnual, savingsAnnual: t.savingsAnnual, annualNeed,
      surplus, surplusMonthly: surplus / 12,
      requiredGross: reqGross,
      annualHours: hrs,
      requiredHourly: hrs > 0 ? reqGross / hrs : null,
      currentHourly: hrs > 0 ? salary / hrs : null,
      meter: meter(surplus, annualNeed)
    };
  }

  // Surplus: more than 5% of yearly costs left over. Balanced: 0–5% left. Shortfall: below 0.
  function meter(surplus, annualNeed) {
    const need = Math.max(0, num(annualNeed));
    const ratio = need > 0 ? surplus / need : (surplus >= 0 ? 1 : -1);
    let level = 'surplus';
    if (surplus < 0) level = 'shortfall';
    else if (ratio < 0.05) level = 'balanced';
    const label = { surplus: 'Surplus', balanced: 'Balanced', shortfall: 'Shortfall' }[level];
    // position 0..100 on a meter from −50% to +50% of yearly costs
    const pos = Math.max(0, Math.min(100, 50 + ratio * 100));
    return { level, label, ratio, pos };
  }

  // ── Step 6: sentences ──
  // A "meaningful" sentence has at least 4 words and ends with . ! or ?
  function sentences(text) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    if (!s) return { total: 0, meaningful: 0, words: 0 };
    const parts = s.match(/[^.!?]+[.!?]+/g) || [];
    const meaningful = parts.filter(p => p.trim().split(/\s+/).filter(w => /[a-z0-9]/i.test(w)).length >= 4).length;
    return { total: parts.length, meaningful, words: s.split(/\s+/).length };
  }

  // ── Step 6: reflection quality ──
  // Looks for an answer to each of the 5 prompts, at least one of the student's own numbers,
  // enough length, and real writing (not the same words over and over).
  const REFL_MIN_WORDS = 80;
  function reflectionQuality(d) {
    d = d || {};
    const raw = String(d.reflection || ''), t = raw.toLowerCase();
    const s = sentences(raw);
    const words = t.match(/[a-z0-9']+/g) || [];
    const uniq = new Set(words).size;
    const cmp = compare(d.predicted, (d.research || {}).values);
    const job = String((d.career || {}).job || '').toLowerCase().split(/[^a-z]+/).filter(w => w.length > 3);
    const underWord = cmp.under ? cmp.under.label.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 3) : [];
    const has = re => re.test(t);
    const checks = {
      surprise: has(/surpris|shock|didn'?t (expect|know|realize|think)|did not (expect|know|realize|think)|unexpected|amaz|crazy|eye.?open|never (knew|thought|realized)|i thought|wow/),
      under: has(/under.?estimat|guess(ed)? (way |too )?low|more than i (thought|guessed|expected|predicted|estimated)|cost(s|ed)? (way |a lot )?more|higher than (i|my)|way more|low.?ball/) ||
        (underWord.some(w => t.includes(w)) && has(/guess|estimat|predict|thought|expect/)),
      career: (has(/career|job|salary|income|paycheck|wage|earn/) || job.some(w => t.includes(w))) &&
        has(/afford|support|enough|cover|can'?t|cannot|not able|surplus|deficit|shortfall|left ?over|short|pay for|make it/),
      changes: has(/roommate|budget|cheaper|cut (back|down|out)|spend less|less on|sav(e|ing)|second job|side job|part.?time|raise|promotion|different (job|career|city|state|town|place|area)|move|smaller|used car|cook|instead|chang|degree|certif|college|training|overtime|split|carpool|bus|shop/),
      learned: has(/learn|realiz|understand|now know|know now|taught|lesson|important|financial(ly)? health|matters|need to|i see/),
      numbers: /\$\s?\d|\d[\d,.]*\s?(dollars|\/ ?mo|per month|a month|each month|a year|per year|an hour|per hour|\/ ?hr|%)|\b\d{3,}\b/.test(raw.replace(/,(?=\d{3})/g, ''))
    };
    const problems = [];
    if (s.meaningful < 5) problems.push('sentences');
    if (words.length < REFL_MIN_WORDS) problems.push('length');
    if (words.length >= 20 && uniq / words.length < 0.4) problems.push('repeat');
    ['surprise', 'under', 'career', 'changes', 'learned', 'numbers'].forEach(k => { if (!checks[k]) problems.push(k); });
    return { ok: problems.length === 0, problems, checks, words: words.length, sentences: s.meaningful, minWords: REFL_MIN_WORDS, cmp };
  }

  // ── Submission check (the database repeats the important parts) ──
  function missing(d) {
    const m = [];
    d = d || {};
    const c = d.career || {};
    if (!d.step0 || isBlank(d.step0.quiz)) m.push('Step 0: answer the interest question');
    if (isBlank(c.job)) m.push('Step 1: planned occupation');
    if (!(num(c.salary) > 0)) m.push('Step 1: first-year salary');
    if (!(num(c.days) > 0 && num(c.days) <= 7)) m.push('Step 1: days worked per week (1–7)');
    if (!(num(c.hours) > 0 && num(c.hours) <= 24)) m.push('Step 1: hours worked per day (1–24)');
    if (isBlank(c.place)) m.push('Step 1: where you plan to live');
    if (c.salarySource === 'researched' && isBlank(c.salaryUrl)) m.push('Step 1: where you found your salary (or mark it a guess)');
    KEYS.forEach(k => { if (!d.predicted || isBlank(d.predicted[k])) m.push('Step 2: your estimate for ' + CATS.find(x => x.key === k).label); });
    if (!d.predLockedAt) m.push('Step 2: lock your estimates');
    const r = d.research || {};
    if (isBlank(r.location)) m.push('Step 3: location researched');
    if (isBlank(r.household)) m.push('Step 3: household type');
    if (isBlank(r.url) || !/^https?:\/\/\S+\.\S+/i.test(String(r.url).trim())) m.push('Step 3: source web address (starts with https://)');
    KEYS.forEach(k => {
      const x = r.values && r.values[k];
      if (!x || isBlank(x.v)) m.push('Step 3: researched cost for ' + CATS.find(c2 => c2.key === k).label);
      else if (x.src === 'own' && isBlank(x.note)) m.push('Step 3: say where your ' + CATS.find(c2 => c2.key === k).label + ' number came from');
    });
    if (sentences(d.reflection).meaningful < 5) m.push('Step 6: at least 5 complete sentences');
    else if (!reflectionQuality(d).ok) m.push('Step 6: reflection needs more — answer every question and use your own numbers');
    return m;
  }

  // ── Suggested rubric points (teacher reviews and can override every line) ──
  // Reflection is left for the teacher (null). Calculations are done by the site, so their
  // points depend on the student actually completing the comparison/affordability work.
  function suggestScores(d, opts) {
    d = d || {};
    const c = d.career || {}, r = d.research || {}, vals = r.values || {};
    const filled = (obj, k) => obj && !isBlank(obj[k] && typeof obj[k] === 'object' ? obj[k].v : obj[k]);
    // Career & income research (10)
    let career = 0;
    if (!isBlank(c.job)) career += 2;
    if (num(c.salary) > 0) career += 2;
    if (num(c.days) > 0 && num(c.hours) > 0) career += 2;
    if (c.salarySource === 'researched' && !isBlank(c.salaryUrl)) career += 4;
    // Original predictions (15)
    const predN = KEYS.filter(k => filled(d.predicted, k)).length;
    const predictions = Math.round((predN / 12) * 13) + (d.predLockedAt ? 2 : 0);
    // Researched expenses & evidence (25)
    const resN = KEYS.filter(k => filled(vals, k) && !(vals[k].src === 'own' && isBlank(vals[k].note))).length;
    let research = Math.round((resN / 12) * 15);
    ['location', 'household'].forEach(f => { if (!isBlank(r[f])) research += 1; });
    if (/^https?:\/\/\S+\.\S+/i.test(String(r.url || '').trim())) research += 4;
    if (opts && opts.hasImage) research += 4;
    // Calculations & comparison (20): quiz right + reached and finished Steps 4 and 5
    let calc = 0;
    if (d.step0 && d.step0.quiz === 'b') calc += 4;
    if (d.done && d.done[4]) calc += 8;
    if (d.done && d.done[5]) calc += 8;
    // Completion (10)
    const completion = opts && opts.submitted ? 10 : 0;
    return { career, predictions, research, calc, reflection: null, completion };
  }
  const RUBRIC = [
    ['career', 'Career and income research', 10],
    ['predictions', 'Original expense predictions', 15],
    ['research', 'Researched expenses and evidence', 25],
    ['calc', 'Accurate calculations and comparison', 20],
    ['reflection', 'Written reflection', 20],
    ['completion', 'Completion and submission', 10]
  ];

  const FinanceCalc = {
    CATS, KEYS, ESSENTIAL_KEYS, SIMPLE, TAX2026, WEEKS_PER_YEAR, RUBRIC,
    num, isBlank, round2, checkMoney,
    simpleInterest, compoundInterest, workHours, hourlyFrom,
    totals, compare, federalIncomeTax, taxes, requiredGross, sheetMethodIncome,
    affordability, meter, sentences, reflectionQuality, missing, suggestScores
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = FinanceCalc;
  else root.FinanceCalc = FinanceCalc;
})(typeof window !== 'undefined' ? window : globalThis);

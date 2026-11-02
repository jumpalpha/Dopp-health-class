// Independent checks for finance_calc.js. Expected values below were worked out by hand.
// Run: node tools/test_finance_calc.js
const F = require('../finance_calc.js');
let pass = 0, fail = 0;
function eq(name, got, want, tol) {
  const ok = (got === null || want === null) ? got === want : Math.abs(got - want) <= (tol === undefined ? 0.005 : tol);
  if (ok) pass++; else { fail++; console.log('FAIL', name, 'got', got, 'want', want); }
}
function truthy(name, v) { if (v) pass++; else { fail++; console.log('FAIL', name); } }

// Step 0 — the sheet's example: $1,000 at 7% for a year = $70
eq('simple interest 1000@7', F.simpleInterest(1000, 7), 70);
eq('simple interest 2500@4.5', F.simpleInterest(2500, 4.5), 112.5);
eq('simple interest zero', F.simpleInterest(0, 7), 0);
eq('compound 1000@7 2yrs', F.compoundInterest(1000, 7, 2), 144.9);   // 1000*1.07^2-1000
eq('simple 1000@7 2yrs', F.simpleInterest(1000, 7, 2), 140);

// Step 1 — hours
eq('annual hours 5x8', F.workHours(5, 8).annualHours, 2080);
eq('hourly 52000/2080', F.hourlyFrom(52000, 2080), 25);
eq('hourly with 0 hours', F.hourlyFrom(52000, 0), null);
eq('annual hours 4x10', F.workHours(4, 10).annualHours, 2080);

// Steps 2–4 — totals keep monthly and annual separate, savings separate
const pred = { housing: 800, healthcare: 100, utilities: 100, childcare: 0, transportation: 200, education: 50,
  clothing: 50, entertainment: 100, food: 300, personal: 50, misc: 50, savings: 200 };      // = 2000/mo
const res = { housing: { v: 1100 }, healthcare: { v: 250 }, utilities: { v: 90 }, childcare: { v: 0 },
  transportation: { v: 450 }, education: { v: 50 }, clothing: { v: 60 }, entertainment: { v: 80 },
  food: { v: 400 }, personal: { v: 70 }, misc: { v: 50 }, savings: { v: 300 } };            // = 2900/mo
const tp = F.totals(pred);
eq('pred monthly', tp.monthly, 2000); eq('pred annual', tp.annual, 24000);
eq('pred essential monthly', tp.essentialMonthly, 1800); eq('pred savings annual', tp.savingsAnnual, 2400);
const cmp = F.compare(pred, res);
eq('res monthly', cmp.researchedMonthly, 2900); eq('res annual', cmp.researchedAnnual, 34800);
eq('diff monthly', cmp.diffMonthly, 900); eq('diff annual', cmp.diffAnnual, 10800);
eq('diff pct of reality', cmp.pct, 900 / 2900 * 100);
truthy('largest under = housing', cmp.under && cmp.under.key === 'housing' && cmp.under.diff === 300);
truthy('largest over = entertainment', cmp.over && cmp.over.key === 'entertainment' && cmp.over.diff === -20);
eq('row pct childcare (real $0) is null', cmp.rows.find(r => r.key === 'childcare').pct, null);
const zero = F.compare({}, {});
eq('empty compare pct', zero.pct, null); truthy('empty compare no under/over', !zero.under && !zero.over);

// Step 5 — simplified (25% + 6% of GROSS)
const s = F.taxes(100000, { mode: 'simplified' });
eq('simple federal', s.federal, 25000); eq('simple state', s.state, 6000); eq('simple take-home', s.takeHome, 69000);
eq('simple required gross for 69000', F.requiredGross(69000, { mode: 'simplified' }), 100000);
eq('sheet method total', F.sheetMethodIncome(24000).total, 31440);

// Step 5 — realistic 2026 (single, standard deduction)
// $50,000: taxable 33,900 → 1,240 + 21,500×12% = 3,820 fed; SS 3,100; Medicare 725; Idaho 33,900×5.3% = 1,796.70
const r50 = F.taxes(50000, { mode: 'realistic', state: 'ID' });
eq('fed 50k', r50.federal, 3820); eq('ss 50k', r50.socialSecurity, 3100); eq('medicare 50k', r50.medicare, 725);
eq('idaho 50k', r50.state, 1796.7); eq('total 50k', r50.total, 9441.7); eq('take-home 50k', r50.takeHome, 40558.3);
// Below the standard deduction: no income tax, payroll tax still applies
const r15 = F.taxes(15000, { mode: 'realistic', state: 'ID' });
eq('fed 15k', r15.federal, 0); eq('idaho 15k', r15.state, 0); eq('payroll 15k', r15.socialSecurity + r15.medicare, 1147.5);
// $250,000: taxable 233,900 → 1,240 + 4,560 + 12,166 + 23,058 + 10,280 = 51,304
const r250 = F.taxes(250000, { mode: 'realistic', state: 'none' });
eq('fed 250k', r250.federal, 51304); eq('ss capped', r250.socialSecurity, 11439);
eq('medicare 250k (+0.9% over 200k)', r250.medicare, 3625 + 450); eq('no state tax', r250.state, 0);
// custom state rate
eq('custom 4% state on 50k', F.taxes(50000, { mode: 'realistic', state: 'custom', customRate: 4 }).state, 1356);
// zero income
eq('zero income taxes', F.taxes(0, { mode: 'realistic', state: 'ID' }).total, 0);
// required gross round-trips
eq('required gross realistic ≈ 50k', F.requiredGross(40558.3, { mode: 'realistic', state: 'ID' }), 50000, 0.01);
eq('required gross zero need', F.requiredGross(0, { mode: 'realistic' }), 0);
const big = F.requiredGross(2000000, { mode: 'realistic', state: 'ID' });
eq('required gross huge covers need', F.taxes(big, { mode: 'realistic', state: 'ID' }).takeHome, 2000000, 0.01);

// Affordability dashboard
const a = F.affordability({ salary: 50000, days: 5, hours: 8, values: res, tax: { mode: 'realistic', state: 'ID' } });
eq('need = 34800', a.annualNeed, 34800); eq('essential', a.essentialAnnual, 31200); eq('savings', a.savingsAnnual, 3600);
eq('surplus', a.surplus, 40558.3 - 34800); truthy('meter surplus', a.meter.level === 'surplus');
eq('current hourly', a.currentHourly, 50000 / 2080);
eq('required hourly', a.requiredHourly, a.requiredGross / 2080);
eq('take-home at required gross = need', F.taxes(a.requiredGross, { mode: 'realistic', state: 'ID' }).takeHome, 34800, 0.01);
const a0 = F.affordability({ salary: 0, days: 0, hours: 0, values: res, tax: { mode: 'simplified' } });
eq('zero salary deficit', a0.surplus, -34800); truthy('zero salary shortfall', a0.meter.level === 'shortfall');
eq('required hourly null when no hours', a0.requiredHourly, null);
truthy('balanced band', F.meter(100, 10000).level === 'balanced' && F.meter(600, 10000).level === 'surplus' && F.meter(-1, 10000).level === 'shortfall');
truthy('zero expenses zero income = balanced or surplus', F.meter(0, 0).level !== 'shortfall');
eq('large values', F.totals({ housing: 9999999 }).annual, 119999988);

// Inputs
truthy('blank money ok', F.checkMoney('').ok && F.checkMoney('').blank);
truthy('negative rejected', !F.checkMoney('-5').ok);
truthy('text rejected', !F.checkMoney('abc').ok);
truthy('commas ok', F.checkMoney('$1,250').value === 1250);
truthy('too big rejected', !F.checkMoney('99999999').ok);

// Sentences
eq('5 sentences', F.sentences('I was surprised by rent. Food cost more than I thought. My job can pay for it. I could get a roommate to save. Budgets matter for health.').meaningful, 5);
eq('short ones do not count', F.sentences('Yes. No. Ok then. Rent was very high.').meaningful, 1);
eq('no ending punctuation', F.sentences('Rent is high and I learned').meaningful, 0);

// Missing-field check
truthy('empty has many missing', F.missing({}).length > 20);
const full = { step0: { quiz: 'b' }, career: { job: 'Nurse', salary: 60000, days: 4, hours: 12, place: 'Boise, ID', salarySource: 'guess' },
  predicted: pred, predLockedAt: '2026-11-02', research: { location: 'Ada County, ID', household: '1 adult, 0 children',
  url: 'https://livingwage.mit.edu/', date: '2026-11-02', values: res },
  reflection: 'I was surprised by rent. Food cost more than I thought. My job can pay for it. I could get a roommate to save. Budgets matter for health.' };
truthy('complete has nothing missing', F.missing(full).length === 0);
const own = JSON.parse(JSON.stringify(full)); own.research.values.savings = { v: 300, src: 'own', note: '' };
truthy('own source needs a note', F.missing(own).some(m => /Savings/.test(m)));

// Suggested scores never auto-grade the reflection
const sc = F.suggestScores(Object.assign({ done: { 4: true, 5: true } }, full), { submitted: true, hasImage: true });
truthy('reflection left for teacher', sc.reflection === null);
eq('predictions 15', sc.predictions, 15); eq('research 25', sc.research, 25); eq('calc 20', sc.calc, 20);
eq('career guess = 6', sc.career, 6); eq('completion 10', sc.completion, 10);
eq('nothing entered scores 0', Object.values(F.suggestScores({}, {})).reduce((t, v) => t + (v || 0), 0), 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

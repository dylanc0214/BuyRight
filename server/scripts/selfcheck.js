/**
 * selfcheck.js — smallest runnable checks for the non-trivial logic
 * (no DB, no API needed). Run: npm run check
 */
const assert = require('assert');
const { monthlyInstallment, formatRM } = require('../src/services/carFormatter');
const { parseFallback } = require('../src/services/fallbackParser');
const { estimatePrice } = require('../src/services/sellFlowService');

// ── Loan math: RM50,000 car → principal 45,000, interest 14,175, 108 months
assert.strictEqual(monthlyInstallment(50000), Math.round((45000 + 45000 * 0.035 * 9) / 108));
assert.strictEqual(formatRM(45000), 'RM 45,000');
assert.strictEqual(formatRM(1250000), 'RM 1.25M');

// ── Fallback parser: buy intent with filters
const buy = parseFallback('Looking for a Honda SUV under RM100k in Penang');
assert.strictEqual(buy.intent, 'buy');
assert.strictEqual(buy.filters.brand, 'Honda');
assert.strictEqual(buy.filters.bodyType, 'SUV');
assert.strictEqual(buy.filters.priceMax, 100000);
assert.strictEqual(buy.filters.state, 'Penang');
assert.ok(buy.hasEnoughInfo);

// ── Fallback parser: "under 50k" works without the RM prefix
const noRm = parseFallback('anything under 50k in KL');
assert.strictEqual(noRm.filters.priceMax, 50000);
assert.strictEqual(noRm.filters.state, 'Kuala Lumpur');

// ── Fallback parser: bare budget triggers floor + desc sort
const budget = parseFallback('my budget is RM60k');
assert.strictEqual(budget.filters.priceMax, 60000);
assert.strictEqual(budget.filters.priceMin, 36000);
assert.ok(budget.hasEnoughInfo);

// ── Fallback parser: sell intent extracts details
const sell = parseFallback('I want to sell my 2019 Perodua Myvi, 60,000 km');
assert.strictEqual(sell.intent, 'sell');
assert.strictEqual(sell.sellDetails.brand, 'Perodua');
assert.strictEqual(sell.sellDetails.model, 'Myvi');
assert.strictEqual(sell.sellDetails.year, 2019);
assert.strictEqual(sell.sellDetails.mileageKm, 60000);
assert.ok(sell.hasEnoughInfo);

// ── Fallback parser: incomplete sell asks for more
const sellPartial = parseFallback('I want to sell my car');
assert.strictEqual(sellPartial.intent, 'sell');
assert.ok(!sellPartial.hasEnoughInfo);
assert.ok(sellPartial.nextQuestion);

// ── Price estimate: median of comparables, mileage-adjusted, 500-rounded
const comps = [
  { price: '40000', mileage_km: 50000 },
  { price: '45000', mileage_km: 60000 },
  { price: '50000', mileage_km: 70000 },
];
const est = estimatePrice({ mileageKm: 60000 }, comps);
assert.strictEqual(est.suggested, 45000); // median, no mileage diff
assert.strictEqual(est.sampleSize, 3);
const estHighMileage = estimatePrice({ mileageKm: 110000 }, comps);
assert.ok(estHighMileage.suggested < 45000, 'high mileage should lower the estimate');
assert.strictEqual(estimatePrice({}, []), null);

console.log('✅ All self-checks passed');

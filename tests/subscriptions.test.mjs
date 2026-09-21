import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  normalizeMerchant,
  medianInt,
  monthlyEquivalent,
  analyzeSubscriptions,
  formatCents,
  FREE_MAX_ROWS,
} from "../src/subscriptions.js";

const dir = dirname(fileURLToPath(import.meta.url));
const SAMPLE = readFileSync(join(dir, "..", "docs", "sample", "bank-sample.csv"), "utf8");

test("normalizeMerchant strips refs and digits, keeps words", () => {
  assert.equal(normalizeMerchant("NETFLIX.COM 866-579-7172"), "netflix com");
  assert.equal(normalizeMerchant("Spotify SE"), "spotify se");
  assert.equal(normalizeMerchant("12345"), "unknown-merchant");
});

test("medianInt rounds halves up", () => {
  assert.equal(medianInt([1599, 1599, 1699, 1699]), 1649);
  assert.equal(medianInt([5]), 5);
  assert.equal(medianInt([]), null);
});

test("monthlyEquivalent uses integer math per cadence", () => {
  assert.equal(monthlyEquivalent("monthly", 1099), 1099);
  assert.equal(monthlyEquivalent("weekly", 199), 862);
  assert.equal(monthlyEquivalent("quarterly", 300), 100);
  assert.equal(monthlyEquivalent("yearly", 1200), 100);
});

test("sample: finds 6 recurring merchants with exact monthly burn €54.07", () => {
  const r = analyzeSubscriptions(SAMPLE);
  assert.equal(r.stats.recurringCount, 6);
  assert.equal(r.burnCurrency, "EUR");
  assert.equal(r.monthlyBurnCents, 5407);
  assert.equal(r.yearlyProjectionCents, 64884);
  const byName = Object.fromEntries(r.recurring.map((m) => [m.merchant, m]));
  assert.equal(byName["netflix com"].monthlyEquivalentCents, 1649);
  assert.equal(byName["spotify se"].monthlyEquivalentCents, 1099);
  assert.equal(byName["amazon prime"].monthlyEquivalentCents, 499);
  assert.equal(byName["amazon music"].monthlyEquivalentCents, 999);
  assert.equal(byName["cloud storage"].monthlyEquivalentCents, 299);
  assert.equal(byName["weekly app"].monthlyEquivalentCents, 862);
});

test("sample: price increase, new subscription and duplicate findings", () => {
  const r = analyzeSubscriptions(SAMPLE);
  const types = r.findings.map((f) => f.type);
  assert.ok(types.includes("price_increase"));
  const pi = r.findings.find((f) => f.type === "price_increase");
  assert.equal(pi.merchant, "netflix com");
  assert.equal(pi.firstCents, 1599);
  assert.equal(pi.lastCents, 1699);
  const nw = r.findings.find((f) => f.type === "new_subscription");
  assert.equal(nw.merchant, "weekly app");
  const dup = r.findings.find((f) => f.type === "possible_duplicate");
  assert.deepEqual([...dup.merchants].sort(), ["amazon music", "amazon prime"]);
});

test("sample: honesty counters — inflow skipped, unknown counted, 2x charge irregular", () => {
  const r = analyzeSubscriptions(SAMPLE);
  assert.equal(r.stats.rowsSeen, 24);
  assert.equal(r.stats.skippedInflows, 1);
  assert.equal(r.stats.skippedUnknown, 1);
  const fitness = r.merchants.find((m) => m.merchant === "fitness club annual");
  assert.equal(fitness.cadence, null);
  assert.ok(r.issues.some((i) => i.code === "unknown_amount"));
  // Unknown money never leaks into totals.
  assert.ok(!r.recurring.some((m) => m.merchant.includes("mystery")));
});

test("free cap slices rows and says so", () => {
  const r = analyzeSubscriptions(SAMPLE, { maxRows: 5 });
  assert.equal(r.capped, true);
  assert.equal(r.stats.rowsAnalyzed, 5);
  assert.equal(r.stats.rowsSeen, 24);
  const full = analyzeSubscriptions(SAMPLE);
  assert.equal(full.capped, false);
});

test("multi-currency refuses a combined total", () => {
  const csv = "Date;Description;Amount\n2026-05-01;STREAM ALPHA;-10,00 €\n2026-06-01;STREAM ALPHA;-10,00 €\n2026-07-01;STREAM ALPHA;-10,00 €\n2026-05-01;STREAM BETA;-$5.00\n2026-06-01;STREAM BETA;-$5.00\n2026-07-01;STREAM BETA;-$5.00\n";
  const r = analyzeSubscriptions(csv);
  assert.equal(r.monthlyBurnCents, null);
  assert.equal(r.burnCurrency, "MULTI");
  assert.deepEqual(r.perCurrencyBurns, { EUR: 1000, USD: 500 });
  assert.ok(r.issues.some((i) => i.code === "multi_currency"));
});

test("two occurrences are never recurring", () => {
  const csv = "Date;Description;Amount\n2026-01-05;GYM;-20,00 €\n2026-02-05;GYM;-20,00 €\n";
  const r = analyzeSubscriptions(csv);
  assert.equal(r.stats.recurringCount, 0);
  assert.equal(r.merchants[0].cadence, null);
});

test("formatCents never invents precision", () => {
  assert.equal(formatCents(5407, "EUR"), "€54.07");
  assert.equal(formatCents(-199, "USD"), "-$1.99");
  assert.equal(formatCents(null, "EUR"), "unknown");
});

test("FREE_MAX_ROWS constant is the documented cap", () => {
  assert.equal(FREE_MAX_ROWS, 200);
});

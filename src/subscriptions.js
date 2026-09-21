// subscriptions.js — recurring-charge detection over parsed bank rows.
// Pure, no DOM, no network, no dependencies.
//
// Money is integer minor units throughout. UNKNOWN is not ZERO: rows
// with unreadable amounts are counted and listed, never summed.
// A charge is recurring only with >=3 occurrences on a stable cadence;
// anything else is reported as irregular, never upgraded.
// Cross-currency totals are refused, never summed.

import { parseBankCsv } from "./parse.js";

export const FREE_MAX_ROWS = 200;
export const FREE_MAX_MERCHANTS_SHOWN = 5;
export const PRO_PRICE_EUR = "€2.99";

const CADENCES = [
  { name: "weekly", lo: 6, hi: 8 },
  { name: "monthly", lo: 27, hi: 33 },
  { name: "quarterly", lo: 85, hi: 97 },
  { name: "yearly", lo: 350, hi: 380 },
];

export function normalizeMerchant(raw) {
  const tokens = String(raw || "")
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !/^\d+$/.test(t));
  const joined = tokens.join(" ");
  return joined === "" ? "unknown-merchant" : joined;
}

export function medianInt(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return null;
  if (n % 2 === 1) return sorted[(n - 1) / 2];
  return Math.round((sorted[n / 2 - 1] + sorted[n / 2]) / 2);
}

export function monthlyEquivalent(cadence, medianCents) {
  if (cadence === "weekly") return Math.round((medianCents * 52) / 12);
  if (cadence === "monthly") return medianCents;
  if (cadence === "quarterly") return Math.round(medianCents / 3);
  if (cadence === "yearly") return Math.round(medianCents / 12);
  return null;
}

function detectCadence(days) {
  if (days.length < 3) return { cadence: null, intervals: [] };
  const sorted = [...days].sort((a, b) => a - b);
  const intervals = [];
  for (let i = 1; i < sorted.length; i++) intervals.push(sorted[i] - sorted[i - 1]);
  const med = medianInt(intervals);
  const bucket = CADENCES.find((c) => med >= c.lo && med <= c.hi);
  if (!bucket) return { cadence: null, intervals };
  const stable = intervals.every((iv) => iv >= bucket.lo && iv <= bucket.hi);
  if (!stable) return { cadence: null, intervals };
  return { cadence: bucket.name, intervals };
}

// text: raw CSV text. opts: { maxRows } — the free cap slices the
// earliest rows and reports capped:true; it never reorders or samples.
export function analyzeSubscriptions(text, opts = {}) {
  const maxRows = opts.maxRows == null ? Infinity : opts.maxRows;
  const parsed = parseBankCsv(text);
  const issues = [...parsed.issues];
  const capped = parsed.rows.length > maxRows;
  const sliced = parsed.rows.slice(0, maxRows);

  let skippedInflows = 0;
  let skippedUnknown = 0;
  const groups = new Map();
  for (const r of sliced) {
    if (r.flow === "in" || r.flow === "zero") {
      skippedInflows++;
      continue;
    }
    if (r.flow === "unknown" || r.amountCents == null) {
      skippedUnknown++;
      continue;
    }
    const key = normalizeMerchant(r.merchantRaw);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const fileMaxDay = sliced.reduce((m, r) => Math.max(m, r.day), -Infinity);
  const merchants = [];
  const findings = [];

  for (const [key, charges] of groups) {
    const abs = charges.map((c) => Math.abs(c.amountCents)).sort((a, b) => a - b);
    const days = charges.map((c) => c.day);
    const { cadence } = detectCadence(days);
    const sortedDays = [...days].sort((a, b) => a - b);
    const firstSeenDay = sortedDays[0];
    const lastSeenDay = sortedDays[sortedDays.length - 1];
    const medianCents = medianInt(abs);
    const spread = abs[abs.length - 1] - abs[0];
    const stable = spread <= Math.max(1, Math.round(medianCents * 0.1));
    const firstCents = Math.abs(charges.find((c) => c.day === firstSeenDay).amountCents);
    const lastCents = Math.abs(charges.find((c) => c.day === lastSeenDay).amountCents);
    const currencySet = new Set(charges.map((c) => c.currency).filter(Boolean));

    const entry = {
      merchant: key,
      rawExamples: [...new Set(charges.map((c) => c.merchantRaw))].slice(0, 3),
      charges: charges.length,
      cadence,
      firstSeenDay,
      lastSeenDay,
      medianCents,
      amountStable: stable,
      monthlyEquivalentCents: cadence ? monthlyEquivalent(cadence, medianCents) : null,
      currencies: [...currencySet],
    };
    merchants.push(entry);

    if (cadence && lastCents * 100 > firstCents * 105) {
      findings.push({
        type: "price_increase",
        merchant: key,
        firstCents,
        lastCents,
        increaseBp: Math.round(((lastCents - firstCents) * 10000) / firstCents),
      });
    }
    if (cadence && fileMaxDay !== -Infinity && fileMaxDay - firstSeenDay <= 45) {
      findings.push({ type: "new_subscription", merchant: key, firstSeenDay, monthlyEquivalentCents: entry.monthlyEquivalentCents });
    }
  }

  const recurring = merchants.filter((m) => m.cadence);
  recurring.sort((a, b) => b.monthlyEquivalentCents - a.monthlyEquivalentCents);

  // Possible duplicates: same first token, different full key, both recurring.
  for (let i = 0; i < recurring.length; i++) {
    for (let j = i + 1; j < recurring.length; j++) {
      const a = recurring[i].merchant.split(" ")[0];
      const b = recurring[j].merchant.split(" ")[0];
      if (a && a === b) {
        findings.push({ type: "possible_duplicate", merchants: [recurring[i].merchant, recurring[j].merchant] });
      }
    }
  }

  // Currency rule: exactly one currency across recurring charges, or
  // per-currency subtotals and no combined total.
  const recurringCurrencies = new Set();
  for (const m of recurring) for (const c of m.currencies) recurringCurrencies.add(c);
  const perCurrencyBurns = {};
  for (const m of recurring) {
    if (m.currencies.length === 1) {
      const c = m.currencies[0];
      perCurrencyBurns[c] = (perCurrencyBurns[c] || 0) + m.monthlyEquivalentCents;
    }
  }
  let monthlyBurnCents = null;
  let burnCurrency = null;
  if (recurringCurrencies.size === 1) {
    const only = [...recurringCurrencies][0];
    burnCurrency = only;
    monthlyBurnCents = perCurrencyBurns[only] || 0;
  } else if (recurringCurrencies.size > 1) {
    burnCurrency = "MULTI";
    issues.push({
      row: 0,
      code: "multi_currency",
      detail: "Recurring charges span several currencies. Totals are per currency only; no combined figure is claimed.",
    });
  }

  return {
    merchants,
    recurring,
    monthlyBurnCents,
    burnCurrency,
    perCurrencyBurns,
    yearlyProjectionCents: monthlyBurnCents == null ? null : monthlyBurnCents * 12,
    findings,
    capped,
    stats: {
      rowsSeen: parsed.rows.length,
      rowsAnalyzed: sliced.length,
      skippedInflows,
      skippedUnknown,
      merchantCount: merchants.length,
      recurringCount: recurring.length,
    },
    issues,
    delimiter: parsed.delimiter,
  };
}

export function formatCents(cents, currency) {
  if (cents == null) return "unknown";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  const symbol = currency === "USD" ? "$" : currency === "GBP" ? "£" : "€";
  return `${sign}${symbol}${euros}.${rest}`;
}

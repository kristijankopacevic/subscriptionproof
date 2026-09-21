import test from "node:test";
import assert from "node:assert/strict";
import {
  splitCsvLine,
  detectDelimiter,
  detectCurrency,
  parseAmountToCents,
  parseDate,
  parseBankCsv,
} from "../src/parse.js";

test("splitCsvLine handles quotes and escaped quotes", () => {
  assert.deepEqual(splitCsvLine('a;"b;c";d', ";"), ["a", "b;c", "d"]);
  assert.deepEqual(splitCsvLine('"a""b";c', ";"), ['a"b', "c"]);
});

test("detectDelimiter prefers semicolon for European exports", () => {
  assert.equal(detectDelimiter("a;b;c\n1;2;3\n"), ";");
  assert.equal(detectDelimiter("a,b,c\n1,2,3\n"), ",");
  assert.equal(detectDelimiter(""), ",");
});

test("detectCurrency spots common symbols and codes", () => {
  assert.equal(detectCurrency("-15,99 €"), "EUR");
  assert.equal(detectCurrency("$12.00"), "USD");
  assert.equal(detectCurrency("£3.50"), "GBP");
  assert.equal(detectCurrency("25.00 CHF"), "CHF");
  assert.equal(detectCurrency("100"), null);
});

test("parseAmountToCents: European and Anglo formats", () => {
  assert.equal(parseAmountToCents("-15,99 €").cents, -1599);
  assert.equal(parseAmountToCents("-15.99").cents, -1599);
  assert.equal(parseAmountToCents("1.234,56").cents, 123456);
  assert.equal(parseAmountToCents("1,234.56").cents, 123456);
  assert.equal(parseAmountToCents("(12.50)").cents, -1250);
  assert.equal(parseAmountToCents("+7,00").cents, 700);
});

test("parseAmountToCents: thousands-vs-decimal rule", () => {
  assert.equal(parseAmountToCents("1,000").cents, 100000);
  assert.equal(parseAmountToCents("1.000").cents, 100000);
  assert.equal(parseAmountToCents("1,5").cents, 150);
  assert.equal(parseAmountToCents("1.5").cents, 150);
  assert.equal(parseAmountToCents("2500").cents, 250000);
});

test("parseAmountToCents: unreadable stays UNKNOWN, never zero", () => {
  const r = parseAmountToCents("???");
  assert.equal(r.unknown, true);
  assert.ok(!("cents" in r) || r.cents === undefined);
  assert.equal(parseAmountToCents("").unknown, true);
  assert.equal(parseAmountToCents("no digits here!").unknown, true);
});

test("parseDate: ISO, dotted and slash forms", () => {
  assert.equal(parseDate("2026-08-12").iso, "2026-08-12");
  assert.equal(parseDate("12.08.2026").iso, "2026-08-12");
  assert.equal(parseDate("2026-02-30"), null);
  assert.equal(parseDate("not a date"), null);
});

test("parseDate: slash assumption is DD/MM when first part exceeds 12", () => {
  assert.equal(parseDate("13/08/2026").iso, "2026-08-13");
  assert.equal(parseDate("08/12/2026").iso, "2026-08-12");
});

test("parseBankCsv: missing amount column is fatal, not guessed", () => {
  const res = parseBankCsv("Date;Description\n2026-01-01;X\n");
  assert.equal(res.rows.length, 0);
  assert.ok(res.issues.some((i) => i.code === "missing_columns"));
});

test("parseBankCsv: bad rows are kept UNKNOWN or skipped, counted in issues", () => {
  const res = parseBankCsv("Date;Description;Amount\n2026-08-15;MYSTERY;???\n2026-08-16; inflow ;2500,00 €\n");
  assert.equal(res.rows.length, 2);
  assert.equal(res.rows[0].flow, "unknown");
  assert.equal(res.rows[0].amountCents, null);
  assert.equal(res.rows[1].flow, "in");
  assert.ok(res.issues.some((i) => i.code === "unknown_amount"));
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { escapeHtml, csvCell, merchantsCsv } from "../src/render.js";
import { analyzeSubscriptions } from "../src/subscriptions.js";

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, "..");
const SAMPLE = readFileSync(join(root, "docs", "sample", "bank-sample.csv"), "utf8");

test("escapeHtml neutralises merchant-controlled text", () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  assert.equal(escapeHtml("a'b&c"), "a&#39;b&amp;c");
});

test("csvCell guards formula injection and quotes fields", () => {
  assert.equal(csvCell("=SUM(A1:A9)"), "\"'=SUM(A1:A9)\"");
  assert.equal(csvCell("+cmd"), "\"'+cmd\"");
  assert.equal(csvCell("-2+3"), "\"'-2+3\"");
  assert.equal(csvCell("@x"), "\"'@x\"");
  assert.equal(csvCell('say "hi", ok'), '"say ""hi"", ok"');
  assert.equal(csvCell("plain"), '"plain"');
});

test("merchantsCsv exports one row per merchant with provenance", () => {
  const r = analyzeSubscriptions(SAMPLE);
  const csv = merchantsCsv(r, "bank-sample.csv");
  const lines = csv.trim().split("\r\n");
  assert.equal(lines.length, r.merchants.length + 1);
  assert.ok(lines[0].includes('"merchant"'));
  assert.ok(lines[0].includes('"source_file"'));
  const netflix = lines.find((l) => l.includes('"netflix com"'));
  assert.ok(netflix.includes('"16.49"'));
  assert.ok(netflix.includes('"bank-sample.csv"'));
});

function embeddedSample(htmlPath) {
  const html = readFileSync(join(root, htmlPath), "utf8");
  const m = html.match(/<script type="text\/plain" id="sample-csv">([\s\S]*?)<\/script>/);
  assert.ok(m, `${htmlPath} must embed the sample CSV`);
  return m[1].replace(/^\n/, "").replace(/\n$/, "");
}

test("index.html and pro.html embed the sample identical to the fixture", () => {
  assert.equal(embeddedSample("index.html").trim(), SAMPLE.trim());
  assert.equal(embeddedSample("pro.html").trim(), SAMPLE.trim());
});

test("pro.html template carries exactly one secret-injection marker", () => {
  const html = readFileSync(join(root, "pro.html"), "utf8");
  const hits = html.match(/\/\*__SUBPROOF_SECRET__\*\//g) || [];
  assert.equal(hits.length, 1);
  assert.ok(!html.includes("test-secret"), "no real secret may sit in the template");
});

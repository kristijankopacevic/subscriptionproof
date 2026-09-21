// render.js — HTML string builders + CSV export for the pages.
// No DOM access here, so all of it is unit-tested in Node.
// Escaping discipline: merchant-controlled text is escaped in HTML
// and formula-guarded in CSV exports (leading = + - @ TAB CR get a
// protective single quote, every field is double-quoted).

import { formatCents } from "./subscriptions.js";

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function csvCell(v) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

export function merchantRowHtml(m, currency) {
  const cadence = m.cadence ? `<span class="tag t-sub">${escapeHtml(m.cadence)}</span>` : `<span class="tag t-irr">irregular</span>`;
  const monthly = m.monthlyEquivalentCents == null ? `<span class="unknown">n/a</span>` : escapeHtml(formatCents(m.monthlyEquivalentCents, currency));
  const median = escapeHtml(formatCents(m.medianCents, currency));
  const stable = m.amountStable ? "" : ` <span class="tag t-var">amount varies</span>`;
  return `<tr><td>${escapeHtml(m.merchant)}<div class="ex">${escapeHtml(m.rawExamples.join(" · "))}</div></td><td>${cadence}${stable}</td><td class="n">${m.charges}</td><td class="n">${median}</td><td class="n"><b>${monthly}</b></td></tr>`;
}

export function findingHtml(f, currency) {
  if (f.type === "price_increase") {
    const pct = (f.increaseBp / 100).toFixed(2);
    return `<li><span class="tag t-inc">price increase</span> <b>${escapeHtml(f.merchant)}</b> went from ${escapeHtml(formatCents(f.firstCents, currency))} to ${escapeHtml(formatCents(f.lastCents, currency))} (+${escapeHtml(pct)}%).</li>`;
  }
  if (f.type === "new_subscription") {
    return `<li><span class="tag t-new">new</span> <b>${escapeHtml(f.merchant)}</b> first appeared recently — about ${escapeHtml(formatCents(f.monthlyEquivalentCents, currency))}/mo if it continues.</li>`;
  }
  if (f.type === "possible_duplicate") {
    return `<li><span class="tag t-dup">possible duplicate</span> <b>${escapeHtml(f.merchants[0])}</b> and <b>${escapeHtml(f.merchants[1])}</b> look like the same vendor billed twice. Check whether both are wanted.</li>`;
  }
  return `<li>${escapeHtml(JSON.stringify(f))}</li>`;
}

export function issueHtml(issue) {
  return `<li><code>${escapeHtml(issue.code)}</code>${issue.row ? ` (row ${issue.row})` : ""} — ${escapeHtml(issue.detail)}</li>`;
}

// Accountant-friendly export: one row per merchant, decimal amounts,
// currency column, source file + row-cap provenance on every row.
export function merchantsCsv(result, sourceName) {
  const header = ["merchant", "cadence", "charges", "median_amount", "monthly_equivalent", "currency", "first_seen", "last_seen", "source_file", "capped"];
  const lines = [header.map(csvCell).join(",")];
  const cur = result.burnCurrency && result.burnCurrency !== "MULTI" ? result.burnCurrency : "";
  for (const m of result.merchants) {
    const toMajor = (c) => (c == null ? "unknown" : (c / 100).toFixed(2));
    lines.push(
      [
        m.merchant,
        m.cadence || "irregular",
        String(m.charges),
        toMajor(m.medianCents),
        toMajor(m.monthlyEquivalentCents),
        cur,
        String(m.firstSeenDay),
        String(m.lastSeenDay),
        sourceName || "",
        result.capped ? "yes" : "no",
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return lines.join("\r\n") + "\r\n";
}

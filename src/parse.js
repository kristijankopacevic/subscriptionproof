// parse.js — CSV + money + date parsing for bank-statement exports.
// Pure, no DOM, no network, no dependencies. Shared unchanged by the
// demo page, the Pro page and the tests.
//
// Core honesty rule: an unreadable amount is UNKNOWN, never zero.
// Rows with unknown amounts are kept, counted and reported — they are
// never silently dropped and never summed as 0.

export function splitCsvLine(line, delim) {
  const cells = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function countOutsideQuotes(line, delim) {
  let n = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && ch === delim) {
      n++;
    }
  }
  return n;
}

// Delimiter detection: ';' wins ties only when it actually appears,
// otherwise the higher count wins; fallback is ','.
export function detectDelimiter(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "").slice(0, 5);
  let semi = 0;
  let comma = 0;
  for (const l of lines) {
    semi += countOutsideQuotes(l, ";");
    comma += countOutsideQuotes(l, ",");
  }
  if (semi === 0 && comma === 0) return ",";
  return semi >= comma ? ";" : ",";
}

export function detectCurrency(raw) {
  const s = String(raw);
  if (s.includes("€")) return "EUR";
  if (s.includes("$")) return "USD";
  if (s.includes("£")) return "GBP";
  const m = s.match(/\b(CHF|HRK|EUR|USD|GBP|SEK|NOK|DKK|PLN|CZK|HUF|RON|BGN)\b/i);
  if (m) return m[1].toUpperCase();
  if (/\bkn\b/i.test(s)) return "HRK";
  return null;
}

// Thousands-vs-decimal rule (documented assumption):
// a trailing group of exactly 3 digits after the last separator is a
// thousands group ("1,000" -> 1000.00, "1.000" -> 1000.00);
// any other trailing group is the decimal part ("1,5" -> 1.50).
export function parseAmountToCents(raw) {
  if (raw == null) return { unknown: true, reason: "empty", currency: null };
  let s = String(raw).trim();
  if (s === "") return { unknown: true, reason: "empty", currency: null };
  const currency = detectCurrency(s);
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1).trim();
  }
  if (/^-/.test(s)) {
    neg = true;
    s = s.slice(1).trim();
  } else if (/^\+/.test(s)) {
    s = s.slice(1).trim();
  }
  const num = s.replace(/[^0-9.,]/g, "");
  if (!/[0-9]/.test(num)) return { unknown: true, reason: "no-digits", currency };
  const lastDot = num.lastIndexOf(".");
  const lastComma = num.lastIndexOf(",");
  let intPart;
  let fracPart = "";
  if (lastDot > -1 && lastComma > -1) {
    const decPos = Math.max(lastDot, lastComma);
    fracPart = num.slice(decPos + 1);
    intPart = num.slice(0, decPos).replace(/[.,]/g, "");
  } else if (lastComma > -1) {
    const after = num.slice(lastComma + 1);
    if (after.length === 3) {
      intPart = num.replace(/[.,]/g, "");
    } else {
      intPart = num.slice(0, lastComma).replace(/[.,]/g, "");
      fracPart = after;
    }
  } else if (lastDot > -1) {
    const after = num.slice(lastDot + 1);
    if (after.length === 3) {
      intPart = num.replace(/[.,]/g, "");
    } else {
      intPart = num.slice(0, lastDot).replace(/[.,]/g, "");
      fracPart = after;
    }
  } else {
    intPart = num;
  }
  if (intPart === "") intPart = "0";
  if (!/^\d+$/.test(intPart)) return { unknown: true, reason: "bad-integer", currency };
  if (fracPart !== "" && !/^\d+$/.test(fracPart)) {
    return { unknown: true, reason: "bad-fraction", currency };
  }
  fracPart = (fracPart + "00").slice(0, 2);
  const cents = Number(intPart) * 100 + Number(fracPart);
  if (!Number.isSafeInteger(cents)) return { unknown: true, reason: "overflow", currency };
  return { cents: neg ? -cents : cents, currency };
}

// Slash-date assumption (documented): DD/MM/YYYY when the first part
// exceeds 12, otherwise MM/DD/YYYY. Dotted dates are always DD.MM.YYYY.
export function parseDate(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  let y;
  let m;
  let d;
  let mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (mIso) {
    y = Number(mIso[1]);
    m = Number(mIso[2]);
    d = Number(mIso[3]);
  } else {
    const mDot = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (mDot) {
      d = Number(mDot[1]);
      m = Number(mDot[2]);
      y = Number(mDot[3]);
    } else {
      const mSlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (!mSlash) return null;
      const a = Number(mSlash[1]);
      const b = Number(mSlash[2]);
      y = Number(mSlash[3]);
      if (a > 12) {
        d = a;
        m = b;
      } else {
        m = a;
        d = b;
      }
    }
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const ms = Date.UTC(y, m - 1, d);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    return null;
  }
  const iso = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { iso, day: Math.floor(ms / 86400000) };
}

const DATE_ALIASES = ["date", "datum", "valuta", "buchung", "booking", "posting", "value date", "transaction date"];
const DESC_ALIASES = [
  "description",
  "desc",
  "details",
  "detail",
  "merchant",
  "payee",
  "recipient",
  "narrative",
  "opis",
  "primatelj",
  "empfänger",
  "auftraggeber",
  "buchungstext",
  "verwendungszweck",
];
const AMOUNT_ALIASES = ["amount", "betrag", "iznos", "value", "sum", "total", "uplata", "isplata"];

function findColumn(headers, aliases) {
  const lowered = headers.map((h) => String(h).trim().toLowerCase());
  for (const alias of aliases) {
    for (let i = 0; i < lowered.length; i++) {
      if (lowered[i].includes(alias)) return i;
    }
  }
  return -1;
}

// Returns { rows, issues, columns, delimiter }.
// rows entries: { rowNumber, dateIso, day, merchantRaw, flow, amountCents|null, currency|null }.
// A missing date/description/amount column is fatal: no silent guessing.
export function parseBankCsv(text) {
  const issues = [];
  const rows = [];
  if (text == null || String(text).trim() === "") {
    return { rows, issues: [{ row: 0, code: "empty_file", detail: "No content." }], columns: null, delimiter: "," };
  }
  const delim = detectDelimiter(text);
  const lines = String(text).split(/\r?\n/);
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== "") {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    return { rows, issues: [{ row: 0, code: "empty_file", detail: "No content." }], columns: null, delimiter: delim };
  }
  const headers = splitCsvLine(lines[headerIdx], delim);
  const dateCol = findColumn(headers, DATE_ALIASES);
  const descCol = findColumn(headers, DESC_ALIASES);
  const amountCol = findColumn(headers, AMOUNT_ALIASES);
  const columns = { dateCol, descCol, amountCol, headers };
  if (dateCol === -1 || descCol === -1 || amountCol === -1) {
    issues.push({
      row: headerIdx + 1,
      code: "missing_columns",
      detail: `Found columns: ${headers.join(" | ")}. Needed a date, a description and an amount column.`,
    });
    return { rows, issues, columns, delimiter: delim };
  }
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    const rowNumber = i + 1;
    const cells = splitCsvLine(line, delim);
    if (cells.length < headers.length) {
      issues.push({ row: rowNumber, code: "ragged_row", detail: `Expected ${headers.length} cells, saw ${cells.length}. Row skipped, not zeroed.` });
      continue;
    }
    const parsedDate = parseDate(cells[dateCol]);
    if (!parsedDate) {
      issues.push({ row: rowNumber, code: "bad_date", detail: `Could not read date "${cells[dateCol]}". Row skipped, not zeroed.` });
      continue;
    }
    const merchantRaw = String(cells[descCol]).trim();
    const parsedAmount = parseAmountToCents(cells[amountCol]);
    if (parsedAmount.unknown) {
      rows.push({
        rowNumber,
        dateIso: parsedDate.iso,
        day: parsedDate.day,
        merchantRaw: merchantRaw || "(no description)",
        flow: "unknown",
        amountCents: null,
        currency: parsedAmount.currency,
      });
      issues.push({ row: rowNumber, code: "unknown_amount", detail: `Could not read amount "${cells[amountCol]}". Kept as UNKNOWN, excluded from totals.` });
      continue;
    }
    const cents = parsedAmount.cents;
    rows.push({
      rowNumber,
      dateIso: parsedDate.iso,
      day: parsedDate.day,
      merchantRaw: merchantRaw || "(no description)",
      flow: cents < 0 ? "out" : cents > 0 ? "in" : "zero",
      amountCents: cents,
      currency: parsedAmount.currency,
    });
  }
  return { rows, issues, columns, delimiter: delim };
}

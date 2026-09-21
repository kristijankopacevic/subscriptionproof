# SubscriptionProof

**Find every subscription eating your bank balance — without your bank data leaving your computer.**

Drop in the CSV your bank already exports. SubscriptionProof finds the charges
that repeat every week, month, quarter or year, adds up your true monthly burn,
and flags price increases and possible duplicates.

- `index.html` — free demo. Reads the first 200 rows, shows the top 5
  subscriptions, no export. Publish this on GitHub Pages.
- `pro.html` — the €2.99 Pro template. Unlimited rows, every merchant, CSV
  export, unlocked with a receipt key. Packaged per `GUMROAD_SETUP.md` and
  delivered via Gumroad; never published publicly.

Both pages work offline after load and make zero network requests.

---

## Why this exists

Bank statements bury recurring charges among one-off payments. A €16.99 charge
every month is easy to miss; a quiet price rise from €15.99 is invisible; two
similar charges from the same vendor (`AMAZON PRIME` + `AMAZON MUSIC`) may both
be wanted — or one may be forgotten. People audit this by hand, once, then never
again. SubscriptionProof turns the export the bank already gives into the list
in seconds, and re-running it next month costs nothing.

## The rules the code is built around

**UNKNOWN IS NOT ZERO.** An unreadable amount is reported as unknown and left
out of the totals. It is never assumed to be zero.

**Three makes a pattern.** A merchant is recurring only with 3+ charges on a
stable weekly, monthly, quarterly or yearly cadence. Two similar charges are
reported as irregular — never upgraded.

**No totals it cannot know.** Charges in different currencies are totalled per
currency only. A combined figure across currencies is refused, not estimated.

**No AI in the arithmetic.** Every figure is deterministic integer-cent
calculation you could redo by hand. There is no model anywhere in this
repository.

**The key is a receipt, not DRM.** The Pro file checks the key offline and
states so on screen. Anyone who can read the file can read the check. The real
gate is Gumroad delivering the file after payment. Do not claim otherwise.

## What it checks

| Output | Meaning |
|---|---|
| Recurring charges | Merchant, cadence, charge count, typical amount, monthly equivalent |
| Monthly burn | Sum of monthly equivalents — one currency only |
| Yearly projection | Monthly burn × 12, labelled a projection |
| `price_increase` | Last charge >5% above the first for the same merchant |
| `new_subscription` | First charge within 45 days of the newest row in the file |
| `possible_duplicate` | Two recurring merchants sharing a first word (same vendor, twice?) |
| Issues | Unknown amounts, ragged rows, bad dates, multi-currency — each listed |

## Supported files

Bank or card statement exports as CSV: a date column, a description column and
an amount column, detected by name across common English and European aliases.
Semicolon and comma delimiters; European (`1.234,56`) and Anglo (`1,234.56`)
number formats; ISO, dotted and slash dates.

If a required column cannot be found, the tool says which columns it saw and
refuses — rather than producing a confident report from nothing.

## Running it

Serve over HTTP (module scripts do not run from `file://`):

```
npx serve .            # then open the printed URL
```

Tests and packaging self-check (zero dependencies):

```
npm test               # 31 tests, node --test
npm run verify:packaging
```

Seller packaging (needs the private secret, never committed):

```
SUBPROOF_SECRET=<secret> node scripts/package-pro.mjs   # -> dist/pro.html
SUBPROOF_SECRET=<secret> node scripts/mint-key.mjs buyer@example.com
```

## Sample

`docs/sample/bank-sample.csv` is a 24-row statement containing six real
subscriptions (monthly burn €54.07), one price increase, one new subscription,
one possible duplicate, a two-charge irregular, one inflow and one unknown
amount. Both pages embed this exact file for TRY SAMPLE; tests pin the parity.

## Privacy

No server exists to send anything to. After load, selecting, analysing and (in
Pro) exporting files makes no network request at all. There is no analytics, no
telemetry, and the demo stores nothing — reloading erases everything. Pro
stores your email + receipt key in local storage only if you tick “Remember on
this device”, and “Forget this device” erases them.

## Status

Built 2026-09-21. **NOT yet published, NOT yet selling.** Publish and
monetization gates: `PRODUCTION_CHECKLIST.md`. Scope freeze:
`RELEASE_SCOPE.md`. Paid delivery wiring: `GUMROAD_SETUP.md`.

Not affiliated with any bank or with Gumroad. Not financial advice.

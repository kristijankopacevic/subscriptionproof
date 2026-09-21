# SubscriptionProof — release scope

**Date:** 2026-09-21 · **Version:** 0.1.0 · **Decision: PUBLISHED (demo live; Pro sale pending Gumroad listing)**

## 0.1.0 — 2026-09-21 — demo published

- Repo: https://github.com/kristijankopacevic/subscriptionproof (public, `main`)
- Demo: https://kristijankopacevic.github.io/subscriptionproof/
- Gates at publish: `npm test` 31/31, `verify:packaging` 7/7, `node --check` clean,
  privacy grep clean (only the Gumroad placeholder anchor leaves the page),
  `SUBPROOF_SECRET` nowhere in the repo, `dist/` never pushed.
- Open: Gumroad listing (€2.99) + first test purchase; see `GUMROAD_SETUP.md`.
  Pages repo step of `PRODUCTION_CHECKLIST.md` §4 is done; §5 is owner-bound.

---

## What it is

| | |
|---|---|
| **Target buyer** | Anyone with a bank account and a creeping feeling — first: freelancers and household budgeters who already export CSVs |
| **Problem** | Recurring charges hide among one-offs; quiet price rises go unnoticed; forgotten duplicates keep billing |
| **Local path** | `products/subscriptionproof` |
| **Distribution** | Free capped demo on GitHub Pages + €2.99 one-off Pro file via Gumroad (new path — no portfolio product uses pay-gated download) |
| **Tests** | **31**, `node --test`, zero dependencies, plus `npm run verify:packaging` |

## Duplication check — the question that could have stopped this

| | MarginProof | PayoutProof | FreightGuard | **SubscriptionProof** |
|---|---|---|---|---|
| Input | Store product export | Shopify payout exports | Freight invoice + rate card | **Bank/card statement CSV** |
| Buyer | Store merchants | Merchants + bookkeepers | Logistics/finance staff | **Anyone with a bank account** |
| Question answered | Which products lose money | Do payouts match the bank | Was this invoice overbilled | **What repeats, what rose, what doubled** |
| Price | Free, unpriced | Free, unpriced | €9/€39/€99 SaaS | **€2.99 one-off file** |

**Verdict: not duplicative.** Different input, different buyer, different
question, different delivery. `MERGE_INTO` is not set. ProfitGuard/Cost
Importer (WooCommerce) and ProductShot (photo studio) share no surface at all.

## V1 — frozen

- **Target buyer:** above.
- **Problem:** above.
- **Input:** one bank/card statement CSV.
- **Output (demo):** top-5 recurring merchants from the first 200 rows, findings,
  issues, upsell. **Output (Pro):** unlimited rows, all merchants, merchants CSV
  export, offline receipt-key unlock.
- **Activation event:** a user drops in their export and sees their burn number.
- **First value moment:** the first recurring charge they had forgotten about.

### Out of scope, deliberately

No account, login, server, upload, OAuth, billing backend, dashboard, team
features, analytics, bank API/PSD2 connections, automatic cancellation, spend
categorisation, budgets, alerts, and **no LLM anywhere in the arithmetic**.
Manual key fulfilment within 24h at low volume — no fulfilment automation until
sales justify it.

## Financial correctness

- **All money is an integer count of cents.** Converted once at parse, formatted
  once for display, integer arithmetic in between.
- **Monthly equivalents use integer math** (`weekly × 52 / 12` rounded once).
  Asserted by test (199 → 862).
- **Recurrence needs 3+ charges on a stable cadence** with every interval inside
  the cadence bucket. Asserted (two charges stay irregular; sample burn is
  exactly €54.07).
- **UNKNOWN ≠ ZERO.** Unknown amounts are counted, listed and excluded.
  Asserted in three places.
- **Cross-currency totals refused.** Asserted (EUR+USD → per-currency only).
- **CSV exports are formula-guarded** (leading `= + - @ TAB CR` get a protective
  quote). Asserted.
- **No language model touches any number.** There is no model in this repository.

## Honest limits

1. **No real user has run a real statement through it.** Validated on a synthetic
   24-row fixture and 31 unit tests.
2. **It cannot know which subscriptions you still use.** It shows repetition and
   change; cancellation stays a human decision. The pages say so.
3. **Two charges never count as recurring**, even when they look monthly.
4. **The receipt key is honor-system**, stated on screen and in docs — not DRM.
5. **Slash dates assume DD/MM when the first part exceeds 12, else MM/DD.**
   Documented in code and tested; truly ambiguous files should use ISO.

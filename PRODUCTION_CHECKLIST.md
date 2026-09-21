# Production checklist

Work top to bottom. Owner-bound steps are marked **OWNER** (account, money,
email) — everything else is done and green.

## 1. Code gates (done, re-run before any release)

- [x] `npm test` — 31/31 green, zero dependencies.
- [x] `npm run verify:packaging` — marker, injection and unlock roundtrip green.
- [x] `node --check` on all `src/*.js` + `scripts/*.mjs`.
- [ ] Re-run all three after the Gumroad/Pages URL TODOs are flipped.
- [ ] Secret scan: `git grep -n "SUBPROOF_SECRET"` shows code references only;
      no secret value anywhere; `git status --ignored` shows `dist/` ignored.

## 2. Privacy audit (per release, real browser)

- [ ] Serve locally, open `index.html`, select the sample: network tab shows
      zero requests after load through analysis.
- [ ] Same for packaged `dist/pro.html`: unlock, analyse, export — zero requests.
- [ ] Reload: demo holds nothing; Pro without “Remember” holds nothing.
- [ ] “Remember” stores only email+key; “Forget this device” removes them.

## 3. Functional smoke (per release)

- [ ] TRY SAMPLE on both pages: 6 recurring, €54.07 burn, price increase, new
      subscription, possible duplicate, 1 inflow skipped, 1 unknown listed.
- [ ] Drop a 200+ row file on the demo: cap warning appears, totals say which
      rows they cover.
- [ ] Pro export opens in a spreadsheet: amounts are numbers, merchant names
      starting with `= + - @` are text, not formulas.
- [ ] Wrong key / wrong email rejected; tampered key rejected.
- [ ] 390px mobile: no horizontal overflow, drop zone + tables usable.

## 4. Publish — free demo (**OWNER**)

- [ ] New public GitHub repo (Pages on the free plan needs a public repo),
      push `index.html`, `src/`, `docs/sample`, `robots.txt`, `README.md`.
      Do NOT push `pro.html` source? Public template contains no secret
      (marker only) — safe to include, and keeps sample-parity tests meaningful.
      NEVER push `dist/`.
- [ ] Enable GitHub Pages, confirm HTTP 200 on the live URL.
- [ ] Flip `index.html` TODOs: Gumroad permalink, `og:url`, `canonical`.
- [ ] Add `sitemap.xml` with the real URL; confirm `robots.txt` live.

## 5. Monetize — Pro (**OWNER**)

- [ ] `GUMROAD_SETUP.md` steps 1–3: secret stored, product listed at €2.99,
      `dist/pro.html` uploaded, 24h key fulfilment stated.
- [ ] Test purchase with a real €2.99 payment; mint + deliver key; unlock works.
- [ ] Refund path tested once (buy, refund, confirm key handling decision).

## 6. Before announcing

- [ ] Landing (the demo page) contains no fabricated testimonial, no invented
      savings statistic, no bank logo.
- [ ] First three help-Be-useful posts drafted (same playbook as MarginProof's
      community replies): answer questions about forgotten subscriptions, link
      the demo only where it answers.
- [ ] Instrument without breaking privacy: NO on-page analytics (it would void
      the zero-request claim). Count Gumroad sales + demo-to-Pro clicks via
      Gumroad's own dashboard only.

## 7. Metrics that matter (weekly, owner)

- Demo loads (Pages traffic) → sample runs → Pro clicks (Gumroad referrers).
- Sales, refunds + reasons, fulfilment time (target <24h).
- Support questions — each one is a docs or UX defect until proven otherwise.

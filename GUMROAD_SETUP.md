# Gumroad setup — €2.99 Pro delivery

Owner-bound steps. Nothing here can be done by an agent: it needs the owner's
Gumroad account, email and judgement. Code gates (receipt-key check, packaging
that never commits the secret) are already built and verified.

## 1. Create the secret (once, owner only)

```
# any 32+ random bytes, base64 or hex
openssl rand -base64 32
```

Store it in a password manager as `SUBPROOF_SECRET`. It is used for two things:
packaging `dist/pro.html` and minting per-buyer keys. **It never enters the
repo, chat logs or screenshots.** Anyone with read access to `dist/pro.html`
can already verify keys — the secret's only job is binding keys to buyer
emails at mint time.

## 2. Package the deliverable

```
SUBPROOF_SECRET=<secret> node scripts/package-pro.mjs   # -> dist/pro.html (git-ignored)
```

Sanity: open `dist/pro.html`, unlock with a test key minted below, run TRY
SAMPLE, download the CSV. Then delete the test key's meaning by minting real
buyer keys only for real buyers.

## 3. Create the Gumroad product

- Name: **SubscriptionProof Pro**
- Price: **€2.99** one-off (Gumroad shows the local equivalent; Gumroad is the
  merchant of record and handles EU VAT — confirm this on the listing, do not
  improvise tax advice).
- Deliverable: upload `dist/pro.html` (single file, works offline).
- Description must state, plainly:
  - what Pro unlocks (unlimited rows, all merchants, CSV export);
  - that the free demo exists (link the Pages URL) and what it caps;
  - that the receipt key arrives **by email within 24 hours** (v1 fulfilment);
  - that the key is checked offline in the file — a receipt, not DRM;
  - refund terms (suggested: 14-day, no-questions — decide before listing).
- Thumbnail: screenshot of the demo results table with sample data (never a
  real statement).

## 4. Fulfil keys (v1: manual)

On each sale notification:

```
SUBPROOF_SECRET=<secret> node scripts/mint-key.mjs buyer-email@example.com
```

Reply with the key + the `dist/pro.html` attachment (or Gumroad delivery link)
+ one line: “Works offline forever; your bank file never leaves your computer.”

Automate (Gumroad API / workflow) only when manual fulfilment actually hurts —
not before ~20 sales.

## 5. Flip the code TODOs live

After the listing + Pages URLs exist:

1. `index.html`: replace the Gumroad `href` placeholder with the live permalink
   (marked `TODO(Batch C)`), set `og:url` + `canonical` to the Pages address.
2. `pro.html`: not published publicly — delivered only via Gumroad. Keep
   `noindex` and the `robots.txt` disallow.
3. Add `sitemap.xml` with the real Pages URL (deliberately not shipped with a
   guessed URL).
4. Re-run `npm test` (sample-parity tests cover both pages) and record the
   release in `RELEASE_SCOPE.md` as PUBLISHED with the live URLs.

## Pricing notes (recorded, not promised)

€2.99 is an impulse price: below any approval threshold, justified by a single
forgotten subscription found. If buyers ask for teams, banks or automation —
that is a different product, not a price rise on this one. Test €4.99 before
€1.99 if the price is ever questioned: too-low signals a toy.

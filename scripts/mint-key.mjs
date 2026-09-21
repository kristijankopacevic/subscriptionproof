// mint-key.mjs — seller-side receipt-key minting.
// Usage:  SUBPROOF_SECRET=<secret> node scripts/mint-key.mjs buyer@example.com
// The secret NEVER lives in the repo. Keys are per-buyer-email; Gumroad's
// post-purchase workflow (or a manual reply) delivers the key.
import { mintKey } from "../src/license.js";

const email = process.argv[2];
const secret = process.env.SUBPROOF_SECRET;
if (!email) {
  console.error("Usage: SUBPROOF_SECRET=<secret> node scripts/mint-key.mjs buyer@example.com");
  process.exit(2);
}
if (!secret) {
  console.error("Refusing: SUBPROOF_SECRET is not set. The secret must never be committed.");
  process.exit(1);
}
const res = mintKey(email, secret);
if (!res.ok) {
  console.error(`Refusing: ${res.reason}`);
  process.exit(1);
}
console.log(`email: ${res.email}`);
console.log(`key:   ${res.key}`);

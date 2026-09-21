// package-pro.mjs — builds the deliverable dist/pro.html from the
// pro.html template by injecting the seller's SUBPROOF_SECRET.
// Usage:  SUBPROOF_SECRET=<secret> node scripts/package-pro.mjs
// Output: dist/pro.html (git-ignored, delivered via Gumroad, never committed).
// Fails closed: no secret, no marker, or leftover marker all abort.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, "..");
const MARKER = "/*__SUBPROOF_SECRET__*/ \"\"";

const secret = process.env.SUBPROOF_SECRET;
if (!secret) {
  console.error("Refusing: SUBPROOF_SECRET is not set.");
  process.exit(1);
}
const template = readFileSync(join(root, "pro.html"), "utf8");
const hits = template.split(MARKER).length - 1;
if (hits !== 1) {
  console.error(`Refusing: expected exactly 1 secret marker, found ${hits}.`);
  process.exit(1);
}
const built = template.replace(MARKER, JSON.stringify(secret));
if (built.includes("__SUBPROOF_SECRET__")) {
  console.error("Refusing: leftover marker after injection.");
  process.exit(1);
}
mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist", "pro.html"), built);
console.log("Wrote dist/pro.html (deliverable, do not commit).");

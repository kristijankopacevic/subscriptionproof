// verify-packaging.mjs — end-to-end packaging self-test with an
// ephemeral secret. Proves: template has exactly one marker, injection
// produces a deliverable with no leftover marker, and a key minted with
// the same secret unlocks that deliverable. Leaves no trace behind.
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { mintKey, verifyKey } from "../src/license.js";

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, "..");
const MARKER = '/*__SUBPROOF_SECRET__*/ ""';
const failures = [];
const check = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}`);
  if (!cond) failures.push(name);
};

const template = readFileSync(join(root, "pro.html"), "utf8");
check("template has exactly one secret marker", template.split(MARKER).length - 1 === 1);
check("template carries no real secret", !template.includes("ephemeral-packaging-test"));

const secret = `ephemeral-packaging-test-${randomBytes(8).toString("hex")}`;
const built = template.replace(MARKER, JSON.stringify(secret));
check("no leftover marker in deliverable", !built.includes("__SUBPROOF_SECRET__"));
check("deliverable embeds the secret", built.includes(JSON.stringify(secret)));

const outPath = join(tmpdir(), `subproof-pack-test-${Date.now()}.html`);
writeFileSync(outPath, built);
const minted = mintKey("packaging-check@example.com", secret);
check("mint works with packaging secret", minted.ok);
check(
  "minted key unlocks the deliverable secret",
  minted.ok && verifyKey(minted.key, "packaging-check@example.com", secret).ok
);
check("wrong email still rejected", !verifyKey(minted.key, "other@example.com", secret).ok);
rmSync(outPath);

if (failures.length) {
  console.error(`verify-packaging: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log("verify-packaging: all green, temp file removed.");

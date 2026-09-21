import test from "node:test";
import assert from "node:assert/strict";
import { sha256Hex, mintKey, verifyKey, normalizeEmail } from "../src/license.js";

const SECRET = "test-secret-for-suite-only";

test("sha256 matches the standard test vector", () => {
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(sha256Hex("").length, 64);
});

test("mint/verify roundtrip is case- and space-tolerant on email", () => {
  const m = mintKey("Buyer@Example.com ", SECRET);
  assert.equal(m.ok, true);
  assert.match(m.key, /^SP29-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(verifyKey(m.key, "buyer@example.com", SECRET).ok, true);
  assert.equal(verifyKey(m.key.toLowerCase(), "  BUYER@example.com", SECRET).ok, true);
});

test("mint is deterministic per email+secret", () => {
  assert.equal(mintKey("a@b.co", SECRET).key, mintKey("a@b.co", SECRET).key);
  assert.notEqual(mintKey("a@b.co", SECRET).key, mintKey("a@b.co", "other").key);
});

test("tampered keys and wrong emails fail", () => {
  const m = mintKey("buyer@example.com", SECRET);
  const tampered = m.key.slice(0, -1) + (m.key.endsWith("A") ? "B" : "A");
  assert.equal(verifyKey(tampered, "buyer@example.com", SECRET).ok, false);
  assert.equal(verifyKey(m.key, "someone-else@example.com", SECRET).ok, false);
  assert.equal(verifyKey("GARBAGE", "buyer@example.com", SECRET).ok, false);
});

test("bad email and missing secret are refused, not minted", () => {
  assert.equal(mintKey("not-an-email", SECRET).ok, false);
  assert.equal(mintKey("a@b.co", "").ok, false);
  assert.equal(normalizeEmail("  A@B.Co "), "a@b.co");
});

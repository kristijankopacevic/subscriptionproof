// license.js — offline receipt-key mint/verify for the €2.99 Pro file.
// Pure, no DOM, no network, no dependencies. Identical behaviour in
// Node and the browser (TextEncoder + hand-rolled SHA-256, so the
// seller-side mint script and the page agree byte for byte).
//
// Honest scope, stated plainly: this is a receipt check, not DRM.
// Anyone who can read pro.html can read the verifier. The real gate
// is Gumroad delivering the file after payment. Do not claim otherwise.

const SHA_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(x, n) {
  return (x >>> n) | (x << (32 - n));
}

// Returns 32 digest bytes for a UTF-8 string.
export function sha256Bytes(text) {
  const data = new TextEncoder().encode(text);
  const bitLen = data.length * 8;
  const paddedLen = (((data.length + 8) >> 6) + 1) << 6;
  const buf = new Uint8Array(paddedLen);
  buf.set(data);
  buf[data.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(paddedLen - 4, bitLen >>> 0);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 4294967296));
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const w = new Array(64);
  for (let off = 0; off < paddedLen; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + SHA_K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }
  const out = new Uint8Array(32);
  const oview = new DataView(out.buffer);
  oview.setUint32(0, h0);
  oview.setUint32(4, h1);
  oview.setUint32(8, h2);
  oview.setUint32(12, h3);
  oview.setUint32(16, h4);
  oview.setUint32(20, h5);
  oview.setUint32(24, h6);
  oview.setUint32(28, h7);
  return out;
}

export function sha256Hex(text) {
  return [...sha256Bytes(text)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// No ambiguous glyphs: no 0/O, no 1/I/L.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// Key shape: SP29-XXXX-XXXX-XXXX (12 payload chars, 5 bits each from
// the first 60 digest bits of sha256(email|secret)).
export function mintKey(email, secret) {
  const norm = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm)) {
    return { ok: false, reason: "bad-email" };
  }
  if (!secret) return { ok: false, reason: "no-secret" };
  const digest = sha256Bytes(`${norm}|${secret}`);
  let payload = "";
  for (let i = 0; i < 12; i++) payload += ALPHABET[digest[i] & 31];
  const key = `SP29-${payload.slice(0, 4)}-${payload.slice(4, 8)}-${payload.slice(8, 12)}`;
  return { ok: true, key, email: norm };
}

export function verifyKey(key, email, secret) {
  const norm = normalizeEmail(email);
  const stripped = String(key || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^SP29[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/.test(stripped)) {
    return { ok: false, reason: "bad-format" };
  }
  if (!secret) return { ok: false, reason: "no-secret" };
  const expected = mintKey(norm, secret);
  if (!expected.ok) return { ok: false, reason: expected.reason };
  const want = expected.key.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (stripped.length !== want.length) return { ok: false, reason: "mismatch" };
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= stripped.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0 ? { ok: true, email: norm } : { ok: false, reason: "mismatch" };
}

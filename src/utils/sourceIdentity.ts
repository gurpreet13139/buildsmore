/**
 * BUILDsmore — Deterministic SHA-256 Source Identity & URL Normalization Utilities
 * Runs identically in both Node.js and Browser environments with zero dependencies.
 */

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

/**
 * Pure TypeScript FIPS 180-4 SHA-256 hex digest (UTF-8 encoded).
 * Byte-for-byte compatible with Node.js crypto.createHash('sha256').
 */
export function sha256Hex(message: string): string {
  const utf8 = new TextEncoder().encode(message);
  const bitLen = utf8.length * 8;

  // Pad to 512-bit (64-byte) blocks: message + 0x80 + zeros + 8-byte big-endian length
  const paddedLen = Math.ceil((utf8.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(utf8);
  padded[utf8.length] = 0x80;

  const view = new DataView(padded.buffer);
  const highBits = Math.floor(bitLen / 0x100000000);
  const lowBits = bitLen >>> 0;
  view.setUint32(paddedLen - 8, highBits, false);
  view.setUint32(paddedLen - 4, lowBits, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
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
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((val) => val.toString(16).padStart(8, '0'))
    .join('');
}

/**
 * Canonicalizes a source URL so equivalent forms map to one identity
 * (e.g., https://www.HlpPalmGreen.com and https://hlppalmgreen.com/#hero -> https://hlppalmgreen.com/)
 */
export function normalizeSourceUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';

  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withScheme);
    const protocol = parsed.protocol.toLowerCase();
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const port = parsed.port ? `:${parsed.port}` : '';
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';

    // Sort query params deterministically if present
    const params = Array.from(parsed.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b));
    const search = params.length > 0
      ? `?${params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`
      : '';

    return `${protocol}//${hostname}${port}${pathname}${search}`;
  } catch {
    return trimmed.toLowerCase().replace(/#.*$/, '').replace(/\/+$/, '');
  }
}

/**
 * Extracts a stable, normalized sourceWebsiteId (hostname without leading www.)
 */
export function extractSourceWebsiteId(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return 'unknown-source';

  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withScheme);
    return parsed.hostname.toLowerCase().replace(/^www\./, '') || 'unknown-source';
  } catch {
    return trimmed
      .toLowerCase()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/.*$/, '') || 'unknown-source';
  }
}

/**
 * Computes a collision-resistant SHA-256 short hash of the canonical source URL.
 */
export function computeSourceUrlHash(rawUrl: string, length = 12): string {
  const canonical = normalizeSourceUrl(rawUrl);
  return sha256Hex(canonical).slice(0, length);
}

/**
 * Computes a collision-resistant SHA-256 short hash of the website hostname (sourceWebsiteId).
 */
export function computeWebsiteHash(siteUrl: string, length = 10): string {
  const websiteId = extractSourceWebsiteId(siteUrl);
  return sha256Hex(websiteId).slice(0, length);
}

/**
 * Generates deterministic, globally unique Property ID for Universal One-Page Importer sites.
 */
export function computeUniversalPropertyId(rawUrl: string): string {
  return `prop-univ-${computeSourceUrlHash(rawUrl, 12)}`;
}

/**
 * Generates deterministic, globally unique Property ID for WordPress REST API posts.
 */
export function computeWordPressPropertyId(siteUrl: string, wpPostId: string | number): string {
  const siteHash = computeWebsiteHash(siteUrl, 10);
  const cleanPostId = String(wpPostId).trim().replace(/[^a-zA-Z0-9_-]/g, '');
  return `wp-${siteHash}-${cleanPostId}`;
}

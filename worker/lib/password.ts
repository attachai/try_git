// Cloudflare Workers Web Crypto currently caps PBKDF2 at 100,000 iterations.
const ITERATIONS = 100000;
const KEY_BYTES = 32;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function derive(secret: string, salt: BufferSource, iterations: number) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    keyMaterial,
    KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

function sameBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashSecret(secret: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(secret, salt, ITERATIONS);
  return ["pbkdf2", ITERATIONS, bytesToBase64(salt), bytesToBase64(hash)].join("$");
}

export async function verifySecret(secret: string, encoded: string | null | undefined) {
  if (!encoded) return false;
  const [algorithm, iterationsText, saltText, hashText] = encoded.split("$");
  if (algorithm !== "pbkdf2" || !iterationsText || !saltText || !hashText) return false;
  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations < 100000) return false;

  const expected = base64ToBytes(hashText);
  const actual = await derive(secret, base64ToBytes(saltText), iterations);
  return sameBytes(actual, expected);
}

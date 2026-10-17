import { safeEqual } from "./session";

/**
 * Password hashing with PBKDF2-SHA256 via Web Crypto, so the same code runs in the browser
 * (hash generator on the login page) and on the server (login verification).
 *
 * Format: pbkdf2$sha256$<iterations>$<saltBase64>$<hashBase64>
 */

export const PBKDF2_ITERATIONS = 310_000;

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, baseKey, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await derive(password, salt, iterations);
  return `pbkdf2$sha256$${iterations}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPasswordHash(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== "sha256") return false;
  const iterations = Number(parts[2]);
  if (!Number.isInteger(iterations) || iterations < 10_000 || iterations > 5_000_000) return false;
  try {
    const salt = fromB64(parts[3]);
    const expected = parts[4];
    const actual = toB64(await derive(password, salt, iterations));
    return safeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Compares against either the configured hash (preferred) or the plain env password. */
export async function verifyOwnerPassword(input: string, cfg: { password: string; passwordHash: string }): Promise<boolean> {
  if (!input || input.length > 512) return false;
  if (cfg.passwordHash) return verifyPasswordHash(input, cfg.passwordHash);
  if (!cfg.password) return false;
  // Hash both sides first so comparison time does not depend on the secret's length.
  const [a, b] = await Promise.all([digest(input), digest(cfg.password)]);
  return safeEqual(a, b);
}

async function digest(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return toB64(new Uint8Array(d));
}

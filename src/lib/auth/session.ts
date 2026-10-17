import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";

/** Edge- and Node-compatible signed session tokens (HS256). */

export interface SessionPayload {
  sub: "owner";
  sid: string;
  ver: string;
  iat: number;
  exp: number;
}

const ISSUER = "plr-champion-suite";
const AUDIENCE = "plr-champion-owner";

function key(secret: string) {
  return new TextEncoder().encode(secret);
}

export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSessionToken(secret: string, days: number, version: string): Promise<{ token: string; expires: Date }> {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const token = await new SignJWT({ sid: randomToken(16), ver: version })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject("owner")
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expires.getTime() / 1000))
    .sign(key(secret));
  return { token, expires };
}

export async function verifySessionToken(token: string | undefined | null, secret: string, version: string): Promise<SessionPayload | null> {
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
    if (payload.sub !== "owner") return null;
    if (String(payload.ver ?? "") !== version) return null;
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Constant-time string comparison that does not leak length through early exit. */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  const len = Math.max(ea.length, eb.length);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < len; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

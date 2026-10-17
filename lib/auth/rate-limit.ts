/**
 * Login throttling.
 *
 * In-memory, per server instance: each IP gets MAX_FAILURES failed attempts per WINDOW, then is locked
 * out with an increasing delay. A global counter adds a small delay to every attempt when many
 * failures arrive from different addresses.
 *
 * On Vercel each serverless instance keeps its own memory, so this is a first line of defence.
 * For deployment-level protection add a Vercel Firewall rate-limit rule for POST /api/auth/login
 * (see docs/DEPLOYMENT.md).
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const GLOBAL_THRESHOLD = 50;

interface Entry {
  failures: number;
  firstAt: number;
  lockedUntil: number;
  lockouts: number;
}

const byKey = new Map<string, Entry>();
let globalFailures: number[] = [];

function prune(now: number) {
  globalFailures = globalFailures.filter((t) => now - t < WINDOW_MS);
  if (byKey.size > 5000) {
    for (const [k, v] of byKey) if (now - v.firstAt > WINDOW_MS && v.lockedUntil < now) byKey.delete(k);
  }
}

export function checkLoginAllowed(key: string, now = Date.now()): { allowed: boolean; retryAfterSec: number; globalDelayMs: number } {
  prune(now);
  const e = byKey.get(key);
  const globalDelayMs = globalFailures.length > GLOBAL_THRESHOLD ? 1500 : 0;
  if (e && e.lockedUntil > now) return { allowed: false, retryAfterSec: Math.ceil((e.lockedUntil - now) / 1000), globalDelayMs };
  return { allowed: true, retryAfterSec: 0, globalDelayMs };
}

export function recordLoginFailure(key: string, now = Date.now()): { lockedForSec: number } {
  globalFailures.push(now);
  let e = byKey.get(key);
  if (!e || now - e.firstAt > WINDOW_MS) {
    e = { failures: 0, firstAt: now, lockedUntil: 0, lockouts: e?.lockouts ?? 0 };
    byKey.set(key, e);
  }
  e.failures += 1;
  if (e.failures >= MAX_FAILURES) {
    e.lockouts += 1;
    const lockMs = Math.min(60 * 60 * 1000, WINDOW_MS * 2 ** (e.lockouts - 1));
    e.lockedUntil = now + lockMs;
    e.failures = 0;
    e.firstAt = now;
    return { lockedForSec: Math.ceil(lockMs / 1000) };
  }
  return { lockedForSec: 0 };
}

export function recordLoginSuccess(key: string) {
  byKey.delete(key);
}

export function clientKey(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  const ip = (fwd ? fwd.split(",")[0] : headers.get("x-real-ip")) ?? "unknown";
  return ip.trim().slice(0, 64) || "unknown";
}

/** Test helper. */
export function __resetRateLimit() {
  byKey.clear();
  globalFailures = [];
}

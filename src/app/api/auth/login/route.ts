import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { cookieNames, getAuthConfig, getAuthConfigStatus, isSecureRequest } from "@/lib/auth/config";
import { verifyOwnerPassword } from "@/lib/auth/password";
import { checkLoginAllowed, clientKey, recordLoginFailure, recordLoginSuccess } from "@/lib/auth/rate-limit";
import { createSessionToken, randomToken } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ password: z.string().min(1).max(512) });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  const cfg = getAuthConfig();
  const status = getAuthConfigStatus(cfg);
  if (!status.configured) {
    return NextResponse.json({ error: "Owner access is not configured yet.", problems: status.problems }, { status: 503 });
  }

  const key = clientKey(req.headers);
  const gate = checkLoginAllowed(key);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: `Too many failed attempts. Try again in ${Math.ceil(gate.retryAfterSec / 60)} minute(s).` },
      { status: 429, headers: { "Retry-After": String(gate.retryAfterSec) } },
    );
  }
  if (gate.globalDelayMs) await sleep(gate.globalDelayMs);

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Enter your password." }, { status: 400 });
  }

  const ok = await verifyOwnerPassword(parsed.password, cfg);
  if (!ok) {
    const { lockedForSec } = recordLoginFailure(key);
    await sleep(400 + Math.floor(Math.random() * 300));
    return NextResponse.json(
      { error: lockedForSec ? `Too many failed attempts. Login is locked for ${Math.ceil(lockedForSec / 60)} minute(s).` : "That password is not correct." },
      { status: lockedForSec ? 429 : 401 },
    );
  }

  recordLoginSuccess(key);
  const secure = isSecureRequest(req.nextUrl, req.headers);
  const names = cookieNames(secure);
  const { token, expires } = await createSessionToken(cfg.secret, cfg.sessionDays, cfg.sessionVersion);
  const csrf = randomToken(24);

  const res = NextResponse.json({ ok: true, expiresAt: expires.toISOString() }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(names.session, token, { httpOnly: true, secure, sameSite: "lax", path: "/", expires });
  res.cookies.set(names.csrf, csrf, { httpOnly: false, secure, sameSite: "strict", path: "/", expires });
  return res;
}

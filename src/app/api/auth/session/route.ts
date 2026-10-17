import { NextResponse, type NextRequest } from "next/server";
import { ALL_CSRF_COOKIES, ALL_SESSION_COOKIES, cookieNames, getAuthConfig, isSecureRequest } from "@/lib/auth/config";
import { randomToken, verifySessionToken } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns session info and re-issues the CSRF cookie if the browser lost it. */
export async function GET(req: NextRequest) {
  const cfg = getAuthConfig();
  const token = ALL_SESSION_COOKIES.map((n) => req.cookies.get(n)?.value).find(Boolean);
  const session = await verifySessionToken(token, cfg.secret, cfg.sessionVersion);
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });
  const res = NextResponse.json(
    { authenticated: true, expiresAt: new Date(session.exp * 1000).toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
  const hasCsrf = ALL_CSRF_COOKIES.some((n) => req.cookies.get(n)?.value);
  if (!hasCsrf) {
    const secure = isSecureRequest(req.nextUrl, req.headers);
    res.cookies.set(cookieNames(secure).csrf, randomToken(24), { httpOnly: false, secure, sameSite: "strict", path: "/", expires: new Date(session.exp * 1000) });
  }
  return res;
}

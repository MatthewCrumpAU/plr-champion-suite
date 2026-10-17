import { NextResponse, type NextRequest } from "next/server";
import { ALL_CSRF_COOKIES, ALL_SESSION_COOKIES, CSRF_HEADER, getAuthConfig, getAuthConfigStatus } from "@/lib/auth/config";
import { safeEqual, verifySessionToken } from "@/lib/auth/session";

/**
 * Protects every page and API route.
 *  - Pages without a valid session redirect to /login.
 *  - API routes without a valid session return 401.
 *  - Mutating API requests must pass an Origin check and a double-submit CSRF token.
 */

const PUBLIC_PAGES = new Set(["/login"]);
const PUBLIC_API = new Set(["/api/auth/login", "/api/auth/logout"]);
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function readCookie(req: NextRequest, names: string[]): string | undefined {
  for (const n of names) {
    const v = req.cookies.get(n)?.value;
    if (v) return v;
  }
  return undefined;
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) {
    // Browsers always send Origin on cross-site POSTs; a missing Origin on a mutating request
    // can only come from same-origin navigation in older browsers or non-browser clients.
    const fetchSite = req.headers.get("sec-fetch-site");
    return !fetchSite || fetchSite === "same-origin" || fetchSite === "none";
  }
  try {
    const o = new URL(origin);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
    return o.host === host;
  } catch {
    return false;
  }
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // CSRF: every mutating API call (including login/logout) must come from this origin.
  if (isApi && MUTATING.has(req.method) && !sameOrigin(req)) {
    return json(403, { error: "Cross-origin request blocked." });
  }

  if (PUBLIC_PAGES.has(pathname) || PUBLIC_API.has(pathname)) {
    return NextResponse.next();
  }

  const cfg = getAuthConfig();
  const status = getAuthConfigStatus(cfg);
  if (!status.configured) {
    if (isApi) return json(503, { error: "Owner access is not configured. See the login page for setup steps." });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const session = await verifySessionToken(readCookie(req, ALL_SESSION_COOKIES), cfg.secret, cfg.sessionVersion);
  if (!session) {
    if (isApi) return json(401, { error: "Your session has expired. Please sign in again." });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (isApi && MUTATING.has(req.method)) {
    const cookieToken = readCookie(req, ALL_CSRF_COOKIES);
    const headerToken = req.headers.get(CSRF_HEADER);
    if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
      return json(403, { error: "Security token missing or invalid. Refresh the page and try again." });
    }
  }

  const res = NextResponse.next();
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|pdf.worker).*)"],
};

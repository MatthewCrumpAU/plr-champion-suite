import { NextResponse } from "next/server";
import { ALL_CSRF_COOKIES, ALL_SESSION_COOKIES } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  for (const name of [...ALL_SESSION_COOKIES, ...ALL_CSRF_COOKIES]) {
    res.cookies.set(name, "", { path: "/", expires: new Date(0), secure: name.startsWith("__Host-"), httpOnly: ALL_SESSION_COOKIES.includes(name) });
  }
  return res;
}

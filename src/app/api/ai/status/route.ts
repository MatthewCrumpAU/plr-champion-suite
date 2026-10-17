import { NextResponse } from "next/server";
import { aiStatus } from "@/lib/ai/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(aiStatus(), { headers: { "Cache-Control": "no-store" } });
}

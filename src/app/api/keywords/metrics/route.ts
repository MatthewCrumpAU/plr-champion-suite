import { NextResponse } from "next/server";
import { z } from "zod";
import { getKeywordMetricsProvider } from "@/lib/research/metrics-provider";

export const runtime = "nodejs";

export async function GET() {
  const p = getKeywordMetricsProvider();
  return NextResponse.json({ configured: !!p?.isConfigured(), provider: p?.isConfigured() ? p.label : null });
}

const Body = z.object({ keywords: z.array(z.string().min(1).max(200)).min(1).max(500), country: z.string().max(8).optional(), language: z.string().max(8).optional() });

export async function POST(req: Request) {
  const p = getKeywordMetricsProvider();
  if (!p || !p.isConfigured()) {
    return NextResponse.json({ error: "No keyword data provider is configured. Import a CSV from your keyword tool or enter verified numbers manually." }, { status: 501 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    const results = await p.lookup(parsed.data.keywords, { country: parsed.data.country, language: parsed.data.language });
    return NextResponse.json({ provider: p.label, fetchedAt: new Date().toISOString(), results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lookup failed." }, { status: 502 });
  }
}

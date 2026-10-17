/* ------------------------------------------------------------------ */
/* Opportunity Scanner                                                  */
/* ------------------------------------------------------------------ */
export type FunnelRole = "lead-magnet" | "front-end" | "order-bump" | "upsell" | "downsell" | "bonus" | "membership";

export const FUNNEL_ROLE_LABELS: Record<FunnelRole, string> = {
  "lead-magnet": "Lead magnet",
  "front-end": "Front-end offer",
  "order-bump": "Order bump",
  upsell: "Upsell",
  downsell: "Downsell",
  bonus: "Bonus",
  membership: "Membership content",
};

export interface Opportunity {
  id: string;
  format: string;
  name: string;
  sourceChapterIds: string[];
  complexity: "low" | "medium" | "high";
  positioning: string;
  funnelRole: FunnelRole;
  priceLow: number;
  priceHigh: number;
  /** 1–5 heuristic score, an estimate only. */
  rating: number;
  rationale: string;
  origin: "analysis" | "ai";
  builtAssetId: string | null;
  dismissed: boolean;
}

export interface DocumentStats {
  chapters: number;
  words: number;
  headings: number;
  listItems: number;
  actionSteps: number;
  questions: number;
  tables: number;
  howToHeadings: number;
}

export interface OpportunityScanData {
  documentId: string | null;
  scannedAt: string | null;
  stats: DocumentStats | null;
  opportunities: Opportunity[];
}

export function defaultOpportunityScanData(partial: Partial<OpportunityScanData> = {}): OpportunityScanData {
  return { documentId: null, scannedAt: null, stats: null, opportunities: [], ...partial };
}

export function normalizeOpportunityScanData(raw: unknown): OpportunityScanData {
  const d = (raw ?? {}) as Partial<OpportunityScanData>;
  return { ...defaultOpportunityScanData(), ...d, opportunities: Array.isArray(d.opportunities) ? d.opportunities : [] };
}

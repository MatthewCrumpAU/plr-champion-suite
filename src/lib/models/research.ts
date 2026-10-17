/* ------------------------------------------------------------------ */
/* Niche Research                                                       */
/* ------------------------------------------------------------------ */
export type ItemSource = "manual" | "ai-hypothesis" | "pattern" | "csv";

export interface ResearchItem {
  id: string;
  text: string;
  why: string;
  severity: "low" | "medium" | "high" | null;
  source: ItemSource;
  validated: boolean;
  evidence: string;
  createdAt: string;
}

export interface IdeaScores {
  demand: number;
  competition: number;
  fit: number;
  effort: number;
  profit: number;
}

export interface ProductIdea {
  id: string;
  name: string;
  format: string;
  angle: string;
  scores: IdeaScores;
  notes: string;
  source: ItemSource;
}

export interface Persona {
  id: string;
  name: string;
  summary: string;
  demographics: string;
  goals: string[];
  pains: string[];
  objections: string[];
  channels: string[];
  source: ItemSource;
}

export interface ContentOpportunity {
  id: string;
  title: string;
  format: string;
  angle: string;
  status: "idea" | "planned" | "created";
  source: ItemSource;
}

export interface ResearchReference {
  id: string;
  title: string;
  url: string;
  notes: string;
  addedAt: string;
}

export interface NicheResearchData {
  niche: string;
  subNiches: string[];
  audience: string;
  needs: ResearchItem[];
  problems: ResearchItem[];
  ideas: ProductIdea[];
  personas: Persona[];
  content: ContentOpportunity[];
  references: ResearchReference[];
  notes: string;
  weights: IdeaScores;
}

export function defaultNicheResearchData(partial: Partial<NicheResearchData> = {}): NicheResearchData {
  return {
    niche: "",
    subNiches: [],
    audience: "",
    needs: [],
    problems: [],
    ideas: [],
    personas: [],
    content: [],
    references: [],
    notes: "",
    weights: { demand: 3, competition: 2, fit: 2, effort: 1, profit: 2 },
    ...partial,
  };
}

export function normalizeNicheResearchData(raw: unknown): NicheResearchData {
  const d = (raw ?? {}) as Partial<NicheResearchData>;
  const def = defaultNicheResearchData();
  return { ...def, ...d, weights: { ...def.weights, ...(d.weights ?? {}) } };
}

/* ------------------------------------------------------------------ */
/* Keyword Finder                                                       */
/* ------------------------------------------------------------------ */
export type KeywordType = "seed" | "long-tail" | "question" | "product" | "topic";
export type KeywordIntent = "informational" | "commercial" | "transactional" | "navigational" | "";

export interface KeywordMetrics {
  volume: number | null;
  competition: string | null;
  cpc: number | null;
  /** Where the numbers came from, e.g. "Entered by me", "CSV: export.csv". Never AI. */
  metricsSource: string | null;
}

export interface Keyword {
  id: string;
  keyword: string;
  type: KeywordType;
  intent: KeywordIntent;
  cluster: string;
  notes: string;
  source: ItemSource;
  metrics: KeywordMetrics;
  starred: boolean;
  createdAt: string;
}

export interface KeywordSetData {
  seed: string;
  niche: string;
  audience: string;
  keywords: Keyword[];
}

export function defaultKeywordSetData(partial: Partial<KeywordSetData> = {}): KeywordSetData {
  return { seed: "", niche: "", audience: "", keywords: [], ...partial };
}
export function normalizeKeywordSetData(raw: unknown): KeywordSetData {
  const d = (raw ?? {}) as Partial<KeywordSetData>;
  return { ...defaultKeywordSetData(), ...d, keywords: Array.isArray(d.keywords) ? d.keywords : [] };
}

/* ------------------------------------------------------------------ */
/* PLR Rights Review                                                    */
/* ------------------------------------------------------------------ */
export type RightStatus = "not-reviewed" | "allowed" | "not-allowed" | "conditional" | "unclear";

export const RIGHT_STATUS_LABELS: Record<RightStatus, string> = {
  "not-reviewed": "Not reviewed",
  allowed: "Allowed",
  "not-allowed": "Not allowed",
  conditional: "Conditional",
  unclear: "Unclear — verify",
};

export type RightGroup = "permitted" | "restricted" | "modification" | "resale" | "distribution" | "attribution";

export interface RightCheck {
  id: string;
  key: string;
  group: RightGroup;
  label: string;
  help: string;
  status: RightStatus;
  evidence: string;
  notes: string;
}

export interface ReviewChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export type LicenceType = "unknown" | "plr" | "mrr" | "rr" | "giveaway" | "personal-use" | "custom";

export const LICENCE_TYPE_LABELS: Record<LicenceType, string> = {
  unknown: "Unknown — not yet reviewed",
  plr: "Private Label Rights (PLR)",
  mrr: "Master Resell Rights (MRR)",
  rr: "Resell Rights (RR)",
  giveaway: "Giveaway rights",
  "personal-use": "Personal use only",
  custom: "Custom licence",
};

export interface RightsReviewData {
  licenceName: string;
  licenceType: LicenceType;
  source: { vendor: string; productName: string; purchaseDate: string; orderRef: string; url: string; notes: string };
  licenceText: string;
  licenceFileId: string | null;
  checks: RightCheck[];
  attribution: string;
  resaleNotes: string;
  modificationNotes: string;
  distributionNotes: string;
  warnings: string[];
  checklist: ReviewChecklistItem[];
  reviewedAt: string | null;
  summary: string;
}

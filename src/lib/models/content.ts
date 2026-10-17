import type { PMDoc } from "@/lib/doc/types";
import type { ReplacementRule } from "./document";

/* ------------------------------------------------------------------ */
/* Outline Generator                                                    */
/* ------------------------------------------------------------------ */
export type OutlineType = "ebook" | "report" | "guide" | "workbook" | "course" | "mini-course" | "email-course" | "challenge" | "membership-lesson";

export const OUTLINE_TYPE_LABELS: Record<OutlineType, string> = {
  ebook: "Ebook",
  report: "Report",
  guide: "Guide",
  workbook: "Workbook",
  course: "Course",
  "mini-course": "Mini-course",
  "email-course": "Email course",
  challenge: "Challenge",
  "membership-lesson": "Membership lesson",
};

export const OUTLINE_UNIT_LABELS: Record<OutlineType, string> = {
  ebook: "Chapter",
  report: "Section",
  guide: "Section",
  workbook: "Worksheet",
  course: "Module",
  "mini-course": "Lesson",
  "email-course": "Email",
  challenge: "Day",
  "membership-lesson": "Part",
};

export interface OutlineSection {
  id: string;
  title: string;
  notes: string;
}

export interface OutlineItem {
  id: string;
  title: string;
  summary: string;
  notes: string;
  sections: OutlineSection[];
}

export interface OutlineData {
  type: OutlineType;
  topic: string;
  audience: string;
  promise: string;
  subtitle: string;
  items: OutlineItem[];
  generatedWith: "template" | "ai" | "manual";
  templateId: string | null;
  documentId: string | null;
}

export function defaultOutlineData(partial: Partial<OutlineData> = {}): OutlineData {
  return { type: "ebook", topic: "", audience: "", promise: "", subtitle: "", items: [], generatedWith: "manual", templateId: null, documentId: null, ...partial };
}

export function normalizeOutlineData(raw: unknown): OutlineData {
  const d = (raw ?? {}) as Partial<OutlineData>;
  return {
    ...defaultOutlineData(),
    ...d,
    items: Array.isArray(d.items) ? d.items.map((it) => ({ id: it.id, title: it.title ?? "", summary: it.summary ?? "", notes: it.notes ?? "", sections: Array.isArray(it.sections) ? it.sections : [] })) : [],
  };
}

/* ------------------------------------------------------------------ */
/* Rebrand Assistant                                                    */
/* ------------------------------------------------------------------ */
export interface RebrandConfig {
  originalName: string;
  originalAuthor: string;
  newName: string;
  subtitle: string;
  niche: string;
  audience: string;
  promise: string;
  voice: string;
  author: string;
  positioning: string;
  colors: { primary: string; secondary: string; accent: string };
  brandKitId: string | null;
}

export type ProposalStatus = "pending" | "accepted" | "rejected";

export interface RebrandProposal {
  chapterId: string;
  originalTitle: string;
  proposedTitle: string;
  proposedContent: PMDoc;
  method: "rules" | "ai" | "manual";
  status: ProposalStatus;
  generatedAt: string;
  replacements: number;
  error: string | null;
}

export interface RebrandSessionData {
  sourceDocumentId: string | null;
  step: number;
  config: RebrandConfig;
  rules: ReplacementRule[];
  aiLevel: "light" | "moderate" | "full";
  proposals: RebrandProposal[];
  resultDocumentId: string | null;
  savedAs: "version" | "asset" | null;
  savedAt: string | null;
}

export function defaultRebrandConfig(partial: Partial<RebrandConfig> = {}): RebrandConfig {
  return {
    originalName: "",
    originalAuthor: "",
    newName: "",
    subtitle: "",
    niche: "",
    audience: "",
    promise: "",
    voice: "",
    author: "",
    positioning: "",
    colors: { primary: "#5b4df5", secondary: "#1e1b4b", accent: "#f5b544" },
    brandKitId: null,
    ...partial,
  };
}

export function defaultRebrandSessionData(partial: Partial<RebrandSessionData> = {}): RebrandSessionData {
  return { sourceDocumentId: null, step: 0, config: defaultRebrandConfig(), rules: [], aiLevel: "moderate", proposals: [], resultDocumentId: null, savedAs: null, savedAt: null, ...partial };
}

export function normalizeRebrandSessionData(raw: unknown): RebrandSessionData {
  const d = (raw ?? {}) as Partial<RebrandSessionData>;
  const def = defaultRebrandSessionData();
  return { ...def, ...d, config: { ...def.config, ...(d.config ?? {}), colors: { ...def.config.colors, ...(d.config?.colors ?? {}) } }, rules: d.rules ?? [], proposals: d.proposals ?? [] };
}

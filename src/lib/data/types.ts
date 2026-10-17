import type { DocumentData } from "@/lib/models/document";
import type { CoverData, MockupData, BrandKit } from "@/lib/models/design";
import type { OutlineData, RebrandSessionData } from "@/lib/models/content";
import type { OpportunityScanData } from "@/lib/models/product";
import type { NicheResearchData, KeywordSetData, RightsReviewData } from "@/lib/models/research";
import type { SalesPageData, EmailCampaignData, SocialCampaignData, NameIdeasData } from "@/lib/models/marketing";
import type { ProfitData, FunnelData, LaunchPlanData } from "@/lib/models/profit";

export type { BrandKit };

/** Bump when the stored shape changes; backups carry this number and are migrated on restore. */
export const DATA_SCHEMA_VERSION = 1;

export type ProjectStage = "idea" | "editing" | "rebranding" | "building" | "marketing" | "launch-ready" | "launched";

export const PROJECT_STAGE_LABELS: Record<ProjectStage, string> = {
  idea: "Idea",
  editing: "Editing",
  rebranding: "Rebranding",
  building: "Building products",
  marketing: "Marketing",
  "launch-ready": "Launch ready",
  launched: "Launched",
};

export interface Project {
  id: string;
  name: string;
  description: string;
  niche: string;
  audience: string;
  productType: string;
  stage: ProjectStage;
  status: "active" | "archived";
  brandKitId: string | null;
  mainDocumentId: string | null;
  coverAssetId: string | null;
  tags: string[];
  notes: string;
  plannedPrice: number | null;
  currency: string;
  /** SHA-256 fingerprints of imported source files (duplicate detection). */
  sourceFingerprints: string[];
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface AssetDataMap {
  document: DocumentData;
  outline: OutlineData;
  "rebrand-session": RebrandSessionData;
  cover: CoverData;
  mockup: MockupData;
  "opportunity-scan": OpportunityScanData;
  "niche-research": NicheResearchData;
  "keyword-set": KeywordSetData;
  "rights-review": RightsReviewData;
  "sales-page": SalesPageData;
  "email-campaign": EmailCampaignData;
  "social-campaign": SocialCampaignData;
  "name-ideas": NameIdeasData;
  "profit-scenario": ProfitData;
  funnel: FunnelData;
  "launch-plan": LaunchPlanData;
}

export type AssetType = keyof AssetDataMap;
export type AssetStatus = "draft" | "in-progress" | "ready" | "approved";

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  draft: "Draft",
  "in-progress": "In progress",
  ready: "Ready",
  approved: "Approved",
};

export interface Asset<T extends AssetType = AssetType> {
  id: string;
  projectId: string;
  type: T;
  title: string;
  status: AssetStatus;
  data: AssetDataMap[T];
  /** Assets this one was derived from (e.g. a bonus built from the main document). */
  sourceAssetIds: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type AnyAsset = { [K in AssetType]: Asset<K> }[AssetType];

export type VersionReason = "manual" | "auto" | "import" | "created" | "pre-restore" | "pre-ai" | "pre-bulk" | "pre-rebrand" | "pre-apply";

export const VERSION_REASON_LABELS: Record<VersionReason, string> = {
  manual: "Snapshot",
  auto: "Auto-save",
  import: "Import",
  created: "Created",
  "pre-restore": "Before restore",
  "pre-ai": "Before AI",
  "pre-bulk": "Before bulk edit",
  "pre-rebrand": "Before rebrand",
  "pre-apply": "Before applying",
};

export interface AssetVersion {
  id: string;
  assetId: string;
  projectId: string;
  assetType: AssetType;
  label: string;
  reason: VersionReason;
  title: string;
  data: unknown;
  size: number;
  wordCount: number | null;
  createdAt: string;
}

export interface ProjectBundle {
  project: Project;
  assets: Asset[];
}

export interface ProjectSnapshot {
  id: string;
  projectId: string;
  label: string;
  createdAt: string;
  size: number;
  assetCount: number;
  payload: ProjectBundle;
}

export type StoredFileKind = "import" | "image" | "logo" | "licence" | "render";

export interface StoredFile {
  id: string;
  projectId: string | null;
  name: string;
  mime: string;
  size: number;
  blob: Blob;
  fingerprint: string;
  kind: StoredFileKind;
  createdAt: string;
}

export interface ExportRecord {
  id: string;
  projectId: string | null;
  assetId: string | null;
  label: string;
  format: string;
  fileName: string;
  size: number;
  createdAt: string;
}

export interface AIUsageRecord {
  id: string;
  task: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  projectId: string | null;
  ok: boolean;
  createdAt: string;
}

export interface KeyValue<T = unknown> {
  key: string;
  value: T;
}

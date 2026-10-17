import type { AssetDataMap, AssetType } from "./types";
import { defaultDocumentData, normalizeDocumentData } from "@/lib/models/document";
import { defaultCoverData, defaultMockupData, normalizeCoverData, normalizeMockupData } from "@/lib/models/design";
import { defaultOutlineData, defaultRebrandSessionData, normalizeOutlineData, normalizeRebrandSessionData } from "@/lib/models/content";
import { defaultOpportunityScanData, normalizeOpportunityScanData } from "@/lib/models/product";
import { defaultKeywordSetData, defaultNicheResearchData, normalizeKeywordSetData, normalizeNicheResearchData } from "@/lib/models/research";
import {
  defaultEmailCampaignData,
  defaultFunnelData,
  defaultLaunchPlanData,
  defaultNameIdeasData,
  defaultProfitData,
  defaultRightsReviewData,
  defaultSalesPageData,
  defaultSocialCampaignData,
  normalizeEmailCampaignData,
  normalizeFunnelData,
  normalizeLaunchPlanData,
  normalizeNameIdeasData,
  normalizeProfitData,
  normalizeRightsReviewData,
  normalizeSalesPageData,
  normalizeSocialCampaignData,
} from "@/lib/models/defaults";

export type StudioId = "content" | "design" | "product" | "research" | "marketing" | "profit";

export const STUDIO_LABELS: Record<StudioId, string> = {
  content: "Content Studio",
  design: "Design Studio",
  product: "Product Studio",
  research: "Research Studio",
  marketing: "Marketing Studio",
  profit: "Profit Studio",
};

export interface AssetTypeInfo<T extends AssetType> {
  type: T;
  label: string;
  plural: string;
  studio: StudioId;
  /** Tool route. The selected asset is passed as ?id=… */
  route: string;
  defaultTitle: string;
  defaults: () => AssetDataMap[T];
  normalize: (raw: unknown) => AssetDataMap[T];
}

type Registry = { [K in AssetType]: AssetTypeInfo<K> };

export const ASSET_TYPES: Registry = {
  document: { type: "document", label: "Document", plural: "Documents", studio: "content", route: "/editor", defaultTitle: "Untitled document", defaults: () => defaultDocumentData(), normalize: normalizeDocumentData },
  outline: { type: "outline", label: "Outline", plural: "Outlines", studio: "content", route: "/outlines", defaultTitle: "Untitled outline", defaults: () => defaultOutlineData(), normalize: normalizeOutlineData },
  "rebrand-session": { type: "rebrand-session", label: "Rebrand session", plural: "Rebrand sessions", studio: "content", route: "/rebrand", defaultTitle: "Rebrand", defaults: () => defaultRebrandSessionData(), normalize: normalizeRebrandSessionData },
  cover: { type: "cover", label: "Cover", plural: "Covers", studio: "design", route: "/covers", defaultTitle: "Untitled cover", defaults: () => defaultCoverData(), normalize: normalizeCoverData },
  mockup: { type: "mockup", label: "Mockup", plural: "Mockups", studio: "design", route: "/mockups", defaultTitle: "Untitled mockup", defaults: () => defaultMockupData(), normalize: normalizeMockupData },
  "opportunity-scan": { type: "opportunity-scan", label: "Opportunity scan", plural: "Opportunity scans", studio: "product", route: "/opportunities", defaultTitle: "Opportunity scan", defaults: () => defaultOpportunityScanData(), normalize: normalizeOpportunityScanData },
  "niche-research": { type: "niche-research", label: "Niche research", plural: "Niche research", studio: "research", route: "/niche-research", defaultTitle: "Niche research", defaults: () => defaultNicheResearchData(), normalize: normalizeNicheResearchData },
  "keyword-set": { type: "keyword-set", label: "Keyword list", plural: "Keyword lists", studio: "research", route: "/keywords", defaultTitle: "Keyword list", defaults: () => defaultKeywordSetData(), normalize: normalizeKeywordSetData },
  "rights-review": { type: "rights-review", label: "Rights review", plural: "Rights reviews", studio: "research", route: "/rights", defaultTitle: "PLR rights review", defaults: () => defaultRightsReviewData(), normalize: normalizeRightsReviewData },
  "sales-page": { type: "sales-page", label: "Sales page", plural: "Sales pages", studio: "marketing", route: "/sales-pages", defaultTitle: "Sales page", defaults: () => defaultSalesPageData(), normalize: normalizeSalesPageData },
  "email-campaign": { type: "email-campaign", label: "Email campaign", plural: "Email campaigns", studio: "marketing", route: "/emails", defaultTitle: "Email campaign", defaults: () => defaultEmailCampaignData(), normalize: normalizeEmailCampaignData },
  "social-campaign": { type: "social-campaign", label: "Social content", plural: "Social content", studio: "marketing", route: "/social", defaultTitle: "Social content plan", defaults: () => defaultSocialCampaignData(), normalize: normalizeSocialCampaignData },
  "name-ideas": { type: "name-ideas", label: "Name ideas", plural: "Name ideas", studio: "marketing", route: "/names", defaultTitle: "Name ideas", defaults: () => defaultNameIdeasData(), normalize: normalizeNameIdeasData },
  "profit-scenario": { type: "profit-scenario", label: "Profit model", plural: "Profit models", studio: "profit", route: "/profit", defaultTitle: "Profit model", defaults: () => defaultProfitData(), normalize: normalizeProfitData },
  funnel: { type: "funnel", label: "Funnel", plural: "Funnels", studio: "profit", route: "/funnels", defaultTitle: "Sales funnel", defaults: () => defaultFunnelData(), normalize: normalizeFunnelData },
  "launch-plan": { type: "launch-plan", label: "Launch plan", plural: "Launch plans", studio: "profit", route: "/launch", defaultTitle: "Launch plan", defaults: () => defaultLaunchPlanData(), normalize: normalizeLaunchPlanData },
};

export function assetInfo<T extends AssetType>(type: T): AssetTypeInfo<T> {
  return ASSET_TYPES[type] as unknown as AssetTypeInfo<T>;
}

export function assetHref(asset: { id: string; type: AssetType }): string {
  return `${ASSET_TYPES[asset.type].route}?id=${encodeURIComponent(asset.id)}`;
}

export const ALL_ASSET_TYPES = Object.keys(ASSET_TYPES) as AssetType[];

import type { BrandId } from "./types";

/**
 * Brand registry. Brands share every component and service; this config is the only place
 * their customer experience differs (name, colours, voice, which areas are switched on).
 */
export interface BrandTheme {
  /** Main accent (buttons, active states). */
  primary: string;
  primaryForeground: string;
  primarySoft: string;
  accentForeground: string;
  /** Sidebar background and its accents. */
  sidebar: string;
  sidebarAccent: string;
  sidebarBorder: string;
  sidebarMuted: string;
  /** Second brand colour used in gradients and highlights. */
  highlight: string;
}

export interface BrandConfig {
  id: BrandId;
  name: string;
  shortName: string;
  tagline: string;
  /** One-line promise shown on the member dashboard. */
  promise: string;
  /** Two-letter monogram used where there's no room for the full logo. */
  monogram: string;
  theme: BrandTheme;
  /** Public domain the brand will live on (informational until go-live). */
  domain: string;
  supportEmail: string;
  /** Name of the monthly product drop. */
  dropName: string;
  /** Areas switched on for this brand. */
  features: {
    tools: boolean;
    training: boolean;
    resources: boolean;
    drops: boolean;
  };
}

export const BRANDS: Record<BrandId, BrandConfig> = {
  "plr-champion": {
    id: "plr-champion",
    name: "PLR Champion",
    shortName: "Champion",
    tagline: "Premium PLR Membership",
    promise: "Premium PLR content, the software to make it yours, and a clear path to profit.",
    monogram: "PC",
    theme: {
      primary: "#5b4df5",
      primaryForeground: "#ffffff",
      primarySoft: "#eeecff",
      accentForeground: "#3a2fd0",
      sidebar: "#0b1122",
      sidebarAccent: "#172038",
      sidebarBorder: "#1b2440",
      sidebarMuted: "#7c86a3",
      highlight: "#f5b544",
    },
    domain: "plrchampion.com",
    supportEmail: "support@plrchampion.com",
    dropName: "Monthly Product Drop",
    features: { tools: true, training: true, resources: true, drops: true },
  },
  plrforim: {
    id: "plrforim",
    name: "PLRforIM",
    shortName: "PLRforIM",
    tagline: "PLR for Internet Marketers",
    promise: "Done-for-you internet marketing PLR — funnels, lead magnets and swipes ready to rebrand and sell.",
    monogram: "IM",
    theme: {
      primary: "#0f8a7a",
      primaryForeground: "#ffffff",
      primarySoft: "#e3f5f2",
      accentForeground: "#0a6b5f",
      sidebar: "#0a1a1f",
      sidebarAccent: "#13292f",
      sidebarBorder: "#183239",
      sidebarMuted: "#7f9ea3",
      highlight: "#ff8a3d",
    },
    domain: "plrforim.com",
    supportEmail: "support@plrforim.com",
    dropName: "Monthly IM Drop",
    features: { tools: true, training: true, resources: true, drops: true },
  },
};

export function isBrandId(v: string | null | undefined): v is BrandId {
  return !!v && Object.prototype.hasOwnProperty.call(BRANDS, v);
}

/** Brands whose member area is switched on. PLRforIM opens in Phase 3. */
export const LIVE_BRAND_IDS: BrandId[] = ["plr-champion"];

export function isLiveBrand(v: string | null | undefined): v is BrandId {
  return isBrandId(v) && LIVE_BRAND_IDS.includes(v);
}

export function getBrand(id: BrandId): BrandConfig {
  return BRANDS[id];
}

/** CSS custom properties that re-theme every shared component for a brand. */
export function brandCssVars(t: BrandTheme): Record<string, string> {
  return {
    "--primary": t.primary,
    "--primary-foreground": t.primaryForeground,
    "--primary-soft": t.primarySoft,
    "--accent": t.primarySoft,
    "--accent-foreground": t.accentForeground,
    "--ring": t.primary,
    "--sidebar": t.sidebar,
    "--sidebar-accent": t.sidebarAccent,
    "--sidebar-border": t.sidebarBorder,
    "--sidebar-muted": t.sidebarMuted,
    "--chart-1": t.primary,
    "--brand-highlight": t.highlight,
  };
}

export const memberPath = (brand: BrandId, path = "") => `/m/${brand}${path ? (path.startsWith("/") ? path : `/${path}`) : ""}`;
export const adminPath = (brand: BrandId, path = "") => `/m/${brand}/admin${path ? (path.startsWith("/") ? path : `/${path}`) : ""}`;

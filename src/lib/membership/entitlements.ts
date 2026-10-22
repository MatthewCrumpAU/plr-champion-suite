import { BRAND_IDS, type AccessTier, type BrandId, type MemberAccount } from "./types";

/**
 * Cross-brand access, prepared for bundle purchasers.
 *
 * A person can hold accounts on more than one brand (each brand keeps its own customers), and those
 * accounts can be linked. Access to a brand comes from:
 *  - direct   — the account's own `brandAccess`
 *  - bundle   — a bundle on the account (e.g. PLR Champion + PLRforIM) granting several brands
 *  - linked   — a linked account's direct or bundle access (one hop, both directions)
 * The highest tier wins. Nothing here signs anyone in: it only decides what an account may see,
 * so the same rules can run on the server (Supabase RLS / route handlers) once memberships go live.
 */

export interface BundleDefinition {
  id: string;
  name: string;
  description: string;
  grants: Partial<Record<BrandId, AccessTier>>;
}

export const BUNDLES: BundleDefinition[] = [
  {
    id: "plr-ecosystem-bundle",
    name: "PLR Champion + PLRforIM bundle",
    description: "Premium access to both brands for one purchase. Buyers get an account on each brand, linked together.",
    grants: { "plr-champion": "premium", plrforim: "premium" },
  },
  {
    id: "plr-business-complete",
    name: "Complete PLR Business bundle",
    description: "Premium access to PLR Champion, PLRforIM and PLR Profit Lab — the content, the software and the implementation programme.",
    grants: { "plr-champion": "premium", plrforim: "premium", "plr-profit-lab": "premium" },
  },
];

const RANK: Record<AccessTier, number> = { free: 0, member: 1, premium: 2 };

export const getBundle = (id: string) => BUNDLES.find((b) => b.id === id) ?? null;

export type EntitlementSource = "owner" | "direct" | "bundle" | "linked";

export interface Entitlement {
  brandId: BrandId;
  tier: AccessTier;
  source: EntitlementSource;
  /** Account the access comes from (this account, or the linked one). */
  accountId: string;
  bundleId?: string;
}

/** Access an account grants by itself (direct + its bundles). */
function ownGrants(a: MemberAccount): Omit<Entitlement, "source">[] {
  const out: Omit<Entitlement, "source">[] = [];
  for (const b of BRAND_IDS) {
    const t = a.brandAccess[b];
    if (t) out.push({ brandId: b, tier: t, accountId: a.id });
  }
  for (const id of a.bundleIds ?? []) {
    const bundle = getBundle(id);
    if (!bundle) continue;
    for (const [brand, tier] of Object.entries(bundle.grants) as [BrandId, AccessTier][]) out.push({ brandId: brand, tier, accountId: a.id, bundleId: bundle.id });
  }
  return out;
}

/** Accounts linked to this one, in either direction. */
export function linkedAccounts(account: MemberAccount, all: MemberAccount[]): MemberAccount[] {
  const ids = new Set(account.linkedAccountIds);
  for (const other of all) if (other.linkedAccountIds.includes(account.id)) ids.add(other.id);
  ids.delete(account.id);
  return all.filter((a) => ids.has(a.id));
}

export function entitlementsFor(account: MemberAccount, all: MemberAccount[] = [account]): Entitlement[] {
  if (account.role === "owner") return BRAND_IDS.map((b) => ({ brandId: b, tier: "premium" as const, source: "owner" as const, accountId: account.id }));
  const out: Entitlement[] = [];
  for (const g of ownGrants(account)) out.push({ brandId: g.brandId, tier: g.tier, accountId: g.accountId, bundleId: g.bundleId, source: g.bundleId ? "bundle" : "direct" });
  for (const other of linkedAccounts(account, all)) for (const g of ownGrants(other)) out.push({ brandId: g.brandId, tier: g.tier, accountId: other.id, bundleId: g.bundleId, source: "linked" });
  return out;
}

/** Highest tier the account has for a brand from any source, or null for no access. */
export function effectiveTier(account: MemberAccount, brandId: BrandId, all: MemberAccount[] = [account]): AccessTier | null {
  let best: AccessTier | null = null;
  for (const e of entitlementsFor(account, all)) if (e.brandId === brandId && (!best || RANK[e.tier] > RANK[best])) best = e.tier;
  return best;
}

/** Brands the account can open (any tier). */
export function accessibleBrands(account: MemberAccount, all: MemberAccount[] = [account]): BrandId[] {
  return BRAND_IDS.filter((b) => effectiveTier(account, b, all) !== null);
}

export const ENTITLEMENT_SOURCE_LABELS: Record<EntitlementSource, string> = { owner: "Owner", direct: "Own membership", bundle: "Bundle", linked: "Linked account" };

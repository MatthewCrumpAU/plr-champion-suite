import type { AccessTier, BrandId, MemberAccount, PublishStatus } from "./types";
import { effectiveTier } from "./entitlements";

/**
 * Access rules, kept in one place so the same checks can later run on the server (Supabase RLS /
 * route handlers). Today the only account is the owner, who can preview the library as any tier.
 */

const TIER_RANK: Record<AccessTier, number> = { free: 0, member: 1, premium: 2 };

export function tierAtLeast(have: AccessTier | null | undefined, need: AccessTier): boolean {
  if (!have) return false;
  return TIER_RANK[have] >= TIER_RANK[need];
}

/** The viewer a page is rendered for. Owners can "view as" a member tier to check access rules. */
export interface Viewer {
  accountId: string;
  role: "owner" | "member";
  /** Tier used for content checks (the owner's chosen preview tier). */
  tier: AccessTier | null;
  /** True when the owner is previewing as a member — admin controls are hidden. */
  previewing: boolean;
}

export function viewerFor(account: MemberAccount, brandId: BrandId, previewTier: AccessTier | "owner", allAccounts: MemberAccount[] = [account]): Viewer {
  if (account.role === "owner") {
    if (previewTier === "owner") return { accountId: account.id, role: "owner", tier: "premium", previewing: false };
    return { accountId: account.id, role: "owner", tier: previewTier, previewing: true };
  }
  // Members get the best tier from their own membership, bundles and linked accounts.
  return { accountId: account.id, role: "member", tier: effectiveTier(account, brandId, allAccounts), previewing: false };
}

export function isAdminView(v: Viewer): boolean {
  return v.role === "owner" && !v.previewing;
}

/** Is a scheduled/published item live yet? Drafts and archived items never are. */
export function isLive(item: { status: PublishStatus; publishAt: string | null }, now: Date = new Date()): boolean {
  if (item.status === "published") return !item.publishAt || new Date(item.publishAt) <= now;
  if (item.status === "scheduled") return !!item.publishAt && new Date(item.publishAt) <= now;
  return false;
}

/** Can the viewer see this item in listings? Owners (not previewing) also see drafts. */
export function canSee(v: Viewer, item: { status: PublishStatus; publishAt: string | null }, now: Date = new Date()): boolean {
  if (isAdminView(v)) return item.status !== "archived";
  return isLive(item, now);
}

/** Can the viewer open/download it? Locked items are still listed so members can see what upgrading unlocks. */
export function canUse(v: Viewer, item: { access: AccessTier; status: PublishStatus; publishAt: string | null }, now: Date = new Date()): boolean {
  if (isAdminView(v)) return true;
  return isLive(item, now) && tierAtLeast(v.tier, item.access);
}

export function lockReason(v: Viewer, item: { access: AccessTier; status: PublishStatus; publishAt: string | null }, now: Date = new Date()): string | null {
  if (canUse(v, item, now)) return null;
  if (!isLive(item, now)) return item.publishAt ? `Available ${new Date(item.publishAt).toLocaleDateString()}` : "Not published yet";
  if (!v.tier) return "Members only";
  return `${item.access === "premium" ? "Premium" : "Member"} access required`;
}

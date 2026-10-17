import { nowIso } from "@/lib/utils";
import { getMembershipRepos, type MembershipRepositories } from "./db";
import type { AccessTier, MemberAccount } from "./types";

/**
 * Private-testing account model. There is one account — the owner — signed in through the
 * server-validated owner password. No registration, subscriptions or cross-brand sign-in exist yet;
 * the account record is shaped so those can be added without changing the UI.
 */
export const OWNER_ACCOUNT_ID = "acct_owner";
const PREVIEW_KEY = "previewTier";

export type PreviewTier = AccessTier | "owner";

export async function ensureOwnerAccount(repos: MembershipRepositories = getMembershipRepos()): Promise<MemberAccount> {
  const existing = await repos.accounts.get(OWNER_ACCOUNT_ID);
  if (existing) return existing;
  const now = nowIso();
  const owner: MemberAccount = {
    id: OWNER_ACCOUNT_ID,
    email: "owner@private.local",
    displayName: "Owner",
    role: "owner",
    brandAccess: { "plr-champion": "premium", plrforim: "premium" },
    linkedAccountIds: [],
    source: "owner",
    createdAt: now,
    updatedAt: now,
  };
  await repos.accounts.put(owner);
  return owner;
}

export async function getPreviewTier(repos: MembershipRepositories = getMembershipRepos()): Promise<PreviewTier> {
  return (await repos.kv.get<PreviewTier>(PREVIEW_KEY)) ?? "owner";
}

export async function setPreviewTier(t: PreviewTier, repos: MembershipRepositories = getMembershipRepos()) {
  await repos.kv.set(PREVIEW_KEY, t);
}

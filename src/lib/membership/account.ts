import { nowIso, uid } from "@/lib/utils";
import { getMembershipRepos, type MembershipRepositories } from "./db";
import { getBundle } from "./entitlements";
import { BRAND_IDS, type AccessTier, type BrandId, type MemberAccount } from "./types";

/**
 * Private-testing account model. There is one account — the owner — signed in through the
 * server-validated owner password. No registration, subscriptions or cross-brand sign-in exist yet;
 * the account record is shaped so those can be added without changing the UI.
 */
export const OWNER_ACCOUNT_ID = "acct_owner";
const PREVIEW_KEY = "previewTier";

/** What the owner is viewing as: themselves, a member tier, or a saved test profile (`account:<id>`). */
export type PreviewTier = AccessTier | "owner" | `account:${string}`;

export function previewAccountId(t: PreviewTier): string | null {
  return t.startsWith("account:") ? t.slice("account:".length) : null;
}

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

/* ------------------------------------------------------------------------------------------ */
/* Test profiles                                                                               */
/* ------------------------------------------------------------------------------------------ */
/**
 * Test profiles are local, sign-in-less member records the owner creates to check access rules —
 * a PLRforIM-only buyer, a bundle buyer, two linked accounts. They never authenticate; the owner
 * "views as" them. When memberships go live, real accounts use the same shape.
 */
export interface TestProfileInput {
  id?: string;
  displayName: string;
  email: string;
  brandAccess: Partial<Record<BrandId, AccessTier>>;
  bundleIds: string[];
  linkedAccountIds: string[];
  note?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function listAccounts(repos: MembershipRepositories = getMembershipRepos()): Promise<MemberAccount[]> {
  return (await repos.accounts.list()).sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : a.displayName.localeCompare(b.displayName)));
}

export async function saveTestProfile(input: TestProfileInput, repos: MembershipRepositories = getMembershipRepos()): Promise<MemberAccount> {
  const name = input.displayName.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) throw new Error("Give the profile a name.");
  if (!EMAIL_RE.test(email)) throw new Error("Enter an email address (it's only a label — nothing is sent).");
  const all = await repos.accounts.list();
  if (all.some((a) => a.email.toLowerCase() === email && a.id !== input.id)) throw new Error("Another profile already uses that email.");
  const existing = input.id ? all.find((a) => a.id === input.id) : undefined;
  if (existing && existing.role === "owner") throw new Error("The owner account can't be edited here.");
  const brandAccess: Partial<Record<BrandId, AccessTier>> = {};
  for (const b of BRAND_IDS) if (input.brandAccess[b]) brandAccess[b] = input.brandAccess[b];
  const id = existing?.id ?? uid("acct");
  const linked = [...new Set(input.linkedAccountIds)].filter((x) => x !== id && all.some((a) => a.id === x && a.role !== "owner"));
  const now = nowIso();
  const account: MemberAccount = {
    id,
    email,
    displayName: name,
    role: "member",
    brandAccess,
    bundleIds: input.bundleIds.filter((b) => !!getBundle(b)),
    linkedAccountIds: linked,
    source: "test",
    note: input.note?.trim() || undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await repos.accounts.put(account);
  return account;
}

export async function deleteTestProfile(id: string, repos: MembershipRepositories = getMembershipRepos()): Promise<void> {
  const all = await repos.accounts.list();
  const target = all.find((a) => a.id === id);
  if (!target || target.role === "owner") return;
  await repos.transaction(async () => {
    for (const a of all) if (a.linkedAccountIds.includes(id)) await repos.accounts.put({ ...a, linkedAccountIds: a.linkedAccountIds.filter((x) => x !== id), updatedAt: nowIso() });
    await repos.accounts.delete(id);
    if ((await getPreviewTier(repos)) === `account:${id}`) await setPreviewTier("owner", repos);
  });
}

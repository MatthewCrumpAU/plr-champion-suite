// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { createMembershipRepositories, MembershipDatabase, setMembershipRepos, type MembershipRepositories } from "@/lib/membership/db";
import { accessibleBrands, effectiveTier, entitlementsFor, linkedAccounts } from "@/lib/membership/entitlements";
import { viewerFor } from "@/lib/membership/access";
import { deleteTestProfile, ensureOwnerAccount, getPreviewTier, listAccounts, previewAccountId, saveTestProfile, setPreviewTier } from "@/lib/membership/account";
import { ensureSampleLibrary, removeSampleContent, type DocRenderer } from "@/lib/membership/seed";
import { BRANDS, LIVE_BRAND_IDS, brandCssVars, isLiveBrand } from "@/lib/membership/brands";
import { sampleLibraryFor } from "@/lib/membership/sample-libraries";
import { createMembershipBackup, parseMembershipBackup, restoreMembershipBackup } from "@/lib/membership/backup";
import type { MemberAccount } from "@/lib/membership/types";

let repos: MembershipRepositories;
let n = 0;
const fakeRender: DocRenderer = async (doc, format) => new Blob([`${format}:${doc.title}`]);

beforeEach(async () => {
  const db = new MembershipDatabase(`brand-test-${Date.now()}-${n++}`);
  await db.open();
  repos = createMembershipRepositories(db);
  setMembershipRepos(repos, db);
});

const acct = (id: string, patch: Partial<MemberAccount> = {}): MemberAccount => ({ id, email: `${id}@x.test`, displayName: id, role: "member", brandAccess: {}, linkedAccountIds: [], source: "test", createdAt: "", updatedAt: "", ...patch });

describe("brands", () => {
  it("switches on both brands with their own look", () => {
    expect(LIVE_BRAND_IDS).toEqual(["plr-champion", "plrforim"]);
    expect(isLiveBrand("plrforim")).toBe(true);
    expect(isLiveBrand("profit-lab")).toBe(false);
    expect(brandCssVars(BRANDS.plrforim.theme)["--primary"]).toBe("#0f8a7a");
    expect(brandCssVars(BRANDS["plr-champion"].theme)["--primary"]).toBe("#5b4df5");
    expect(BRANDS.plrforim.dropName).not.toBe(BRANDS["plr-champion"].dropName);
  });

  it("gives each brand its own sample library", () => {
    const champion = sampleLibraryFor("plr-champion")!;
    const im = sampleLibraryFor("plrforim")!;
    const titles = (l: typeof im) => new Set(l.products.map((p) => p.title));
    const overlap = [...titles(champion)].filter((t) => titles(im).has(t));
    expect(overlap).toEqual([]);
    expect(im.categories.map((c) => c.name)).toContain("Affiliate Marketing");
    // Every sample product's categories and drops exist.
    for (const lib of [champion, im]) {
      const keys = new Set(lib.categories.map((c) => c.key));
      for (const p of lib.products) {
        expect(p.categories.every((k) => keys.has(k)), p.title).toBe(true);
        if (p.drop !== null) expect(lib.drops[p.drop], p.title).toBeDefined();
      }
    }
  });

  it("no sample content makes income claims", () => {
    const text = JSON.stringify([sampleLibraryFor("plr-champion"), sampleLibraryFor("plrforim")]).toLowerCase();
    for (const banned of ["guaranteed income", "make $", "earn $", "per month in", "six figures", "6 figures", "passive income guaranteed"]) expect(text).not.toContain(banned);
  });

  it("seeds and removes each brand's library independently", async () => {
    await ensureSampleLibrary("plr-champion", { render: fakeRender });
    await ensureSampleLibrary("plrforim", { render: fakeRender });
    const champ = await repos.products.list("plr-champion");
    const im = await repos.products.list("plrforim");
    expect(im.length).toBeGreaterThanOrEqual(10);
    expect(champ.some((p) => im.some((q) => q.id === p.id))).toBe(false);
    const imCats = new Set((await repos.categories.list("plrforim")).map((c) => c.id));
    expect(im.every((p) => p.categoryIds.every((c) => imCats.has(c)))).toBe(true);
    const imReleases = await repos.releases.list("plrforim");
    expect(im.filter((p) => p.releaseId).every((p) => imReleases.some((r) => r.id === p.releaseId))).toBe(true);

    await removeSampleContent("plrforim");
    expect(await repos.products.list("plrforim")).toHaveLength(0);
    expect(await repos.products.list("plr-champion")).toHaveLength(champ.length);
    const fileBrands = new Set((await repos.files.listMeta()).map((f) => f.brandId));
    expect(fileBrands).toEqual(new Set(["plr-champion"]));
  });

  it("restores a brand backup without touching the other brand", async () => {
    await ensureSampleLibrary("plr-champion", { render: fakeRender });
    await ensureSampleLibrary("plrforim", { render: fakeRender });
    const champCount = (await repos.products.list("plr-champion")).length;
    const { blob } = await createMembershipBackup("plrforim");
    const parsed = await parseMembershipBackup(blob);
    await restoreMembershipBackup(parsed, "replace", "plrforim");
    expect((await repos.products.list("plr-champion")).length).toBe(champCount);
    await expect(restoreMembershipBackup(parsed, "replace", "plr-champion")).rejects.toThrow(/plrforim backup/);
  });
});

describe("entitlements (prepared for bundles and linked accounts)", () => {
  it("uses direct access per brand", () => {
    const a = acct("a", { brandAccess: { plrforim: "member" } });
    expect(effectiveTier(a, "plrforim")).toBe("member");
    expect(effectiveTier(a, "plr-champion")).toBeNull();
    expect(accessibleBrands(a)).toEqual(["plrforim"]);
  });

  it("grants both brands through the bundle", () => {
    const a = acct("a", { brandAccess: { "plr-champion": "free" }, bundleIds: ["plr-ecosystem-bundle", "unknown-bundle"] });
    expect(effectiveTier(a, "plr-champion")).toBe("premium");
    expect(effectiveTier(a, "plrforim")).toBe("premium");
    expect(entitlementsFor(a).filter((e) => e.source === "bundle")).toHaveLength(2);
  });

  it("shares access between linked accounts in both directions", () => {
    const champ = acct("champ", { brandAccess: { "plr-champion": "premium" }, linkedAccountIds: ["im"] });
    const im = acct("im", { brandAccess: { plrforim: "member" } });
    const stranger = acct("stranger", { brandAccess: { plrforim: "premium" } });
    const all = [champ, im, stranger];
    expect(linkedAccounts(im, all).map((a) => a.id)).toEqual(["champ"]);
    expect(effectiveTier(im, "plr-champion", all)).toBe("premium");
    expect(effectiveTier(champ, "plrforim", all)).toBe("member");
    expect(effectiveTier(stranger, "plr-champion", all)).toBeNull();
    // Linked access is one hop only.
    const third = acct("third", { linkedAccountIds: ["im"] });
    expect(effectiveTier(third, "plr-champion", [...all, third])).toBeNull();
    expect(entitlementsFor(im, all).find((e) => e.brandId === "plr-champion")?.source).toBe("linked");
  });

  it("feeds the viewer used by every page", () => {
    const champ = acct("champ", { brandAccess: { "plr-champion": "member" }, linkedAccountIds: ["im"] });
    const im = acct("im", { brandAccess: { plrforim: "premium" } });
    expect(viewerFor(im, "plr-champion", "owner", [champ, im]).tier).toBe("member");
    expect(viewerFor(im, "plrforim", "owner", [champ, im]).tier).toBe("premium");
    expect(viewerFor(acct("none"), "plrforim", "owner").tier).toBeNull();
  });
});

describe("test profiles", () => {
  it("creates, links, previews and deletes local test profiles", async () => {
    await ensureOwnerAccount();
    const im = await saveTestProfile({ displayName: "IM buyer", email: "IM@Example.com", brandAccess: { plrforim: "member" }, bundleIds: [], linkedAccountIds: [] });
    expect(im.email).toBe("im@example.com");
    expect(im.source).toBe("test");
    const champ = await saveTestProfile({ displayName: "Champion buyer", email: "champ@example.com", brandAccess: { "plr-champion": "premium" }, bundleIds: [], linkedAccountIds: [im.id, "acct_owner", "missing"] });
    expect(champ.linkedAccountIds).toEqual([im.id]);
    await expect(saveTestProfile({ displayName: "Dup", email: "im@example.com", brandAccess: {}, bundleIds: [], linkedAccountIds: [] })).rejects.toThrow(/already uses/);
    await expect(saveTestProfile({ displayName: "Bad", email: "not-an-email", brandAccess: {}, bundleIds: [], linkedAccountIds: [] })).rejects.toThrow(/email/);
    await expect(saveTestProfile({ id: "acct_owner", displayName: "Owner", email: "o@x.com", brandAccess: {}, bundleIds: [], linkedAccountIds: [] })).rejects.toThrow(/owner/);

    const all = await listAccounts();
    expect(all[0].role).toBe("owner");
    expect(effectiveTier(all.find((a) => a.id === im.id)!, "plr-champion", all)).toBe("premium");

    await setPreviewTier(`account:${im.id}`);
    expect(previewAccountId(await getPreviewTier())).toBe(im.id);
    await deleteTestProfile(im.id);
    expect(await getPreviewTier()).toBe("owner");
    expect((await repos.accounts.get(champ.id))!.linkedAccountIds).toEqual([]);
    await deleteTestProfile("acct_owner");
    expect(await repos.accounts.get("acct_owner")).toBeDefined();
  });
});

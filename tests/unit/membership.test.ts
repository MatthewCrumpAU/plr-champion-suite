// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import JSZip from "jszip";
import { createMembershipRepositories, MembershipDatabase, setMembershipRepos, type MembershipRepositories } from "@/lib/membership/db";
import { canSee, canUse, isLive, lockReason, tierAtLeast, viewerFor } from "@/lib/membership/access";
import { ensureOwnerAccount, OWNER_ACCOUNT_ID } from "@/lib/membership/account";
import { EMPTY_QUERY, filterProducts, paramsToQuery, parseTerms, queryToParams } from "@/lib/membership/search";
import { addProductFile, defaultLicence, deleteCategory, deleteProduct, duplicateProduct, newProduct, newRelease, publishRelease, safeUrl, saveCategory, saveProduct, saveRelease } from "@/lib/membership/catalog";
import { ensureSampleLibrary, isSeeded, removeSampleContent, seedSampleLibrary, type DocRenderer } from "@/lib/membership/seed";
import { checklistItems, licenceText, setLessonComplete, toggleChecklistItem, toggleFavourite } from "@/lib/membership/member-actions";
import { createMembershipBackup, parseMembershipBackup, restoreMembershipBackup } from "@/lib/membership/backup";
import { wrapText, coverSvg } from "@/lib/membership/covers";
import type { MemberAccount, Product } from "@/lib/membership/types";

let repos: MembershipRepositories;
let n = 0;

/** Fast stand-in for the DOCX/PDF engines: a small text blob per document. */
const fakeRender: DocRenderer = async (doc, format) => new Blob([`${format.toUpperCase()}:${doc.title}\n${doc.chapters.map((c) => c.title).join("\n")}`], { type: format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

beforeEach(async () => {
  const db = new MembershipDatabase(`m-test-${Date.now()}-${n++}`);
  await db.open();
  repos = createMembershipRepositories(db);
  setMembershipRepos(repos, db);
});

const owner: MemberAccount = { id: "acct_owner", email: "o@x", displayName: "Owner", role: "owner", brandAccess: { "plr-champion": "premium" }, linkedAccountIds: [], source: "owner", createdAt: "", updatedAt: "" };
const member: MemberAccount = { ...owner, id: "acct_m", role: "member", brandAccess: { "plr-champion": "member" } };

describe("access rules", () => {
  const past = new Date(Date.now() - 86_400_000).toISOString();
  const future = new Date(Date.now() + 86_400_000).toISOString();

  it("ranks tiers", () => {
    expect(tierAtLeast("premium", "member")).toBe(true);
    expect(tierAtLeast("free", "member")).toBe(false);
    expect(tierAtLeast(null, "free")).toBe(false);
  });

  it("treats drafts, archived and future items as not live", () => {
    expect(isLive({ status: "published", publishAt: past })).toBe(true);
    expect(isLive({ status: "published", publishAt: future })).toBe(false);
    expect(isLive({ status: "scheduled", publishAt: past })).toBe(true);
    expect(isLive({ status: "scheduled", publishAt: future })).toBe(false);
    expect(isLive({ status: "draft", publishAt: null })).toBe(false);
    expect(isLive({ status: "archived", publishAt: past })).toBe(false);
  });

  it("lets the owner see drafts but not when previewing as a member", () => {
    const draft = { status: "draft" as const, publishAt: null, access: "member" as const };
    const ownerView = viewerFor(owner, "plr-champion", "owner");
    const preview = viewerFor(owner, "plr-champion", "free");
    expect(canSee(ownerView, draft)).toBe(true);
    expect(canSee(preview, draft)).toBe(false);
    expect(preview.previewing).toBe(true);
    const premium = { status: "published" as const, publishAt: past, access: "premium" as const };
    expect(canUse(preview, premium)).toBe(false);
    expect(lockReason(preview, premium)).toMatch(/Premium/);
    const memberView = viewerFor(member, "plr-champion", "owner");
    expect(memberView.tier).toBe("member");
    expect(canUse(memberView, { ...premium, access: "member" })).toBe(true);
    expect(viewerFor(member, "plrforim", "owner").tier).toBeNull();
    expect(lockReason(viewerFor(owner, "plr-champion", "member"), { status: "scheduled", publishAt: future, access: "free" })).toMatch(/Available/);
  });
});

describe("search", () => {
  const mk = (patch: Partial<Product>): Product => newProduct("plr-champion", { status: "published", publishAt: new Date().toISOString(), ...patch });
  const products = [
    mk({ id: "a", title: "Sleep Better Tonight", tags: ["sleep", "health"], categoryIds: ["health"], publishAt: "2026-01-01T00:00:00.000Z", wordCount: 2000 }),
    mk({ id: "b", title: "Budget Reset", subtitle: "Money made simple", tags: ["budgeting"], categoryIds: ["money"], publishAt: "2026-03-01T00:00:00.000Z", wordCount: 3000, access: "premium" }),
    mk({ id: "c", title: "Calm Mornings", description: "A routine that helps you sleep and wake better", categoryIds: ["health"], publishAt: "2026-02-01T00:00:00.000Z", wordCount: 500, licence: { ...defaultLicence("mrr") } }),
  ];

  it("parses quoted phrases", () => {
    expect(parseTerms('budget "morning routine"  Calm')).toEqual(["budget", "morning routine", "calm"]);
  });

  it("ranks title matches above body matches and requires every term", () => {
    expect(filterProducts(products, { ...EMPTY_QUERY, text: "sleep" }).map((p) => p.id)).toEqual(["a", "c"]);
    expect(filterProducts(products, { ...EMPTY_QUERY, text: "sleep budget" })).toHaveLength(0);
    expect(filterProducts(products, { ...EMPTY_QUERY, text: "money" }).map((p) => p.id)).toEqual(["b"]);
  });

  it("filters by category, access, rights and sorts", () => {
    expect(filterProducts(products, { ...EMPTY_QUERY, categoryIds: ["health"] }).map((p) => p.id)).toEqual(["c", "a"]);
    expect(filterProducts(products, { ...EMPTY_QUERY, access: ["premium"] }).map((p) => p.id)).toEqual(["b"]);
    expect(filterProducts(products, { ...EMPTY_QUERY, rights: ["edit"] }).map((p) => p.id).sort()).toEqual(["a", "b"]);
    expect(filterProducts(products, { ...EMPTY_QUERY, sort: "longest" }).map((p) => p.id)).toEqual(["b", "a", "c"]);
    expect(filterProducts(products, { ...EMPTY_QUERY, sort: "title" }).map((p) => p.id)).toEqual(["b", "c", "a"]);
    expect(filterProducts(products, { ...EMPTY_QUERY, favouritesOnly: true }, { favourites: new Set(["c"]) }).map((p) => p.id)).toEqual(["c"]);
  });

  it("round-trips through URL params", () => {
    const q = { ...EMPTY_QUERY, text: "sleep", categoryIds: ["x", "y"], rights: ["sell" as const], editableOnly: true, sort: "newest" as const };
    expect(paramsToQuery(queryToParams(q))).toEqual(q);
    expect(paramsToQuery(new URLSearchParams())).toEqual(EMPTY_QUERY);
  });
});

describe("catalogue", () => {
  it("keeps slugs unique and detaches deleted categories", async () => {
    const cat = await saveCategory("plr-champion", { name: "Health" });
    const a = await saveProduct(newProduct("plr-champion", { title: "Same Title", categoryIds: [cat.id] }));
    const b = await saveProduct(newProduct("plr-champion", { title: "Same Title" }));
    expect(a.slug).toBe("same-title");
    expect(b.slug).toBe("same-title-2");
    await deleteCategory(cat.id);
    expect((await repos.products.get(a.id))!.categoryIds).toEqual([]);
  });

  it("keeps releases and products in step", async () => {
    const rel = await saveRelease(newRelease("plr-champion", "2026-05"));
    const p = await saveProduct(newProduct("plr-champion", { title: "In a drop", releaseId: rel.id }));
    expect((await repos.releases.get(rel.id))!.productIds).toEqual([p.id]);
    const rel2 = await saveRelease({ ...newRelease("plr-champion", "2026-06"), productIds: [p.id] });
    expect((await repos.products.get(p.id))!.releaseId).toBe(rel2.id);
    expect((await repos.releases.get(rel.id))!.productIds).toEqual([]);
    const past = new Date(Date.now() - 1000).toISOString();
    await publishRelease((await repos.releases.get(rel2.id))!, past);
    expect((await repos.products.get(p.id))!.status).toBe("published");
    const future = new Date(Date.now() + 86_400_000 * 40).toISOString();
    const p2 = await saveProduct(newProduct("plr-champion", { title: "Later", releaseId: rel2.id }));
    await publishRelease((await repos.releases.get(rel2.id))!, future);
    expect((await repos.products.get(p2.id))!.status).toBe("scheduled");
    await deleteProduct(p.id);
    expect((await repos.releases.get(rel2.id))!.productIds).toEqual([p2.id]);
  });

  it("stores attachments, duplicates with independent files and cleans up on delete", async () => {
    let p = await saveProduct(newProduct("plr-champion", { title: "Files" }));
    p = await addProductFile(p, new Blob(["hello"], { type: "text/plain" }), "guide.docx");
    p = await addProductFile(p, new Blob(["img"]), "cover-art.png");
    expect(p.files.map((f) => [f.kind, f.editable])).toEqual([
      ["ebook", true],
      ["graphics", false],
    ]);
    const copy = (await duplicateProduct(p.id))!;
    expect(copy.status).toBe("draft");
    expect(copy.files[0].fileId).not.toBe(p.files[0].fileId);
    await deleteProduct(p.id);
    expect(await repos.files.get(p.files[0].fileId)).toBeUndefined();
    expect(await repos.files.get(copy.files[0].fileId)).toBeDefined();
  });

  it("only allows safe links", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("data:text/html,hi")).toBe("");
    expect(safeUrl("//evil.example")).toBe("");
    expect(safeUrl("/profit")).toBe("/profit");
    expect(safeUrl("https://example.com/a")).toBe("https://example.com/a");
  });
});

describe("sample library", () => {
  it("seeds once with files, drops, courses and resources", async () => {
    const now = new Date("2026-10-15T10:00:00.000Z");
    const s = await ensureSampleLibrary("plr-champion", { render: fakeRender, now });
    expect(s!.products).toBeGreaterThanOrEqual(10);
    expect(s!.releases).toBe(4);
    expect(await isSeeded("plr-champion")).toBe(true);
    expect(await ensureSampleLibrary("plr-champion", { render: fakeRender, now })).toBeNull();

    const products = await repos.products.list("plr-champion");
    expect(products.every((p) => p.coverFileId && p.files.length > 0 && p.isSample)).toBe(true);
    expect(products.some((p) => p.status === "draft")).toBe(true);
    expect(products.some((p) => p.status === "scheduled")).toBe(true);
    expect(products.some((p) => p.licence.type === "mrr")).toBe(true);
    for (const p of products) for (const f of p.files) expect(await repos.files.get(f.fileId)).toBeDefined();

    const releases = (await repos.releases.list("plr-champion")).sort((a, b) => a.month.localeCompare(b.month));
    expect(releases.map((r) => r.month)).toEqual(["2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(releases.map((r) => r.status)).toEqual(["published", "published", "published", "scheduled"]);
    for (const r of releases) for (const id of r.productIds) expect(products.find((p) => p.id === id)?.releaseId).toBe(r.id);

    expect((await repos.courses.list("plr-champion")).length).toBeGreaterThanOrEqual(4);
    expect((await repos.resources.list("plr-champion")).length).toBeGreaterThanOrEqual(4);
    // Other brands are untouched.
    expect(await repos.products.list("plrforim")).toHaveLength(0);
  });

  it("removes only sample content", async () => {
    await seedSampleLibrary("plr-champion", { render: fakeRender });
    const mine = await saveProduct(newProduct("plr-champion", { title: "My own product" }));
    await removeSampleContent("plr-champion");
    expect((await repos.products.list("plr-champion")).map((p) => p.id)).toEqual([mine.id]);
    expect(await repos.releases.list("plr-champion")).toHaveLength(0);
    expect(await repos.courses.list("plr-champion")).toHaveLength(0);
    expect((await repos.files.listMeta()).length).toBe(0);
  });
});

describe("member actions", () => {
  it("toggles favourites and lesson progress", async () => {
    expect(await toggleFavourite("plr-champion", "m1", "p1")).toBe(true);
    expect(await repos.favourites.listForMember("plr-champion", "m1")).toHaveLength(1);
    expect(await toggleFavourite("plr-champion", "m1", "p1")).toBe(false);
    await toggleChecklistItem("plr-champion", "m1", "c1", "l1", 2);
    await toggleChecklistItem("plr-champion", "m1", "c1", "l1", 0);
    const pr = await setLessonComplete("plr-champion", "m1", "c1", "l1", true);
    expect(pr.checked).toEqual([0, 2]);
    expect(pr.completedAt).toBeTruthy();
    expect((await setLessonComplete("plr-champion", "m1", "c1", "l1", false)).completedAt).toBeNull();
  });

  it("parses checklist bodies and writes licence summaries", () => {
    expect(checklistItems("Intro\n- one\n* [x] two\n  - [ ] three\nnot an item")).toEqual(["one", "two", "three"]);
    const p = newProduct("plr-champion", { title: "T", licence: { ...defaultLicence("plr"), terms: "No giveaways on marketplaces." } });
    const txt = licenceText(p, "PLR Champion");
    expect(txt).toContain("Private Label Rights");
    expect(txt).toContain("Edit and rebrand the content: Allowed");
    expect(txt).toContain("No giveaways on marketplaces.");
  });

  it("creates the owner account once", async () => {
    const a = await ensureOwnerAccount();
    const b = await ensureOwnerAccount();
    expect(a.id).toBe(OWNER_ACCOUNT_ID);
    expect(b.createdAt).toBe(a.createdAt);
    expect(a.brandAccess).toEqual({ "plr-champion": "premium", plrforim: "premium", "plr-profit-lab": "premium" });
  });
});

describe("membership backup", () => {
  it("round-trips a brand's library and refuses other brands", async () => {
    await seedSampleLibrary("plr-champion", { render: fakeRender });
    const before = await repos.products.list("plr-champion");
    const { blob, summary } = await createMembershipBackup("plr-champion");
    expect(summary.products).toBe(before.length);
    const zip = await JSZip.loadAsync(blob);
    expect(zip.file("membership.json")).toBeTruthy();

    await repos.clearAll();
    const parsed = await parseMembershipBackup(blob);
    await expect(restoreMembershipBackup(parsed, "merge", "plrforim")).rejects.toThrow(/plr-champion backup/);
    await restoreMembershipBackup(parsed, "replace", "plr-champion");
    const after = await repos.products.list("plr-champion");
    expect(after.map((p) => p.id).sort()).toEqual(before.map((p) => p.id).sort());
    const f = after[0].files[0];
    expect((await repos.files.get(f.fileId))!.size).toBe(f.size);
    expect(await isSeeded("plr-champion")).toBe(true);
  });

  it("rejects files that aren't membership backups", async () => {
    await expect(parseMembershipBackup(new Blob(["nope"]))).rejects.toThrow(/not a ZIP/);
    const zip = new JSZip();
    zip.file("membership.json", JSON.stringify({ format: "something-else" }));
    await expect(parseMembershipBackup(await zip.generateAsync({ type: "blob" }))).rejects.toThrow(/can't be restored/);
  });
});

describe("covers", () => {
  it("wraps and escapes text", () => {
    expect(wrapText("The Calm Morning Method For Busy People", 15)).toEqual(["The Calm", "Morning Method", "For Busy People"]);
    const svg = coverSvg({ title: "A <b> & C", brandName: "X", palette: ["#000", "#111", "#fff"], motif: "grid" });
    expect(svg).toContain("A &lt;b&gt; &amp; C");
    expect(svg).not.toContain("<b>");
  });
});

describe("training progress and tool links", () => {
  it("summarises course progress and finds the next lesson", async () => {
    const { courseStats, currentRelease, isThisMonth } = await import("@/lib/membership/progress");
    const { newCourse: nc, newRelease: nr } = await import("@/lib/membership/catalog");
    const c = nc("plr-champion", {
      modules: [
        { id: "m1", title: "M1", lessons: [{ id: "a", title: "A", type: "article", body: "", videoUrl: "", durationMin: 5, attachments: [] }, { id: "b", title: "B", type: "article", body: "", videoUrl: "", durationMin: 10, attachments: [] }] },
        { id: "m2", title: "M2", lessons: [{ id: "c", title: "C", type: "checklist", body: "- x", videoUrl: "", durationMin: 3, attachments: [] }] },
      ],
    });
    const p = (lessonId: string, done: boolean) => ({ id: `u:${c.id}:${lessonId}`, brandId: "plr-champion" as const, memberId: "u", courseId: c.id, lessonId, completedAt: done ? "2026-01-01T00:00:00.000Z" : null, checked: [], updatedAt: "2026-01-02T00:00:00.000Z" });
    const s = courseStats(c, [p("a", true), p("b", false)]);
    expect(s).toMatchObject({ total: 3, completed: 1, pct: 33, minutes: 18 });
    expect(s.next?.lesson.id).toBe("b");
    expect(courseStats(c, [p("a", true), p("b", true), p("c", true)]).next?.lesson.id).toBe("a");

    const now = new Date(2026, 9, 15);
    const oct = { ...nr("plr-champion", "2026-10"), status: "published" as const };
    const sep = { ...nr("plr-champion", "2026-09"), status: "published" as const };
    const nov = { ...nr("plr-champion", "2026-11"), status: "scheduled" as const };
    expect(currentRelease([sep, oct, nov], (r) => r.status === "published", now)?.month).toBe("2026-10");
    expect(currentRelease([sep, nov], (r) => r.status === "published", now)?.month).toBe("2026-09");
    expect(isThisMonth(new Date(2026, 9, 2).toISOString(), now)).toBe(true);
    expect(isThisMonth(new Date(2026, 9, 20).toISOString(), now)).toBe(false);
  });

  it("remaps studio tool links for embedded shells", async () => {
    const { remapToolHref } = await import("@/components/common/tool-links");
    const routes = { "/editor": "/m/plr-champion/tools/editor", "/funnels": "/m/plr-champion/tools/profit-map" };
    expect(remapToolHref(routes, "/editor?id=doc_1")).toBe("/m/plr-champion/tools/editor?id=doc_1");
    expect(remapToolHref(routes, "/editor")).toBe("/m/plr-champion/tools/editor");
    expect(remapToolHref(routes, "/editorial")).toBe("/editorial");
    expect(remapToolHref(routes, "/covers?id=1")).toBe("/covers?id=1");
  });
});

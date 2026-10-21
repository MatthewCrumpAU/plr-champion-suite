// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDexieRepositories, PLRDatabase } from "@/lib/data/dexie";
import { setRepos, type Repositories } from "@/lib/data";
import { createProject, duplicateProject } from "@/lib/services/projects";
import { ensureSampleProject, seedSampleProject } from "@/lib/services/sample";
import { removeAllSampleContent } from "@/lib/services/clean-start";
import { createMembershipRepositories, MembershipDatabase, setMembershipRepos, type MembershipRepositories } from "@/lib/membership/db";
import { ensureSampleLibrary, resetSampleContent, type DocRenderer } from "@/lib/membership/seed";
import { newProduct, saveProduct } from "@/lib/membership/catalog";
import { BRAND_IDS } from "@/lib/membership/types";

const fakeRender: DocRenderer = async (doc, format) => new Blob([`${format}:${doc.title}`]);
let studio: Repositories;
let members: MembershipRepositories;
let n = 0;

beforeEach(async () => {
  const sdb = new PLRDatabase(`clean-s-${Date.now()}-${n}`);
  await sdb.open();
  studio = createDexieRepositories(sdb);
  setRepos(studio, sdb);
  const mdb = new MembershipDatabase(`clean-m-${Date.now()}-${n++}`);
  await mdb.open();
  members = createMembershipRepositories(mdb);
  setMembershipRepos(members, mdb);
});

afterEach(() => vi.unstubAllEnvs());

describe("Start clean: remove all sample content", () => {
  it("removes every sample, keeps your own work, and samples don't come back", async () => {
    const sample = (await ensureSampleProject(studio))!;
    expect(sample.isSample).toBe(true);
    const mine = await createProject({ name: "My real ebook" }, studio);
    const copy = await duplicateProject(sample.id, { name: "My version of the sample" }, studio);
    for (const b of BRAND_IDS) await ensureSampleLibrary(b, { render: fakeRender, repos: members });
    const ownProduct = await saveProduct({ ...newProduct("plr-champion"), title: "My own PLR pack" }, members);
    expect((await members.products.list("plr-champion")).filter((p) => p.isSample).length).toBeGreaterThan(5);

    const s = await removeAllSampleContent(studio, members);
    expect(s.projects).toBe(1);
    expect(s.membershipItems).toBeGreaterThan(10);

    const projects = await studio.projects.list({ includeArchived: true, includeDeleted: true });
    expect(projects.map((p) => p.name).sort()).toEqual(["My real ebook", "My version of the sample"]);
    expect(projects.find((p) => p.id === mine.id)).toBeDefined();
    // The sample brand kit is still used by the copy, so it stays.
    expect(s.brandKits).toBe(0);
    expect(await studio.brandKits.get(copy!.brandKitId!)).toBeDefined();
    expect(await studio.assets.listByProject(sample.id)).toEqual([]);

    for (const b of BRAND_IDS) {
      expect((await members.products.list(b)).filter((p) => p.isSample)).toEqual([]);
      expect((await members.releases.list(b)).filter((r) => r.isSample)).toEqual([]);
      expect((await members.courses.list(b)).filter((c) => c.isSample)).toEqual([]);
    }
    expect((await members.products.list("plr-champion")).map((p) => p.id)).toEqual([ownProduct.id]);

    // Nothing is re-created on the next visit…
    expect(await ensureSampleProject(studio)).toBeNull();
    for (const b of BRAND_IDS) expect(await ensureSampleLibrary(b, { render: fakeRender, repos: members })).toBeNull();
    // …but you can still bring samples back on purpose.
    expect((await seedSampleProject(studio)).isSample).toBe(true);
    expect((await resetSampleContent("plr-champion", { render: fakeRender, repos: members })).products).toBeGreaterThan(5);
  });

  it("removes the sample brand kit when nothing of yours uses it", async () => {
    await ensureSampleProject(studio);
    const s = await removeAllSampleContent(studio, members);
    expect(s.brandKits).toBe(1);
    expect(await studio.brandKits.list()).toEqual([]);
    expect(await studio.projects.list({ includeArchived: true, includeDeleted: true })).toEqual([]);
  });

  it("with NEXT_PUBLIC_PLR_SAMPLE_CONTENT=off a new browser starts completely empty", async () => {
    vi.stubEnv("NEXT_PUBLIC_PLR_SAMPLE_CONTENT", "off");
    expect(await ensureSampleProject(studio)).toBeNull();
    expect(await studio.projects.list({ includeArchived: true, includeDeleted: true })).toEqual([]);
    for (const b of BRAND_IDS) {
      expect(await ensureSampleLibrary(b, { render: fakeRender, repos: members })).toBeNull();
      expect(await members.products.list(b)).toEqual([]);
      expect(await members.courses.list(b)).toEqual([]);
    }
  });
});

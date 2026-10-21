"use client";

import * as React from "react";
import { DatabaseBackup, Download, FlaskConical, HardDrive, RotateCcw, Trash2, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Callout, PageContainer, PageHeader, Progress } from "@/components/ui/primitives";
import { useConfirm } from "@/components/ui/confirm";
import { FileDrop } from "@/components/common/file-drop";
import { downloadBlob } from "@/lib/export/download";
import { createMembershipBackup, parseMembershipBackup, restoreMembershipBackup, type MembershipRestoreMode, type ParsedMembershipBackup } from "@/lib/membership/backup";
import { removeSampleContent, resetSampleContent } from "@/lib/membership/seed";
import { getMembershipRepos } from "@/lib/membership/db";
import { useMemberLive } from "@/lib/membership/hooks";
import { errorMessage, formatBytes, formatDateTime, plural } from "@/lib/utils";
import { useMember } from "../member-context";
import { AdminGate } from "./admin-gate";

export function DataAdmin() {
  return (
    <AdminGate>
      <Inner />
    </AdminGate>
  );
}

function Inner() {
  const m = useMember();
  const confirm = useConfirm();
  const lab = m.brand.features.lab;
  const [busy, setBusy] = React.useState<string | null>(null);
  const [parsed, setParsed] = React.useState<ParsedMembershipBackup | null>(null);
  const [seedProgress, setSeedProgress] = React.useState<{ done: number; total: number; label: string } | null>(null);
  const [estimate, setEstimate] = React.useState<{ usage: number; quota: number } | null>(null);
  const { data: stats } = useMemberLive(
    async (r) => {
      const files = (await r.files.listMeta()).filter((f) => f.brandId === m.brandId);
      const [products, campaigns, buildDays] = await Promise.all([r.products.list(m.brandId), r.campaigns.list(m.brandId), r.buildDays.list(m.brandId)]);
      const labSamples = campaigns.filter((c) => c.isSample).length + buildDays.filter((b) => b.isSample).length;
      return { bytes: files.reduce((n, f) => n + f.size, 0), files: files.length, samples: products.filter((p) => p.isSample).length + labSamples, products: products.length, campaigns: campaigns.length, buildDays: buildDays.length };
    },
    [m.brandId],
  );

  React.useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((e) => e.quota && setEstimate({ usage: e.usage ?? 0, quota: e.quota }))
      .catch(() => undefined);
  }, [stats?.bytes]);

  const backup = async () => {
    setBusy("backup");
    try {
      const { blob, fileName, summary } = await createMembershipBackup(m.brandId);
      downloadBlob(blob, fileName);
      toast.success("Backup downloaded", { description: `${lab ? `${plural(summary.campaigns ?? 0, "campaign")} · ${plural(summary.buildDays ?? 0, "Build Day")}` : plural(summary.products, "product")} · ${plural(summary.files, "file")} · ${formatBytes(summary.bytes)}` });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const restore = async (mode: MembershipRestoreMode) => {
    if (!parsed) return;
    if (mode === "replace" && !(await confirm({ title: "Replace this brand's library?", description: `All current ${m.brand.name} ${lab ? "campaigns, Build Days, Profit Path plans" : "products, categories, releases"}, training, resources and member activity in this browser are replaced by the backup. Other brands and your studio projects aren't affected.`, confirmLabel: "Replace library", destructive: true, typeToConfirm: "REPLACE" }))) return;
    setBusy("restore");
    try {
      const s = await restoreMembershipBackup(parsed, mode, m.brandId);
      toast.success("Backup restored", { description: lab ? `${plural(s.campaigns ?? 0, "campaign")} · ${plural(s.buildDays ?? 0, "Build Day")} · ${plural(s.courses, "course")}` : `${plural(s.products, "product")} · ${plural(s.releases, "release")} · ${plural(s.courses, "course")}` });
      setParsed(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <PageContainer>
      <PageHeader eyebrow="Membership Admin" title="Data & backup" description={`${m.brand.name}'s library is stored in this browser (IndexedDB) for private testing. Download backups regularly — clearing site data deletes it.`} />

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="size-4" /> Storage
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 text-sm">
            <p>
              {lab ? `${plural(stats?.campaigns ?? 0, "campaign")}, ${plural(stats?.buildDays ?? 0, "Build Day")}` : plural(stats?.products ?? 0, "product")} and {plural(stats?.files ?? 0, "stored file")} use <strong>{formatBytes(stats?.bytes ?? 0)}</strong>.
            </p>
            {estimate && (
              <div>
                <Progress value={(estimate.usage / estimate.quota) * 100} />
                <p className="mt-1 text-xs text-muted-foreground">
                  This site is using {formatBytes(estimate.usage)} of about {formatBytes(estimate.quota)} the browser allows.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DatabaseBackup className="size-4" /> Backup and restore
            </CardTitle>
            <CardDescription>One ZIP with every {lab ? "campaign, Build Day, Profit Path plan and member progress record" : "product, image, file, release"}, course and resource for {m.brand.name}. Studio projects have their own backup in the Export Centre.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4">
            <Button onClick={backup} loading={busy === "backup"} className="justify-self-start" data-testid="membership-backup">
              <Download /> Download {m.brand.name} backup
            </Button>
            <FileDrop
              accept=".zip,application/zip"
              compact
              title="Restore from a membership backup (.zip)"
              testId="membership-restore"
              onFiles={async ([f]) => {
                try {
                  const p = await parseMembershipBackup(f);
                  if (p.manifest.brandId !== m.brandId) throw new Error(`That's a ${p.manifest.brandId} backup — restore it from that brand's admin.`);
                  setParsed(p);
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            />
            {parsed && (
              <Callout
                tone="info"
                title={`Backup from ${formatDateTime(parsed.summary.createdAt)}`}
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => restore("merge")} loading={busy === "restore"} data-testid="restore-merge">
                      <Upload /> Merge
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => restore("replace")} disabled={!!busy}>
                      Replace
                    </Button>
                  </div>
                }
              >
                {lab ? `${plural(parsed.summary.campaigns ?? 0, "campaign")}, ${plural(parsed.summary.buildDays ?? 0, "Build Day")}` : `${plural(parsed.summary.products, "product")}, ${plural(parsed.summary.categories, "category", "categories")}, ${plural(parsed.summary.releases, "release")}`}, {plural(parsed.summary.courses, "course")}, {plural(parsed.summary.files, "file")}. <em>Merge</em> adds and updates items; <em>Replace</em> swaps the whole library.
              </Callout>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="size-4" /> Sample content
            </CardTitle>
            <CardDescription>The sample library is original demonstration content for testing. Remove it before you load real products, or recreate it to start testing again. Products you created are never touched.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3">
            <p className="text-sm text-muted-foreground">{plural(stats?.samples ?? 0, lab ? "sample campaign or Build Day" : "sample product", lab ? "sample campaigns and Build Days" : undefined)} {lab ? "(plus two sample members with their own Profit Path)" : "in the library"}.</p>
            {seedProgress && (
              <div>
                <Progress value={(seedProgress.done / seedProgress.total) * 100} />
                <p className="mt-1 text-xs text-muted-foreground">{seedProgress.label}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!!busy || !stats?.samples}
                loading={busy === "remove"}
                onClick={async () => {
                  if (!(await confirm({ title: "Remove all sample content?", description: lab ? "Sample campaigns, Build Days, courses, resources and the two sample members (with their plans and progress) are deleted along with their files." : "Sample products, drops, courses and resources are deleted along with their files.", confirmLabel: "Remove samples", destructive: true }))) return;
                  setBusy("remove");
                  try {
                    const n = await removeSampleContent(m.brandId);
                    toast.success(`Removed ${plural(n, "sample item")}`);
                  } catch (e) {
                    toast.error(errorMessage(e));
                  } finally {
                    setBusy(null);
                  }
                }}
                data-testid="remove-samples"
              >
                <Trash2 /> Remove sample content
              </Button>
              <Button
                variant="outline"
                disabled={!!busy}
                loading={busy === "reset"}
                onClick={async () => {
                  if (!(await confirm({ title: "Recreate the sample library?", description: "Existing sample items are replaced with fresh copies. Your own products are kept.", confirmLabel: "Recreate samples" }))) return;
                  setBusy("reset");
                  try {
                    const s = await resetSampleContent(m.brandId, { onProgress: (label, done, total) => setSeedProgress({ label, done, total }) });
                    toast.success(lab ? `Created ${plural(s.campaigns ?? 0, "sample campaign")} and ${plural(s.buildDays ?? 0, "Build Day")}` : `Created ${plural(s.products, "sample product")}`);
                  } catch (e) {
                    toast.error(errorMessage(e));
                  } finally {
                    setBusy(null);
                    setSeedProgress(null);
                  }
                }}
              >
                <RotateCcw /> Recreate sample library
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="size-4" /> Erase {m.brand.name} membership data
            </CardTitle>
            <CardDescription>Deletes this brand&apos;s library, files and member activity from this browser. Download a backup first.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              disabled={!!busy}
              onClick={async () => {
                if (!(await confirm({ title: `Erase all ${m.brand.name} membership data?`, description: "This can't be undone. Studio projects and other brands are not affected.", confirmLabel: "Erase", destructive: true, typeToConfirm: "ERASE" }))) return;
                setBusy("erase");
                try {
                  const r = getMembershipRepos();
                  const b = m.brandId;
                  const repos = [r.products, r.categories, r.releases, r.courses, r.resources, r.downloads, r.progress, r.favourites, r.campaigns, r.buildDays, r.labProfiles, r.labProgress] as const;
                  const lists = await Promise.all(repos.map((repo) => repo.list(b)));
                  const files = (await r.files.listMeta()).filter((f) => f.brandId === b);
                  await r.transaction(async () => {
                    for (const [i, list] of lists.entries()) for (const row of list) await repos[i].delete(row.id);
                    for (const f of files) await r.files.delete(f.id);
                    // Keep the sample library from being re-added automatically.
                    await r.kv.set(`seed:${b}`, { version: 1, at: new Date().toISOString(), erased: true });
                  });
                  toast.success("Membership data erased");
                } catch (e) {
                  toast.error(errorMessage(e));
                } finally {
                  setBusy(null);
                }
              }}
            >
              <Trash2 /> Erase membership data
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, FileUp, Plus, Quote, Scale, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/data/types";
import type { LicenceType, RightCheck, RightGroup, RightsReviewData, RightStatus } from "@/lib/models/research";
import { LICENCE_TYPE_LABELS, RIGHT_STATUS_LABELS } from "@/lib/models/research";
import { automaticWarnings, findClauses, rightsReport, rightsSummary } from "@/lib/research/rights";
import { importFile, ACCEPTED_IMPORT } from "@/lib/import";
import { docText } from "@/lib/doc/text";
import { markdownToDoc } from "@/lib/doc/parse";
import { exportDocument } from "@/lib/export/document";
import { loadDocExportOptions } from "@/components/common/doc-export";
import { safeFileName, textFile } from "@/lib/export/download";
import { storeFile } from "@/lib/services/files";
import { createAsset } from "@/lib/services/assets";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Card, Checkbox, Field, Input, NativeSelect, Progress, Textarea } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger, Tooltip } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { AssetWorkspace } from "@/components/common/asset-workspace";
import { ExportMenu } from "@/components/common/export-menu";
import type { AssetEditor } from "@/features/common/use-asset-editor";
import { cn, errorMessage, formatDate } from "@/lib/utils";

const GROUP_LABELS: Record<RightGroup, { title: string; hint: string }> = {
  permitted: { title: "Permitted uses", hint: "How you may use and sell the content." },
  restricted: { title: "Restricted uses", hint: "Uses the licence specifically prohibits." },
  modification: { title: "Modification rights", hint: "What you may change, and whether you may claim authorship." },
  resale: { title: "Resale rights", hint: "What you may pass on to your buyers — never assume Master Resell Rights." },
  distribution: { title: "Distribution restrictions", hint: "Where and how the content may (not) be distributed." },
  attribution: { title: "Attribution & other assets", hint: "Credits, images and graphics." },
};

const STATUS_STYLE: Record<RightStatus, string> = {
  "not-reviewed": "border-border bg-card text-muted-foreground",
  allowed: "border-green-300 bg-green-50 text-green-800",
  "not-allowed": "border-red-300 bg-red-50 text-red-800",
  conditional: "border-amber-300 bg-amber-50 text-amber-900",
  unclear: "border-violet-300 bg-violet-50 text-violet-900",
};

function CheckRow({ c, licenceText, onChange }: { c: RightCheck; licenceText: string; onChange: (p: Partial<RightCheck>) => void }) {
  const [open, setOpen] = React.useState(false);
  const matches = React.useMemo(() => (open ? findClauses(licenceText, c.key) : []), [open, licenceText, c.key]);
  return (
    <li className="rounded-lg border p-3" data-testid={`right-${c.key}`}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium">{c.label}</p>
          {c.help && <p className="text-[12px] text-muted-foreground">{c.help}</p>}
        </div>
        <NativeSelect value={c.status} onChange={(e) => onChange({ status: e.target.value as RightStatus })} className={cn("h-8 w-44 text-xs font-medium", STATUS_STYLE[c.status])} aria-label={`${c.label} status`}>
          {Object.entries(RIGHT_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Input value={c.evidence} onChange={(e) => onChange({ evidence: e.target.value })} placeholder="Quote the licence wording (evidence)" className="h-8 text-xs" aria-label="Evidence" />
        <Input value={c.notes} onChange={(e) => onChange({ notes: e.target.value })} placeholder="Your notes or conditions" className="h-8 text-xs" aria-label="Notes" />
      </div>
      <button type="button" className="mt-2 text-[12px] font-medium text-primary disabled:text-muted-foreground" onClick={() => setOpen((o) => !o)} disabled={!licenceText.trim()}>
        {open ? "Hide possibly relevant wording" : licenceText.trim() ? "Find possibly relevant wording in the licence" : "Add licence text to search it"}
      </button>
      {open && (
        <div className="mt-2 grid gap-1.5">
          {matches.length ? (
            matches.map((m, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md bg-secondary/70 p-2 text-[12px]">
                <Quote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  {m.text} {m.negative && <Badge variant="warning" className="ml-1">contains a restriction word</Badge>}
                </span>
                <Button size="xs" variant="ghost" onClick={() => onChange({ evidence: m.text.slice(0, 500) })}>
                  Use as evidence
                </Button>
              </div>
            ))
          ) : (
            <p className="text-[12px] text-muted-foreground">No wording matched the search terms. That doesn&apos;t mean it&apos;s allowed — licences often only list what&apos;s permitted. Treat unmentioned rights as unclear and ask the seller.</p>
          )}
          <p className="text-[11px] text-muted-foreground">This only finds wording to read in context. You decide the status.</p>
        </div>
      )}
    </li>
  );
}

function RightsEditor({ editor, project }: { editor: AssetEditor<"rights-review">; project: Project }) {
  const d = editor.data!;
  const set = (p: Partial<RightsReviewData>) => editor.update((x) => ({ ...x, ...p }));
  const setSource = (p: Partial<RightsReviewData["source"]>) => editor.update((x) => ({ ...x, source: { ...x.source, ...p } }));
  const patchCheck = (id: string, p: Partial<RightCheck>) => editor.update((x) => ({ ...x, checks: x.checks.map((c) => (c.id === id ? { ...c, ...p } : c)) }));
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [importing, setImporting] = React.useState(false);
  const [newWarning, setNewWarning] = React.useState("");
  const confirm = useConfirm();
  const summary = rightsSummary(d);
  const auto = automaticWarnings(d);
  const doneCount = d.checklist.filter((c) => c.done).length;

  const importLicence = async (f: File) => {
    setImporting(true);
    try {
      const r = await importFile(f);
      const text = docText(r.doc).trim();
      if (!text) throw new Error(r.warnings[0] ?? "No text could be read from that file.");
      if (d.licenceText.trim() && !(await confirm({ title: "Replace the saved licence text?", description: "The current licence text will be replaced with the text from this file. A version is kept in history.", confirmLabel: "Replace" }))) return;
      const stored = await storeFile(r.blob, { name: f.name, projectId: project.id, kind: "licence", fingerprint: r.fingerprint });
      set({ licenceText: text, licenceFileId: stored.id, licenceName: d.licenceName || f.name.replace(/\.[^.]+$/, "") });
      toast.success(`Imported licence text from ${f.name}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setImporting(false);
    }
  };

  const groups = Object.keys(GROUP_LABELS) as RightGroup[];
  return (
    <div className="mx-auto grid grid-cols-[minmax(0,1fr)] w-full max-w-[1400px] gap-5 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-5">
        <Callout tone="neutral" icon={<Scale />} title="Your record, not legal advice">
          This workspace helps you record what the licence says and check it before you sell. It does not decide what&apos;s allowed. When wording is unclear, ask the seller or a qualified adviser — and never assume Master Resell Rights are included.
        </Callout>
        <Tabs defaultValue="licence">
          <TabsList>
            <TabsTrigger value="licence">Licence &amp; source</TabsTrigger>
            <TabsTrigger value="rights">
              Rights ({summary.reviewed}/{summary.total})
            </TabsTrigger>
            <TabsTrigger value="notes">Notes &amp; warnings</TabsTrigger>
          </TabsList>
          <TabsContent value="licence" className="mt-4 grid gap-5">
            <Card className="grid gap-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Licence name" htmlFor="r-name">
                  <Input id="r-name" value={d.licenceName} onChange={(e) => set({ licenceName: e.target.value })} placeholder="e.g. Standard PLR licence" />
                </Field>
                <Field label="Licence type (as stated in the licence)" htmlFor="r-type">
                  <NativeSelect id="r-type" value={d.licenceType} onChange={(e) => set({ licenceType: e.target.value as LicenceType })} data-testid="licence-type">
                    {Object.entries(LICENCE_TYPE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Vendor / seller" htmlFor="r-vendor">
                  <Input id="r-vendor" value={d.source.vendor} onChange={(e) => setSource({ vendor: e.target.value })} />
                </Field>
                <Field label="Product as purchased" htmlFor="r-prod">
                  <Input id="r-prod" value={d.source.productName} onChange={(e) => setSource({ productName: e.target.value })} />
                </Field>
                <Field label="Purchase date" htmlFor="r-date">
                  <Input id="r-date" type="date" value={d.source.purchaseDate} onChange={(e) => setSource({ purchaseDate: e.target.value })} />
                </Field>
                <Field label="Order / receipt reference" htmlFor="r-order">
                  <Input id="r-order" value={d.source.orderRef} onChange={(e) => setSource({ orderRef: e.target.value })} />
                </Field>
                <Field label="Licence or product URL" htmlFor="r-url" optional>
                  <Input id="r-url" value={d.source.url} onChange={(e) => setSource({ url: e.target.value })} placeholder="https://" />
                </Field>
              </div>
              <Field label="Source licence notes" htmlFor="r-snotes" optional hint="Anything the seller told you outside the licence (support replies, sales page wording).">
                <Textarea id="r-snotes" rows={2} value={d.source.notes} onChange={(e) => setSource({ notes: e.target.value })} />
              </Field>
            </Card>
            <Card className="grid gap-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">Licence text</p>
                {d.licenceFileId && <Badge variant="secondary">File saved</Badge>}
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => fileRef.current?.click()} loading={importing} data-testid="licence-import">
                  <FileUp /> Import licence file
                </Button>
              </div>
              <Textarea value={d.licenceText} onChange={(e) => set({ licenceText: e.target.value })} rows={14} placeholder="Paste the full licence terms here, or import the licence file (DOCX, PDF, TXT, Markdown or HTML)." className="font-mono text-[12.5px] leading-relaxed" data-testid="licence-text" />
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_IMPORT}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void importLicence(f);
                }}
              />
            </Card>
          </TabsContent>
          <TabsContent value="rights" className="mt-4 grid gap-5">
            {groups.filter((g) => d.checks.some((c) => c.group === g)).map((g) => (
              <Card key={g} className="grid gap-3 p-5">
                <div>
                  <p className="text-sm font-semibold">{GROUP_LABELS[g].title}</p>
                  <p className="text-xs text-muted-foreground">{GROUP_LABELS[g].hint}</p>
                </div>
                <ul className="grid gap-2">
                  {d.checks
                    .filter((c) => c.group === g)
                    .map((c) => (
                      <CheckRow key={c.id} c={c} licenceText={d.licenceText} onChange={(p) => patchCheck(c.id, p)} />
                    ))}
                </ul>
              </Card>
            ))}
          </TabsContent>
          <TabsContent value="notes" className="mt-4 grid gap-5">
            <Card className="grid gap-4 p-5">
              <Field label="Attribution requirements" htmlFor="r-attr">
                <Textarea id="r-attr" rows={2} value={d.attribution} onChange={(e) => set({ attribution: e.target.value })} placeholder="e.g. None stated / Must credit the original author in the copyright notice" />
              </Field>
              <Field label="Resale rights notes" htmlFor="r-resale">
                <Textarea id="r-resale" rows={2} value={d.resaleNotes} onChange={(e) => set({ resaleNotes: e.target.value })} placeholder="What you may pass to buyers. Write “None” if no resale rights are granted." />
              </Field>
              <Field label="Modification rights" htmlFor="r-mod">
                <Textarea id="r-mod" rows={2} value={d.modificationNotes} onChange={(e) => set({ modificationNotes: e.target.value })} />
              </Field>
              <Field label="Distribution restrictions" htmlFor="r-dist">
                <Textarea id="r-dist" rows={2} value={d.distributionNotes} onChange={(e) => set({ distributionNotes: e.target.value })} />
              </Field>
            </Card>
            <Card className="grid gap-3 p-5">
              <p className="text-sm font-semibold">Product-specific warnings</p>
              <ul className="grid gap-1.5">
                {d.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-[13px] text-amber-900">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span className="flex-1">{w}</span>
                    <button type="button" onClick={() => set({ warnings: d.warnings.filter((_, j) => j !== i) })} aria-label="Remove warning">
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newWarning.trim()) return;
                  set({ warnings: [...d.warnings, newWarning.trim()] });
                  setNewWarning("");
                }}
              >
                <Input value={newWarning} onChange={(e) => setNewWarning(e.target.value)} placeholder="e.g. Images are personal-use only — replace before selling" className="h-9" />
                <Button type="submit" size="sm" variant="outline">
                  <Plus /> Add
                </Button>
              </form>
            </Card>
            <Card className="grid gap-2 p-5">
              <Field label="Your summary" htmlFor="r-sum" hint="In your own words: what you plan to do with this product and why the licence allows it.">
                <Textarea id="r-sum" rows={3} value={d.summary} onChange={(e) => set({ summary: e.target.value })} />
              </Field>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <aside className="grid content-start gap-4">
        <Card className="grid gap-3 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            <p className="text-sm font-semibold">Status</p>
            {d.reviewedAt ? <Badge variant="success" className="ml-auto">Reviewed {formatDate(d.reviewedAt)}</Badge> : <Badge variant="warning" className="ml-auto">Not reviewed</Badge>}
          </div>
          <Progress value={(summary.reviewed / Math.max(1, summary.total)) * 100} />
          <p className="text-xs text-muted-foreground">
            {summary.reviewed} of {summary.total} rights recorded
          </p>
          <div className="grid grid-cols-2 gap-1.5 text-[12px]">
            {(["allowed", "conditional", "not-allowed", "unclear"] as RightStatus[]).map((s) => (
              <span key={s} className={cn("rounded-md border px-2 py-1", STATUS_STYLE[s])}>
                {RIGHT_STATUS_LABELS[s]}: <b>{summary.counts[s]}</b>
              </span>
            ))}
          </div>
        </Card>
        {(summary.byStatus["not-allowed"].length > 0 || summary.byStatus.conditional.length > 0) && (
          <Card className="grid gap-2 p-4" data-testid="restricted-uses">
            <p className="text-sm font-semibold">Restricted uses</p>
            {summary.byStatus["not-allowed"].map((c) => (
              <p key={c.id} className="text-[12.5px] text-red-800">✕ {c.label}</p>
            ))}
            {summary.byStatus.conditional.map((c) => (
              <p key={c.id} className="text-[12.5px] text-amber-900">
                ◐ {c.label}
                {c.notes ? ` — ${c.notes}` : ""}
              </p>
            ))}
          </Card>
        )}
        {auto.length > 0 && (
          <Card className="grid gap-2 p-4" data-testid="auto-warnings">
            <p className="text-sm font-semibold">Things to check</p>
            {auto.map((w, i) => (
              <p key={i} className="flex gap-2 text-[12.5px] leading-snug text-amber-900">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {w}
              </p>
            ))}
          </Card>
        )}
        <Card className="grid gap-2 p-4">
          <div className="flex items-center">
            <p className="text-sm font-semibold">Before you sell</p>
            <span className="ml-auto text-xs text-muted-foreground">
              {doneCount}/{d.checklist.length}
            </span>
          </div>
          <ul className="grid gap-1.5" data-testid="presale-checklist">
            {d.checklist.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-start gap-2 text-[12.5px] leading-snug">
                  <Checkbox className="mt-0.5" checked={c.done} onCheckedChange={(v) => editor.update((x) => ({ ...x, checklist: x.checklist.map((i) => (i.id === c.id ? { ...i, done: !!v } : i)) }))} />
                  <span className={cn(c.done && "text-muted-foreground line-through")}>{c.label}</span>
                </label>
              </li>
            ))}
          </ul>
          {d.reviewedAt ? (
            <Button size="sm" variant="ghost" onClick={() => set({ reviewedAt: null })}>
              Mark as not reviewed
            </Button>
          ) : (
            <Tooltip content={doneCount < d.checklist.length ? "Tick every checklist item first" : "Record today's date as your review date"}>
              <span>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={doneCount < d.checklist.length}
                  onClick={() => {
                    set({ reviewedAt: new Date().toISOString() });
                    toast.success("Marked as reviewed");
                  }}
                  data-testid="mark-reviewed"
                >
                  <CheckCircle2 /> Mark licence as reviewed
                </Button>
              </span>
            </Tooltip>
          )}
        </Card>
      </aside>
    </div>
  );
}

async function exportRights(d: RightsReviewData, title: string, format: "md" | "docx" | "pdf") {
  const md = rightsReport(d, title);
  if (format === "md") return textFile(md, safeFileName(title, "md"), "text/markdown");
  return exportDocument({ title, chapters: [{ title: "Licence review", content: markdownToDoc(md.replace(/^# .*\n/, "")) }] }, format, { ...loadDocExportOptions(), toc: false });
}

export function RightsReview({ project }: { project: Project }) {
  return (
    <AssetWorkspace
      project={project}
      type="rights-review"
      tool="PLR Rights Review"
      eyebrow="Research Studio"
      icon={<Scale />}
      description="Record and review each PLR licence before you sell: licence text, permitted and restricted uses, modification and resale rights, distribution limits, attribution and a pre-sale checklist."
      createLabel="New licence review"
      onCreate={async () => (await createAsset(project.id, "rights-review", { title: "Licence review" })).id}
      itemMeta={(a) => {
        const s = rightsSummary(a.data);
        return `${LICENCE_TYPE_LABELS[a.data.licenceType]} · ${s.reviewed}/${s.total} rights recorded${a.data.reviewedAt ? " · reviewed" : ""}`;
      }}
      renderEditor={(editor) => <RightsEditor editor={editor} project={project} />}
      versionText={(x) => rightsReport(x as RightsReviewData, "Version")}
      headerActions={(editor) => (
        <ExportMenu
          projectId={project.id}
          assetId={editor.asset!.id}
          assetLabel={editor.title}
          beforeExport={editor.save}
          options={[
            { id: "pdf", label: "PDF report", run: () => exportRights(editor.getData()!, editor.title, "pdf") },
            { id: "docx", label: "Word (.docx)", run: () => exportRights(editor.getData()!, editor.title, "docx") },
            { id: "md", label: "Markdown", run: () => exportRights(editor.getData()!, editor.title, "md") },
          ]}
        />
      )}
    />
  );
}


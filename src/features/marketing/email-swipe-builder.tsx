"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Check, Copy, LayoutTemplate, Mail, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/data/types";
import type { EmailCampaignData, EmailItem, EmailSequenceType } from "@/lib/models/marketing";
import { EMAIL_SEQUENCE_LABELS } from "@/lib/models/marketing";
import { campaignCsv, campaignMarkdown, campaignText, dayLabel, sortEmails, templateEmails, type EmailContext } from "@/lib/marketing/emails";
import { useAITask, useAIStatus, parseJsonLoose } from "@/lib/ai/client";
import { useAssets, useBrandKit } from "@/lib/data/hooks";
import { createAsset } from "@/lib/services/assets";
import { markdownToDoc } from "@/lib/doc/parse";
import { exportDocument } from "@/lib/export/document";
import { safeFileName, textFile } from "@/lib/export/download";
import { loadDocExportOptions } from "@/components/common/doc-export";
import { Button } from "@/components/ui/button";
import { Badge, Callout, EmptyState, Field, Input, NativeSelect, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Tooltip } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { AssetWorkspace } from "@/components/common/asset-workspace";
import { ExportMenu } from "@/components/common/export-menu";
import { AIRunStatus, AIUsageLine, useBrief } from "@/components/common/ai";
import type { AssetEditor } from "@/features/common/use-asset-editor";
import { cn, errorMessage, uid } from "@/lib/utils";

function useEmailContext(project: Project, d: EmailCampaignData): EmailContext {
  const { data: docs } = useAssets<"document">(project.id, "document");
  const { data: kit } = useBrandKit(project.brandKitId);
  return React.useMemo(() => {
    const main = docs?.find((x) => x.id === project.mainDocumentId) ?? docs?.[0];
    return {
      productName: main?.title || project.name.replace(/^SAMPLE\s*[—-]\s*/i, ""),
      audience: project.audience,
      outcome: "",
      fromName: d.fromName || kit?.authorName || "",
      topics: (main?.data.chapters ?? []).map((c) => c.title.replace(/^(chapter|part|section)\s+\w+\s*[:.\-–—]\s*/i, "")).slice(0, 6),
      price: project.plannedPrice !== null ? String(project.plannedPrice) : "",
    };
  }, [docs, kit, project, d.fromName]);
}

function EmailEditorPane({ e, update }: { e: EmailItem; update: (p: Partial<EmailItem>) => void }) {
  return (
    <div className="grid gap-4" data-testid="email-editor">
      <div className="grid grid-cols-[120px_1fr] gap-3">
        <Field label="Send on day" hint="Days after the sequence starts (negative = before).">
          <Input type="number" value={e.day} onChange={(x) => update({ day: Math.round(Number(x.target.value) || 0) })} min={-30} max={365} />
        </Field>
        <Field label="Subject line">
          <Input value={e.subject} onChange={(x) => update({ subject: x.target.value })} className="font-medium" data-testid="email-subject" />
        </Field>
      </div>
      <Field label="Alternative subject lines" hint="One per line — useful for A/B tests.">
        <Textarea rows={2} value={e.altSubjects.join("\n")} onChange={(x) => update({ altSubjects: x.target.value.split("\n") })} onBlur={() => update({ altSubjects: e.altSubjects.map((s) => s.trim()).filter(Boolean) })} />
      </Field>
      {e.altSubjects.filter(Boolean).length > 0 && (
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {e.altSubjects.filter(Boolean).map((s, i) => (
            <button key={i} type="button" onClick={() => update({ subject: s, altSubjects: [e.subject, ...e.altSubjects.filter((x) => x !== s)].filter(Boolean) })} className="rounded-full border px-2.5 py-0.5 text-[11px] hover:border-primary hover:text-primary">
              Use “{s.length > 40 ? `${s.slice(0, 40)}…` : s}”
            </button>
          ))}
        </div>
      )}
      <Field label={`Preview text (${e.preview.length}/90)`} hint="Shown next to the subject in most inboxes." error={e.preview.length > 110 ? "Preview text over ~110 characters is usually cut off." : undefined}>
        <Input value={e.preview} onChange={(x) => update({ preview: x.target.value })} />
      </Field>
      <Field label="Email body" hint="Plain text. Leave a blank line between paragraphs. [Placeholders] mark details only you can fill in.">
        <Textarea rows={14} value={e.body} onChange={(x) => update({ body: x.target.value })} className="font-mono text-[13px] leading-relaxed" data-testid="email-body" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Button / link text" optional>
          <Input value={e.ctaText} onChange={(x) => update({ ctaText: x.target.value })} />
        </Field>
        <Field label="Button link" optional>
          <Input value={e.ctaUrl} onChange={(x) => update({ ctaUrl: x.target.value.trim() })} placeholder="https://" />
        </Field>
      </div>
      <Field label="Notes" optional>
        <Input value={e.notes} onChange={(x) => update({ notes: x.target.value })} placeholder="e.g. Send only to non-buyers" />
      </Field>
    </div>
  );
}

function InboxPreview({ e, fromName }: { e: EmailItem; fromName: string }) {
  const placeholders = (e.subject + e.body + e.preview).match(/\[[^\]]+\]/g)?.length ?? 0;
  return (
    <div className="grid gap-3">
      <div className="rounded-xl border bg-card p-3 shadow-sm">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Inbox view</p>
        <div className="mt-2 flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">{(fromName || "Y")[0]?.toUpperCase()}</span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">{fromName || "Your name"}</p>
            <p className="truncate text-[13px]">
              <b>{e.subject || "(no subject)"}</b> <span className="text-muted-foreground">— {e.preview}</span>
            </p>
          </div>
        </div>
      </div>
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <p className="whitespace-pre-line text-[14px] leading-relaxed">{e.body}</p>
        {e.ctaText && <span className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{e.ctaText}</span>}
      </div>
      {placeholders > 0 && <Callout tone="warning">{placeholders} placeholder{placeholders === 1 ? "" : "s"} in [brackets] still need your details before sending.</Callout>}
    </div>
  );
}

function CampaignEditor({ editor, project }: { editor: AssetEditor<"email-campaign">; project: Project }) {
  const d = editor.data!;
  const set = (p: Partial<EmailCampaignData>) => editor.update((x) => ({ ...x, ...p }));
  const ordered = sortEmails(d.emails);
  const [selectedId, setSelectedId] = React.useState<string | null>(ordered[0]?.id ?? null);
  const selected = d.emails.find((e) => e.id === selectedId) ?? ordered[0] ?? null;
  const context = useEmailContext(project, d);
  const { configured } = useAIStatus();
  const ai = useAITask("marketing.emails");
  const brief = useBrief(project.id);
  const confirm = useConfirm();
  const [count, setCount] = React.useState(5);
  const [extra, setExtra] = React.useState("");
  const [proposal, setProposal] = React.useState<EmailItem[] | null>(null);
  const updateEmail = (id: string, p: Partial<EmailItem>) => editor.update((x) => ({ ...x, emails: x.emails.map((e) => (e.id === id ? { ...e, ...p } : e)) }));

  const addTemplate = async () => {
    const list = templateEmails(d.sequenceType, context, d.defaultCtaUrl);
    if (d.emails.length) {
      const replace = await confirm({ title: "Replace the current emails?", description: `This sequence already has ${d.emails.length} email${d.emails.length === 1 ? "" : "s"}. Replacing keeps a version in history; or cancel and use “Add email” instead.`, confirmLabel: "Replace with template" });
      if (!replace) return;
      await editor.snapshot("Before replacing emails with a template", "pre-apply");
    }
    set({ emails: list });
    setSelectedId(list[0]?.id ?? null);
    toast.success(`${list.length} template emails added — fill in the [placeholders]`);
  };

  const runAI = async () => {
    const r = await ai.run({ sequence: d.sequenceType, count, ctaUrl: d.defaultCtaUrl, extra: [d.goal && `Goal: ${d.goal}`, extra].filter(Boolean).join("\n"), brief: { ...brief, author: d.fromName || brief.author } }, project.id);
    if (!r) return;
    try {
      const arr = parseJsonLoose<Partial<EmailItem>[]>(r.text);
      const list = (Array.isArray(arr) ? arr : [])
        .filter((x) => x && (x.subject || x.body))
        .map((x, i) => ({ id: uid("em"), day: Number.isFinite(Number(x.day)) ? Math.round(Number(x.day)) : i * 2, subject: String(x.subject ?? ""), altSubjects: Array.isArray(x.altSubjects) ? x.altSubjects.map(String) : [], preview: String(x.preview ?? ""), body: String(x.body ?? ""), ctaText: String(x.ctaText ?? ""), ctaUrl: x.ctaText ? d.defaultCtaUrl : "", notes: "" }));
      if (!list.length) throw new Error("The AI response didn't contain any emails. Try again.");
      setProposal(list);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const applyProposal = async (mode: "append" | "replace") => {
    if (!proposal) return;
    if (mode === "replace" && d.emails.length) await editor.snapshot("Before replacing emails with AI drafts", "pre-ai");
    set({ emails: mode === "replace" ? proposal : [...d.emails, ...proposal] });
    setSelectedId(proposal[0].id);
    setProposal(null);
    toast.success(mode === "replace" ? "Sequence replaced" : `${proposal.length} emails added`);
  };

  return (
    <div className="flex min-h-full flex-col lg:h-full lg:min-h-0 lg:flex-row">
      <aside className="plr-scroll flex w-full shrink-0 flex-col gap-3 border-b bg-card p-3 lg:w-[300px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <Field label="Sequence type">
          <NativeSelect value={d.sequenceType} onChange={(e) => set({ sequenceType: e.target.value as EmailSequenceType })} data-testid="email-sequence-type">
            {Object.entries(EMAIL_SEQUENCE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Goal" optional>
          <Input value={d.goal} onChange={(e) => set({ goal: e.target.value })} placeholder="e.g. Sell the workbook to new subscribers" className="h-8 text-sm" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="From name">
            <Input value={d.fromName} onChange={(e) => set({ fromName: e.target.value })} placeholder={context.fromName || "Your name"} className="h-8 text-sm" />
          </Field>
          <Field label="Default link">
            <Input value={d.defaultCtaUrl} onChange={(e) => set({ defaultCtaUrl: e.target.value.trim() })} placeholder="https://" className="h-8 text-sm" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" onClick={() => void addTemplate()} data-testid="email-template">
            <LayoutTemplate /> Template
          </Button>
          <Tooltip content={configured ? "Draft the whole sequence with AI — review before applying" : "Configure AI in Settings to enable"}>
            <span>
              <Button size="sm" variant="gradient" className="w-full" onClick={() => void runAI()} disabled={!configured || ai.running} data-testid="email-ai">
                <Sparkles /> AI draft
              </Button>
            </span>
          </Tooltip>
        </div>
        <div className="grid grid-cols-[80px_1fr] gap-2">
          <Input type="number" min={1} max={14} value={count} onChange={(e) => setCount(Math.max(1, Math.min(14, Number(e.target.value) || 1)))} className="h-8 text-xs" aria-label="Number of emails for AI" />
          <Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="AI instructions (optional)" className="h-8 text-xs" />
        </div>
        <AIRunStatus running={ai.running} error={ai.error} onCancel={ai.cancel} onRetry={() => void ai.retry()} label="Writing emails…" />
        <div className="mt-1 flex items-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sequence ({d.emails.length})</p>
          <Button
            size="xs"
            variant="ghost"
            className="ml-auto"
            onClick={() => {
              const last = ordered[ordered.length - 1];
              const e: EmailItem = { id: uid("em"), day: last ? last.day + 1 : 0, subject: "", altSubjects: [], preview: "", body: "Hi [First name],\n\n", ctaText: "", ctaUrl: d.defaultCtaUrl, notes: "" };
              set({ emails: [...d.emails, e] });
              setSelectedId(e.id);
            }}
            data-testid="email-add"
          >
            <Plus /> Add email
          </Button>
        </div>
        <ol className="grid gap-1.5" data-testid="email-list">
          {ordered.map((e, i) => (
            <li key={e.id} className={cn("group flex items-start gap-2 rounded-lg border p-2", e.id === selected?.id ? "border-primary bg-primary-soft" : "hover:border-primary/40")}>
              <button type="button" onClick={() => setSelectedId(e.id)} className="min-w-0 flex-1 text-left">
                <span className="block text-[11px] font-medium text-muted-foreground">
                  {i + 1}. {dayLabel(e.day)}
                </span>
                <span className="block truncate text-[13px] font-medium">{e.subject || "(no subject)"}</span>
              </button>
              <div className="flex flex-col opacity-60 group-hover:opacity-100">
                <button type="button" onClick={() => updateEmail(e.id, { day: e.day - 1 })} aria-label="Send a day earlier">
                  <ArrowUp className="size-3.5" />
                </button>
                <button type="button" onClick={() => updateEmail(e.id, { day: e.day + 1 })} aria-label="Send a day later">
                  <ArrowDown className="size-3.5" />
                </button>
              </div>
              <div className="flex flex-col gap-1 opacity-60 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => {
                    const c = { ...e, id: uid("em"), subject: `${e.subject} (copy)` };
                    set({ emails: [...d.emails, c] });
                    setSelectedId(c.id);
                  }}
                  aria-label="Duplicate email"
                >
                  <Copy className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (await confirm({ title: "Delete this email?", confirmLabel: "Delete", destructive: true })) set({ emails: d.emails.filter((x) => x.id !== e.id) });
                  }}
                  aria-label="Delete email"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      </aside>
      <section className="plr-scroll min-w-0 flex-1 p-4 sm:p-5 lg:overflow-y-auto">
        {proposal ? (
          <div className="grid gap-3" data-testid="email-proposal">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="ai">
                <Sparkles /> AI drafts
              </Badge>
              <p className="text-sm text-muted-foreground">{proposal.length} emails — nothing has changed yet.</p>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setProposal(null)}>
                  Discard
                </Button>
                {d.emails.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => void applyProposal("append")}>
                    Add to sequence
                  </Button>
                )}
                <Button size="sm" onClick={() => void applyProposal("replace")} data-testid="email-proposal-apply">
                  <Check /> {d.emails.length ? "Replace sequence" : "Use these emails"}
                </Button>
              </div>
            </div>
            <AIUsageLine result={ai.result} />
            {proposal.map((e, i) => (
              <div key={e.id} className="rounded-xl border bg-card p-4">
                <p className="text-[11px] text-muted-foreground">
                  {i + 1}. {dayLabel(e.day)}
                </p>
                <p className="font-semibold">{e.subject}</p>
                <p className="mb-2 text-xs text-muted-foreground">{e.preview}</p>
                <p className="whitespace-pre-line text-[13px]">{e.body}</p>
              </div>
            ))}
          </div>
        ) : selected ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <EmailEditorPane key={selected.id} e={selected} update={(p) => updateEmail(selected.id, p)} />
            <InboxPreview e={selected} fromName={d.fromName || context.fromName} />
          </div>
        ) : (
          <EmptyState icon={<Mail />} title="No emails yet" description="Start from a template for this sequence type, draft with AI, or add emails one by one." action={<Button onClick={() => void addTemplate()}><LayoutTemplate /> Start from template</Button>} />
        )}
      </section>
    </div>
  );
}

async function exportCampaign(d: EmailCampaignData, title: string, format: "txt" | "md" | "csv" | "docx" | "html") {
  if (format === "txt") return textFile(campaignText(d, title), safeFileName(title, "txt"));
  if (format === "md") return textFile(campaignMarkdown(d, title), safeFileName(title, "md"), "text/markdown");
  if (format === "csv") return textFile(campaignCsv(d), safeFileName(title, "csv"), "text/csv");
  return exportDocument({ title, subtitle: EMAIL_SEQUENCE_LABELS[d.sequenceType], chapters: [{ title: "Emails", content: markdownToDoc(campaignMarkdown(d, title).replace(/^# .*\n/, "")) }] }, format, { ...loadDocExportOptions(), toc: false });
}

function NewCampaignDialog({ project, open, onOpenChange, onCreated }: { project: Project; open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const [type, setType] = React.useState<EmailSequenceType>("launch");
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New email campaign</DialogTitle>
          <DialogDescription>Choose the kind of sequence. You can start from a template or AI draft inside.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2" data-testid="email-types">
          {Object.entries(EMAIL_SEQUENCE_LABELS).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setType(v as EmailSequenceType)} className={cn("rounded-lg border px-3 py-2 text-left text-sm", type === v ? "border-primary bg-primary-soft font-medium" : "hover:border-primary/40")}>
              {l}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const a = await createAsset(project.id, "email-campaign", { title: `${EMAIL_SEQUENCE_LABELS[type]} — ${project.name.replace(/^SAMPLE\s*[—-]\s*/i, "")}`, data: { sequenceType: type } });
                onOpenChange(false);
                onCreated(a.id);
              } finally {
                setBusy(false);
              }
            }}
            data-testid="email-create"
          >
            Create campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EmailSwipeBuilder({ project }: { project: Project }) {
  return (
    <AssetWorkspace
      project={project}
      type="email-campaign"
      tool="Email Swipe Builder"
      eyebrow="Marketing Studio"
      icon={<Mail />}
      description="Create complete email sequences — welcome, launch, sales, follow-up, broadcasts and abandoned checkout — with subject lines, preview text, body copy, calls to action and send order."
      createLabel="New campaign"
      createDialog={(p) => <NewCampaignDialog project={project} {...p} />}
      itemMeta={(a) => `${EMAIL_SEQUENCE_LABELS[a.data.sequenceType]} · ${a.data.emails.length} emails`}
      fullHeight
      renderEditor={(editor) => <CampaignEditor editor={editor} project={project} />}
      versionText={(x) => campaignText(x as EmailCampaignData, "Version")}
      headerActions={(editor) => (
        <ExportMenu
          projectId={project.id}
          assetId={editor.asset!.id}
          assetLabel={editor.title}
          beforeExport={editor.save}
          options={[
            { id: "docx", label: "Word (.docx)", run: () => exportCampaign(editor.getData()!, editor.title, "docx") },
            { id: "txt", label: "Plain text (.txt)", run: () => exportCampaign(editor.getData()!, editor.title, "txt") },
            { id: "md", label: "Markdown", run: () => exportCampaign(editor.getData()!, editor.title, "md") },
            { id: "csv", label: "CSV (for email tools)", run: () => exportCampaign(editor.getData()!, editor.title, "csv") },
            { id: "html", label: "HTML document", run: () => exportCampaign(editor.getData()!, editor.title, "html") },
          ]}
        />
      )}
    />
  );
}

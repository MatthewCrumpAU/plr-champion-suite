"use client";

import * as React from "react";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Eye, EyeOff, GripVertical, LayoutTemplate, Monitor, Palette, Plus, Presentation, Settings2, Smartphone, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/data/types";
import type { SalesItem, SalesPageData, SalesSection, SalesSectionType } from "@/lib/models/marketing";
import { SALES_SECTION_LABELS } from "@/lib/models/marketing";
import { SALES_SECTION_ORDER, defaultSalesPageData } from "@/lib/models/defaults";
import { getRepos } from "@/lib/data";
import { newSectionFromTemplate, outcomeFrom, salesPageDoc, salesPageHtml, salesTemplate, sectionIsEmpty, type SalesContext } from "@/lib/marketing/sales";
import { useAITask, useAIStatus, parseJsonLoose } from "@/lib/ai/client";
import { useAssets, useBrandKit, useBrandKits } from "@/lib/data/hooks";
import { salesHeroImage } from "@/lib/marketing/sales-hero";
import { appFontFaceCss, googleFontsLink } from "@/lib/client/font-css";
import { createAsset } from "@/lib/services/assets";
import { exportDocument } from "@/lib/export/document";
import { safeFileName, textFile } from "@/lib/export/download";
import { docToMarkdown } from "@/lib/doc/markdown";
import { loadDocExportOptions } from "@/components/common/doc-export";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Field, Input, Label, NativeSelect, Switch, Textarea } from "@/components/ui/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, Sheet, SheetContent, SheetDescription, SheetTitle, Tooltip } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { AssetWorkspace } from "@/components/common/asset-workspace";
import { ExportMenu } from "@/components/common/export-menu";
import { ColorField, FontSelect } from "@/components/common/design-fields";
import { AIRunStatus, AIUsageLine, useBrief } from "@/components/common/ai";
import type { AssetEditor } from "@/features/common/use-asset-editor";
import { cn, errorMessage, uid } from "@/lib/utils";

type FieldKey = "heading" | "subheading" | "body" | "bullets" | "items" | "options" | "button";
const FIELDS: Record<SalesSectionType, FieldKey[]> = {
  headline: ["heading", "subheading", "options"],
  subheadline: ["heading", "options"],
  problem: ["heading", "body", "bullets"],
  introduction: ["heading", "subheading", "body"],
  benefits: ["heading", "body", "bullets"],
  features: ["heading", "items"],
  included: ["heading", "items"],
  bonuses: ["heading", "items"],
  pricing: ["heading", "body", "bullets", "button"],
  faq: ["heading", "items"],
  cta: ["heading", "body", "button"],
  guarantee: ["heading", "body"],
};
const ITEM_LABELS: Partial<Record<SalesSectionType, [string, string]>> = { faq: ["Question", "Answer"], features: ["Feature", "What it does for the reader"], included: ["Component", "Description"], bonuses: ["Bonus", "Description"] };

function useSalesContext(project: Project, d: SalesPageData): SalesContext {
  const { data: docs } = useAssets<"document">(project.id, "document");
  return React.useMemo(() => {
    const main = docs?.find((x) => x.id === project.mainDocumentId) ?? docs?.find((x) => x.data.role === "main");
    const included = (docs ?? []).filter((x) => x.data.role === "main" || x.data.role === "product" || x.data.role === "rebrand").map((x) => x.title);
    const bonuses = (docs ?? []).filter((x) => x.data.role === "bonus").map((x) => x.title);
    return {
      productName: d.productName || main?.title || project.name.replace(/^SAMPLE\s*[—-]\s*/i, ""),
      audience: project.audience,
      outcome: outcomeFrom(main?.data.subtitle ?? ""),
      format: project.productType || "ebook",
      included: [...new Set(included)],
      bonuses,
      price: d.price.amount !== null ? String(d.price.amount) : project.plannedPrice !== null ? String(project.plannedPrice) : "",
    };
  }, [docs, project, d.productName, d.price.amount]);
}

function SortableRow({ s, active, onSelect, onToggle }: { s: SalesSection; active: boolean; onSelect: () => void; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("group flex items-center gap-1 rounded-lg border bg-card px-1.5 py-1.5", active ? "border-primary bg-primary-soft" : "hover:border-primary/40", isDragging && "z-10 shadow-lg", !s.enabled && "opacity-55")} data-testid="sales-section-row">
      <button type="button" className="cursor-grab text-muted-foreground" aria-label="Drag to reorder" {...attributes} {...listeners}>
        <GripVertical className="size-4" />
      </button>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[13px] font-medium">{SALES_SECTION_LABELS[s.type]}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{s.heading || (sectionIsEmpty(s) ? "Empty" : "—")}</span>
      </button>
      <Tooltip content={s.enabled ? "Hide on page" : "Show on page"}>
        <button type="button" onClick={onToggle} className="p-1 text-muted-foreground hover:text-foreground" aria-label={s.enabled ? "Disable section" : "Enable section"} data-testid="sales-section-toggle">
          {s.enabled ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        </button>
      </Tooltip>
    </li>
  );
}

function ItemsEditor({ items, onChange, labels }: { items: SalesItem[]; onChange: (i: SalesItem[]) => void; labels: [string, string] }) {
  return (
    <div className="grid gap-2">
      {items.map((it, idx) => (
        <div key={it.id} className="grid gap-1.5 rounded-lg border p-2.5">
          <div className="flex gap-1.5">
            <Input value={it.title} onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, title: e.target.value } : x)))} placeholder={labels[0]} className="h-8 text-sm font-medium" aria-label={labels[0]} />
            <Button size="icon-sm" variant="ghost" onClick={() => onChange(items.filter((x) => x.id !== it.id))} aria-label="Remove">
              <X />
            </Button>
          </div>
          <Textarea rows={2} value={it.text} onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)))} placeholder={labels[1]} className="text-[13px]" aria-label={`${labels[1]} ${idx + 1}`} />
        </div>
      ))}
      <Button size="sm" variant="outline" className="justify-self-start" onClick={() => onChange([...items, { id: uid("si"), title: "", text: "" }])}>
        <Plus /> Add {labels[0].toLowerCase()}
      </Button>
    </div>
  );
}

function SectionEditor({ s, update, project, context }: { s: SalesSection; update: (p: Partial<SalesSection>) => void; project: Project; context: SalesContext }) {
  const fields = FIELDS[s.type];
  const { configured } = useAIStatus();
  const ai = useAITask("marketing.sales");
  const brief = useBrief(project.id);
  const confirm = useConfirm();
  const [extra, setExtra] = React.useState("");
  const [proposal, setProposal] = React.useState<Partial<SalesSection> | null>(null);
  React.useEffect(() => setProposal(null), [s.id]);

  const fillTemplate = async () => {
    if (!sectionIsEmpty(s) && !(await confirm({ title: "Replace this section with the template?", description: "Your current wording in this section will be replaced. Earlier versions stay in version history.", confirmLabel: "Replace" }))) return;
    update(salesTemplate(s.type, context));
  };
  const runAI = async () => {
    const current = [s.heading, s.subheading, s.body, ...s.bullets, ...s.items.map((i) => `${i.title}: ${i.text}`)].filter(Boolean).join("\n").slice(0, 5500);
    const r = await ai.run({ section: s.type, included: context.included, bonuses: context.bonuses, current, extra, brief: { ...brief, productName: context.productName || brief.productName } }, project.id);
    if (!r) return;
    try {
      const j = parseJsonLoose<{ heading?: string; subheading?: string; body?: string; bullets?: string[]; items?: { title?: string; text?: string }[] }>(r.text);
      setProposal({
        heading: String(j.heading ?? ""),
        subheading: String(j.subheading ?? ""),
        body: String(j.body ?? ""),
        bullets: Array.isArray(j.bullets) ? j.bullets.map(String) : [],
        items: Array.isArray(j.items) ? j.items.map((i) => ({ id: uid("si"), title: String(i?.title ?? ""), text: String(i?.text ?? "") })) : [],
      });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="grid gap-4" data-testid="sales-section-editor">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">{SALES_SECTION_LABELS[s.type]}</h2>
        {!s.enabled && <Badge variant="secondary">Hidden</Badge>}
        <div className="ml-auto flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => void fillTemplate()} data-testid="sales-template">
            <LayoutTemplate /> Template
          </Button>
          <Tooltip content={configured ? "Draft this section with AI — you approve before anything is replaced" : "Configure AI in Settings to enable"}>
            <span>
              <Button size="sm" variant="gradient" onClick={() => void runAI()} disabled={!configured || ai.running} data-testid="sales-ai">
                <Sparkles /> Write with AI
              </Button>
            </span>
          </Tooltip>
        </div>
      </div>
      {fields.includes("heading") && (
        <Field label={s.type === "headline" ? "Headline" : s.type === "subheadline" ? "Subheadline" : "Heading"}>
          {s.type === "headline" || s.type === "subheadline" ? <Textarea rows={2} value={s.heading} onChange={(e) => update({ heading: e.target.value })} className="text-[15px] font-semibold" data-testid="sales-heading" /> : <Input value={s.heading} onChange={(e) => update({ heading: e.target.value })} data-testid="sales-heading" />}
        </Field>
      )}
      {fields.includes("subheading") && (
        <Field label={s.type === "headline" ? "Supporting line" : "Subheading"} optional>
          <Input value={s.subheading} onChange={(e) => update({ subheading: e.target.value })} />
        </Field>
      )}
      {fields.includes("options") && (
        <div className="grid gap-2">
          <Label>Options to choose from</Label>
          {s.items.map((o) => (
            <div key={o.id} className="flex items-start gap-1.5">
              <Textarea rows={2} value={o.title} onChange={(e) => update({ items: s.items.map((x) => (x.id === o.id ? { ...x, title: e.target.value } : x)) })} className="text-[13px]" />
              <div className="grid gap-1">
                <Tooltip content="Use this option">
                  <Button size="icon-sm" variant={s.heading === o.title ? "soft" : "outline"} onClick={() => update({ heading: o.title })} aria-label="Use this option">
                    <Check />
                  </Button>
                </Tooltip>
                <Button size="icon-sm" variant="ghost" onClick={() => update({ items: s.items.filter((x) => x.id !== o.id) })} aria-label="Remove option">
                  <X />
                </Button>
              </div>
            </div>
          ))}
          <Button size="sm" variant="ghost" className="justify-self-start" onClick={() => update({ items: [...s.items, { id: uid("si"), title: "", text: "" }] })}>
            <Plus /> Add option
          </Button>
        </div>
      )}
      {fields.includes("body") && (
        <Field label="Body" hint="Leave a blank line between paragraphs.">
          <Textarea rows={6} value={s.body} onChange={(e) => update({ body: e.target.value })} data-testid="sales-body" />
        </Field>
      )}
      {fields.includes("bullets") && (
        <Field label="Bullet points" hint="One per line.">
          <Textarea rows={5} value={s.bullets.join("\n")} onChange={(e) => update({ bullets: e.target.value.split("\n") })} onBlur={() => update({ bullets: s.bullets.map((b) => b.trim()).filter(Boolean) })} data-testid="sales-bullets" />
        </Field>
      )}
      {fields.includes("items") && <ItemsEditor items={s.items} onChange={(items) => update({ items })} labels={ITEM_LABELS[s.type] ?? ["Title", "Text"]} />}
      {fields.includes("button") && (
        <Field label="Button text">
          <Input value={s.buttonText} onChange={(e) => update({ buttonText: e.target.value })} />
        </Field>
      )}
      <Field label="Instructions for AI" optional>
        <Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="e.g. Friendlier tone, mention the workbook" className="h-8 text-xs" />
      </Field>
      <AIRunStatus running={ai.running} error={ai.error} onCancel={ai.cancel} onRetry={() => void ai.retry()} label="Writing this section…" />
      {proposal && (
        <div className="grid gap-2 rounded-xl border border-violet-200 bg-violet-50/60 p-3" data-testid="sales-proposal">
          <div className="flex items-center gap-2">
            <Badge variant="ai">
              <Sparkles /> AI draft
            </Badge>
            <span className="text-xs text-muted-foreground">Nothing has changed yet — review, then apply or discard.</span>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg bg-white p-3 text-[13px] leading-relaxed">
            {proposal.heading && <p className="font-semibold">{proposal.heading}</p>}
            {proposal.subheading && <p className="italic text-muted-foreground">{proposal.subheading}</p>}
            {proposal.body && <p className="whitespace-pre-line">{proposal.body}</p>}
            {!!proposal.bullets?.length && (
              <ul className="ml-4 list-disc">
                {proposal.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
            {proposal.items?.map((i) => (
              <p key={i.id}>
                <b>{i.title}</b> {i.text}
              </p>
            ))}
          </div>
          <AIUsageLine result={ai.result} />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                const p = proposal;
                if (s.type === "headline" || s.type === "subheadline") update({ items: [...(p.items ?? []).filter((i) => i.title), ...s.items.filter((i) => i.title)], heading: s.heading || p.items?.[0]?.title || p.heading || "" });
                else update({ heading: p.heading || s.heading, subheading: p.subheading ?? "", body: p.body ?? "", bullets: p.bullets ?? [], items: p.items ?? [] });
                setProposal(null);
                toast.success(s.type === "headline" || s.type === "subheadline" ? "Options added" : "Section updated");
              }}
              data-testid="sales-proposal-apply"
            >
              <Check /> {s.type === "headline" || s.type === "subheadline" ? "Add as options" : "Replace section"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setProposal(null)}>
              Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PageSettings({ d, set, project }: { d: SalesPageData; set: (p: Partial<SalesPageData>) => void; project: Project }) {
  const { data: covers } = useAssets<"cover">(project.id, "cover");
  const { data: mockups } = useAssets<"mockup">(project.id, "mockup");
  const { data: kits } = useBrandKits();
  const setTheme = (p: Partial<SalesPageData["theme"]>) => set({ theme: { ...d.theme, ...p } });
  const hero = d.mockupAssetId ? `mockup:${d.mockupAssetId}` : d.coverAssetId ? `cover:${d.coverAssetId}` : "";
  return (
    <div className="grid gap-5">
      <Field label="Product name" htmlFor="sp-name">
        <Input id="sp-name" value={d.productName} onChange={(e) => set({ productName: e.target.value })} data-testid="sales-product-name" />
      </Field>
      <div className="grid grid-cols-[1fr_100px] gap-2">
        <Field label="Price" htmlFor="sp-price">
          <Input id="sp-price" type="number" min={0} step="0.01" value={d.price.amount ?? ""} onChange={(e) => set({ price: { ...d.price, amount: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) } })} placeholder="e.g. 27" />
        </Field>
        <Field label="Currency" htmlFor="sp-cur">
          <NativeSelect id="sp-cur" value={d.price.currency} onChange={(e) => set({ price: { ...d.price, currency: e.target.value } })}>
            {["USD", "AUD", "GBP", "EUR", "CAD", "NZD"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Price label" htmlFor="sp-plabel">
        <Input id="sp-plabel" value={d.price.label} onChange={(e) => set({ price: { ...d.price, label: e.target.value } })} />
      </Field>
      <Field label="Checkout link" htmlFor="sp-url" hint="Your payment page (e.g. your cart or payment processor). Buttons link here.">
        <Input id="sp-url" value={d.checkoutUrl} onChange={(e) => set({ checkoutUrl: e.target.value.trim() })} placeholder="https://" />
      </Field>
      <Field label="Hero image" htmlFor="sp-hero">
        <NativeSelect
          id="sp-hero"
          value={hero}
          onChange={(e) => {
            const [kind, id] = e.target.value.split(":");
            set({ coverAssetId: kind === "cover" ? id : null, mockupAssetId: kind === "mockup" ? id : null });
          }}
        >
          <option value="">None</option>
          {!!mockups?.length && (
            <optgroup label="Mockups">
              {mockups.map((m) => (
                <option key={m.id} value={`mockup:${m.id}`}>
                  {m.title}
                </option>
              ))}
            </optgroup>
          )}
          {!!covers?.length && (
            <optgroup label="Covers">
              {covers.map((c) => (
                <option key={c.id} value={`cover:${c.id}`}>
                  {c.title}
                </option>
              ))}
            </optgroup>
          )}
        </NativeSelect>
      </Field>
      <div className="grid gap-3 rounded-xl border p-3">
        <div className="flex items-center gap-2">
          <Palette className="size-4 text-primary" />
          <p className="text-sm font-semibold">Look &amp; feel</p>
          {!!kits?.length && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="xs" variant="ghost" className="ml-auto">
                  Apply brand kit
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {kits.map((k) => (
                  <DropdownMenuItem key={k.id} onSelect={() => set({ brandKitId: k.id, theme: { ...d.theme, primary: k.colors.primary, accent: k.colors.accent, text: k.colors.dark, surface: k.colors.light, headingFont: k.headingFont, bodyFont: k.bodyFont } })}>
                    {k.name}
                    {k.id === project.brandKitId && <Badge className="ml-auto">Project</Badge>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Buttons" value={d.theme.primary} onChange={(c) => setTheme({ primary: c })} />
          <ColorField label="Accent" value={d.theme.accent} onChange={(c) => setTheme({ accent: c })} />
          <ColorField label="Background" value={d.theme.background} onChange={(c) => setTheme({ background: c })} />
          <ColorField label="Cards" value={d.theme.surface} onChange={(c) => setTheme({ surface: c })} />
          <ColorField label="Text" value={d.theme.text} onChange={(c) => setTheme({ text: c })} />
        </div>
        <FontSelect label="Headings" value={d.theme.headingFont} onChange={(v) => setTheme({ headingFont: v })} />
        <FontSelect label="Body text" value={d.theme.bodyFont} onChange={(v) => setTheme({ bodyFont: v })} />
        <label className="flex items-center justify-between text-[13px]">
          Rounded corners
          <Switch checked={d.theme.rounded} onCheckedChange={(v) => setTheme({ rounded: v })} />
        </label>
        <Field label={`Content width: ${d.theme.maxWidth}px`}>
          <Input type="range" min={600} max={1100} step={20} value={d.theme.maxWidth} onChange={(e) => setTheme({ maxWidth: Number(e.target.value) })} className="h-6 p-0" />
        </Field>
      </div>
    </div>
  );
}

function useHeroImage(project: Project, d: SalesPageData) {
  const { data: covers } = useAssets<"cover">(project.id, "cover");
  const { data: mockups } = useAssets<"mockup">(project.id, "mockup");
  const { data: kit } = useBrandKit(project.brandKitId);
  const [src, setSrc] = React.useState<string | null>(null);
  const cover = covers?.find((c) => c.id === d.coverAssetId);
  const mockup = mockups?.find((m) => m.id === d.mockupAssetId);
  const key = `${cover?.id}:${cover?.updatedAt}|${mockup?.id}:${mockup?.updatedAt}|${covers?.length}`;
  React.useEffect(() => {
    let active = true;
    salesHeroImage(d, covers ?? [], mockups ?? [], kit?.logoFileId ?? null)
      .then((s) => active && setSrc(s))
      .catch(() => active && setSrc(null));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, kit?.logoFileId]);
  return src;
}

function SalesEditor({ editor, project }: { editor: AssetEditor<"sales-page">; project: Project }) {
  const d = editor.data!;
  const set = (p: Partial<SalesPageData>) => editor.update((x) => ({ ...x, ...p }));
  const [selectedId, setSelectedId] = React.useState<string | null>(d.sections[0]?.id ?? null);
  const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const context = useSalesContext(project, d);
  const hero = useHeroImage(project, d);
  const confirm = useConfirm();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const selected = d.sections.find((s) => s.id === selectedId) ?? d.sections[0] ?? null;
  const updateSection = (id: string, p: Partial<SalesSection>) => editor.update((x) => ({ ...x, sections: x.sections.map((s) => (s.id === id ? { ...s, ...p } : s)) }));

  React.useEffect(() => {
    if (!d.productName && context.productName) set({ productName: context.productName, price: { ...d.price, amount: d.price.amount ?? project.plannedPrice } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const html = React.useMemo(() => salesPageHtml(d, { heroImage: hero, headExtra: `<style>${appFontFaceCss()}</style>` }), [d, hero]);

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    editor.update((x) => {
      const from = x.sections.findIndex((s) => s.id === e.active.id);
      const to = x.sections.findIndex((s) => s.id === e.over!.id);
      return { ...x, sections: arrayMove(x.sections, from, to) };
    });
  };

  const fillAllEmpty = () => {
    let n = 0;
    editor.update((x) => ({
      ...x,
      sections: x.sections.map((s) => {
        if (!sectionIsEmpty(s) && !(s.type !== "headline" && s.type !== "subheadline" && s.heading === SALES_SECTION_LABELS[s.type] && !s.body && !s.bullets.length && !s.items.length)) return s;
        n++;
        return { ...s, ...salesTemplate(s.type, context) };
      }),
    }));
    toast.success(n ? `Filled ${n} empty section${n === 1 ? "" : "s"} with templates` : "No empty sections to fill");
  };

  return (
    <div className="flex min-h-full flex-col lg:h-full lg:min-h-0 lg:flex-row">
      <aside className="plr-scroll flex w-full shrink-0 flex-col gap-2 border-b bg-card p-3 lg:w-[250px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sections</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="xs" variant="ghost" className="ml-auto" data-testid="sales-add-section">
                <Plus /> Add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Add a section</DropdownMenuLabel>
              {SALES_SECTION_ORDER.map((t) => (
                <DropdownMenuItem
                  key={t}
                  onSelect={() => {
                    const s = newSectionFromTemplate(t, context);
                    editor.update((x) => ({ ...x, sections: [...x.sections, s] }));
                    setSelectedId(s.id);
                  }}
                >
                  {SALES_SECTION_LABELS[t]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={d.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ul className="grid gap-1.5">
              {d.sections.map((s) => (
                <SortableRow key={s.id} s={s} active={s.id === selected?.id} onSelect={() => setSelectedId(s.id)} onToggle={() => updateSection(s.id, { enabled: !s.enabled })} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        <Button size="sm" variant="outline" onClick={fillAllEmpty} data-testid="sales-fill-empty">
          <LayoutTemplate /> Fill empty sections
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSettingsOpen(true)} data-testid="sales-settings">
          <Settings2 /> Page settings
        </Button>
        <Callout tone="neutral" className="mt-auto text-[12px]">
          No testimonials, results or income claims are ever written for you. Add real reviews only with your customers&apos; permission.
        </Callout>
      </aside>
      <section className="plr-scroll w-full shrink-0 border-b bg-background p-4 lg:w-[440px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
        {selected ? (
          <>
            <SectionEditor key={selected.id} s={selected} update={(p) => updateSection(selected.id, p)} project={project} context={context} />
            <div className="mt-6 flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={async () => {
                  if (!(await confirm({ title: `Delete the “${SALES_SECTION_LABELS[selected.type]}” section?`, description: "You can also just hide it with the eye icon.", confirmLabel: "Delete", destructive: true }))) return;
                  editor.update((x) => ({ ...x, sections: x.sections.filter((s) => s.id !== selected.id) }));
                  setSelectedId(null);
                }}
              >
                <Trash2 /> Delete section
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Add a section to get started.</p>
        )}
      </section>
      <section className="flex h-[80dvh] min-w-0 shrink-0 flex-col bg-secondary/40 lg:h-auto lg:flex-1 lg:shrink">
        <div className="flex h-11 shrink-0 items-center gap-1 border-b bg-card px-3">
          <span className="text-xs font-medium text-muted-foreground">Live preview</span>
          <div className="ml-auto flex gap-0.5 rounded-lg bg-secondary p-0.5">
            <Button size="icon-xs" variant={device === "desktop" ? "outline" : "ghost"} onClick={() => setDevice("desktop")} aria-label="Desktop preview">
              <Monitor />
            </Button>
            <Button size="icon-xs" variant={device === "mobile" ? "outline" : "ghost"} onClick={() => setDevice("mobile")} aria-label="Mobile preview">
              <Smartphone />
            </Button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 justify-center overflow-hidden p-4">
          <iframe title="Sales page preview" sandbox="allow-same-origin" srcDoc={html} className={cn("h-full rounded-lg border bg-white shadow-sm transition-all", device === "mobile" ? "w-full max-w-[390px]" : "w-full")} data-testid="sales-preview" />
        </div>
      </section>
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent className="plr-scroll w-[420px] overflow-y-auto sm:max-w-[420px]">
          <div className="border-b px-5 py-4">
            <SheetTitle className="text-base font-semibold">Page settings</SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">Product, price, checkout link, hero image and design.</SheetDescription>
          </div>
          <div className="px-5 py-4">
            <PageSettings d={d} set={set} project={project} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

async function exportSales(d: SalesPageData, title: string, format: "html" | "docx" | "pdf" | "md", hero: string | null) {
  if (format === "html") {
    const html = salesPageHtml(d, { heroImage: hero, title, headExtra: googleFontsLink([d.theme.headingFont, d.theme.bodyFont]) });
    return textFile(html, safeFileName(title, "html"), "text/html");
  }
  const doc = salesPageDoc(d);
  if (format === "md") return textFile(`# ${d.productName || title}\n\n${docToMarkdown(doc)}`, safeFileName(title, "md"), "text/markdown");
  return exportDocument({ title: d.productName || title, subtitle: "Sales page copy", chapters: [{ title: "Sales page copy", content: doc }] }, format, { ...loadDocExportOptions(), toc: false });
}

function SalesExport({ editor, project }: { editor: AssetEditor<"sales-page">; project: Project }) {
  const hero = useHeroImage(project, editor.data!);
  return (
    <ExportMenu
      projectId={project.id}
      assetId={editor.asset!.id}
      assetLabel={editor.title}
      beforeExport={editor.save}
      options={[
        { id: "html", label: "HTML page (ready to upload)", run: () => exportSales(editor.getData()!, editor.title, "html", hero) },
        { id: "docx", label: "Word (.docx) copy", run: () => exportSales(editor.getData()!, editor.title, "docx", hero) },
        { id: "pdf", label: "PDF copy", run: () => exportSales(editor.getData()!, editor.title, "pdf", hero) },
        { id: "md", label: "Markdown copy", run: () => exportSales(editor.getData()!, editor.title, "md", hero) },
      ]}
    />
  );
}

export function SalesPageBuilder({ project }: { project: Project }) {
  return (
    <AssetWorkspace
      project={project}
      type="sales-page"
      tool="Sales Page Builder"
      eyebrow="Marketing Studio"
      icon={<Presentation />}
      description="Write sales pages section by section — headline, problem and solution, benefits, features, what's included, bonuses, pricing, FAQ, guarantee and call to action — with a live preview. Export as an HTML page or a document."
      createLabel="New sales page"
      onCreate={async () => {
        const kit = project.brandKitId ? await getRepos().brandKits.get(project.brandKitId) : undefined;
        const base = defaultSalesPageData();
        const theme = kit ? { ...base.theme, primary: kit.colors.primary, accent: kit.colors.accent, text: kit.colors.dark, surface: kit.colors.light, headingFont: kit.headingFont, bodyFont: kit.bodyFont } : base.theme;
        const a = await createAsset(project.id, "sales-page", { title: `${project.name.replace(/^SAMPLE\s*[—-]\s*/i, "")} sales page`, data: { coverAssetId: project.coverAssetId, brandKitId: project.brandKitId, theme } });
        return a.id;
      }}
      itemMeta={(a) => `${a.data.sections.filter((s) => s.enabled).length} sections · ${a.data.price.amount !== null ? `${a.data.price.currency} ${a.data.price.amount}` : "no price set"}`}
      fullHeight
      renderEditor={(editor) => <SalesEditor editor={editor} project={project} />}
      versionText={(x) => docToMarkdown(salesPageDoc(x as SalesPageData))}
      headerActions={(editor) => <SalesExport editor={editor} project={project} />}
    />
  );
}

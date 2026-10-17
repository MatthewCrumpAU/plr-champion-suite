"use client";

import type { Asset, AssetType, BrandKit, Project } from "@/lib/data/types";
import { exportDocument, type DocExportFormat } from "@/lib/export/document";
import { safeFileName, textFile, type ExportFile } from "@/lib/export/download";
import { loadDocExportOptions } from "@/components/common/doc-export";
import { markdownToDoc } from "@/lib/doc/parse";
import { outlineToExportDoc, outlineToMarkdown } from "@/lib/content/outline";
import { exportCover } from "@/lib/covers/export";
import { exportMockup } from "@/lib/mockups/export";
import { researchMarkdown } from "@/lib/research/niche";
import { keywordsToCsv } from "@/lib/research/keywords";
import { rightsReport } from "@/lib/research/rights";
import { salesPageDoc, salesPageHtml } from "@/lib/marketing/sales";
import { salesHeroImage } from "@/lib/marketing/sales-hero";
import { campaignCsv, campaignMarkdown, campaignText } from "@/lib/marketing/emails";
import { socialCsv, socialMarkdown } from "@/lib/marketing/social";
import { namesText } from "@/lib/marketing/names";
import { profitReport } from "@/lib/profit/report";
import { funnelReport } from "@/lib/profit/funnel";
import { launchCsv, launchIcs, launchMarkdown } from "@/lib/profit/launch";
import { googleFontsLink } from "@/lib/client/font-css";
import { docToMarkdown } from "@/lib/doc/markdown";
import { FUNNEL_ROLE_LABELS } from "@/lib/models/product";

/**
 * One place that knows how to export every asset type. Used by the Export Centre (single downloads and the
 * project ZIP). Each tool's own Export menu offers the same formats.
 */
export interface ExportContext {
  project: Project;
  assets: Asset[];
  kit: BrandKit | null;
}

export interface AssetExportOption {
  id: string;
  label: string;
  ext: string;
  run: (asset: Asset, ctx: ExportContext) => Promise<ExportFile>;
}

const md = (text: string, title: string) => textFile(text, safeFileName(title, "md"), "text/markdown");
const mdDoc = (text: string, title: string, format: DocExportFormat) => exportDocument({ title, chapters: [{ title, content: markdownToDoc(text.replace(/^# .*\n/, "")) }] }, format, { ...loadDocExportOptions(), toc: false });
const covers = (ctx: ExportContext) => ctx.assets.filter((a) => a.type === "cover") as Asset<"cover">[];
const mockups = (ctx: ExportContext) => ctx.assets.filter((a) => a.type === "mockup") as Asset<"mockup">[];

function docOpt(fmt: DocExportFormat, label: string): AssetExportOption {
  return {
    id: fmt,
    label,
    ext: fmt,
    run: async (a, ctx) => {
      const d = (a as Asset<"document">).data;
      return exportDocument({ title: a.title, subtitle: d.subtitle, author: d.author || ctx.kit?.authorName, chapters: d.chapters }, fmt, loadDocExportOptions());
    },
  };
}

function scanMarkdown(a: Asset<"opportunity-scan">): string {
  const lines = [`# ${a.title}`, "", "_Price ideas and fit scores are planning estimates from the content's structure — not market research._", ""];
  for (const o of a.data.opportunities.filter((x) => !x.dismissed)) {
    lines.push(`## ${o.name}`, "", `- Format: ${o.format}`, `- Funnel role: ${FUNNEL_ROLE_LABELS[o.funnelRole]}`, `- Complexity: ${o.complexity}`, `- Price idea (estimate): ${o.priceHigh > 0 ? `$${o.priceLow}–$${o.priceHigh}` : "free"}`, o.rating ? `- Fit (estimate): ${o.rating}/5` : "", "", o.positioning, "", o.rationale ? `_${o.rationale}_` : "", "");
  }
  return lines.filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n");
}

export const EXPORTERS: Record<AssetType, AssetExportOption[]> = {
  document: [docOpt("docx", "Word (.docx)"), docOpt("pdf", "PDF"), docOpt("html", "Web page (.html)"), docOpt("md", "Markdown"), docOpt("txt", "Plain text")],
  outline: [
    { id: "md", label: "Markdown", ext: "md", run: async (a) => md(outlineToMarkdown((a as Asset<"outline">).data, a.title), a.title) },
    { id: "docx", label: "Word (.docx)", ext: "docx", run: async (a) => exportDocument(outlineToExportDoc((a as Asset<"outline">).data, a.title), "docx", { ...loadDocExportOptions(), toc: false }) },
  ],
  "rebrand-session": [],
  cover: [
    { id: "png", label: "PNG", ext: "png", run: (a, ctx) => exportCover((a as Asset<"cover">).data, a.title, "png", ctx.kit?.logoFileId ?? null) },
    { id: "jpg", label: "JPG", ext: "jpg", run: (a, ctx) => exportCover((a as Asset<"cover">).data, a.title, "jpg", ctx.kit?.logoFileId ?? null) },
    { id: "pdf", label: "PDF", ext: "pdf", run: (a, ctx) => exportCover((a as Asset<"cover">).data, a.title, "pdf", ctx.kit?.logoFileId ?? null) },
  ],
  mockup: [
    { id: "png", label: "PNG", ext: "png", run: (a, ctx) => exportMockup((a as Asset<"mockup">).data, covers(ctx), ctx.kit, a.title, "png", 1) },
    { id: "jpg", label: "JPG", ext: "jpg", run: (a, ctx) => exportMockup((a as Asset<"mockup">).data, covers(ctx), ctx.kit, a.title, "jpg", 1) },
  ],
  "opportunity-scan": [{ id: "md", label: "Markdown report", ext: "md", run: async (a) => md(scanMarkdown(a as Asset<"opportunity-scan">), a.title) }],
  "niche-research": [
    { id: "md", label: "Markdown", ext: "md", run: async (a) => md(researchMarkdown((a as Asset<"niche-research">).data, a.title), a.title) },
    { id: "pdf", label: "PDF", ext: "pdf", run: (a) => mdDoc(researchMarkdown((a as Asset<"niche-research">).data, a.title), a.title, "pdf") },
  ],
  "keyword-set": [{ id: "csv", label: "CSV", ext: "csv", run: async (a) => textFile(keywordsToCsv((a as Asset<"keyword-set">).data.keywords), safeFileName(a.title, "csv"), "text/csv") }],
  "rights-review": [
    { id: "pdf", label: "PDF report", ext: "pdf", run: (a) => mdDoc(rightsReport((a as Asset<"rights-review">).data, a.title), a.title, "pdf") },
    { id: "md", label: "Markdown", ext: "md", run: async (a) => md(rightsReport((a as Asset<"rights-review">).data, a.title), a.title) },
  ],
  "sales-page": [
    {
      id: "html",
      label: "HTML page",
      ext: "html",
      run: async (a, ctx) => {
        const d = (a as Asset<"sales-page">).data;
        const hero = await salesHeroImage(d, covers(ctx), mockups(ctx), ctx.kit?.logoFileId ?? null).catch(() => null);
        return textFile(salesPageHtml(d, { heroImage: hero, title: a.title, headExtra: googleFontsLink([d.theme.headingFont, d.theme.bodyFont]) }), safeFileName(a.title, "html"), "text/html");
      },
    },
    { id: "docx", label: "Word copy (.docx)", ext: "docx", run: (a) => exportDocument({ title: (a as Asset<"sales-page">).data.productName || a.title, subtitle: "Sales page copy", chapters: [{ title: "Sales page copy", content: salesPageDoc((a as Asset<"sales-page">).data) }] }, "docx", { ...loadDocExportOptions(), toc: false }) },
    { id: "md", label: "Markdown copy", ext: "md", run: async (a) => md(`# ${a.title}\n\n${docToMarkdown(salesPageDoc((a as Asset<"sales-page">).data))}`, a.title) },
  ],
  "email-campaign": [
    { id: "txt", label: "Plain text", ext: "txt", run: async (a) => textFile(campaignText((a as Asset<"email-campaign">).data, a.title), safeFileName(a.title, "txt")) },
    { id: "csv", label: "CSV (email tools)", ext: "csv", run: async (a) => textFile(campaignCsv((a as Asset<"email-campaign">).data), safeFileName(a.title, "csv"), "text/csv") },
    { id: "docx", label: "Word (.docx)", ext: "docx", run: (a) => mdDoc(campaignMarkdown((a as Asset<"email-campaign">).data, a.title), a.title, "docx") },
  ],
  "social-campaign": [
    { id: "csv", label: "CSV (calendar)", ext: "csv", run: async (a) => textFile(socialCsv((a as Asset<"social-campaign">).data), safeFileName(a.title, "csv"), "text/csv") },
    { id: "md", label: "Markdown", ext: "md", run: async (a) => md(socialMarkdown((a as Asset<"social-campaign">).data, a.title), a.title) },
  ],
  "name-ideas": [{ id: "txt", label: "Text list", ext: "txt", run: async (a) => textFile(namesText((a as Asset<"name-ideas">).data), safeFileName(a.title, "txt")) }],
  "profit-scenario": [{ id: "md", label: "Markdown report", ext: "md", run: async (a) => md(profitReport((a as Asset<"profit-scenario">).data, a.title), a.title) }],
  funnel: [
    { id: "md", label: "Markdown summary", ext: "md", run: async (a) => md(funnelReport((a as Asset<"funnel">).data, a.title), a.title) },
    { id: "json", label: "Funnel map (JSON)", ext: "json", run: async (a) => textFile(JSON.stringify((a as Asset<"funnel">).data, null, 2), safeFileName(a.title, "json"), "application/json") },
  ],
  "launch-plan": [
    { id: "ics", label: "Calendar (.ics)", ext: "ics", run: async (a) => textFile(launchIcs((a as Asset<"launch-plan">).data, a.title), safeFileName(a.title, "ics"), "text/calendar") },
    { id: "csv", label: "Tasks (CSV)", ext: "csv", run: async (a) => textFile(launchCsv((a as Asset<"launch-plan">).data), safeFileName(a.title, "csv"), "text/csv") },
    { id: "md", label: "Plan (Markdown)", ext: "md", run: async (a) => md(launchMarkdown((a as Asset<"launch-plan">).data, a.title), a.title) },
  ],
};

/** Default format per type for the project package. */
export const DEFAULT_PACKAGE_FORMAT: Partial<Record<AssetType, string>> = {
  document: "docx",
  outline: "md",
  cover: "png",
  mockup: "png",
  "opportunity-scan": "md",
  "niche-research": "md",
  "keyword-set": "csv",
  "rights-review": "pdf",
  "sales-page": "html",
  "email-campaign": "txt",
  "social-campaign": "csv",
  "name-ideas": "txt",
  "profit-scenario": "md",
  funnel: "md",
  "launch-plan": "ics",
};

export const PACKAGE_FOLDERS: Partial<Record<AssetType, string>> = {
  document: "01-products",
  outline: "02-outlines",
  cover: "03-design",
  mockup: "03-design",
  "sales-page": "04-marketing",
  "email-campaign": "04-marketing",
  "social-campaign": "04-marketing",
  "name-ideas": "04-marketing",
  "opportunity-scan": "05-research",
  "niche-research": "05-research",
  "keyword-set": "05-research",
  "rights-review": "06-licence",
  "profit-scenario": "07-planning",
  funnel: "07-planning",
  "launch-plan": "07-planning",
};

export interface PackageItem {
  asset: Asset;
  format: string;
}

/** Builds a ZIP of the chosen assets. Failures are collected and reported, not hidden. */
export async function buildProjectZip(items: PackageItem[], ctx: ExportContext, onProgress?: (done: number, total: number, label: string) => void): Promise<{ blob: Blob; fileName: string; failed: { title: string; error: string }[]; count: number }> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const failed: { title: string; error: string }[] = [];
  const used = new Set<string>();
  let n = 0;
  for (const it of items) {
    onProgress?.(n, items.length, it.asset.title);
    const opt = EXPORTERS[it.asset.type].find((o) => o.id === it.format) ?? EXPORTERS[it.asset.type][0];
    if (!opt) continue;
    try {
      const file = await opt.run(it.asset, ctx);
      const folder = PACKAGE_FOLDERS[it.asset.type] ?? "other";
      let name = `${folder}/${file.fileName}`;
      for (let i = 2; used.has(name); i++) name = `${folder}/${file.fileName.replace(/(\.[^.]+)$/, `-${i}$1`)}`;
      used.add(name);
      zip.file(name, file.blob);
    } catch (e) {
      failed.push({ title: it.asset.title, error: e instanceof Error ? e.message : String(e) });
    }
    n++;
  }
  const readme = [`${ctx.project.name}`, `Exported from PLR Champion on ${new Date().toLocaleString()}.`, "", `${n - failed.length} file(s) included.`, failed.length ? `\nNot included:\n${failed.map((f) => `- ${f.title}: ${f.error}`).join("\n")}` : "", "", "Projections and price ideas in planning files are hypothetical estimates, not forecasts or guaranteed earnings. Check your PLR licence before selling."].join("\n");
  zip.file("README.txt", readme);
  onProgress?.(items.length, items.length, "Compressing…");
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  return { blob, fileName: safeFileName(`${ctx.project.name.replace(/^SAMPLE\s*[—-]\s*/i, "")} package`, "zip"), failed, count: n - failed.length };
}

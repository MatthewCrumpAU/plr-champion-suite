import { getRepos, type Repositories } from "@/lib/data";
import type { Asset } from "@/lib/data/types";
import type { RebrandConfig, RebrandProposal, RebrandSessionData } from "@/lib/models/content";
import type { Chapter, ReplacementRule } from "@/lib/models/document";
import { newChapter } from "@/lib/models/document";
import { applyRules, applyRulesToText, FILLER_PHRASES } from "@/lib/doc/replace";
import { markdownToDoc } from "@/lib/doc/parse";
import type { PMDoc } from "@/lib/doc/types";
import { deepClone, nowIso, uid } from "@/lib/utils";
import { createAsset, getAsset, updateAsset } from "./assets";
import { createVersion } from "./versions";
import { updateProject } from "./projects";

/** Replacement rules implied by the rebrand settings (old name → new name, old author → new author). */
export function suggestRules(cfg: RebrandConfig, existing: ReplacementRule[] = []): ReplacementRule[] {
  const out = [...existing];
  const has = (find: string) => out.some((r) => r.find.trim().toLowerCase() === find.trim().toLowerCase());
  const add = (find: string, replace: string, wholeWord = false) => {
    if (!find.trim() || has(find) || find.trim() === replace.trim()) return;
    out.push({ id: uid("rule"), find: find.trim(), replace: replace.trim(), caseSensitive: false, wholeWord, enabled: true });
  };
  if (cfg.originalName && cfg.newName) add(cfg.originalName, cfg.newName);
  if (cfg.originalAuthor && cfg.author) add(cfg.originalAuthor, cfg.author, true);
  return out;
}

export function fillerRules(existing: ReplacementRule[]): ReplacementRule[] {
  const out = [...existing];
  for (const p of FILLER_PHRASES) if (!out.some((r) => r.find.toLowerCase() === p.toLowerCase())) out.push({ id: uid("rule"), find: p, replace: "", caseSensitive: false, wholeWord: false, enabled: true });
  return out;
}

export function proposeWithRules(chapter: Chapter, rules: ReplacementRule[]): RebrandProposal {
  const body = applyRules(chapter.content, rules);
  const title = applyRulesToText(chapter.title, rules);
  return {
    chapterId: chapter.id,
    originalTitle: chapter.title,
    proposedTitle: title.text,
    proposedContent: body.doc,
    method: "rules",
    status: "pending",
    generatedAt: nowIso(),
    replacements: body.count + title.count,
    error: null,
  };
}

/** Converts an AI rewrite ("# Title" + body Markdown) into a proposal, then applies the rules on top. */
export function proposalFromAI(chapter: Chapter, markdown: string, rules: ReplacementRule[]): RebrandProposal {
  const doc = markdownToDoc(markdown);
  let title = chapter.title;
  let content: PMDoc = doc;
  const first = doc.content[0];
  if (first?.type === "heading") {
    title = (first.content ?? []).map((n) => n.text ?? "").join("").trim() || title;
    content = { type: "doc", content: doc.content.slice(1).length ? doc.content.slice(1) : [{ type: "paragraph" }] };
  }
  const body = applyRules(content, rules);
  const t = applyRulesToText(title, rules);
  return {
    chapterId: chapter.id,
    originalTitle: chapter.title,
    proposedTitle: t.text,
    proposedContent: body.doc,
    method: "ai",
    status: "pending",
    generatedAt: nowIso(),
    replacements: body.count + t.count,
    error: null,
  };
}

export function rebrandBrief(cfg: RebrandConfig) {
  return {
    productName: cfg.newName,
    originalName: cfg.originalName,
    niche: cfg.niche,
    audience: cfg.audience,
    promise: cfg.promise,
    voice: cfg.voice,
    author: cfg.author,
    positioning: cfg.positioning,
  };
}

/** Chapters after applying accepted proposals; rejected and pending chapters keep their current content. */
export function mergeProposals(chapters: Chapter[], proposals: RebrandProposal[]): { chapters: Chapter[]; accepted: number } {
  let accepted = 0;
  const out = chapters.map((c) => {
    const p = proposals.find((x) => x.chapterId === c.id && x.status === "accepted");
    if (!p) return c;
    accepted++;
    return { ...c, title: p.proposedTitle, content: deepClone(p.proposedContent) };
  });
  return { chapters: out, accepted };
}

export interface SaveRebrandOptions {
  target: "version" | "asset";
  applyProjectName: boolean;
  linkBrandKit: boolean;
}

/** Writes the accepted rebrand. "version" updates the source document (saving a version first); "asset" creates a new document. */
export async function saveRebrand(session: Asset<"rebrand-session">, opts: SaveRebrandOptions, repos: Repositories = getRepos()): Promise<{ documentId: string; accepted: number }> {
  const s: RebrandSessionData = session.data;
  if (!s.sourceDocumentId) throw new Error("Choose a source document first.");
  const source = await getAsset<"document">(s.sourceDocumentId, repos);
  if (!source) throw new Error("The source document no longer exists.");
  const { chapters, accepted } = mergeProposals(source.data.chapters, s.proposals);
  if (!accepted) throw new Error("Accept at least one proposed chapter before saving.");
  const cfg = s.config;
  const title = cfg.newName.trim() || source.title;
  let documentId: string;

  if (opts.target === "version") {
    await createVersion(source, `Before rebrand to “${title}”`, "pre-rebrand", repos);
    const updated = await updateAsset<"document">(
      source.id,
      { title, data: { ...source.data, chapters, subtitle: cfg.subtitle || source.data.subtitle, author: cfg.author || source.data.author, rules: s.rules } },
      repos,
    );
    documentId = updated.id;
  } else {
    const original = source.data.original ?? { sources: [], chapters: source.data.chapters.map((c) => ({ ...deepClone(c) })) };
    const copied: Chapter[] = chapters.map((c) => ({ ...newChapter(c.title, deepClone(c.content), c.sourceChapterId ?? (source.data.original ? null : c.id)), notes: c.notes }));
    const created = await createAsset(
      source.projectId,
      "document",
      {
        title,
        sourceAssetIds: [source.id],
        status: "in-progress",
        data: { ...deepClone(source.data), role: "rebrand", chapters: copied, original: deepClone(original), subtitle: cfg.subtitle || source.data.subtitle, author: cfg.author || source.data.author, rules: s.rules, builder: null },
      },
      repos,
    );
    await createVersion(created, "Created by Rebrand Assistant", "created", repos);
    documentId = created.id;
  }

  const projectPatch: Record<string, unknown> = {};
  if (opts.applyProjectName && cfg.newName.trim()) projectPatch.name = cfg.newName.trim();
  if (opts.linkBrandKit && cfg.brandKitId) projectPatch.brandKitId = cfg.brandKitId;
  if (cfg.niche) projectPatch.niche = cfg.niche;
  if (cfg.audience) projectPatch.audience = cfg.audience;
  projectPatch.stage = "rebranding";
  await updateProject(source.projectId, projectPatch, repos);
  await updateAsset<"rebrand-session">(session.id, { data: { ...s, resultDocumentId: documentId, savedAs: opts.target, savedAt: nowIso(), step: 4 }, status: "ready" }, repos);
  return { documentId, accepted };
}

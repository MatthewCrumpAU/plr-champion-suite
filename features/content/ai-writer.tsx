"use client";

import * as React from "react";
import { ClipboardCopy, FileText, LayoutTemplate, ListChecks, Save, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/data/types";
import { useAITask, useAIStatus } from "@/lib/ai/client";
import { WRITER_CREATE_TOOLS, WRITER_TRANSFORM_TOOLS } from "@/lib/ai/tasks";
import { CREATE_TOOL_INFO, TRANSFORM_TOOL_INFO, createTemplate, type CreateTool, type TransformTool } from "@/lib/content/writer-templates";
import { markdownToDoc } from "@/lib/doc/parse";
import { docToMarkdown } from "@/lib/doc/markdown";
import { docText, docWords } from "@/lib/doc/text";
import { emptyDoc, type PMDoc } from "@/lib/doc/types";
import { useAssets } from "@/lib/data/hooks";
import { Button } from "@/components/ui/button";
import { Card, Field, Input, NativeSelect, PageContainer, PageHeader, Textarea } from "@/components/ui/primitives";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { AIRunStatus, AIStatusNotice, AIUsageLine, MarkdownView, useBrief } from "@/components/common/ai";
import { RichEditor } from "@/components/common/rich-editor";
import { SaveOutputDialog } from "@/components/common/save-output-dialog";
import { SourcePicker, chaptersToMarkdown, selectedChapters, type SourceSelection } from "@/components/common/source-picker";
import { cn } from "@/lib/utils";

const TONES = ["Clear, friendly and practical", "Warm and encouraging", "Confident and authoritative", "Conversational and fun", "Calm and reassuring", "Professional and concise"];

interface WriterState {
  mode: "create" | "transform";
  createTool: CreateTool;
  transformTool: TransformTool;
  topic: string;
  audience: string;
  tone: string;
  length: "short" | "medium" | "long";
  keyPoints: string;
  extra: string;
  useSource: boolean;
  sourceText: string;
  transformSource: "chapters" | "paste";
  output: PMDoc | null;
  outputKey: number;
}

const DEFAULT_STATE: WriterState = {
  mode: "create",
  createTool: "article",
  transformTool: "clarity",
  topic: "",
  audience: "",
  tone: TONES[0],
  length: "medium",
  keyPoints: "",
  extra: "",
  useSource: false,
  sourceText: "",
  transformSource: "chapters",
  output: null,
  outputKey: 0,
};

function useStoredState(projectId: string) {
  const key = `plrc.writer.${projectId}`;
  const [state, setState] = React.useState<WriterState>(DEFAULT_STATE);
  const loaded = React.useRef(false);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setState({ ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<WriterState>) });
    } catch {
      /* ignore */
    }
    loaded.current = true;
  }, [key]);
  React.useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(state));
      } catch {
        /* storage full or blocked: drafts are a convenience only */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [key, state]);
  return [state, setState] as const;
}

export function AIWriter({ project }: { project: Project }) {
  const [s, setS] = useStoredState(project.id);
  const set = <K extends keyof WriterState>(k: K, v: WriterState[K]) => setS((x) => ({ ...x, [k]: v }));
  const [source, setSource] = React.useState<SourceSelection>({ documentId: null, chapterIds: [] });
  const [saveOpen, setSaveOpen] = React.useState(false);
  const { data: docs } = useAssets(project.id, "document");
  const { configured } = useAIStatus();
  const brief = useBrief(project.id);
  const create = useAITask("writer.create");
  const transform = useAITask("writer.transform");
  const ai = s.mode === "create" ? create : transform;
  const outputRef = React.useRef<PMDoc | null>(s.output);
  outputRef.current = s.output;

  React.useEffect(() => {
    setS((x) => ({ ...x, audience: x.audience || project.audience || "" }));
  }, [project.audience, setS]);

  const sourceMarkdown = () => {
    if (s.mode === "transform" && s.transformSource === "paste") return s.sourceText;
    return chaptersToMarkdown(selectedChapters(docs, source));
  };

  const setOutput = (doc: PMDoc) => setS((x) => ({ ...x, output: doc, outputKey: x.outputKey + 1 }));

  async function runAI() {
    if (s.mode === "create") {
      if (!s.topic.trim()) return toast.info("Enter a topic first.");
      const r = await create.run(
        { tool: s.createTool, topic: s.topic, audience: s.audience, tone: s.tone, length: s.length, keyPoints: s.keyPoints, extra: s.extra, sourceText: s.useSource ? sourceMarkdown() : "", brief },
        project.id,
      );
      if (r) setOutput(markdownToDoc(r.text));
    } else {
      const text = sourceMarkdown();
      if (text.trim().length < 20) return toast.info("Choose chapters or paste some text to work on.");
      const r = await transform.run({ tool: s.transformTool, text, tone: s.tone, audience: s.audience, extra: s.extra, brief }, project.id);
      if (r) setOutput(markdownToDoc(r.text));
    }
  }

  function useTemplate() {
    if (s.mode === "create") {
      setOutput(markdownToDoc(createTemplate(s.createTool, { topic: s.topic, audience: s.audience, tone: s.tone, keyPoints: s.keyPoints, length: s.length })));
      toast.success("Template added — replace the [bracketed prompts] with your content.");
    } else {
      const text = sourceMarkdown();
      if (!text.trim()) return toast.info("Choose chapters or paste some text first.");
      setOutput(markdownToDoc(text));
      toast.success("Source loaded into the editor — follow the checklist to revise it.");
    }
  }

  const outputWords = s.output ? docWords(s.output) : 0;
  const toolLabel = s.mode === "create" ? CREATE_TOOL_INFO[s.createTool].label : TRANSFORM_TOOL_INFO[s.transformTool].label;
  const defaultTitle = s.mode === "create" ? s.topic || toolLabel : `${TRANSFORM_TOOL_INFO[s.transformTool].label} — ${new Date().toLocaleDateString()}`;

  return (
    <PageContainer width="wide">
      <PageHeader eyebrow="Content Studio" title="AI Writer" description="Write new content or transform existing chapters. Works with structured templates when AI is off; uses Claude when it's configured. Nothing replaces your saved content without your approval." />
      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <div className="grid content-start gap-4">
          <Tabs value={s.mode} onValueChange={(v) => set("mode", v as WriterState["mode"])}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">
                <Sparkles /> Create
              </TabsTrigger>
              <TabsTrigger value="transform">
                <Wand2 /> Transform
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Card className="p-2">
            <ul className="grid grid-cols-2 gap-1" data-testid="writer-tools">
              {(s.mode === "create" ? WRITER_CREATE_TOOLS : WRITER_TRANSFORM_TOOLS).map((t) => {
                const info = s.mode === "create" ? CREATE_TOOL_INFO[t as CreateTool] : TRANSFORM_TOOL_INFO[t as TransformTool];
                const active = s.mode === "create" ? s.createTool === t : s.transformTool === t;
                return (
                  <li key={t}>
                    <button type="button" title={info.description} onClick={() => (s.mode === "create" ? set("createTool", t as CreateTool) : set("transformTool", t as TransformTool))} className={cn("w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium leading-tight transition", active ? "bg-primary-soft text-accent-foreground" : "hover:bg-secondary")}>
                      {info.label.replace(/ Writer$/, "")}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="px-2.5 pb-1 pt-2 text-[12px] text-muted-foreground">{s.mode === "create" ? CREATE_TOOL_INFO[s.createTool].description : TRANSFORM_TOOL_INFO[s.transformTool].description}</p>
          </Card>
          <Card className="grid gap-3 p-4">
            {s.mode === "create" ? (
              <>
                <Field label="Topic" htmlFor="w-topic">
                  <Input id="w-topic" value={s.topic} onChange={(e) => set("topic", e.target.value)} placeholder="e.g. How to plan a focused work week" data-testid="writer-topic" />
                </Field>
                <Field label="Audience" htmlFor="w-aud">
                  <Input id="w-aud" value={s.audience} onChange={(e) => set("audience", e.target.value)} placeholder="Who is this for?" />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Tone" htmlFor="w-tone">
                    <NativeSelect id="w-tone" value={TONES.includes(s.tone) ? s.tone : "custom"} onChange={(e) => set("tone", e.target.value === "custom" ? "" : e.target.value)}>
                      {TONES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                      <option value="custom">Custom…</option>
                    </NativeSelect>
                  </Field>
                  <Field label="Length" htmlFor="w-len">
                    <NativeSelect id="w-len" value={s.length} onChange={(e) => set("length", e.target.value as WriterState["length"])}>
                      <option value="short">Short (~500 words)</option>
                      <option value="medium">Medium (~1,100)</option>
                      <option value="long">Long (~2,000+)</option>
                    </NativeSelect>
                  </Field>
                </div>
                {!TONES.includes(s.tone) && <Input value={s.tone} onChange={(e) => set("tone", e.target.value)} placeholder="Describe the tone" aria-label="Custom tone" />}
                <Field label="Key points" htmlFor="w-kp" optional hint="One per line. Templates turn these into sections.">
                  <Textarea id="w-kp" value={s.keyPoints} onChange={(e) => set("keyPoints", e.target.value)} rows={4} />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={s.useSource} onChange={(e) => set("useSource", e.target.checked)} className="accent-[var(--primary)]" /> Draw on chapters from this project
                </label>
                {s.useSource && <SourcePicker projectId={project.id} value={source} onChange={setSource} maxHeight={180} />}
              </>
            ) : (
              <>
                <div className="flex gap-1 rounded-lg bg-secondary p-1 text-xs">
                  {(["chapters", "paste"] as const).map((v) => (
                    <button key={v} type="button" onClick={() => set("transformSource", v)} className={cn("flex-1 rounded-md px-2 py-1 font-medium", s.transformSource === v ? "bg-card shadow-sm" : "text-muted-foreground")}>
                      {v === "chapters" ? "Project chapters" : "Paste text"}
                    </button>
                  ))}
                </div>
                {s.transformSource === "chapters" ? (
                  <SourcePicker projectId={project.id} value={source} onChange={setSource} maxHeight={200} defaultAll={false} label="Chapters to transform" />
                ) : (
                  <Textarea value={s.sourceText} onChange={(e) => set("sourceText", e.target.value)} rows={8} placeholder="Paste the text to work on" aria-label="Text to transform" />
                )}
                {s.transformTool === "tone" && (
                  <Field label="New tone" htmlFor="w-ntone">
                    <Input id="w-ntone" value={s.tone} onChange={(e) => set("tone", e.target.value)} />
                  </Field>
                )}
                {s.transformTool === "audience" && (
                  <Field label="New audience" htmlFor="w-naud">
                    <Input id="w-naud" value={s.audience} onChange={(e) => set("audience", e.target.value)} />
                  </Field>
                )}
              </>
            )}
            <Field label="Extra instructions" htmlFor="w-extra" optional>
              <Textarea id="w-extra" value={s.extra} onChange={(e) => set("extra", e.target.value)} rows={2} placeholder="e.g. Use Australian spelling" />
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" onClick={useTemplate} data-testid="writer-template">
                <LayoutTemplate /> {s.mode === "create" ? "Use template" : "Edit manually"}
              </Button>
              <Button variant="gradient" onClick={() => void runAI()} disabled={!configured || ai.running} data-testid="writer-generate">
                <Sparkles /> Generate with AI
              </Button>
            </div>
            <AIStatusNotice compact manualHint={s.mode === "create" ? "Use the template to get a structured draft you can fill in." : "Load the text into the editor and follow the checklist."} />
          </Card>
        </div>

        <div className="grid min-h-[70vh] content-start gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto flex items-center gap-2 text-sm font-semibold">
              <FileText className="size-4 text-primary" /> {toolLabel} output {s.output && <span className="font-normal text-muted-foreground">· {outputWords.toLocaleString()} words</span>}
            </h2>
            <Button
              size="sm"
              variant="ghost"
              disabled={!s.output}
              onClick={async () => {
                if (!outputRef.current) return;
                await navigator.clipboard.writeText(docToMarkdown(outputRef.current));
                toast.success("Copied as Markdown");
              }}
            >
              <ClipboardCopy /> Copy
            </Button>
            <Button size="sm" disabled={!s.output || !docText(s.output)} onClick={() => setSaveOpen(true)} data-testid="writer-save">
              <Save /> Save to project
            </Button>
          </div>
          <AIRunStatus running={ai.running} error={ai.error} onCancel={ai.cancel} onRetry={() => void runAI()} label="Writing…" />
          {ai.running ? (
            <Card className="min-h-[60vh] p-6">
              <MarkdownView markdown={ai.text || "…"} />
            </Card>
          ) : s.output ? (
            <>
              <RichEditor content={s.output} resetKey={s.outputKey} onChange={(d) => setS((x) => ({ ...x, output: d }))} className="min-h-[60vh]" testId="writer-output" />
              <AIUsageLine result={ai.result} />
            </>
          ) : (
            <Card className="flex min-h-[60vh] flex-col items-center justify-center gap-2 p-8 text-center">
              <Sparkles className="size-6 text-primary" />
              <p className="font-medium">Your draft appears here</p>
              <p className="max-w-sm text-sm text-muted-foreground">Fill in the form, then use a template or generate with AI. You can edit the result here before saving it to a document.</p>
            </Card>
          )}
          {s.mode === "transform" && (
            <Card className="p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <ListChecks className="size-4 text-primary" /> Manual checklist: {TRANSFORM_TOOL_INFO[s.transformTool].label}
              </p>
              <ul className="grid gap-1.5 text-sm text-muted-foreground">
                {TRANSFORM_TOOL_INFO[s.transformTool].manual.map((m) => (
                  <li key={m} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" /> {m}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
      <SaveOutputDialog open={saveOpen} onOpenChange={setSaveOpen} project={project} getContent={() => outputRef.current ?? emptyDoc()} defaultTitle={defaultTitle} />
    </PageContainer>
  );
}

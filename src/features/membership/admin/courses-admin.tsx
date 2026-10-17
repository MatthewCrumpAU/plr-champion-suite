"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, Eye, GraduationCap, Paperclip, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Field, Input, NativeSelect, PageContainer, PageHeader, Spinner, Textarea } from "@/components/ui/primitives";
import { useConfirm } from "@/components/ui/confirm";
import { FileDrop } from "@/components/common/file-drop";
import { SaveStatus } from "@/components/common/save-status";
import { useMemberLive } from "@/lib/membership/hooks";
import { deleteCourse, newCourse, safeUrl, saveCourse } from "@/lib/membership/catalog";
import { deleteMemberFiles, MAX_IMAGE_BYTES, MAX_PRODUCT_FILE_BYTES, storeMemberFile } from "@/lib/membership/files";
import { ACCESS_TIERS, ACCESS_TIER_LABELS, COURSE_LEVEL_LABELS, LESSON_TYPE_LABELS, PUBLISH_STATUS_LABELS, type AccessTier, type Course, type CourseLevel, type Lesson, type LessonType, type PublishStatus } from "@/lib/membership/types";
import { cn, errorMessage, formatBytes, moveItem, plural, uid } from "@/lib/utils";
import { useCatalog, useMember } from "../member-context";
import { TOOL_HINTS } from "../member-nav";
import { StoredImage } from "../ui";
import { AdminGate } from "./admin-gate";
import { useDraft } from "./use-draft";

export function CoursesAdmin() {
  return (
    <AdminGate>
      <CoursesList />
    </AdminGate>
  );
}

function CoursesList() {
  const m = useMember();
  const router = useRouter();
  const confirm = useConfirm();
  const { data, loading } = useCatalog();
  const [busy, setBusy] = React.useState(false);
  if (loading || !data) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }
  const create = async (kind: Course["kind"]) => {
    setBusy(true);
    try {
      const c = await saveCourse(newCourse(m.brandId, { kind, title: kind === "tutorial" ? "Untitled tutorial" : "Untitled course", order: data.courses.length }));
      router.push(m.adminHref(`courses/${c.id}`));
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  };
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Membership Admin"
        title="Training"
        description="Courses and tool tutorials for the Training Centre. Lessons can be articles, checklists, downloads or links to videos hosted elsewhere."
        actions={
          <>
            <Button variant="outline" onClick={() => create("tutorial")} disabled={busy}>
              <Plus /> New tutorial
            </Button>
            <Button onClick={() => create("course")} loading={busy} data-testid="new-course">
              <Plus /> New course
            </Button>
          </>
        }
      />
      {data.courses.length === 0 ? (
        <EmptyState icon={<GraduationCap />} title="No training yet" />
      ) : (
        <div className="grid grid-cols-1 gap-3" data-testid="admin-courses">
          {data.courses.map((c) => (
            <Card key={c.id} className="flex items-center gap-4 p-3">
              <StoredImage fileId={c.coverFileId} alt="" className="aspect-video w-24 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{c.title}</p>
                  <Badge variant={c.kind === "tutorial" ? "secondary" : "default"}>{c.kind === "tutorial" ? "Tutorial" : "Course"}</Badge>
                  <Badge variant={c.status === "published" ? "success" : "secondary"}>{PUBLISH_STATUS_LABELS[c.status]}</Badge>
                  {c.isSample && <Badge variant="sample">Sample</Badge>}
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {plural(c.modules.length, "module")} · {plural(c.modules.reduce((n, mm) => n + mm.lessons.length, 0), "lesson")} · {ACCESS_TIER_LABELS[c.access]}
                </p>
              </div>
              <Button asChild size="xs" variant="ghost">
                <Link href={m.href(`courses/${c.id}`)}>
                  <Eye /> View
                </Link>
              </Button>
              <Button asChild size="xs" variant="outline">
                <Link href={m.adminHref(`courses/${c.id}`)}>
                  <Pencil /> Edit
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Delete ${c.title}`}
                onClick={async () => {
                  if (!(await confirm({ title: `Delete “${c.title}”?`, description: "The course, its lessons and attachments are removed. Members' progress for it is no longer shown.", confirmLabel: "Delete course", destructive: true }))) return;
                  await deleteCourse(c.id);
                  toast.success("Course deleted");
                }}
              >
                <Trash2 />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

export function CourseEditor() {
  return (
    <AdminGate>
      <CourseEditorInner />
    </AdminGate>
  );
}

function CourseEditorInner() {
  const { courseId } = useParams<{ courseId: string }>();
  const m = useMember();
  const { data: stored, loading } = useMemberLive((r) => r.courses.get(courseId), [courseId]);
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }
  if (!stored || stored.brandId !== m.brandId) {
    return (
      <PageContainer width="narrow">
        <EmptyState icon={<GraduationCap />} title="Course not found" action={<Button asChild><Link href={m.adminHref("courses")}>All training</Link></Button>} />
      </PageContainer>
    );
  }
  return <CourseForm key={stored.id} stored={stored} />;
}

function LessonEditor({ lesson, onChange, onRemove, onMove, first, last, brandId }: { lesson: Lesson; onChange: (l: Lesson) => void; onRemove: () => void; onMove: (d: -1 | 1) => void; first: boolean; last: boolean; brandId: Course["brandId"] }) {
  const [open, setOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  return (
    <li className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition", !open && "-rotate-90")} />
          <span className="truncate text-sm font-medium">{lesson.title || "Untitled lesson"}</span>
          <Badge variant="outline">{LESSON_TYPE_LABELS[lesson.type]}</Badge>
          <span className="text-xs text-muted-foreground">{lesson.durationMin} min</span>
        </button>
        <Button variant="ghost" size="icon-xs" disabled={first} onClick={() => onMove(-1)} aria-label="Move lesson up">
          <ArrowUp />
        </Button>
        <Button variant="ghost" size="icon-xs" disabled={last} onClick={() => onMove(1)} aria-label="Move lesson down">
          <ArrowDown />
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={onRemove} aria-label="Delete lesson">
          <Trash2 />
        </Button>
      </div>
      {open && (
        <div className="grid grid-cols-1 gap-3 border-t p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_160px_100px]">
            <Field label="Lesson title">
              <Input value={lesson.title} onChange={(e) => onChange({ ...lesson, title: e.target.value })} aria-label="Lesson title" />
            </Field>
            <Field label="Type">
              <NativeSelect value={lesson.type} onChange={(e) => onChange({ ...lesson, type: e.target.value as LessonType })} aria-label="Lesson type">
                {Object.entries(LESSON_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Minutes">
              <Input type="number" min={1} max={600} value={lesson.durationMin} onChange={(e) => onChange({ ...lesson, durationMin: Math.max(1, Number(e.target.value) || 1) })} aria-label="Minutes" />
            </Field>
          </div>
          <Field label="Content" hint={lesson.type === "checklist" ? "Each line starting with “- ” becomes a box members can tick." : "Markdown supported."}>
            <Textarea rows={7} value={lesson.body} onChange={(e) => onChange({ ...lesson, body: e.target.value })} aria-label="Lesson content" />
          </Field>
          <Field label="Video link" hint="YouTube, Vimeo or Loom link — videos open on the host's site. Leave empty for none." optional>
            <Input value={lesson.videoUrl} placeholder="https://" onChange={(e) => onChange({ ...lesson, videoUrl: e.target.value })} onBlur={(e) => onChange({ ...lesson, videoUrl: safeUrl(e.target.value).startsWith("http") ? safeUrl(e.target.value) : "" })} aria-label="Video link" />
          </Field>
          <div className="grid grid-cols-1 gap-2">
            <p className="text-[13px] font-medium">Attachments</p>
            {lesson.attachments.map((a) => (
              <div key={a.fileId} className="flex items-center gap-2 rounded-md bg-secondary/60 px-2.5 py-1.5 text-sm">
                <Paperclip className="size-3.5 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
                <span className="text-xs text-muted-foreground">{formatBytes(a.size)}</span>
                <button
                  type="button"
                  onClick={async () => {
                    onChange({ ...lesson, attachments: lesson.attachments.filter((x) => x.fileId !== a.fileId) });
                    await deleteMemberFiles([a.fileId]);
                  }}
                  aria-label={`Remove ${a.name}`}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            <FileDrop
              accept="*/*"
              multiple
              compact
              disabled={uploading}
              title={uploading ? "Uploading…" : "Add a download to this lesson"}
              onFiles={async (files) => {
                setUploading(true);
                try {
                  const added: Lesson["attachments"] = [];
                  for (const f of files) {
                    if (f.size > MAX_PRODUCT_FILE_BYTES) {
                      toast.error(`${f.name} is too large.`);
                      continue;
                    }
                    const stored = await storeMemberFile(f, f.name, brandId);
                    added.push({ fileId: stored.id, name: f.name, size: f.size });
                  }
                  onChange({ ...lesson, attachments: [...lesson.attachments, ...added] });
                } catch (e) {
                  toast.error(errorMessage(e));
                } finally {
                  setUploading(false);
                }
              }}
            />
          </div>
        </div>
      )}
    </li>
  );
}

function CourseForm({ stored }: { stored: Course }) {
  const m = useMember();
  const router = useRouter();
  const confirm = useConfirm();
  const { draft, update, flush, adopt, state, lastSavedAt } = useDraft<Course>(stored, (c) => saveCourse(c));
  if (!draft) return null;
  const c = draft;
  const setModules = (modules: Course["modules"]) => update({ modules });
  const newLesson = (): Lesson => ({ id: uid("les"), title: "New lesson", type: "article", body: "", videoUrl: "", durationMin: 5, attachments: [] });

  return (
    <PageContainer>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={m.adminHref("courses")}>
            <ArrowLeft /> Training
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">{c.title}</h1>
        <SaveStatus state={state} lastSavedAt={lastSavedAt} onRetry={() => void flush()} />
        <Button asChild size="sm" variant="outline">
          <Link href={m.href(`courses/${c.id}`)} onClick={() => void flush()}>
            <Eye /> Preview
          </Link>
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid grid-cols-1 content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Course details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <Field label="Title" htmlFor="ce-title">
                <Input id="ce-title" value={c.title} onChange={(e) => update({ title: e.target.value })} data-testid="ce-title" />
              </Field>
              <Field label="Summary" htmlFor="ce-summary">
                <Textarea id="ce-summary" rows={2} value={c.summary} onChange={(e) => update({ summary: e.target.value })} />
              </Field>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 gap-4">
            {c.modules.map((mod, mi) => (
              <Card key={mod.id}>
                <CardHeader className="flex-row items-center gap-2">
                  <Input value={mod.title} onChange={(e) => setModules(c.modules.map((x) => (x.id === mod.id ? { ...x, title: e.target.value } : x)))} className="font-semibold" aria-label="Module title" />
                  <Button variant="ghost" size="icon-xs" disabled={mi === 0} onClick={() => setModules(moveItem(c.modules, mi, mi - 1))} aria-label="Move module up">
                    <ArrowUp />
                  </Button>
                  <Button variant="ghost" size="icon-xs" disabled={mi === c.modules.length - 1} onClick={() => setModules(moveItem(c.modules, mi, mi + 1))} aria-label="Move module down">
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Delete module"
                    onClick={async () => {
                      if (mod.lessons.length && !(await confirm({ title: `Delete “${mod.title}”?`, description: `Its ${plural(mod.lessons.length, "lesson")} will be deleted too.`, confirmLabel: "Delete module", destructive: true }))) return;
                      setModules(c.modules.filter((x) => x.id !== mod.id));
                      await deleteMemberFiles(mod.lessons.flatMap((l) => l.attachments.map((a) => a.fileId)));
                    }}
                  >
                    <Trash2 />
                  </Button>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-2">
                  <ul className="grid grid-cols-1 gap-2">
                    {mod.lessons.map((l, li) => (
                      <LessonEditor
                        key={l.id}
                        lesson={l}
                        brandId={c.brandId}
                        first={li === 0}
                        last={li === mod.lessons.length - 1}
                        onChange={(nl) => setModules(c.modules.map((x) => (x.id === mod.id ? { ...x, lessons: x.lessons.map((y) => (y.id === l.id ? nl : y)) } : x)))}
                        onMove={(d) => setModules(c.modules.map((x) => (x.id === mod.id ? { ...x, lessons: moveItem(x.lessons, li, li + d) } : x)))}
                        onRemove={async () => {
                          if (!(await confirm({ title: `Delete “${l.title}”?`, confirmLabel: "Delete lesson", destructive: true }))) return;
                          setModules(c.modules.map((x) => (x.id === mod.id ? { ...x, lessons: x.lessons.filter((y) => y.id !== l.id) } : x)));
                          await deleteMemberFiles(l.attachments.map((a) => a.fileId));
                        }}
                      />
                    ))}
                  </ul>
                  <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setModules(c.modules.map((x) => (x.id === mod.id ? { ...x, lessons: [...x.lessons, newLesson()] } : x)))}>
                    <Plus /> Add lesson
                  </Button>
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" onClick={() => setModules([...c.modules, { id: uid("mod"), title: `Module ${c.modules.length + 1}`, lessons: [newLesson()] }])}>
              <Plus /> Add module
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <Field label="Status" htmlFor="ce-status">
                <NativeSelect id="ce-status" value={c.status} onChange={(e) => update({ status: e.target.value as PublishStatus })} data-testid="ce-status">
                  {(["draft", "published", "archived"] as PublishStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {PUBLISH_STATUS_LABELS[s]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Type" htmlFor="ce-kind">
                <NativeSelect id="ce-kind" value={c.kind} onChange={(e) => update({ kind: e.target.value as Course["kind"] })}>
                  <option value="course">Course</option>
                  <option value="tutorial">Tool tutorial</option>
                </NativeSelect>
              </Field>
              <Field label="Level" htmlFor="ce-level">
                <NativeSelect id="ce-level" value={c.level} onChange={(e) => update({ level: e.target.value as CourseLevel })}>
                  {Object.entries(COURSE_LEVEL_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Access level" htmlFor="ce-access">
                <NativeSelect id="ce-access" value={c.access} onChange={(e) => update({ access: e.target.value as AccessTier })}>
                  {ACCESS_TIERS.map((t) => (
                    <option key={t} value={t}>
                      {ACCESS_TIER_LABELS[t]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="“Try it” tool" htmlFor="ce-tool" optional>
                <NativeSelect id="ce-tool" value={c.toolHint ?? ""} onChange={(e) => update({ toolHint: e.target.value || null })}>
                  <option value="">None</option>
                  {Object.entries(TOOL_HINTS).map(([k, t]) => (
                    <option key={k} value={k}>
                      {t.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cover</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3">
              {c.coverFileId && <StoredImage fileId={c.coverFileId} alt="" className="aspect-video w-full rounded-md" />}
              <FileDrop
                accept="image/*"
                compact
                title={c.coverFileId ? "Replace cover" : "Upload cover"}
                onFiles={async ([f]) => {
                  if (!f.type.startsWith("image/") || f.size > MAX_IMAGE_BYTES) return toast.error(`Choose an image under ${formatBytes(MAX_IMAGE_BYTES)}.`);
                  try {
                    const latest = (await flush()) ?? c;
                    const file = await storeMemberFile(f, f.name, m.brandId);
                    adopt(await saveCourse({ ...latest, coverFileId: file.id }));
                    if (latest.coverFileId) await deleteMemberFiles([latest.coverFileId]);
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
                }}
              />
            </CardContent>
          </Card>
          <Button
            variant="ghost"
            className="text-destructive hover:bg-red-50 hover:text-destructive"
            onClick={async () => {
              if (!(await confirm({ title: `Delete “${c.title}”?`, confirmLabel: "Delete course", destructive: true }))) return;
              await flush();
              await deleteCourse(c.id);
              toast.success("Course deleted");
              router.push(m.adminHref("courses"));
            }}
          >
            <Trash2 /> Delete course
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}


"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, CircleCheck, Circle, Clock, Download, ExternalLink, GraduationCap, ListChecks, PlayCircle, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, Checkbox, EmptyState, PageContainer, PageHeader, Progress, SectionTitle, Spinner, Stat } from "@/components/ui/primitives";
import { checklistItems, downloadStoredFile, progressId, setLessonComplete, toggleChecklistItem } from "@/lib/membership/member-actions";
import { courseStats, flattenLessons } from "@/lib/membership/progress";
import { COURSE_LEVEL_LABELS, LESSON_TYPE_LABELS, type Course, type LessonProgress } from "@/lib/membership/types";
import { cn, errorMessage, formatBytes, plural } from "@/lib/utils";
import { useCatalog, useMember, useMemberActivity } from "./member-context";
import { TOOL_HINTS } from "./member-nav";
import { AccessBadge, LockNotice, Markdown, StoredImage } from "./ui";

function useCourses() {
  const m = useMember();
  const { data, loading } = useCatalog();
  const { data: activity } = useMemberActivity();
  const courses = React.useMemo(() => (data?.courses ?? []).filter((c) => m.canSee({ status: c.status, publishAt: null })), [data, m]);
  return { courses, progress: activity?.progress ?? [], loading: loading || !activity };
}

function CourseCard({ course, progress }: { course: Course; progress: LessonProgress[] }) {
  const m = useMember();
  const s = courseStats(course, progress);
  const lock = m.lockReason({ access: course.access, status: course.status, publishAt: null });
  return (
    <Link href={m.href(`courses/${course.id}`)} className="group flex flex-col overflow-hidden rounded-xl border bg-card transition hover:-translate-y-0.5 hover:shadow-md" data-testid="course-card">
      <StoredImage fileId={course.coverFileId} alt="" className="aspect-video w-full" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={course.kind === "tutorial" ? "secondary" : "default"}>{course.kind === "tutorial" ? "Tutorial" : "Course"}</Badge>
          <Badge variant="outline">{COURSE_LEVEL_LABELS[course.level]}</Badge>
          <AccessBadge tier={course.access} />
          {m.isAdmin && course.status !== "published" && <Badge variant="warning">{course.status}</Badge>}
        </div>
        <h3 className="font-semibold leading-snug tracking-tight">{course.title}</h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{course.summary}</p>
        <div className="mt-auto pt-2">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {plural(s.total, "lesson")} · {s.minutes} min
            </span>
            <span>{lock ? lock : s.completed ? `${s.pct}% complete` : "Not started"}</span>
          </div>
          <Progress value={s.pct} className="h-1.5" />
        </div>
      </div>
    </Link>
  );
}

export function TrainingCentre() {
  const m = useMember();
  const { courses, progress, loading } = useCourses();
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }
  const stats = courses.map((c) => ({ c, s: courseStats(c, progress) }));
  const inProgress = stats.filter((x) => x.s.completed > 0 && x.s.completed < x.s.total).sort((a, b) => (b.s.lastActivity ?? "").localeCompare(a.s.lastActivity ?? ""));
  const completedCourses = stats.filter((x) => x.s.total > 0 && x.s.completed === x.s.total).length;
  const lessonsDone = progress.filter((p) => p.completedAt).length;
  const minutes = stats.reduce((n, x) => n + x.c.modules.flatMap((mm) => mm.lessons).filter((l) => progress.some((p) => p.courseId === x.c.id && p.lessonId === l.id && p.completedAt)).reduce((t, l) => t + l.durationMin, 0), 0);
  const tutorials = courses.filter((c) => c.kind === "tutorial");
  const fullCourses = courses.filter((c) => c.kind === "course");

  return (
    <PageContainer width="wide">
      <PageHeader eyebrow={m.brand.name} title="Training Centre" description="Step-by-step courses and quick tool tutorials. Your progress is saved automatically." actions={<Button asChild variant="outline"><Link href={m.href("courses")}>All courses & tutorials</Link></Button>} />
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Lessons completed" value={lessonsDone} />
        <Stat label="Courses finished" value={completedCourses} hint={`of ${courses.length}`} />
        <Stat label="In progress" value={inProgress.length} />
        <Stat label="Learning time" value={`${minutes} min`} />
      </div>

      {inProgress.length > 0 && (
        <section className="mb-8">
          <SectionTitle>Continue where you left off</SectionTitle>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {inProgress.slice(0, 2).map(({ c, s }) => (
              <Card key={c.id} className="flex items-center gap-4 p-4">
                <StoredImage fileId={c.coverFileId} alt="" className="aspect-video w-24 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.title}</p>
                  <p className="truncate text-sm text-muted-foreground">Next: {s.next?.lesson.title}</p>
                  <Progress value={s.pct} className="mt-2 h-1.5" />
                </div>
                <Button asChild size="sm">
                  <Link href={m.href(`courses/${c.id}?lesson=${s.next?.lesson.id ?? ""}`)}>
                    Resume <ArrowRight />
                  </Link>
                </Button>
              </Card>
            ))}
          </div>
        </section>
      )}

      {fullCourses.length > 0 && (
        <section className="mb-8">
          <SectionTitle>Courses</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {fullCourses.map((c) => (
              <CourseCard key={c.id} course={c} progress={progress} />
            ))}
          </div>
        </section>
      )}

      {tutorials.length > 0 && (
        <section>
          <SectionTitle>Tool tutorials</SectionTitle>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {tutorials.map((c) => {
              const s = courseStats(c, progress);
              const tool = c.toolHint ? TOOL_HINTS[c.toolHint] : null;
              return (
                <Card key={c.id} className="flex items-center gap-3 p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    {s.total && s.completed === s.total ? <CircleCheck className="size-5" /> : <PlayCircle className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={m.href(`courses/${c.id}`)} className="block truncate font-semibold hover:text-primary">
                      {c.title}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {plural(s.total, "step")} · {s.minutes} min{tool ? ` · ${tool.label}` : ""}
                    </p>
                  </div>
                  {tool && (
                    <Button asChild size="xs" variant="outline">
                      <Link href={m.href(tool.path)}>
                        <Wrench /> Open tool
                      </Link>
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {!courses.length && <EmptyState icon={<GraduationCap />} title="No training yet" description="Published courses and tutorials will appear here." />}
    </PageContainer>
  );
}

export function CoursesList() {
  const m = useMember();
  const { courses, progress, loading } = useCourses();
  const [kind, setKind] = React.useState<"all" | "course" | "tutorial">("all");
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }
  const shown = courses.filter((c) => kind === "all" || c.kind === kind);
  return (
    <PageContainer width="wide">
      <PageHeader eyebrow={m.brand.name} title="Courses & Tutorials" description="Learn the PLR business and every tool in the suite at your own pace." />
      <div className="mb-5 flex gap-1 rounded-lg border bg-card p-1" role="tablist" aria-label="Filter training">
        {(["all", "course", "tutorial"] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={cn("flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition sm:flex-none", kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>
            {k === "all" ? `All (${courses.length})` : k === "course" ? `Courses (${courses.filter((c) => c.kind === "course").length})` : `Tutorials (${courses.filter((c) => c.kind === "tutorial").length})`}
          </button>
        ))}
      </div>
      {shown.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => (
            <CourseCard key={c.id} course={c} progress={progress} />
          ))}
        </div>
      ) : (
        <EmptyState icon={<BookOpen />} title="Nothing here yet" />
      )}
    </PageContainer>
  );
}

export function CoursePlayer() {
  const { courseId } = useParams<{ courseId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const m = useMember();
  const { courses, progress, loading } = useCourses();
  const [busy, setBusy] = React.useState(false);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }
  const course = courses.find((c) => c.id === courseId);
  if (!course) {
    return (
      <PageContainer width="narrow">
        <EmptyState icon={<GraduationCap />} title="Course not available" action={<Button asChild><Link href={m.href("training")}>Back to training</Link></Button>} />
      </PageContainer>
    );
  }
  const lessons = flattenLessons(course);
  const s = courseStats(course, progress);
  const lessonId = search.get("lesson") || s.next?.lesson.id || lessons[0]?.lesson.id;
  const idx = Math.max(0, lessons.findIndex((x) => x.lesson.id === lessonId));
  const current = lessons[idx]?.lesson;
  const lock = m.lockReason({ access: course.access, status: course.status, publishAt: null });
  const pr = current ? progress.find((p) => p.id === progressId(m.account.id, course.id, current.id)) : undefined;
  const done = !!pr?.completedAt;
  const items = current?.type === "checklist" ? checklistItems(current.body) : [];
  const bodyWithoutItems = current?.type === "checklist" ? current.body.replace(/^\s*[-*]\s+.*$/gm, "").trim() : current?.body ?? "";
  const go = (i: number) => router.replace(m.href(`courses/${course.id}?lesson=${lessons[i].lesson.id}`), { scroll: false });
  const tool = course.toolHint ? TOOL_HINTS[course.toolHint] : null;

  const markDone = async (complete: boolean) => {
    if (!current) return;
    setBusy(true);
    try {
      await setLessonComplete(m.brandId, m.account.id, course.id, current.id, complete);
      if (complete && idx < lessons.length - 1) go(idx + 1);
      if (complete && idx === lessons.length - 1) toast.success(`You've finished “${course.title}”`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer width="wide">
      <Link href={m.href(course.kind === "tutorial" ? "courses" : "training")} className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> {course.kind === "tutorial" ? "Courses & Tutorials" : "Training Centre"}
      </Link>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="grid grid-cols-1 content-start gap-4">
          <Card className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">{course.kind === "tutorial" ? "Tutorial" : "Course"}</p>
            <h1 className="mt-1 text-lg font-semibold leading-snug tracking-tight">{course.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{course.summary}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {s.completed}/{s.total} lessons
              </span>
              <span>{s.pct}%</span>
            </div>
            <Progress value={s.pct} className="mt-1.5 h-1.5" />
            {tool && (
              <Button asChild size="sm" variant="soft" className="mt-4 w-full">
                <Link href={m.href(tool.path)}>
                  <Wrench /> Try it in the {tool.label}
                </Link>
              </Button>
            )}
          </Card>
          <nav aria-label="Lessons" className="grid grid-cols-1 gap-4">
            {course.modules.map((mod) => (
              <div key={mod.id}>
                <p className="mb-1.5 px-1 text-xs font-semibold text-muted-foreground">{mod.title}</p>
                <ul className="grid grid-cols-1 gap-0.5">
                  {mod.lessons.map((l) => {
                    const i = lessons.findIndex((x) => x.lesson.id === l.id);
                    const isDone = progress.some((p) => p.courseId === course.id && p.lessonId === l.id && p.completedAt);
                    return (
                      <li key={l.id}>
                        <button type="button" onClick={() => go(i)} aria-current={l.id === current?.id ? "step" : undefined} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition", l.id === current?.id ? "bg-primary-soft font-medium text-accent-foreground" : "hover:bg-card")}>
                          {isDone ? <CircleCheck className="size-4 shrink-0 text-success" aria-label="Completed" /> : <Circle className="size-4 shrink-0 text-muted-foreground" aria-label="Not completed" />}
                          <span className="min-w-0 flex-1 truncate">{l.title}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{l.durationMin}m</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <article className="min-w-0">
          {lock ? (
            <LockNotice reason={lock} />
          ) : current ? (
            <Card className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{LESSON_TYPE_LABELS[current.type]}</Badge>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" /> {current.durationMin} min
                </span>
                <span>
                  Lesson {idx + 1} of {lessons.length}
                </span>
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight" data-testid="lesson-title">
                {current.title}
              </h2>
              {current.videoUrl && (
                <a href={current.videoUrl} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center gap-3 rounded-xl border bg-secondary/50 p-4 text-sm transition hover:bg-secondary">
                  <PlayCircle className="size-8 text-primary" />
                  <span className="flex-1">
                    <span className="block font-medium">Watch the video</span>
                    <span className="block text-xs text-muted-foreground">Opens on the video host in a new tab</span>
                  </span>
                  <ExternalLink className="size-4 text-muted-foreground" />
                </a>
              )}
              {bodyWithoutItems && <Markdown source={bodyWithoutItems} className="mt-5" />}
              {items.length > 0 && (
                <ul className="mt-5 grid gap-2" data-testid="lesson-checklist">
                  {items.map((it, i) => {
                    const on = pr?.checked.includes(i) ?? false;
                    return (
                      <li key={i}>
                        <label className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition", on ? "border-success/30 bg-success-soft" : "hover:bg-secondary/50")}>
                          <Checkbox checked={on} onCheckedChange={() => toggleChecklistItem(m.brandId, m.account.id, course.id, current.id, i).catch((e) => toast.error(errorMessage(e)))} aria-label={it} className="mt-0.5" />
                          <span className={cn(on && "text-muted-foreground line-through")}>{it}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              {current.attachments.length > 0 && (
                <div className="mt-6 grid gap-2">
                  <p className="text-sm font-semibold">Downloads</p>
                  {current.attachments.map((a) => (
                    <button
                      key={a.fileId}
                      type="button"
                      onClick={() => downloadStoredFile(m.brandId, a.fileId, a.name, m.account.id, "lesson", `${course.title}: ${current.title}`).catch((e) => toast.error(errorMessage(e)))}
                      className="flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition hover:bg-secondary/50"
                    >
                      <Download className="size-4 text-primary" />
                      <span className="flex-1 truncate font-medium">{a.name}</span>
                      <span className="text-xs text-muted-foreground">{formatBytes(a.size)}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-8 flex flex-wrap items-center gap-2 border-t pt-5">
                <Button variant="ghost" disabled={idx === 0} onClick={() => go(idx - 1)}>
                  <ArrowLeft /> Previous
                </Button>
                <div className="flex-1" />
                {done ? (
                  <Button variant="outline" onClick={() => markDone(false)} loading={busy} data-testid="lesson-incomplete">
                    <ListChecks /> Mark as not done
                  </Button>
                ) : (
                  <Button onClick={() => markDone(true)} loading={busy} data-testid="lesson-complete">
                    <CircleCheck /> {idx < lessons.length - 1 ? "Complete and continue" : "Complete course"}
                  </Button>
                )}
                {done && idx < lessons.length - 1 && (
                  <Button variant="ghost" onClick={() => go(idx + 1)}>
                    Next <ArrowRight />
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <EmptyState icon={<BookOpen />} title="This course has no lessons yet" />
          )}
        </article>
      </div>
    </PageContainer>
  );
}

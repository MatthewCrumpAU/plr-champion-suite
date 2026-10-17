import type { Course, Lesson, LessonProgress, Release } from "./types";

export interface CourseStats {
  total: number;
  completed: number;
  pct: number;
  minutes: number;
  /** First incomplete lesson (or the first lesson when all are done). */
  next: { moduleId: string; lesson: Lesson } | null;
  lastActivity: string | null;
}

export function flattenLessons(c: Course): { moduleId: string; lesson: Lesson }[] {
  return c.modules.flatMap((m) => m.lessons.map((lesson) => ({ moduleId: m.id, lesson })));
}

export function courseStats(c: Course, progress: LessonProgress[]): CourseStats {
  const mine = progress.filter((p) => p.courseId === c.id);
  const done = new Set(mine.filter((p) => p.completedAt).map((p) => p.lessonId));
  const all = flattenLessons(c);
  const completed = all.filter((x) => done.has(x.lesson.id)).length;
  const next = all.find((x) => !done.has(x.lesson.id)) ?? all[0] ?? null;
  const lastActivity = mine.reduce<string | null>((acc, p) => (!acc || p.updatedAt > acc ? p.updatedAt : acc), null);
  return { total: all.length, completed, pct: all.length ? Math.round((completed / all.length) * 100) : 0, minutes: all.reduce((n, x) => n + (x.lesson.durationMin || 0), 0), next, lastActivity };
}

/** The drop for the current month if live, otherwise the most recent live one. */
export function currentRelease(releases: Release[], isLive: (r: Release) => boolean, now = new Date()): Release | null {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const live = releases.filter(isLive).sort((a, b) => b.month.localeCompare(a.month));
  return live.find((r) => r.month === month) ?? live[0] ?? null;
}

export function isThisMonth(iso: string | null, now = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d <= now;
}

/**
 * Local calendar-day helpers. Plan days are "YYYY-MM-DD" in the member's own time zone, so a task
 * planned for Tuesday stays on Tuesday wherever the browser is.
 */

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDay(s: string | null | undefined): s is string {
  if (!s) return false;
  const m = DAY_RE.exec(s);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

/** Local midnight of a "YYYY-MM-DD" day. */
export function parseDay(s: string): Date {
  const m = DAY_RE.exec(s);
  if (!m) throw new Error(`Invalid date “${s}”.`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function formatDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayDay(now: Date = new Date()): string {
  return formatDay(now);
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return formatDay(d);
}

/** Whole days from a to b (b - a), ignoring daylight-saving shifts. */
export function daysBetween(a: string, b: string): number {
  const da = parseDay(a);
  const db = parseDay(b);
  return Math.round((Date.UTC(db.getFullYear(), db.getMonth(), db.getDate()) - Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(day: string): number {
  return parseDay(day).getDay();
}

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Tue 14 Oct" */
export function dayLabel(day: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  return parseDay(day).toLocaleDateString(undefined, opts);
}

/** "YYYY-MM" for a date plus a month offset. */
export function monthOf(d: Date, offset = 0): string {
  const x = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
}

export function isMonth(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

/** "October 2026" */
export function monthLabel(month: string): string {
  if (!isMonth(month)) return month;
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** The given day of a month, clamped to the month's length. */
export function dayOfMonth(month: string, day: number): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return formatDay(new Date(y, m - 1, Math.min(Math.max(1, Math.round(day)), last)));
}

/** Next month after "YYYY-MM". */
export function nextMonth(month: string, n = 1): string {
  const [y, m] = month.split("-").map(Number);
  return monthOf(new Date(y, m - 1, 1), n);
}

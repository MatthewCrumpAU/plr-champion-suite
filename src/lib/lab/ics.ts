/**
 * Minimal, standards-compliant iCalendar (RFC 5545) writer for Profit Lab calendars:
 * escaped text, CRLF line endings and lines folded at 75 octets.
 */

export interface IcsAllDayEvent {
  uid: string;
  /** "YYYY-MM-DD" */
  day: string;
  summary: string;
  description?: string;
}

export interface IcsTimedEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
}

export function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold a content line to 75 octets (UTF-8), continuation lines start with a space. */
export function foldLine(line: string): string[] {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return [line];
  const out: string[] = [];
  let cur = "";
  let curBytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74;
    if (curBytes + b > limit) {
      out.push(out.length === 0 ? cur : ` ${cur}`);
      cur = "";
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  if (cur) out.push(out.length === 0 ? cur : ` ${cur}`);
  return out;
}

const dateOnly = (day: string) => day.replace(/-/g, "");
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const x = new Date(y, m - 1, d + 1);
  return `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, "0")}${String(x.getDate()).padStart(2, "0")}`;
}

export function buildIcs(calendarName: string, events: { allDay?: IcsAllDayEvent[]; timed?: IcsTimedEvent[] }, now: Date = new Date()): string {
  const stamp = utcStamp(now);
  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PLR Profit Lab//Profit Lab//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsEscape(calendarName)}`];
  for (const e of events.allDay ?? []) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}@plr-profit-lab`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${dateOnly(e.day)}`, `DTEND;VALUE=DATE:${nextDay(e.day)}`, `SUMMARY:${icsEscape(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
    lines.push("TRANSP:TRANSPARENT", "END:VEVENT");
  }
  for (const e of events.timed ?? []) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}@plr-profit-lab`, `DTSTAMP:${stamp}`, `DTSTART:${utcStamp(e.start)}`, `DTEND:${utcStamp(e.end)}`, `SUMMARY:${icsEscape(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
    if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.flatMap(foldLine).join("\r\n") + "\r\n";
}

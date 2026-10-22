"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  CircleCheck,
  Clock,
  ExternalLink,
  FileArchive,
  FileText,
  Hand,
  Link2,
  ListChecks,
  MapPin,
  MessagesSquare,
  NotebookPen,
  Pencil,
  Plus,
  Radio,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Card, Checkbox, EmptyState, Input, PageContainer, PageHeader, Progress, SectionTitle, Textarea } from "@/components/ui/primitives";
import { useToolHref } from "@/components/common/tool-links";
import { downloadBlob } from "@/lib/export/download";
import { useMemberLive } from "@/lib/membership/hooks";
import { downloadStoredFile } from "@/lib/membership/member-actions";
import { actionDue, actionKey, buildDayIcs, buildDayPack, buildDayStats, checklistKey, countdown, endsAt, phaseOf, runSheetMarkdown, schedule, sessionKey, timeIn, totalMinutes, type BuildPhase } from "@/lib/lab/build-days";
import { dayLabel } from "@/lib/lab/dates";
import { setDone, updateProgress } from "@/lib/lab/store";
import { BUILD_FORMAT_LABELS, BUILD_PHASE_LABELS, BUILD_PHASES, SESSION_KIND_LABELS, type BuildDay, type LabProgress, type SessionKind, type SessionResource } from "@/lib/lab/types";
import { cn, errorMessage, formatBytes, plural, slugify, uid } from "@/lib/utils";
import { useMember } from "@/features/membership/member-context";
import { AccessBadge, LockNotice, Markdown, StatusBadge, StoredImage } from "@/features/membership/ui";
import { CountChip, downloadText, FileRow, Loading, ProgressRing, useLabMember, useLabProgress } from "./lab-ui";

/** Re-renders every `ms` so countdowns and "live now" stay current. */
export function useNow(ms = 30_000) {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function useBuildDays() {
  const m = useMember();
  const lm = useLabMember();
  return useMemberLive(
    async (r) => {
      const [days, progress] = await Promise.all([r.buildDays.list(m.brandId), r.labProgress.listForMember(m.brandId, lm.memberId)]);
      return { days: days.sort((a, b) => a.startsAt.localeCompare(b.startsAt)), progress: new Map(progress.filter((x) => x.kind === "build-day").map((x) => [x.refId, x])) };
    },
    [m.brandId, lm.memberId],
  );
}

const fmtTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const fmtDate = (d: Date, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) => d.toLocaleDateString(undefined, opts);
const localZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "";
  }
};

export function PhaseBadge({ phase }: { phase: BuildPhase }) {
  if (phase === "live")
    return (
      <Badge variant="destructive" className="animate-pulse">
        <Radio /> Live now
      </Badge>
    );
  if (phase === "past") return <Badge variant="outline">Finished</Badge>;
  return <Badge variant="success">Upcoming</Badge>;
}

const RSVP_LABELS = { going: "I'm going", maybe: "Maybe", "not-going": "Can't make it" } as const;

function Rsvp({ b, progress }: { b: BuildDay; progress: LabProgress | null }) {
  const m = useMember();
  const lm = useLabMember();
  const set = (rsvp: LabProgress["rsvp"]) => void updateProgress(m.brandId, lm.memberId, "build-day", b.id, (p) => ({ ...p, rsvp: p.rsvp === rsvp ? null : rsvp })).catch((e) => toast.error(errorMessage(e)));
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Will you be there?">
      {(Object.keys(RSVP_LABELS) as (keyof typeof RSVP_LABELS)[]).map((k) => (
        <Button key={k} size="sm" variant={progress?.rsvp === k ? "default" : "outline"} aria-pressed={progress?.rsvp === k} onClick={() => set(k)} data-testid={`rsvp-${k}`}>
          {k === "going" && <CircleCheck />} {RSVP_LABELS[k]}
        </Button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* List                                                                                         */
/* ------------------------------------------------------------------------------------------ */

export function BuildDaysPage() {
  const m = useMember();
  const now = useNow();
  const { data, loading } = useBuildDays();
  if (loading || !data) return <Loading />;
  const visible = data.days.filter((b) => m.canSee(b));
  const upcoming = visible.filter((b) => phaseOf(b, now) !== "past");
  const past = visible.filter((b) => phaseOf(b, now) === "past").reverse();
  const next = upcoming[0];
  return (
    <PageContainer width="wide">
      <PageHeader
        eyebrow={m.brand.name}
        title="PLR Profit Build Days"
        description="A monthly hands-on workshop: a short lesson, focused build sprints and hot seats, so you leave with something finished. Bring your project — everything you need is on each Build Day's page."
        actions={
          m.isAdmin ? (
            <Button asChild variant="outline">
              <Link href={m.adminHref("build-days")}>Build Day Planner</Link>
            </Button>
          ) : undefined
        }
      />
      {next ? <NextBuildDay b={next} progress={data.progress.get(next.id) ?? null} now={now} /> : <EmptyState icon={<CalendarDays />} title="No Build Day scheduled yet" description={m.isAdmin ? "Plan the next one in the Build Day Planner." : "The next date will appear here."} />}
      {upcoming.length > 1 && (
        <>
          <SectionTitle className="mt-8">Also coming up</SectionTitle>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {upcoming.slice(1).map((b) => (
              <BuildDayCard key={b.id} b={b} progress={data.progress.get(b.id) ?? null} now={now} />
            ))}
          </div>
        </>
      )}
      {past.length > 0 && (
        <>
          <SectionTitle className="mt-8">Past Build Days</SectionTitle>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {past.map((b) => (
              <BuildDayCard key={b.id} b={b} progress={data.progress.get(b.id) ?? null} now={now} />
            ))}
          </div>
        </>
      )}
    </PageContainer>
  );
}

function NextBuildDay({ b, progress, now }: { b: BuildDay; progress: LabProgress | null; now: Date }) {
  const m = useMember();
  const start = new Date(b.startsAt);
  const phase = phaseOf(b, now);
  const left = countdown(b, now);
  return (
    <section className="grid grid-cols-1 overflow-hidden rounded-2xl border bg-card lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" data-testid="next-build-day">
      <StoredImage fileId={b.coverFileId} alt="" className="h-48 w-full lg:h-full" />
      <div className="flex flex-col gap-3 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <PhaseBadge phase={phase} />
          <AccessBadge tier={b.access} />
          {m.isAdmin && <StatusBadge status={b.status} publishAt={b.publishAt} />}
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">{b.title}</h2>
        {b.theme && <p className="text-sm text-muted-foreground">{b.theme}</p>}
        <p className="flex items-center gap-2 text-sm">
          <CalendarDays className="size-4 text-primary" /> {fmtDate(start)} · {fmtTime(start)}–{fmtTime(endsAt(b))}
        </p>
        {left && (
          <p className="text-3xl font-semibold tracking-tight text-primary" data-testid="countdown">
            {left} <span className="text-sm font-medium text-muted-foreground">to go</span>
          </p>
        )}
        <Rsvp b={b} progress={progress} />
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Button asChild>
            <Link href={m.href(`build-days/${b.id}`)}>Open Build Day</Link>
          </Button>
          <Button variant="outline" onClick={() => downloadText(buildDayIcs(b), `${slugify(b.title)}.ics`, "text/calendar")}>
            <CalendarPlus /> Add to calendar
          </Button>
        </div>
      </div>
    </section>
  );
}

function BuildDayCard({ b, progress, now }: { b: BuildDay; progress: LabProgress | null; now: Date }) {
  const m = useMember();
  const s = buildDayStats(b, progress);
  const start = new Date(b.startsAt);
  return (
    <Link href={m.href(`build-days/${b.id}`)} className="flex gap-4 rounded-xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm" data-testid="build-day-card">
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-primary-soft py-2 text-primary">
        <span className="text-[11px] font-semibold uppercase">{start.toLocaleDateString(undefined, { month: "short" })}</span>
        <span className="text-xl font-semibold leading-none">{start.getDate()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <PhaseBadge phase={phaseOf(b, now)} />
          {m.isAdmin && <StatusBadge status={b.status} publishAt={b.publishAt} />}
          {b.replayUrl && <Badge variant="secondary">Recording</Badge>}
        </div>
        <p className="mt-1 truncate font-semibold">{b.title}</p>
        <p className="truncate text-sm text-muted-foreground">{b.theme}</p>
        <div className="mt-2 flex items-center gap-2">
          <Progress value={s.percent} className="max-w-40" />
          <span className="text-xs tabular-nums text-muted-foreground">{s.percent}% done</span>
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Build Day                                                                                    */
/* ------------------------------------------------------------------------------------------ */

export function BuildDayPage() {
  const { buildDayId } = useParams<{ buildDayId: string }>();
  const m = useMember();
  const { data: b, loading } = useMemberLive((r) => r.buildDays.get(buildDayId), [buildDayId]);
  if (loading) return <Loading />;
  if (!b || b.brandId !== m.brandId || !m.canSee(b)) {
    return (
      <PageContainer width="narrow">
        <EmptyState icon={<CalendarDays />} title="This Build Day isn't available" description={b && b.brandId === m.brandId ? "It hasn't been announced yet." : "The link may be wrong."} action={<Button asChild><Link href={m.href("build-days")}>All Build Days</Link></Button>} />
      </PageContainer>
    );
  }
  return <BuildDayView b={b} />;
}

function ResourceLink({ r, label }: { r: SessionResource; label: string }) {
  const m = useMember();
  const lm = useLabMember();
  const remap = useToolHref();
  if (r.kind === "file" && r.fileId) {
    return (
      <Button
        size="xs"
        variant="outline"
        onClick={() => downloadStoredFile(m.brandId, r.fileId!, r.fileName ?? r.title, lm.memberId, "resource", label).catch((e) => toast.error(errorMessage(e)))}
      >
        <FileText /> {r.title}
        {r.size ? <span className="text-muted-foreground">({formatBytes(r.size)})</span> : null}
      </Button>
    );
  }
  if (!r.url) return null;
  const internal = r.url.startsWith("/");
  return (
    <Button asChild size="xs" variant="outline">
      {internal ? (
        <Link href={remap(r.url)}>
          <Link2 /> {r.title}
        </Link>
      ) : (
        <a href={r.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink /> {r.title}
        </a>
      )}
    </Button>
  );
}

const KIND_TONE: Record<SessionKind, string> = { welcome: "bg-sky-100 text-sky-800", teach: "bg-violet-100 text-violet-800", build: "bg-primary-soft text-accent-foreground", "hot-seat": "bg-amber-100 text-amber-900", qa: "bg-teal-100 text-teal-800", break: "bg-secondary text-muted-foreground", review: "bg-rose-100 text-rose-800" };

function BuildDayView({ b }: { b: BuildDay }) {
  const m = useMember();
  const lm = useLabMember();
  const now = useNow();
  const { data: progress } = useLabProgress("build-day", b.id);
  const [busy, setBusy] = React.useState(false);
  const [ownTitle, setOwnTitle] = React.useState("");
  const storedJournal = progress?.journal ?? "";
  const [journal, setJournal] = React.useState(storedJournal);
  React.useEffect(() => setJournal(storedJournal), [storedJournal]);
  const usable = m.canUse(b);
  const lock = m.lockReason(b);
  const phase = phaseOf(b, now);
  const left = countdown(b, now);
  const start = new Date(b.startsAt);
  const sessions = schedule(b);
  const stats = buildDayStats(b, progress);
  const done = progress?.done ?? {};
  const zone = localZone();
  const hostTime = b.timezone && zone && b.timezone !== zone ? timeIn(start, b.timezone) : null;
  const base = slugify(b.title);

  const tick = (key: string, v: boolean) => void setDone(m.brandId, lm.memberId, "build-day", b.id, key, v).catch((e) => toast.error(errorMessage(e)));
  const update = (fn: (p: LabProgress) => LabProgress) => void updateProgress(m.brandId, lm.memberId, "build-day", b.id, fn).catch((e) => toast.error(errorMessage(e)));

  const pack = async () => {
    setBusy(true);
    try {
      const res = await buildDayPack(b);
      downloadBlob(res.blob, res.fileName);
      toast.success(`Downloading ${res.fileName}`, { description: `${plural(res.files, "file")} · ${formatBytes(res.blob.size)}` });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer width="wide">
      <Link href={m.href("build-days")} className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All Build Days
      </Link>
      <section className="rounded-2xl border bg-card p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_280px]">
          <StoredImage fileId={b.coverFileId} alt="" className="aspect-video w-full self-start rounded-xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <PhaseBadge phase={phase} />
              <Badge variant="secondary">{BUILD_FORMAT_LABELS[b.format]}</Badge>
              <AccessBadge tier={b.access} />
              {m.isAdmin && <StatusBadge status={b.status} publishAt={b.publishAt} />}
              {b.isSample && <Badge variant="sample">Sample</Badge>}
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight" data-testid="build-day-title">
              {b.title}
            </h1>
            {b.theme && <p className="mt-1 text-muted-foreground">{b.theme}</p>}
            <ul className="mt-4 grid gap-1.5 text-sm">
              <li className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" /> {fmtDate(start)}
              </li>
              <li className="flex items-center gap-2">
                <Clock className="size-4 text-primary" /> {fmtTime(start)}–{fmtTime(endsAt(b))} your time ({Math.round((totalMinutes(b) / 60) * 10) / 10} hours){hostTime ? ` · ${hostTime} for the host` : ""}
              </li>
              {b.host && (
                <li className="flex items-center gap-2">
                  <Users className="size-4 text-primary" /> Hosted by {b.host}
                  {b.capacity ? ` · ${b.capacity} places` : ""}
                </li>
              )}
              {b.location && (
                <li className="flex items-center gap-2">
                  <MapPin className="size-4 text-primary" /> {b.location}
                </li>
              )}
            </ul>
            {left && (
              <p className="mt-4 text-2xl font-semibold tracking-tight text-primary" data-testid="countdown">
                Starts in {left}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              {usable && b.joinUrl && phase !== "past" && (
                <Button asChild variant={phase === "live" ? "default" : "outline"}>
                  <a href={b.joinUrl} target="_blank" rel="noopener noreferrer" data-testid="join-link">
                    <Video /> {phase === "live" ? "Join now" : "Join link"}
                  </a>
                </Button>
              )}
              {usable && b.replayUrl && (
                <Button asChild variant="outline">
                  <a href={b.replayUrl} target="_blank" rel="noopener noreferrer">
                    <Video /> Watch the recording
                  </a>
                </Button>
              )}
              <Button variant="outline" onClick={() => downloadText(buildDayIcs(b), `${base}.ics`, "text/calendar")} data-testid="build-day-ics">
                <CalendarPlus /> Add to calendar
              </Button>
              <Button variant="outline" onClick={pack} loading={busy} disabled={!usable} data-testid="build-day-pack">
                <FileArchive /> Download everything
              </Button>
              {m.isAdmin && (
                <>
                  <Button variant="ghost" onClick={() => downloadText(runSheetMarkdown(b), `${base}-run-sheet.md`, "text/markdown")}>
                    <ListChecks /> Run sheet
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href={m.adminHref(`build-days/${b.id}`)}>
                      <Pencil /> Edit
                    </Link>
                  </Button>
                </>
              )}
            </div>
            {!b.joinUrl && b.format === "live-online" && phase !== "past" && <p className="mt-2 text-xs text-muted-foreground">The join link will appear here before the day.</p>}
          </div>
          <div className="grid grid-cols-1 content-start gap-4 rounded-xl bg-secondary/50 p-4 lg:col-span-2 xl:col-span-1">
            <div className="flex items-center gap-3">
              <ProgressRing value={stats.percent} size={56} />
              <div className="text-sm">
                <p className="font-semibold">Your progress</p>
                <p className="text-xs text-muted-foreground" data-testid="build-day-progress">
                  {stats.done} of {stats.total} done
                </p>
              </div>
            </div>
            {phase !== "past" && (
              <div>
                <p className="mb-2 text-[13px] font-medium">Will you be there?</p>
                <Rsvp b={b} progress={progress ?? null} />
              </div>
            )}
            {phase !== "upcoming" && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!progress?.attended} onCheckedChange={(v) => update((p) => ({ ...p, attended: !!v }))} data-testid="attended" /> I took part{phase === "past" ? " (live or with the recording)" : ""}
              </label>
            )}
            {!lm.isOwner && <p className="text-xs text-muted-foreground">Saved for {lm.name}.</p>}
          </div>
        </div>
      </section>

      {lock && <LockNotice reason={lock} className="mt-6" />}

      {b.outcome && (
        <Card className="mt-6 p-5">
          <p className="text-sm font-semibold">You&apos;ll leave with</p>
          <Markdown source={b.outcome} className="mt-1 text-sm" />
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0">
          <SectionTitle action={<CountChip done={stats.sessions.done} total={stats.sessions.total} />}>Agenda</SectionTitle>
          <ol className="grid grid-cols-1 gap-2" data-testid="agenda">
            {sessions.map((s) => {
              const isBreak = s.kind === "break";
              const key = sessionKey(s.id);
              const live = now >= s.start && now < s.end;
              return (
                <li key={s.id} className={cn("grid grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-xl border bg-card p-3 sm:grid-cols-[96px_minmax(0,1fr)]", isBreak && "bg-secondary/40", live && "border-primary ring-1 ring-primary")} data-testid="agenda-session">
                  <div className="text-xs">
                    <p className="font-semibold tabular-nums">{fmtTime(s.start)}</p>
                    <p className="text-muted-foreground">{s.durationMin} min</p>
                    {live && <Badge className="mt-1">Now</Badge>}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold", KIND_TONE[s.kind])}>{SESSION_KIND_LABELS[s.kind]}</span>
                        <p className="mt-1 font-semibold">{s.title}</p>
                        {s.presenter && !isBreak && <p className="text-xs text-muted-foreground">with {s.presenter}</p>}
                      </div>
                      {!isBreak && usable && (
                        <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                          <Checkbox checked={!!done[key]} onCheckedChange={(v) => tick(key, !!v)} aria-label={`Mark “${s.title}” done`} /> Done
                        </label>
                      )}
                    </div>
                    {s.description && <Markdown source={s.description} className="mt-1.5 text-sm text-muted-foreground" />}
                    {s.outcome && <p className="mt-1.5 text-sm"><span className="font-medium">Outcome:</span> {s.outcome}</p>}
                    {usable && s.resources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {s.resources.map((r) => (
                          <ResourceLink key={r.id} r={r} label={`${b.title}: ${s.title}`} />
                        ))}
                      </div>
                    )}
                    {s.prompts.length > 0 && (
                      <ul className="mt-2 grid gap-1 text-[13px] text-muted-foreground">
                        {s.prompts.map((p, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <MessagesSquare className="mt-0.5 size-3.5 shrink-0" /> {p}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="grid grid-cols-1 content-start gap-6">
          {usable && b.materials.length > 0 && (
            <section>
              <SectionTitle>Materials</SectionTitle>
              <Card className="p-0">
                <ul className="divide-y">
                  {b.materials.map((x) => (
                    <FileRow key={x.id} file={{ fileId: x.fileId, name: x.fileName, size: x.size }} label={`${b.title}: ${x.title}`} />
                  ))}
                </ul>
              </Card>
            </section>
          )}

          <section>
            <SectionTitle action={<CountChip done={stats.checklist.done} total={stats.checklist.total} />}>Implementation checklist</SectionTitle>
            <Card className="grid grid-cols-1 gap-4 p-4">
              {BUILD_PHASES.map((ph) => {
                const items = b.checklist.filter((c) => c.phase === ph);
                if (!items.length) return null;
                return (
                  <div key={ph}>
                    <p className="mb-2 text-[13px] font-semibold">{BUILD_PHASE_LABELS[ph]}</p>
                    <ul className="grid grid-cols-1 gap-2">
                      {items.map((c) => {
                        const id = `bc-${c.id}`;
                        const key = checklistKey(c.id);
                        return (
                          <li key={c.id} className="flex items-start gap-2.5">
                            <Checkbox id={id} checked={!!done[key]} onCheckedChange={(v) => tick(key, !!v)} className="mt-0.5" disabled={!usable} />
                            <label htmlFor={id} className={cn("cursor-pointer text-sm leading-snug", done[key] && "text-muted-foreground line-through")}>
                              {c.text}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </Card>
          </section>

          <section>
            <SectionTitle action={<CountChip done={stats.actions.done} total={stats.actions.total} />}>Action items</SectionTitle>
            <Card className="grid grid-cols-1 gap-3 p-4">
              <ul className="grid grid-cols-1 gap-2" data-testid="action-items">
                {b.actions.map((a) => {
                  const key = actionKey(a.id);
                  const id = `ba-${a.id}`;
                  return (
                    <li key={a.id} className="flex items-start gap-2.5">
                      <Checkbox id={id} checked={!!done[key]} onCheckedChange={(v) => tick(key, !!v)} className="mt-0.5" disabled={!usable} />
                      <label htmlFor={id} className={cn("min-w-0 flex-1 cursor-pointer text-sm leading-snug", done[key] && "text-muted-foreground line-through")}>
                        {a.title}
                        <span className="block text-xs text-muted-foreground">Due {dayLabel(actionDue(b, a))}</span>
                      </label>
                    </li>
                  );
                })}
                {(progress?.ownActions ?? []).map((a) => (
                  <li key={a.id} className="flex items-start gap-2.5" data-testid="own-action">
                    <Checkbox id={`oa-${a.id}`} checked={a.done} onCheckedChange={(v) => update((p) => ({ ...p, ownActions: p.ownActions.map((x) => (x.id === a.id ? { ...x, done: !!v } : x)) }))} className="mt-0.5" />
                    <label htmlFor={`oa-${a.id}`} className={cn("min-w-0 flex-1 cursor-pointer text-sm leading-snug", a.done && "text-muted-foreground line-through")}>
                      {a.title}
                      <span className="block text-xs text-muted-foreground">Your action</span>
                    </label>
                    <Button variant="ghost" size="icon-xs" aria-label={`Remove “${a.title}”`} onClick={() => update((p) => ({ ...p, ownActions: p.ownActions.filter((x) => x.id !== a.id) }))}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
              {usable && (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const title = ownTitle.trim();
                    if (!title) return;
                    update((p) => ({ ...p, ownActions: [...p.ownActions, { id: uid("oa"), title, done: false }] }));
                    setOwnTitle("");
                  }}
                >
                  <Input value={ownTitle} onChange={(e) => setOwnTitle(e.target.value)} placeholder="Add your own action…" aria-label="Your own action" data-testid="own-action-input" />
                  <Button type="submit" variant="outline" size="icon" aria-label="Add action" disabled={!ownTitle.trim()}>
                    <Plus />
                  </Button>
                </form>
              )}
            </Card>
          </section>

          {usable && (
            <section>
              <SectionTitle>Wins journal</SectionTitle>
              <Card className="grid grid-cols-1 gap-2 p-4">
                <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
                  <NotebookPen className="mt-0.5 size-4 shrink-0" /> {b.community.prompt || "What did you finish today?"}
                </p>
                <Textarea
                  rows={4}
                  value={journal}
                  onChange={(e) => setJournal(e.target.value)}
                  onBlur={() => journal !== storedJournal && update((p) => ({ ...p, journal }))}
                  aria-label="Wins journal"
                  data-testid="journal"
                />
                {b.community.enabled && (
                  <Callout tone="neutral" icon={<Hand />}>
                    Sharing wins with other members is coming with the community area. Your journal stays private until then.
                  </Callout>
                )}
              </Card>
            </section>
          )}
        </div>
      </div>
    </PageContainer>
  );
}


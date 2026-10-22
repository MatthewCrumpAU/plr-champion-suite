"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, CalendarPlus, CopyPlus, Eye, FileArchive, Link2, ListChecks, Pencil, Plus, Rocket, Trash2, Undo2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Field, Input, NativeSelect, PageContainer, PageHeader, Switch, Textarea } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { FileDrop } from "@/components/common/file-drop";
import { SaveStatus } from "@/components/common/save-status";
import { downloadBlob } from "@/lib/export/download";
import { useMemberLive } from "@/lib/membership/hooks";
import { deleteMemberFiles, MAX_IMAGE_BYTES, MAX_PRODUCT_FILE_BYTES, storeMemberFile } from "@/lib/membership/files";
import { ACCESS_TIER_LABELS, ACCESS_TIERS, type AccessTier } from "@/lib/membership/types";
import { buildDayIcs, buildDayPack, buildDayStats, deleteBuildDay, duplicateBuildDay, endsAt, newBuildDay, newSession, phaseOf, runSheetMarkdown, saveBuildDay, schedule, storeMaterial, storeSessionFile, totalMinutes } from "@/lib/lab/build-days";
import { monthLabel, monthOf } from "@/lib/lab/dates";
import { BUILD_FORMAT_LABELS, BUILD_PHASE_LABELS, BUILD_PHASES, SESSION_KIND_LABELS, type BuildChecklistPhase, type BuildDay, type BuildFormat, type SessionKind } from "@/lib/lab/types";
import { cn, errorMessage, formatBytes, plural, slugify, uid } from "@/lib/utils";
import { useMember } from "@/features/membership/member-context";
import { AdminGate } from "@/features/membership/admin/admin-gate";
import { fromLocalInput, toLocalInput } from "@/features/membership/admin/product-editor";
import { useDraft } from "@/features/membership/admin/use-draft";
import { StatusBadge, StoredImage } from "@/features/membership/ui";
import { downloadText, Loading } from "../lab-ui";
import { PhaseBadge } from "../build-days";
import { EditorRow, LinesField, move, RowControls } from "./fields";

const fmt = (d: Date) => d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const fmtTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/* ------------------------------------------------------------------------------------------ */
/* List                                                                                         */
/* ------------------------------------------------------------------------------------------ */

export function BuildDaysAdmin() {
  return (
    <AdminGate>
      <BuildDayList />
    </AdminGate>
  );
}

function BuildDayList() {
  const m = useMember();
  const router = useRouter();
  const confirm = useConfirm();
  const { data, loading } = useMemberLive(
    async (r) => {
      const [days, progress] = await Promise.all([r.buildDays.list(m.brandId), r.labProgress.list(m.brandId)]);
      const rsvps = new Map<string, number>();
      for (const p of progress) if (p.kind === "build-day" && p.rsvp === "going") rsvps.set(p.refId, (rsvps.get(p.refId) ?? 0) + 1);
      return { days: days.sort((a, b) => b.startsAt.localeCompare(a.startsAt)), rsvps };
    },
    [m.brandId],
  );
  const [month, setMonth] = React.useState(monthOf(new Date(), 1));
  const [busy, setBusy] = React.useState(false);
  if (loading || !data) return <Loading />;

  const create = async () => {
    if (!/^\d{4}-\d{2}$/.test(month)) return toast.error("Choose a month.");
    setBusy(true);
    try {
      const b = await saveBuildDay(newBuildDay(m.brandId, month));
      router.push(m.adminHref(`build-days/${b.id}`));
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader eyebrow="Profit Lab Admin" title="Build Day Planner" description="Plan each month's workshop: the agenda with real session times, resources for each session, downloadable materials, an implementation checklist and action items. Live sessions use your own meeting link — there's no streaming built in." />
      <Card className="mb-6 flex flex-wrap items-end gap-3 p-4">
        <Field label="Build Day month" htmlFor="bd-new-month" className="w-48">
          <Input id="bd-new-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Field>
        <Button onClick={create} loading={busy} data-testid="new-build-day">
          <CalendarPlus /> Plan a Build Day
        </Button>
        <p className="text-xs text-muted-foreground">Starts with a proven agenda (teach, two build sprints, hot seats, share and commit) on the second Saturday at 10am.</p>
      </Card>
      {data.days.length === 0 ? (
        <EmptyState icon={<CalendarDays />} title="No Build Days yet" />
      ) : (
        <div className="grid grid-cols-1 gap-3" data-testid="admin-build-days">
          {data.days.map((b) => (
            <Card key={b.id} className="flex flex-wrap items-center gap-4 p-3 sm:flex-nowrap">
              <StoredImage fileId={b.coverFileId} alt="" className="h-14 w-24 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{b.title}</p>
                  <PhaseBadge phase={phaseOf(b)} />
                  <StatusBadge status={b.status} publishAt={b.publishAt} />
                  {b.isSample && <Badge variant="sample">Sample</Badge>}
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {fmt(new Date(b.startsAt))} · {plural(b.agenda.length, "session")} · {plural(b.materials.length, "material")} · {data.rsvps.get(b.id) ?? 0} going
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button asChild size="xs" variant="ghost">
                  <Link href={m.href(`build-days/${b.id}`)}>
                    <Eye /> View
                  </Link>
                </Button>
                <Button asChild size="xs" variant="outline">
                  <Link href={m.adminHref(`build-days/${b.id}`)}>
                    <Pencil /> Edit
                  </Link>
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={async () => {
                    const next = await duplicateBuildDay(b.id);
                    if (next) {
                      toast.success(`Planned for ${monthLabel(next.month)}`);
                      router.push(m.adminHref(`build-days/${next.id}`));
                    }
                  }}
                  data-testid="plan-next-month"
                >
                  <CopyPlus /> Plan next month
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Delete ${b.title}`}
                  onClick={async () => {
                    if (!(await confirm({ title: `Delete “${b.title}”?`, description: "The Build Day, its materials and session files are deleted.", confirmLabel: "Delete Build Day", destructive: true }))) return;
                    await deleteBuildDay(b.id);
                    toast.success("Build Day deleted");
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Editor                                                                                       */
/* ------------------------------------------------------------------------------------------ */

export function BuildDayEditor() {
  return (
    <AdminGate>
      <EditorLoader />
    </AdminGate>
  );
}

function EditorLoader() {
  const { buildDayId } = useParams<{ buildDayId: string }>();
  const m = useMember();
  const { data: stored, loading } = useMemberLive((r) => r.buildDays.get(buildDayId), [buildDayId]);
  if (loading) return <Loading />;
  if (!stored || stored.brandId !== m.brandId) {
    return (
      <PageContainer width="narrow">
        <EmptyState icon={<CalendarDays />} title="Build Day not found" action={<Button asChild><Link href={m.adminHref("build-days")}>All Build Days</Link></Button>} />
      </PageContainer>
    );
  }
  return <BuildDayForm key={stored.id} stored={stored} />;
}

type Update = (patch: Partial<BuildDay> | ((d: BuildDay) => BuildDay)) => void;
type Run = (label: string, fn: (latest: BuildDay) => Promise<BuildDay>, done?: string) => Promise<void>;

function BuildDayForm({ stored }: { stored: BuildDay }) {
  const m = useMember();
  const { draft, update, flush, adopt, state, lastSavedAt } = useDraft<BuildDay>(stored, (b) => saveBuildDay(b));
  const [busy, setBusy] = React.useState<string | null>(null);
  const [when, setWhen] = React.useState(toLocalInput(stored.publishAt ?? new Date().toISOString()));
  if (!draft) return null;
  const b = draft;

  const run: Run = async (label, fn, done) => {
    setBusy(label);
    try {
      const latest = (await flush()) ?? b;
      adopt(await fn(latest));
      if (done) toast.success(done);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const whenIso = fromLocalInput(when);
  const future = whenIso ? new Date(whenIso) > new Date() : false;
  const base = slugify(b.title);

  return (
    <PageContainer width="wide">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={m.adminHref("build-days")}>
            <ArrowLeft /> Build Days
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight" data-testid="build-day-editor-title">
          {b.title}
        </h1>
        <StatusBadge status={b.status} publishAt={b.publishAt} />
        <SaveStatus state={state} lastSavedAt={lastSavedAt} onRetry={() => void flush()} />
        <Button asChild variant="outline" size="sm">
          <Link href={m.href(`build-days/${b.id}`)} onClick={() => void flush()}>
            <Eye /> Member view
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Tabs defaultValue="details">
          <TabsList className="flex w-full justify-start overflow-x-auto">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="agenda" data-testid="tab-agenda">
              Agenda
            </TabsTrigger>
            <TabsTrigger value="materials">Materials</TabsTrigger>
            <TabsTrigger value="checklist">Checklist & actions</TabsTrigger>
            <TabsTrigger value="links">Links & community</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="mt-4">
            <DetailsTab b={b} update={update} run={run} busy={busy} />
          </TabsContent>
          <TabsContent value="agenda" className="mt-4">
            <AgendaTab b={b} update={update} run={run} busy={busy} />
          </TabsContent>
          <TabsContent value="materials" className="mt-4">
            <MaterialsTab b={b} update={update} run={run} busy={busy} />
          </TabsContent>
          <TabsContent value="checklist" className="mt-4">
            <ChecklistTab b={b} update={update} />
          </TabsContent>
          <TabsContent value="links" className="mt-4">
            <LinksTab b={b} update={update} />
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-1 content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Announce to members</CardTitle>
              <CardDescription>Members see the Build Day (and can RSVP) from this moment.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3">
              <Field label="Announce on" htmlFor="bd-when">
                <Input id="bd-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
              </Field>
              <Button onClick={() => whenIso && run("publish", (latest) => saveBuildDay({ ...latest, status: future ? "scheduled" : "published", publishAt: whenIso }), future ? "Announcement scheduled" : "Announced to members")} loading={busy === "publish"} disabled={!whenIso} data-testid="publish-build-day">
                <Rocket /> {future ? "Schedule announcement" : "Announce now"}
              </Button>
              {b.status !== "draft" && (
                <Button variant="ghost" size="sm" onClick={() => update({ status: "draft" })}>
                  <Undo2 /> Back to draft
                </Button>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Run the day</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadText(runSheetMarkdown(b), `${base}-run-sheet.md`, "text/markdown")} data-testid="run-sheet">
                <ListChecks /> Host run sheet (.md)
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadText(buildDayIcs(b), `${base}.ics`, "text/calendar")}>
                <CalendarPlus /> Calendar invite (.ics)
              </Button>
              <Button
                variant="outline"
                size="sm"
                loading={busy === "pack"}
                onClick={() =>
                  run("pack", async (latest) => {
                    const res = await buildDayPack(latest);
                    downloadBlob(res.blob, res.fileName);
                    return latest;
                  })
                }
              >
                <FileArchive /> Member pack (.zip)
              </Button>
            </CardContent>
          </Card>
          <Attendees b={b} />
        </div>
      </div>
    </PageContainer>
  );
}

function DetailsTab({ b, update, run, busy }: { b: BuildDay; update: Update; run: Run; busy: string | null }) {
  const m = useMember();
  const start = toLocalInput(b.startsAt);
  return (
    <Card>
      <CardContent className="grid grid-cols-1 gap-4 pt-6">
        <div className="grid grid-cols-1 gap-4 items-start sm:grid-cols-2">
          <Field label="Title" htmlFor="bd-title">
            <Input id="bd-title" value={b.title} onChange={(e) => update({ title: e.target.value })} data-testid="bd-title" />
          </Field>
          <Field label="Theme" htmlFor="bd-theme" hint="What everyone builds, e.g. “Write your launch emails”.">
            <Input id="bd-theme" value={b.theme} onChange={(e) => update({ theme: e.target.value })} />
          </Field>
          <Field label="Starts" htmlFor="bd-start" hint={`Ends ${fmtTime(endsAt(b))} (${Math.round((totalMinutes(b) / 60) * 10) / 10} hours of agenda).`}>
            <Input
              id="bd-start"
              type="datetime-local"
              value={start}
              onChange={(e) => {
                const iso = fromLocalInput(e.target.value);
                if (iso) update({ startsAt: iso, month: monthOf(new Date(iso)) });
              }}
              data-testid="bd-start"
            />
          </Field>
          <Field label="Host's time zone" htmlFor="bd-tz" hint="Members see times in their own zone too.">
            <Input id="bd-tz" value={b.timezone} onChange={(e) => update({ timezone: e.target.value })} />
          </Field>
          <Field label="Format" htmlFor="bd-format">
            <NativeSelect id="bd-format" value={b.format} onChange={(e) => update({ format: e.target.value as BuildFormat })}>
              {(Object.keys(BUILD_FORMAT_LABELS) as BuildFormat[]).map((f) => (
                <option key={f} value={f}>
                  {BUILD_FORMAT_LABELS[f]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Host" htmlFor="bd-host">
            <Input id="bd-host" value={b.host} onChange={(e) => update({ host: e.target.value })} />
          </Field>
          <Field label="Places" htmlFor="bd-cap" hint="Leave empty for no limit." optional>
            <Input id="bd-cap" type="number" min={1} value={b.capacity ?? ""} onChange={(e) => update({ capacity: e.target.value === "" ? null : Math.round(Number(e.target.value)) })} />
          </Field>
          <Field label="Who can join" htmlFor="bd-access">
            <NativeSelect id="bd-access" value={b.access} onChange={(e) => update({ access: e.target.value as AccessTier })}>
              {ACCESS_TIERS.map((t) => (
                <option key={t} value={t}>
                  {ACCESS_TIER_LABELS[t]}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        {b.format === "in-person" && (
          <Field label="Venue" htmlFor="bd-loc">
            <Input id="bd-loc" value={b.location} onChange={(e) => update({ location: e.target.value })} />
          </Field>
        )}
        <Field label="What everyone leaves with" htmlFor="bd-outcome" hint="Markdown." optional>
          <Textarea id="bd-outcome" rows={4} value={b.outcome} onChange={(e) => update({ outcome: e.target.value })} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start">
          <StoredImage fileId={b.coverFileId} alt="" className="h-24 w-44 rounded-md shadow" />
          <FileDrop
            accept="image/*"
            compact
            title={b.coverFileId ? "Replace banner" : "Upload banner"}
            disabled={!!busy}
            onFiles={([f]) => {
              if (!f.type.startsWith("image/")) return toast.error("Choose an image.");
              if (f.size > MAX_IMAGE_BYTES) return toast.error(`Images must be under ${formatBytes(MAX_IMAGE_BYTES)}.`);
              void run("cover", async (latest) => {
                const file = await storeMemberFile(f, f.name, m.brandId);
                const saved = await saveBuildDay({ ...latest, coverFileId: file.id });
                if (latest.coverFileId) await deleteMemberFiles([latest.coverFileId]);
                return saved;
              });
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function AgendaTab({ b, update, run, busy }: { b: BuildDay; update: Update; run: Run; busy: string | null }) {
  const m = useMember();
  const [kind, setKind] = React.useState<SessionKind>("build");
  const times = schedule(b);
  const list = b.agenda;
  const setList = (agenda: typeof list) => update({ agenda });
  const set = (id: string, patch: Partial<(typeof list)[number]>) => setList(list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  return (
    <div className="grid grid-cols-1 gap-3">
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <p className="flex-1 text-sm">
          {plural(list.length, "session")} · {fmtTime(new Date(b.startsAt))}–{fmtTime(endsAt(b))} · {Math.round((totalMinutes(b) / 60) * 10) / 10} hours
        </p>
        <NativeSelect aria-label="New session type" value={kind} onChange={(e) => setKind(e.target.value as SessionKind)} className="w-40">
          {(Object.keys(SESSION_KIND_LABELS) as SessionKind[]).map((k) => (
            <option key={k} value={k}>
              {SESSION_KIND_LABELS[k]}
            </option>
          ))}
        </NativeSelect>
        <Button size="sm" onClick={() => setList([...list, newSession(kind)])} data-testid="add-session">
          <Plus /> Add session
        </Button>
      </Card>
      {list.map((s, i) => (
        <EditorRow key={s.id} testId="session-editor">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 text-xs font-semibold tabular-nums text-primary">
              {fmtTime(times[i].start)}–{fmtTime(times[i].end)}
            </span>
            <NativeSelect aria-label="Session type" value={s.kind} onChange={(e) => set(s.id, { kind: e.target.value as SessionKind })} className="w-36">
              {(Object.keys(SESSION_KIND_LABELS) as SessionKind[]).map((k) => (
                <option key={k} value={k}>
                  {SESSION_KIND_LABELS[k]}
                </option>
              ))}
            </NativeSelect>
            <Input aria-label="Minutes" type="number" min={1} max={600} value={s.durationMin} onChange={(e) => set(s.id, { durationMin: Number(e.target.value) || 0 })} className="w-20" />
            <span className="text-xs text-muted-foreground">min</span>
            <div className="ml-auto">
              <RowControls index={i} count={list.length} onMove={(a, z) => setList(move(list, a, z))} onRemove={() => setList(list.filter((x) => x.id !== s.id))} label={s.title || "session"} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr]">
            <Input aria-label="Session title" value={s.title} onChange={(e) => set(s.id, { title: e.target.value })} placeholder="Session title" />
            {s.kind !== "break" && <Input aria-label="Presenter" value={s.presenter} onChange={(e) => set(s.id, { presenter: e.target.value })} placeholder="Presenter" />}
          </div>
          {s.kind !== "break" && (
            <>
              <Textarea aria-label="Description" rows={2} value={s.description} onChange={(e) => set(s.id, { description: e.target.value })} placeholder="What happens in this session (Markdown)" />
              <Input aria-label="Outcome" value={s.outcome} onChange={(e) => set(s.id, { outcome: e.target.value })} placeholder="What attendees have at the end" />
              <LinesField value={s.prompts} onChange={(prompts) => set(s.id, { prompts })} rows={2} placeholder="Discussion prompts, one per line" />
              <div className="grid grid-cols-1 gap-2">
                {s.resources.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 rounded-lg bg-secondary/40 px-2 py-1.5 text-sm">
                    {r.kind === "file" ? <FileArchive className="size-3.5 shrink-0" /> : <Link2 className="size-3.5 shrink-0" />}
                    <Input aria-label="Resource title" value={r.title} onChange={(e) => set(s.id, { resources: s.resources.map((x) => (x.id === r.id ? { ...x, title: e.target.value } : x)) })} className="h-8" />
                    {r.kind === "link" && <Input aria-label="Resource link" value={r.url} onChange={(e) => set(s.id, { resources: s.resources.map((x) => (x.id === r.id ? { ...x, url: e.target.value } : x)) })} className="h-8" placeholder="https://… or /sales-pages" />}
                    {r.kind === "file" && <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(r.size)}</span>}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Remove resource"
                      onClick={() => {
                        set(s.id, { resources: s.resources.filter((x) => x.id !== r.id) });
                        if (r.fileId) void deleteMemberFiles([r.fileId]);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" size="xs" onClick={() => set(s.id, { resources: [...s.resources, { id: uid("sr"), title: "Link", kind: "link", fileId: null, fileName: null, size: null, url: "" }] })}>
                    <Link2 /> Add link
                  </Button>
                  <label className={cn("inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium hover:bg-secondary", busy && "pointer-events-none opacity-50")}>
                    <Plus className="size-3.5" /> Add file
                    <input
                      type="file"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (!f) return;
                        if (f.size > MAX_PRODUCT_FILE_BYTES) return toast.error(`Files must be under ${formatBytes(MAX_PRODUCT_FILE_BYTES)}.`);
                        void run("resource", async (latest) => {
                          const res = await storeSessionFile(f, f.name, m.brandId);
                          return saveBuildDay({ ...latest, agenda: latest.agenda.map((x) => (x.id === s.id ? { ...x, resources: [...x.resources, res] } : x)) });
                        }, "File added");
                      }}
                    />
                  </label>
                </div>
              </div>
            </>
          )}
        </EditorRow>
      ))}
    </div>
  );
}

function MaterialsTab({ b, update, run, busy }: { b: BuildDay; update: Update; run: Run; busy: string | null }) {
  const m = useMember();
  const list = b.materials;
  const set = (id: string, patch: Partial<(typeof list)[number]>) => update({ materials: list.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Downloadable materials</CardTitle>
        <CardDescription>Workbooks, templates and slides members download before or during the day. They&apos;re all in the member pack ZIP.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3">
        {list.map((x, i) => (
          <EditorRow key={x.id}>
            <div className="flex items-center gap-2">
              <Input aria-label="Material title" value={x.title} onChange={(e) => set(x.id, { title: e.target.value })} className="flex-1" />
              <span className="hidden text-xs text-muted-foreground sm:block">
                {x.fileName} · {formatBytes(x.size)}
              </span>
              <RowControls
                index={i}
                count={list.length}
                onMove={(a, z) => update({ materials: move(list, a, z) })}
                onRemove={() =>
                  void run("remove", async (latest) => {
                    const saved = await saveBuildDay({ ...latest, materials: latest.materials.filter((y) => y.id !== x.id) });
                    await deleteMemberFiles([x.fileId]);
                    return saved;
                  })
                }
                label={x.title}
              />
            </div>
            <Input aria-label="Material description" value={x.description} onChange={(e) => set(x.id, { description: e.target.value })} placeholder="What it's for" />
          </EditorRow>
        ))}
        <FileDrop
          accept="*/*"
          multiple
          compact
          title="Add materials"
          disabled={!!busy}
          testId="materials-upload"
          onFiles={(files) => {
            const ok = files.filter((f) => f.size <= MAX_PRODUCT_FILE_BYTES);
            if (ok.length < files.length) toast.error(`Files must be under ${formatBytes(MAX_PRODUCT_FILE_BYTES)}.`);
            if (!ok.length) return;
            void run("materials", async (latest) => {
              const added = [];
              for (const f of ok) added.push(await storeMaterial(f, f.name, m.brandId));
              return saveBuildDay({ ...latest, materials: [...latest.materials, ...added] });
            }, `Added ${plural(ok.length, "file")}`);
          }}
        />
      </CardContent>
    </Card>
  );
}

function ChecklistTab({ b, update }: { b: BuildDay; update: Update }) {
  const list = b.checklist;
  const actions = b.actions;
  return (
    <div className="grid grid-cols-1 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-start gap-3">
          <div className="flex-1">
            <CardTitle>Implementation checklist</CardTitle>
            <CardDescription>What members do before, during and after the day.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => update({ checklist: [...list, { id: uid("bc"), phase: "during", text: "" }] })}>
            <Plus /> Add item
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2">
          {list.map((x, i) => (
            <div key={x.id} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[150px_minmax(0,1fr)_auto]">
              <NativeSelect aria-label="When" value={x.phase} onChange={(e) => update({ checklist: list.map((y) => (y.id === x.id ? { ...y, phase: e.target.value as BuildChecklistPhase } : y)) })}>
                {BUILD_PHASES.map((p) => (
                  <option key={p} value={p}>
                    {BUILD_PHASE_LABELS[p]}
                  </option>
                ))}
              </NativeSelect>
              <Input aria-label="Checklist item" value={x.text} onChange={(e) => update({ checklist: list.map((y) => (y.id === x.id ? { ...y, text: e.target.value } : y)) })} />
              <RowControls index={i} count={list.length} onMove={(a, z) => update({ checklist: move(list, a, z) })} onRemove={() => update({ checklist: list.filter((y) => y.id !== x.id) })} label="item" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-start gap-3">
          <div className="flex-1">
            <CardTitle>Action items</CardTitle>
            <CardDescription>Follow-ups with a due date (days after the Build Day). Members can add their own too.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => update({ actions: [...actions, { id: uid("ba"), title: "", detail: "", dueDays: 3 }] })} data-testid="add-action">
            <Plus /> Add action
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2">
          {actions.map((a, i) => (
            <div key={a.id} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_120px_auto]">
              <Input aria-label="Action" value={a.title} onChange={(e) => update({ actions: actions.map((y) => (y.id === a.id ? { ...y, title: e.target.value } : y)) })} />
              <div className="flex items-center gap-1.5">
                <Input aria-label="Due days after" type="number" min={0} value={a.dueDays} onChange={(e) => update({ actions: actions.map((y) => (y.id === a.id ? { ...y, dueDays: Math.max(0, Number(e.target.value) || 0) } : y)) })} />
                <span className="text-xs text-muted-foreground">days</span>
              </div>
              <RowControls index={i} count={actions.length} onMove={(x, z) => update({ actions: move(actions, x, z) })} onRemove={() => update({ actions: actions.filter((y) => y.id !== a.id) })} label="action" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function LinksTab({ b, update }: { b: BuildDay; update: Update }) {
  return (
    <Card>
      <CardContent className="grid grid-cols-1 gap-4 pt-6">
        <Field label="Meeting link" htmlFor="bd-join" hint="Zoom, Google Meet, Teams… Shown to members who can join. Only https links are kept." optional>
          <Input id="bd-join" value={b.joinUrl} onChange={(e) => update({ joinUrl: e.target.value })} placeholder="https://" data-testid="bd-join" />
        </Field>
        <Field label="Recording link" htmlFor="bd-replay" hint="Add after the day. Hosted wherever you keep recordings." optional>
          <Input id="bd-replay" value={b.replayUrl} onChange={(e) => update({ replayUrl: e.target.value })} placeholder="https://" />
        </Field>
        <div className="grid grid-cols-1 gap-3 rounded-xl border p-3">
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-medium">Community participation</span>
              <span className="block text-xs text-muted-foreground">Prepared for the future community area: a shared wins feed and discussion under each session&apos;s prompts.</span>
            </span>
            <Switch checked={b.community.enabled} onCheckedChange={(v) => update({ community: { ...b.community, enabled: v } })} aria-label="Community participation" />
          </label>
          <Field label="Journal prompt" htmlFor="bd-prompt">
            <Input id="bd-prompt" value={b.community.prompt} onChange={(e) => update({ community: { ...b.community, prompt: e.target.value } })} />
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}

/** RSVPs and progress for this Build Day across the owner and test profiles. */
function Attendees({ b }: { b: BuildDay }) {
  const m = useMember();
  const { data } = useMemberLive(async (r) => ({ rows: (await r.labProgress.list(m.brandId)).filter((p) => p.kind === "build-day" && p.refId === b.id), accounts: await r.accounts.list() }), [m.brandId, b.id]);
  const rows = data?.rows ?? [];
  const going = rows.filter((r) => r.rsvp === "going").length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4" /> Attendees
        </CardTitle>
        <CardDescription>
          {going} going{b.capacity ? ` of ${b.capacity} places` : ""} · {rows.filter((r) => r.rsvp === "maybe").length} maybe · {rows.filter((r) => r.attended).length} took part
        </CardDescription>
      </CardHeader>
      {rows.length > 0 && (
        <CardContent>
          <ul className="grid grid-cols-1 gap-2 text-sm">
            {rows.map((r) => {
              const a = data?.accounts.find((x) => x.id === r.memberId);
              const s = buildDayStats(b, r);
              return (
                <li key={r.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">{a?.displayName ?? "Unknown member"}</span>
                  {r.rsvp && <Badge variant={r.rsvp === "going" ? "success" : "secondary"}>{r.rsvp === "not-going" ? "Not going" : r.rsvp === "going" ? "Going" : "Maybe"}</Badge>}
                  <span className="text-xs tabular-nums text-muted-foreground">{s.percent}%</span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}

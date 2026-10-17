"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Diamond, Flag, ListChecks, Plus, Rocket, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/data/types";
import type { LaunchChecklistItem, LaunchMilestone, LaunchPlanData, LaunchTask, LaunchTaskCategory, LaunchTemplate, Priority, TaskStatus } from "@/lib/models/profit";
import { LAUNCH_CATEGORY_LABELS } from "@/lib/models/profit";
import { defaultLaunchPlanData } from "@/lib/models/defaults";
import { AUTO_KEYS, BUILT_IN_TEMPLATES, addDays, applyTemplate, autoDoneKeys, daysBetween, deleteCustomTemplate, launchCsv, launchIcs, launchMarkdown, launchProgress, loadCustomTemplates, milestoneDate, saveCustomTemplate, taskDue, templateFromPlan, todayIso } from "@/lib/profit/launch";
import { monthGrid } from "@/lib/marketing/social";
import { useAssets } from "@/lib/data/hooks";
import { createAsset } from "@/lib/services/assets";
import { safeFileName, textFile } from "@/lib/export/download";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Card, Checkbox, EmptyState, Field, Input, NativeSelect, Progress, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { AssetWorkspace } from "@/components/common/asset-workspace";
import { ExportMenu } from "@/components/common/export-menu";
import type { AssetEditor } from "@/features/common/use-asset-editor";
import { cn, uid } from "@/lib/utils";

const PRIORITY_STYLE: Record<Priority, string> = { low: "bg-secondary text-muted-foreground", medium: "bg-sky-50 text-sky-800", high: "bg-amber-50 text-amber-900", critical: "bg-red-50 text-red-800" };
const STATUS_LABELS: Record<TaskStatus, string> = { todo: "To do", doing: "In progress", done: "Done", blocked: "Blocked" };
const AUTO_LINKS: Record<string, string> = { "doc-approved": "/editor", "rights-reviewed": "/rights", "has-cover": "/covers", "has-mockup": "/mockups", "has-sales-page": "/sales-pages", "has-emails": "/emails", "has-social": "/social", "has-lead-magnet": "/lead-magnets", "has-bonus": "/bonus-builder", "has-funnel": "/funnels", "has-profit": "/profit" };

function relLabel(due: string | null, launch: string | null) {
  if (!due || !launch) return "";
  const n = daysBetween(launch, due);
  return n === 0 ? "Launch day" : n < 0 ? `${-n}d before launch` : `${n}d after launch`;
}

function TaskRow({ t, d, onChange, onDelete, today }: { t: LaunchTask; d: LaunchPlanData; onChange: (p: Partial<LaunchTask>) => void; onDelete: () => void; today: string }) {
  const due = taskDue(t, d.launchDate);
  const overdue = t.status !== "done" && !!due && due < today;
  return (
    <li className={cn("grid gap-2 rounded-lg border bg-card p-2.5 md:grid-cols-[auto_1fr_130px_110px_120px_150px_auto] md:items-center", t.status === "done" && "opacity-60")} data-testid="launch-task">
      <Checkbox checked={t.status === "done"} onCheckedChange={(v) => onChange({ status: v ? "done" : "todo" })} aria-label={`Mark ${t.title} done`} />
      <div className="min-w-0">
        <Input value={t.title} onChange={(e) => onChange({ title: e.target.value })} className={cn("h-8 border-transparent px-1 font-medium hover:border-border", t.status === "done" && "line-through")} aria-label="Task" />
        {t.notes && <p className="truncate px-1 text-[11px] text-muted-foreground">{t.notes}</p>}
      </div>
      <NativeSelect value={t.category} onChange={(e) => onChange({ category: e.target.value as LaunchTaskCategory })} className="h-8 text-xs" aria-label="Category">
        {Object.entries(LAUNCH_CATEGORY_LABELS).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect value={t.priority} onChange={(e) => onChange({ priority: e.target.value as Priority })} className={cn("h-8 text-xs font-medium capitalize", PRIORITY_STYLE[t.priority])} aria-label="Priority">
        {(["low", "medium", "high", "critical"] as Priority[]).map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect value={t.status} onChange={(e) => onChange({ status: e.target.value as TaskStatus })} className="h-8 text-xs" aria-label="Status">
        {Object.entries(STATUS_LABELS).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </NativeSelect>
      <div className="grid gap-0.5">
        <Input type="date" value={due ?? ""} onChange={(e) => onChange({ dueDate: e.target.value || null, offsetDays: e.target.value ? null : t.offsetDays })} className={cn("h-8 text-xs", overdue && "border-red-300 text-red-700")} aria-label="Due date" />
        <span className={cn("px-1 text-[10.5px]", overdue ? "font-medium text-red-700" : "text-muted-foreground")}>{overdue ? "Overdue · " : ""}{relLabel(due, d.launchDate)}</span>
      </div>
      <Button size="icon-xs" variant="ghost" onClick={onDelete} aria-label="Delete task">
        <Trash2 />
      </Button>
    </li>
  );
}

function ChecklistCard({ title, items, onChange, auto, testid }: { title: string; items: LaunchChecklistItem[]; onChange: (i: LaunchChecklistItem[]) => void; auto: Set<string>; testid: string }) {
  const [text, setText] = React.useState("");
  const done = items.filter((i) => i.done || (i.autoKey && auto.has(i.autoKey))).length;
  return (
    <Card className="grid content-start gap-3 p-4" data-testid={testid}>
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold">{title}</p>
        <span className="ml-auto text-xs text-muted-foreground">
          {done}/{items.length}
        </span>
      </div>
      <Progress value={items.length ? (done / items.length) * 100 : 0} />
      <ul className="grid gap-1.5">
        {items.map((i) => {
          const autoOk = !!i.autoKey && auto.has(i.autoKey);
          return (
            <li key={i.id} className="group flex items-start gap-2 text-[13px]">
              <Checkbox className="mt-0.5" checked={i.done || autoOk} disabled={autoOk} onCheckedChange={(v) => onChange(items.map((x) => (x.id === i.id ? { ...x, done: !!v } : x)))} aria-label={i.label} />
              <span className={cn("min-w-0 flex-1", (i.done || autoOk) && "text-muted-foreground line-through")}>
                {i.label}
                {i.autoKey && (
                  <span className="ml-1.5 inline-flex items-center gap-1 text-[11px] no-underline">
                    {autoOk ? (
                      <Badge variant="success" className="no-underline">
                        <CheckCircle2 /> Found in project
                      </Badge>
                    ) : (
                      <Link href={AUTO_LINKS[i.autoKey] ?? "/"} className="font-medium text-primary">
                        Open tool →
                      </Link>
                    )}
                  </span>
                )}
              </span>
              <button type="button" onClick={() => onChange(items.filter((x) => x.id !== i.id))} className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100" aria-label="Remove item">
                <Trash2 className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          onChange([...items, { id: uid("lc"), label: text.trim(), done: false, autoKey: null }]);
          setText("");
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an item" className="h-8 text-xs" />
        <Button size="sm" variant="outline" type="submit">
          <Plus />
        </Button>
      </form>
    </Card>
  );
}

function LaunchCalendar({ d, onOpen }: { d: LaunchPlanData; onOpen: (id: string) => void }) {
  const today = todayIso();
  const [month, setMonth] = React.useState((d.launchDate ?? today).slice(0, 7));
  const grid = monthGrid(month);
  const items = React.useMemo(() => {
    const m = new Map<string, { id: string; title: string; kind: "task" | "milestone"; done: boolean; priority?: Priority }[]>();
    const add = (day: string | null, x: { id: string; title: string; kind: "task" | "milestone"; done: boolean; priority?: Priority }) => day && m.set(day, [...(m.get(day) ?? []), x]);
    for (const ms of d.milestones) add(milestoneDate(ms, d.launchDate), { id: ms.id, title: ms.title, kind: "milestone", done: ms.done });
    for (const t of d.tasks) add(taskDue(t, d.launchDate), { id: t.id, title: t.title, kind: "task", done: t.status === "done", priority: t.priority });
    return m;
  }, [d]);
  const shift = (n: number) => {
    const [y, mo] = month.split("-").map(Number);
    const dt = new Date(y, mo - 1 + n, 1);
    setMonth(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
  };
  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center gap-2">
        <Button size="icon-sm" variant="ghost" onClick={() => shift(-1)} aria-label="Previous month">
          <ChevronLeft />
        </Button>
        <p className="min-w-40 text-center font-semibold">{new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
        <Button size="icon-sm" variant="ghost" onClick={() => shift(1)} aria-label="Next month">
          <ChevronRight />
        </Button>
        {d.launchDate && (
          <Button size="xs" variant="ghost" onClick={() => setMonth(d.launchDate!.slice(0, 7))}>
            Launch month
          </Button>
        )}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-[11px]" data-testid="launch-calendar">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
          <div key={w} className="bg-secondary px-2 py-1 font-medium text-muted-foreground">
            {w}
          </div>
        ))}
        {grid.map((c) => {
          const isLaunch = c.day === d.launchDate;
          return (
            <div key={c.day} className={cn("min-h-24 bg-card p-1", !c.inMonth && "bg-secondary/40 text-muted-foreground", c.day === today && "ring-2 ring-inset ring-primary/40", isLaunch && "bg-primary-soft")}>
              <p className="flex items-center gap-1 px-1 text-[11px] font-medium">
                {Number(c.day.slice(8))}
                {isLaunch && (
                  <span className="flex items-center gap-0.5 text-primary">
                    <Rocket className="size-3" /> Launch
                  </span>
                )}
              </p>
              <div className="grid gap-0.5">
                {(items.get(c.day) ?? []).map((x) => (
                  <button key={x.id} type="button" onClick={() => x.kind === "task" && onOpen(x.id)} className={cn("flex items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10.5px] hover:bg-secondary", x.done && "line-through opacity-60")} title={x.title}>
                    {x.kind === "milestone" ? <Diamond className="size-2.5 shrink-0 text-primary" /> : <span className={cn("size-1.5 shrink-0 rounded-full", x.priority === "critical" ? "bg-red-600" : x.priority === "high" ? "bg-amber-500" : "bg-slate-400")} />}
                    <span className="truncate">{x.title}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TemplateDialog({ open, onOpenChange, onApply }: { open: boolean; onOpenChange: (o: boolean) => void; onApply: (t: LaunchTemplate, mode: "replace" | "append") => void }) {
  const [custom, setCustom] = React.useState<LaunchTemplate[]>([]);
  const [mode, setMode] = React.useState<"replace" | "append">("replace");
  const confirm = useConfirm();
  React.useEffect(() => {
    if (open) loadCustomTemplates().then(setCustom);
  }, [open]);
  const card = (t: LaunchTemplate) => (
    <div key={t.id} className="flex items-start gap-2 rounded-lg border p-3 hover:border-primary/50">
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onApply(t, mode)} data-testid={`launch-template-${t.id}`}>
        <p className="font-semibold">{t.name}</p>
        <p className="text-sm text-muted-foreground">{t.description || `${t.tasks.length} tasks`}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {t.tasks.length} tasks · {t.milestones.length} milestones
        </p>
      </button>
      {!t.builtIn && (
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Delete template"
          onClick={async () => {
            if (!(await confirm({ title: `Delete template “${t.name}”?`, confirmLabel: "Delete", destructive: true }))) return;
            await deleteCustomTemplate(t.id);
            setCustom(await loadCustomTemplates());
          }}
        >
          <Trash2 />
        </Button>
      )}
    </div>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Launch templates</DialogTitle>
          <DialogDescription>Task dates are set relative to your launch date.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} /> Replace current tasks
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={mode === "append"} onChange={() => setMode("append")} /> Add to current tasks
          </label>
        </div>
        <div className="plr-scroll grid max-h-[55vh] gap-2 overflow-y-auto">
          {BUILT_IN_TEMPLATES.map(card)}
          {custom.length > 0 && <p className="pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Your saved templates</p>}
          {custom.map(card)}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LaunchEditor({ editor, project }: { editor: AssetEditor<"launch-plan">; project: Project }) {
  const d = editor.data!;
  const set = (p: Partial<LaunchPlanData>) => editor.update((x) => ({ ...x, ...p }));
  const patchTask = (id: string, p: Partial<LaunchTask>) => editor.update((x) => ({ ...x, tasks: x.tasks.map((t) => (t.id === id ? { ...t, ...p } : t)) }));
  const { data: assets } = useAssets(project.id);
  const auto = React.useMemo(() => autoDoneKeys(assets ?? []), [assets]);
  const today = todayIso();
  const prog = launchProgress(d, auto, today);
  const [tplOpen, setTplOpen] = React.useState(false);
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [tplName, setTplName] = React.useState("");
  const [tplDesc, setTplDesc] = React.useState("");
  const [newTask, setNewTask] = React.useState({ title: "", category: "marketing" as LaunchTaskCategory, priority: "medium" as Priority, due: "" });
  const [groupBy, setGroupBy] = React.useState<"date" | "category">("date");
  const [hideDone, setHideDone] = React.useState(false);
  const [openTask, setOpenTask] = React.useState<string | null>(null);
  const [msTitle, setMsTitle] = React.useState("");
  const confirm = useConfirm();
  const daysLeft = d.launchDate ? daysBetween(today, d.launchDate) : null;

  const tasks = d.tasks.filter((t) => !hideDone || t.status !== "done");
  const sortKey = (t: LaunchTask) => taskDue(t, d.launchDate) ?? "9999";
  const groups: [string, LaunchTask[]][] =
    groupBy === "category"
      ? (Object.keys(LAUNCH_CATEGORY_LABELS) as LaunchTaskCategory[]).map((c) => [LAUNCH_CATEGORY_LABELS[c], tasks.filter((t) => t.category === c).sort((a, b) => sortKey(a).localeCompare(sortKey(b)))] as [string, LaunchTask[]]).filter(([, l]) => l.length)
      : [["All tasks by due date", [...tasks].sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || ["critical", "high", "medium", "low"].indexOf(a.priority) - ["critical", "high", "medium", "low"].indexOf(b.priority))]];
  const open = d.tasks.find((t) => t.id === openTask) ?? null;

  return (
    <div className="mx-auto grid grid-cols-[minmax(0,1fr)] w-full max-w-[1400px] gap-5 px-4 py-6 sm:px-6">
      <Card className="grid gap-4 p-4 lg:grid-cols-[260px_1fr]">
        <div className="grid content-start gap-2">
          <Field label="Launch date">
            <Input type="date" value={d.launchDate ?? ""} onChange={(e) => set({ launchDate: e.target.value || null })} data-testid="launch-date" />
          </Field>
          <p className="text-sm">
            {daysLeft === null ? (
              <span className="text-muted-foreground">Set a launch date to schedule tasks.</span>
            ) : daysLeft > 0 ? (
              <>
                <b>{daysLeft}</b> days to launch
              </>
            ) : daysLeft === 0 ? (
              <b className="text-primary">Launch day!</b>
            ) : (
              <span className="text-muted-foreground">Launched {-daysLeft} days ago</span>
            )}
          </p>
          {d.templateName && <p className="text-[11px] text-muted-foreground">Template: {d.templateName}</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setTplOpen(true)} data-testid="launch-templates">
              <Sparkles /> Templates
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSaveOpen(true)} disabled={!d.tasks.length} data-testid="launch-save-template">
              <Save /> Save as template
            </Button>
          </div>
        </div>
        <div className="grid content-start gap-3">
          <div className="flex items-center gap-3">
            <Progress value={prog.pct} className="flex-1" />
            <span className="text-sm font-semibold tabular-nums" data-testid="launch-progress">
              {prog.pct}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Tasks done", `${prog.done}/${prog.total}`],
              ["Overdue", String(prog.overdue)],
              ["Blocked", String(prog.blocked)],
              ["Critical open", String(prog.criticalOpen)],
              ["Product readiness", `${prog.readinessDone}/${d.readiness.length}`],
              ["Marketing assets", `${prog.marketingDone}/${d.marketing.length}`],
            ].map(([l, v]) => (
              <div key={l} className={cn("rounded-lg border p-2.5", l === "Overdue" && prog.overdue > 0 && "border-red-200 bg-red-50", l === "Critical open" && prog.criticalOpen > 0 && "border-amber-200 bg-amber-50")}>
                <p className="text-[11px] text-muted-foreground">{l}</p>
                <p className="text-lg font-semibold tabular-nums">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Tabs defaultValue="tasks">
        <TabsList className="flex-wrap">
          <TabsTrigger value="tasks">
            <ListChecks /> Tasks ({d.tasks.length})
          </TabsTrigger>
          <TabsTrigger value="calendar" data-testid="tab-launch-calendar">
            <CalendarDays /> Calendar
          </TabsTrigger>
          <TabsTrigger value="checklists">Checklists</TabsTrigger>
          <TabsTrigger value="milestones">
            <Flag /> Milestones ({d.milestones.length})
          </TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>
        <TabsContent value="tasks" className="mt-4 grid gap-3">
          <form
            className="grid grid-cols-[minmax(0,1fr)] gap-2 rounded-lg border bg-card p-3 md:grid-cols-[minmax(0,1fr)_150px_120px_150px_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newTask.title.trim()) return;
              const t: LaunchTask = { id: uid("lt"), title: newTask.title.trim(), category: newTask.category, priority: newTask.priority, status: "todo", offsetDays: null, dueDate: newTask.due || null, notes: "", milestoneId: null };
              set({ tasks: [...d.tasks, t] });
              setNewTask({ ...newTask, title: "" });
            }}
          >
            <Input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="New task" data-testid="launch-new-task" />
            <NativeSelect value={newTask.category} onChange={(e) => setNewTask({ ...newTask, category: e.target.value as LaunchTaskCategory })} aria-label="Category">
              {Object.entries(LAUNCH_CATEGORY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as Priority })} aria-label="Priority" className="capitalize">
              {(["low", "medium", "high", "critical"] as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </NativeSelect>
            <Input type="date" value={newTask.due} onChange={(e) => setNewTask({ ...newTask, due: e.target.value })} aria-label="Due date" />
            <Button type="submit">
              <Plus /> Add
            </Button>
          </form>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <NativeSelect value={groupBy} onChange={(e) => setGroupBy(e.target.value as "date" | "category")} className="h-8 w-auto text-xs" aria-label="Group tasks">
              <option value="date">Order by due date</option>
              <option value="category">Group by category</option>
            </NativeSelect>
            <label className="flex items-center gap-1.5">
              <Checkbox checked={hideDone} onCheckedChange={(v) => setHideDone(!!v)} /> Hide done
            </label>
          </div>
          {d.tasks.length === 0 ? (
            <EmptyState icon={<Rocket />} title="No tasks yet" description="Start from a launch template or add your own tasks." action={<Button onClick={() => setTplOpen(true)}><Sparkles /> Choose a template</Button>} />
          ) : (
            groups.map(([g, list]) => (
              <section key={g} className="grid gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g}</p>
                <ul className="grid gap-1.5" data-testid="launch-tasks">
                  {list.map((t) => (
                    <TaskRow key={t.id} t={t} d={d} today={today} onChange={(p) => patchTask(t.id, p)} onDelete={() => set({ tasks: d.tasks.filter((x) => x.id !== t.id) })} />
                  ))}
                </ul>
              </section>
            ))
          )}
        </TabsContent>
        <TabsContent value="calendar" className="mt-4">
          <LaunchCalendar d={d} onOpen={setOpenTask} />
        </TabsContent>
        <TabsContent value="checklists" className="mt-4 grid gap-4 lg:grid-cols-2">
          <ChecklistCard title="Product readiness" items={d.readiness} onChange={(readiness) => set({ readiness })} auto={auto} testid="readiness" />
          <ChecklistCard title="Marketing assets" items={d.marketing} onChange={(marketing) => set({ marketing })} auto={auto} testid="marketing-checklist" />
          <p className="text-[11px] text-muted-foreground lg:col-span-2">Items marked “Found in project” tick themselves when the matching asset exists in this project ({Object.keys(AUTO_KEYS).length} automatic checks).</p>
        </TabsContent>
        <TabsContent value="milestones" className="mt-4 grid gap-3">
          <ul className="grid gap-1.5">
            {[...d.milestones]
              .sort((a, b) => (milestoneDate(a, d.launchDate) ?? "9999").localeCompare(milestoneDate(b, d.launchDate) ?? "9999"))
              .map((m) => {
                const date = milestoneDate(m, d.launchDate);
                const late = !m.done && !!date && date < today;
                return (
                  <li key={m.id} className="grid items-center gap-2 rounded-lg border bg-card p-2.5 sm:grid-cols-[auto_1fr_160px_140px_auto]">
                    <Checkbox checked={m.done} onCheckedChange={(v) => set({ milestones: d.milestones.map((x) => (x.id === m.id ? { ...x, done: !!v } : x)) })} aria-label={`Mark ${m.title} done`} />
                    <Input value={m.title} onChange={(e) => set({ milestones: d.milestones.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)) })} className="h-8 border-transparent px-1 font-medium hover:border-border" />
                    <Input type="date" value={date ?? ""} onChange={(e) => set({ milestones: d.milestones.map((x) => (x.id === m.id ? { ...x, date: e.target.value || null, offsetDays: e.target.value ? null : x.offsetDays } : x)) })} className={cn("h-8 text-xs", late && "border-red-300 text-red-700")} />
                    <span className={cn("text-[11px]", late ? "font-medium text-red-700" : "text-muted-foreground")}>
                      {late && <AlertTriangle className="mr-1 inline size-3" />}
                      {relLabel(date, d.launchDate) || "No date"}
                    </span>
                    <Button size="icon-xs" variant="ghost" onClick={() => set({ milestones: d.milestones.filter((x) => x.id !== m.id) })} aria-label="Delete milestone">
                      <Trash2 />
                    </Button>
                  </li>
                );
              })}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!msTitle.trim()) return;
              const m: LaunchMilestone = { id: uid("lm"), title: msTitle.trim(), offsetDays: d.launchDate ? 0 : null, date: null, done: false };
              set({ milestones: [...d.milestones, m] });
              setMsTitle("");
            }}
          >
            <Input value={msTitle} onChange={(e) => setMsTitle(e.target.value)} placeholder="New milestone or deadline" className="max-w-md" />
            <Button type="submit" variant="outline">
              <Plus /> Add milestone
            </Button>
          </form>
        </TabsContent>
        <TabsContent value="notes" className="mt-4">
          <Textarea rows={14} value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Launch notes, partner contacts, ideas for next time…" />
        </TabsContent>
      </Tabs>

      <TemplateDialog
        open={tplOpen}
        onOpenChange={setTplOpen}
        onApply={async (t, mode) => {
          if (mode === "replace" && d.tasks.length && !(await confirm({ title: `Replace ${d.tasks.length} tasks with “${t.name}”?`, description: "Your current plan is saved in version history first.", confirmLabel: "Replace" }))) return;
          if (d.tasks.length) await editor.snapshot(`Before applying “${t.name}”`, "pre-apply");
          editor.update((x) => applyTemplate({ ...x, launchDate: x.launchDate ?? addDays(today, 21) }, t, mode));
          setTplOpen(false);
          toast.success(`Applied “${t.name}”`);
        }}
      />
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save as a reusable template</DialogTitle>
            <DialogDescription>Task dates are stored relative to the launch date so the template works for any future launch.</DialogDescription>
          </DialogHeader>
          <Field label="Template name">
            <Input value={tplName} onChange={(e) => setTplName(e.target.value)} data-testid="launch-template-name" />
          </Field>
          <Field label="Description" optional>
            <Input value={tplDesc} onChange={(e) => setTplDesc(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!tplName.trim()) return toast.error("Name the template.");
                await saveCustomTemplate(templateFromPlan(d, tplName.trim(), tplDesc.trim()));
                setSaveOpen(false);
                setTplName("");
                setTplDesc("");
                toast.success("Template saved");
              }}
              data-testid="launch-template-save"
            >
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpenTask(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Task</DialogTitle>
          </DialogHeader>
          {open && (
            <div className="grid gap-3">
              <Input value={open.title} onChange={(e) => patchTask(open.id, { title: e.target.value })} className="font-medium" />
              <div className="grid grid-cols-3 gap-2">
                <NativeSelect value={open.status} onChange={(e) => patchTask(open.id, { status: e.target.value as TaskStatus })}>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect value={open.priority} onChange={(e) => patchTask(open.id, { priority: e.target.value as Priority })} className="capitalize">
                  {(["low", "medium", "high", "critical"] as Priority[]).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </NativeSelect>
                <Input type="date" value={taskDue(open, d.launchDate) ?? ""} onChange={(e) => patchTask(open.id, { dueDate: e.target.value || null })} />
              </div>
              <Field label="Milestone" optional>
                <NativeSelect value={open.milestoneId ?? ""} onChange={(e) => patchTask(open.id, { milestoneId: e.target.value || null })}>
                  <option value="">None</option>
                  {d.milestones.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Notes" optional>
                <Textarea rows={4} value={open.notes} onChange={(e) => patchTask(open.id, { notes: e.target.value })} />
              </Field>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {prog.overdue > 0 && (
        <Callout tone="warning" icon={<AlertTriangle />}>
          {prog.overdue} task{prog.overdue === 1 ? " is" : "s are"} overdue. Reschedule {prog.overdue === 1 ? "it" : "them"} or move the launch date.
        </Callout>
      )}
    </div>
  );
}

function NewLaunchDialog({ project, open, onOpenChange, onCreated }: { project: Project; open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const [date, setDate] = React.useState(addDays(todayIso(), 21));
  const [tpl, setTpl] = React.useState(BUILT_IN_TEMPLATES[0].id);
  const [custom, setCustom] = React.useState<LaunchTemplate[]>([]);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) loadCustomTemplates().then(setCustom);
  }, [open]);
  const all = [...BUILT_IN_TEMPLATES, ...custom];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New launch plan</DialogTitle>
          <DialogDescription>Pick a launch date and a starting template. Everything can be edited afterwards.</DialogDescription>
        </DialogHeader>
        <Field label="Launch date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Start from">
          <NativeSelect value={tpl} onChange={(e) => setTpl(e.target.value)} data-testid="new-launch-template">
            {all.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value="blank">Blank plan</option>
          </NativeSelect>
        </Field>
        <DialogFooter>
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const base = { ...defaultLaunchPlanData(), launchDate: date || null };
                const t = all.find((x) => x.id === tpl);
                const data = t ? applyTemplate(base, t, "replace") : applyTemplate(base, { ...BUILT_IN_TEMPLATES[0], tasks: [], milestones: [], name: "Blank" }, "replace");
                if (!t) data.templateName = null;
                const a = await createAsset(project.id, "launch-plan", { title: `${project.name.replace(/^SAMPLE\s*[—-]\s*/i, "")} launch`, data });
                onOpenChange(false);
                onCreated(a.id);
              } finally {
                setBusy(false);
              }
            }}
            data-testid="launch-create"
          >
            Create plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LaunchPlanner({ project }: { project: Project }) {
  return (
    <AssetWorkspace
      project={project}
      type="launch-plan"
      tool="Launch Planner"
      eyebrow="Profit Studio"
      icon={<Rocket />}
      description="Plan your launch with a task checklist, calendar, product-readiness and marketing-asset checklists, milestones, deadlines, priorities, progress tracking, notes and reusable launch templates."
      createLabel="New launch plan"
      createDialog={(p) => <NewLaunchDialog project={project} {...p} />}
      itemMeta={(a) => {
        const done = a.data.tasks.filter((t) => t.status === "done").length;
        return `${a.data.launchDate ? `Launch ${a.data.launchDate}` : "No date"} · ${done}/${a.data.tasks.length} tasks done`;
      }}
      renderEditor={(editor) => <LaunchEditor editor={editor} project={project} />}
      versionText={(x) => launchMarkdown(x as LaunchPlanData, "Version")}
      headerActions={(editor) => (
        <ExportMenu
          projectId={project.id}
          assetId={editor.asset!.id}
          assetLabel={editor.title}
          beforeExport={editor.save}
          options={[
            { id: "ics", label: "Calendar (.ics)", run: () => textFile(launchIcs(editor.getData()!, editor.title), safeFileName(editor.title, "ics"), "text/calendar") },
            { id: "csv", label: "Tasks (CSV)", run: () => textFile(launchCsv(editor.getData()!), safeFileName(editor.title, "csv"), "text/csv") },
            { id: "md", label: "Plan (Markdown)", run: () => textFile(launchMarkdown(editor.getData()!, editor.title), safeFileName(editor.title, "md"), "text/markdown") },
          ]}
        />
      )}
    />
  );
}


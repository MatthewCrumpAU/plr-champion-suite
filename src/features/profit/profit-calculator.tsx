"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { Calculator, Copy, Plus, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import type { Project } from "@/lib/data/types";
import type { ActualSale, ProfitData, ProfitScenario } from "@/lib/models/profit";
import { newScenario } from "@/lib/models/defaults";
import { calcScenario, money, profitCurve, summariseActuals, type ScenarioResult } from "@/lib/profit/calc";
import { createAsset } from "@/lib/services/assets";
import { profitReport } from "@/lib/profit/report";
import { safeFileName, textFile } from "@/lib/export/download";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Card, Input, Label, NativeSelect, Slider, Switch } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { AssetWorkspace } from "@/components/common/asset-workspace";
import { ExportMenu } from "@/components/common/export-menu";
import { CHART, ChartLegend, ChartTooltip, axisProps } from "@/components/common/charts";
import type { AssetEditor } from "@/features/common/use-asset-editor";
import { cn, uid } from "@/lib/utils";

const CURRENCIES = ["USD", "AUD", "GBP", "EUR", "CAD", "NZD"];
const num = (v: number, d = 0) => (Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: d }) : "—");

function NumberSlider({ label, value, onChange, min, max, step = 1, suffix, prefix, hint, testid }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: string; prefix?: string; hint?: string; testid?: string }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[13px]">{label}</Label>
        <div className="flex items-center gap-1">
          {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
          <Input type="number" value={Number.isFinite(value) ? value : 0} min={min} step={step} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} className="h-7 w-24 text-right text-xs tabular-nums" aria-label={label} data-testid={testid} />
          {suffix && <span className="w-6 text-xs text-muted-foreground">{suffix}</span>}
        </div>
      </div>
      <Slider value={[Math.min(max, Math.max(min, value))]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} aria-label={`${label} slider`} />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border bg-card p-3.5">
      <p className="text-[11.5px] font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 flex items-center gap-1 text-lg font-semibold tabular-nums tracking-tight", tone === "bad" && "text-[#d03b3b]")}>
        {tone === "good" && <TrendingUp className="size-4 text-[#0ca30c]" aria-label="Profit" />}
        {tone === "bad" && <TrendingDown className="size-4" aria-label="Loss" />}
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Breakdown({ r, currency }: { r: ScenarioResult; currency: string }) {
  const rows: [string, number, "add" | "sub" | "total"][] = [
    ["Gross revenue", r.grossRevenue, "add"],
    ["Refunds", -r.refunds, "sub"],
    ["Payment processing fees", -r.processingFees, "sub"],
    ["Affiliate commission", -r.affiliateCommission, "sub"],
    ["Other per-sale costs", -r.variableCosts, "sub"],
    ["Gross profit", r.grossProfit, "total"],
    ["Advertising", -r.adSpend, "sub"],
    ["Fixed costs", -r.fixedCosts, "sub"],
    ["Estimated net operating profit", r.netProfit, "total"],
  ];
  return (
    <table className="w-full text-[13px]" data-testid="profit-breakdown">
      <tbody>
        {rows.map(([l, v, k]) => (
          <tr key={l} className={cn("border-b last:border-0", k === "total" && "font-semibold")}>
            <td className={cn("py-1.5", k === "sub" && "pl-3 text-muted-foreground")}>{l}</td>
            <td className={cn("py-1.5 text-right tabular-nums", k === "total" && v < 0 && "text-[#d03b3b]")}>{money(v, currency)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ProfitChart({ s, r, currency }: { s: ProfitScenario; r: ScenarioResult; currency: string }) {
  const data = React.useMemo(() => profitCurve(s), [s]);
  return (
    <div className="grid gap-2">
      <ChartLegend items={[{ label: "Net operating profit (projection)", color: CHART.projection }, { label: "Break-even line", color: CHART.axis, dashed: true }]} />
      <div className="h-64" data-testid="profit-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 16, bottom: 18, left: 6 }}>
            <CartesianGrid stroke={CHART.grid} strokeDasharray="0" vertical={false} />
            <XAxis dataKey="units" type="number" domain={[0, "dataMax"]} {...axisProps} tickFormatter={(v) => num(v)} label={{ value: "Sales per month", position: "insideBottom", offset: -10, fill: CHART.axis, fontSize: 11 }} />
            <YAxis {...axisProps} width={70} tickFormatter={(v) => money(v, currency, 0)} />
            <ReferenceLine y={0} stroke={CHART.axis} strokeDasharray="4 3" />
            {r.breakEvenUnits !== null && Number.isFinite(r.breakEvenUnits) && <ReferenceDot x={r.breakEvenUnits} y={0} r={5} fill="#fff" stroke={CHART.ink} strokeWidth={2} />}
            <ReferenceDot x={r.units} y={r.netProfit} r={5} fill={CHART.projection} stroke="#fff" strokeWidth={2} />
            <RTooltip content={<ChartTooltip format={(v) => money(v, currency)} labelFormat={(l) => `${num(Number(l), 1)} sales`} />} />
            <Line type="linear" dataKey="profit" name="Net profit" stroke={CHART.projection} strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Filled dot: your projected volume ({num(r.units, 1)} sales). Ring: break-even ({r.breakEvenUnits !== null ? `${num(r.breakEvenUnits, 1)} sales` : "not reachable — each sale loses money"}).
      </p>
    </div>
  );
}

function CompareChart({ d }: { d: ProfitData }) {
  const rows = d.scenarios.map((s) => {
    const r = calcScenario(s);
    return { name: s.name, revenue: Math.round(r.grossRevenue), costs: Math.round(r.grossRevenue - r.netProfit), profit: Math.round(r.netProfit) };
  });
  return (
    <div className="grid gap-2">
      <ChartLegend items={[{ label: "Revenue", color: CHART.series[0] }, { label: "Total costs", color: CHART.series[1] }, { label: "Net profit", color: CHART.series[2] }]} />
      <div className="h-64" data-testid="compare-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 10, right: 10, bottom: 4, left: 6 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} width={70} tickFormatter={(v) => money(v, d.currency, 0)} />
            <ReferenceLine y={0} stroke={CHART.axis} />
            <RTooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} content={<ChartTooltip format={(v) => money(v, d.currency)} />} />
            <Bar dataKey="revenue" name="Revenue" fill={CHART.series[0]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="costs" name="Total costs" fill={CHART.series[1]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="profit" name="Net profit" fill={CHART.series[2]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ActualsPanel({ d, set }: { d: ProfitData; set: (p: Partial<ProfitData>) => void }) {
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [row, setRow] = React.useState<Omit<ActualSale, "id">>({ date: iso, units: 1, grossRevenue: 0, fees: 0, refunds: 0, adSpend: 0, notes: "" });
  const sum = summariseActuals(d.actuals);
  const active = d.scenarios.find((s) => s.id === d.activeScenarioId) ?? d.scenarios[0];
  const proj = calcScenario(active);
  const field = (k: keyof Omit<ActualSale, "id" | "notes" | "date">, label: string) => (
    <label className="grid gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <Input type="number" min={0} step="0.01" value={row[k]} onChange={(e) => setRow({ ...row, [k]: Number(e.target.value) || 0 })} className="h-8 text-xs" />
    </label>
  );
  return (
    <div className="grid gap-4">
      <Callout tone="success" title="Actual recorded sales">
        These are numbers you enter from your sales platform. They are kept completely separate from projections and are never estimated.
      </Callout>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5" data-testid="actuals-summary">
        <Kpi label="Recorded sales" value={num(sum.units)} hint={`${sum.entries} entries`} />
        <Kpi label="Recorded revenue" value={money(sum.grossRevenue, d.currency)} />
        <Kpi label="Fees & refunds" value={money(sum.fees + sum.refunds, d.currency)} />
        <Kpi label="Ad spend" value={money(sum.adSpend, d.currency)} />
        <Kpi label="Recorded net" value={money(sum.net, d.currency)} tone={sum.entries ? (sum.net >= 0 ? "good" : "bad") : undefined} />
      </div>
      <Card className="grid gap-3 p-4">
        <p className="text-sm font-semibold">Add a sales record</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
          <label className="grid gap-1">
            <span className="text-[11px] text-muted-foreground">Date</span>
            <Input type="date" value={row.date} onChange={(e) => setRow({ ...row, date: e.target.value })} className="h-8 text-xs" />
          </label>
          {field("units", "Units sold")}
          {field("grossRevenue", "Gross revenue")}
          {field("fees", "Fees")}
          {field("refunds", "Refunds")}
          {field("adSpend", "Ad spend")}
          <label className="grid gap-1">
            <span className="text-[11px] text-muted-foreground">Notes</span>
            <Input value={row.notes} onChange={(e) => setRow({ ...row, notes: e.target.value })} className="h-8 text-xs" />
          </label>
        </div>
        <Button
          size="sm"
          className="justify-self-start"
          onClick={() => {
            if (!row.date) return toast.error("Enter a date.");
            set({ actuals: [...d.actuals, { ...row, id: uid("act") }] });
            setRow({ ...row, units: 1, grossRevenue: 0, fees: 0, refunds: 0, adSpend: 0, notes: "" });
          }}
          data-testid="actual-add"
        >
          <Plus /> Add record
        </Button>
      </Card>
      {d.actuals.length > 0 && (
        <>
          <Card className="p-4">
            <p className="mb-2 text-sm font-semibold">Recorded net by month</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sum.byMonth} margin={{ top: 8, right: 10, bottom: 4, left: 6 }}>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="month" {...axisProps} />
                  <YAxis {...axisProps} width={70} tickFormatter={(v) => money(v, d.currency, 0)} />
                  <ReferenceLine y={0} stroke={CHART.axis} />
                  <RTooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} content={<ChartTooltip format={(v) => money(v, d.currency)} />} />
                  <Bar dataKey="net" name="Recorded net" fill={CHART.series[0]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              For comparison only: the “{active.name}” projection assumes {money(proj.netProfit, d.currency)} net per month from {num(proj.units, 1)} sales. Projections are not targets or guarantees.
            </p>
          </Card>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-[13px]" data-testid="actuals-table">
              <thead className="bg-secondary text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  {["Date", "Units", "Revenue", "Fees", "Refunds", "Ad spend", "Net", "Notes", ""].map((h) => (
                    <th key={h} className="px-3 py-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...d.actuals]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="px-3 py-1.5">{a.date}</td>
                      <td className="px-3 tabular-nums">{a.units}</td>
                      <td className="px-3 tabular-nums">{money(a.grossRevenue, d.currency)}</td>
                      <td className="px-3 tabular-nums">{money(a.fees, d.currency)}</td>
                      <td className="px-3 tabular-nums">{money(a.refunds, d.currency)}</td>
                      <td className="px-3 tabular-nums">{money(a.adSpend, d.currency)}</td>
                      <td className="px-3 font-medium tabular-nums">{money(a.grossRevenue - a.fees - a.refunds - a.adSpend, d.currency)}</td>
                      <td className="max-w-48 truncate px-3 text-muted-foreground">{a.notes}</td>
                      <td className="px-2">
                        <button type="button" onClick={() => set({ actuals: d.actuals.filter((x) => x.id !== a.id) })} className="text-muted-foreground hover:text-destructive" aria-label="Delete record">
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function ProfitEditor({ editor }: { editor: AssetEditor<"profit-scenario"> }) {
  const d = editor.data!;
  const set = (p: Partial<ProfitData>) => editor.update((x) => ({ ...x, ...p }));
  const active = d.scenarios.find((s) => s.id === d.activeScenarioId) ?? d.scenarios[0];
  const patch = (p: Partial<ProfitScenario>) => editor.update((x) => ({ ...x, scenarios: x.scenarios.map((s) => (s.id === active.id ? { ...s, ...p } : s)) }));
  const r = calcScenario(active);
  const confirm = useConfirm();
  const c = d.currency;
  const sym = React.useMemo(() => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: c }).formatToParts(0).find((p) => p.type === "currency")?.value ?? "$";
    } catch {
      return "$";
    }
  }, [c]);

  return (
    <div className="mx-auto grid w-full max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-5 px-4 py-6 sm:px-6">
      <Callout tone="warning" title="Projections, not promises">
        Everything on the Projections tab is a what-if calculation from the assumptions you enter. It is not a forecast, market data or a guarantee of earnings. Record real results on the Actual sales tab.
      </Callout>
      <Tabs defaultValue="projections">
        <div className="flex flex-wrap items-center gap-3">
          <TabsList>
            <TabsTrigger value="projections">Projections</TabsTrigger>
            <TabsTrigger value="compare">Compare scenarios ({d.scenarios.length})</TabsTrigger>
            <TabsTrigger value="actuals" data-testid="tab-actuals">
              Actual sales ({d.actuals.length})
            </TabsTrigger>
          </TabsList>
          <label className="ml-auto flex items-center gap-2 text-sm">
            Currency
            <NativeSelect value={c} onChange={(e) => set({ currency: e.target.value })} className="h-8 w-24 text-xs">
              {CURRENCIES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </NativeSelect>
          </label>
        </div>
        <TabsContent value="projections" className="mt-4 grid gap-4">
          <div className="flex flex-wrap items-center gap-2" data-testid="scenario-tabs">
            {d.scenarios.map((s) => (
              <button key={s.id} type="button" onClick={() => set({ activeScenarioId: s.id })} className={cn("rounded-full border px-3 py-1 text-sm", s.id === active.id ? "border-primary bg-primary-soft font-medium text-primary" : "hover:border-primary/40")}>
                {s.name}
              </button>
            ))}
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                const s = { ...active, id: uid("scn"), name: `${active.name} (copy)` };
                set({ scenarios: [...d.scenarios, s], activeScenarioId: s.id });
              }}
              data-testid="scenario-duplicate"
            >
              <Copy /> Duplicate
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                const s = newScenario({ name: `Scenario ${d.scenarios.length + 1}` });
                set({ scenarios: [...d.scenarios, s], activeScenarioId: s.id });
              }}
            >
              <Plus /> New
            </Button>
            {d.scenarios.length > 1 && (
              <Button
                size="xs"
                variant="ghost"
                className="text-destructive"
                onClick={async () => {
                  if (!(await confirm({ title: `Delete scenario “${active.name}”?`, confirmLabel: "Delete", destructive: true }))) return;
                  const rest = d.scenarios.filter((s) => s.id !== active.id);
                  set({ scenarios: rest, activeScenarioId: rest[0].id });
                }}
              >
                <Trash2 /> Delete
              </Button>
            )}
          </div>
          <div className="grid gap-5 xl:grid-cols-[400px_1fr]">
            <Card className="grid content-start gap-4 p-4">
              <label className="grid gap-1">
                <span className="text-[13px] font-medium">Scenario name</span>
                <Input value={active.name} onChange={(e) => patch({ name: e.target.value })} className="h-8" />
              </label>
              <NumberSlider label="Selling price" prefix={sym} value={active.price} min={0} max={500} step={1} onChange={(v) => patch({ price: Math.max(0, v) })} testid="pc-price" />
              <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2 text-[13px]">
                <span>Enter sales directly instead of traffic × conversion</span>
                <Switch checked={active.unitsOverride !== null} onCheckedChange={(v) => patch({ unitsOverride: v ? Math.round(r.units) : null })} aria-label="Enter sales directly" />
              </div>
              {active.unitsOverride !== null ? (
                <NumberSlider label="Sales per month" value={active.unitsOverride} min={0} max={2000} onChange={(v) => patch({ unitsOverride: Math.max(0, v) })} testid="pc-units" />
              ) : (
                <>
                  <NumberSlider label="Monthly sales-page visitors" value={active.traffic} min={0} max={50000} step={50} onChange={(v) => patch({ traffic: Math.max(0, v) })} testid="pc-traffic" />
                  <NumberSlider label="Conversion rate" suffix="%" value={active.conversionRate} min={0} max={20} step={0.1} onChange={(v) => patch({ conversionRate: Math.max(0, v) })} hint="Your assumption — check it against your own results when you have them." testid="pc-conv" />
                </>
              )}
              <div className="grid grid-cols-2 gap-3">
                <NumberSlider label="Processing fee" suffix="%" value={active.feePercent} min={0} max={15} step={0.1} onChange={(v) => patch({ feePercent: Math.max(0, v) })} />
                <NumberSlider label="Fixed fee / sale" prefix={sym} value={active.feeFixed} min={0} max={5} step={0.05} onChange={(v) => patch({ feeFixed: Math.max(0, v) })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumberSlider label="Affiliate commission" suffix="%" value={active.affiliatePercent} min={0} max={100} step={1} onChange={(v) => patch({ affiliatePercent: Math.max(0, v) })} />
                <NumberSlider label="Refund rate" suffix="%" value={active.refundRate} min={0} max={50} step={0.5} onChange={(v) => patch({ refundRate: Math.max(0, v) })} />
              </div>
              <NumberSlider label="Other cost per sale" prefix={sym} value={active.variableCost} min={0} max={100} step={0.5} onChange={(v) => patch({ variableCost: Math.max(0, v) })} hint="Delivery, platform per-sale fees, licences." />
              <NumberSlider label="Monthly advertising" prefix={sym} value={active.adSpend} min={0} max={20000} step={10} onChange={(v) => patch({ adSpend: Math.max(0, v) })} testid="pc-ads" />
              <NumberSlider label="Monthly fixed costs" prefix={sym} value={active.fixedCosts} min={0} max={5000} step={5} onChange={(v) => patch({ fixedCosts: Math.max(0, v) })} hint="Software, hosting, membership platform." />
            </Card>
            <div className="grid content-start gap-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="profit-kpis">
                <Kpi label="Projected sales / month" value={num(r.units, 1)} hint={active.unitsOverride !== null ? "Entered directly" : `${num(active.traffic)} visitors × ${active.conversionRate}%`} />
                <Kpi label="Projected revenue" value={money(r.grossRevenue, c)} />
                <Kpi label="Gross profit" value={money(r.grossProfit, c)} hint={r.grossMarginPct !== null ? `${num(r.grossMarginPct, 1)}% margin` : undefined} />
                <Kpi label="Est. net operating profit" value={money(r.netProfit, c)} tone={r.netProfit >= 0 ? "good" : "bad"} hint={r.netMarginPct !== null ? `${num(r.netMarginPct, 1)}% of revenue` : undefined} />
                <Kpi label="Break-even sales" value={r.breakEvenUnits !== null ? num(Math.ceil(r.breakEvenUnits)) : "Not reachable"} hint={r.breakEvenTraffic !== null ? `≈ ${num(Math.ceil(r.breakEvenTraffic))} visitors at ${active.conversionRate}%` : r.breakEvenUnits === null ? "Each sale costs more than it earns" : undefined} />
                <Kpi label="Break-even price" value={money(r.breakEvenPrice, c)} hint={`at ${num(r.units, 1)} sales / month`} />
              </div>
              <Card className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <p className="text-sm font-semibold">Profit at different sales volumes</p>
                  <Badge variant="estimate" className="ml-auto">
                    Projection
                  </Badge>
                </div>
                <ProfitChart s={active} r={r} currency={c} />
              </Card>
              <Card className="grid gap-2 p-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">Monthly breakdown</p>
                  <span className="ml-auto text-[11px] text-muted-foreground">Contribution per sale: {money(r.contributionPerSale, c)}</span>
                </div>
                <Breakdown r={r} currency={c} />
                {(r.costPerSale !== null || r.roas !== null) && (
                  <p className="text-[12px] text-muted-foreground">
                    {r.costPerSale !== null && <>Ad cost per sale: {money(r.costPerSale, c)}. </>}
                    {r.roas !== null && <>Return on ad spend: {num(r.roas, 2)}×.</>}
                  </p>
                )}
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="compare" className="mt-4 grid gap-4">
          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <p className="text-sm font-semibold">Scenario comparison</p>
              <Badge variant="estimate" className="ml-auto">
                Projections
              </Badge>
            </div>
            <CompareChart d={d} />
          </Card>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[760px] text-[13px]" data-testid="compare-table">
              <thead className="bg-secondary text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Scenario</th>
                  {["Price", "Sales", "Revenue", "Gross profit", "Ads + fixed", "Net profit", "Break-even sales"].map((h) => (
                    <th key={h} className="px-3 py-2 text-right">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.scenarios.map((s) => {
                  const x = calcScenario(s);
                  return (
                    <tr key={s.id} className={cn("border-t", s.id === active.id && "bg-primary-soft/40")}>
                      <td className="px-3 py-2 font-medium">{s.name}</td>
                      <td className="px-3 text-right tabular-nums">{money(s.price, c)}</td>
                      <td className="px-3 text-right tabular-nums">{num(x.units, 1)}</td>
                      <td className="px-3 text-right tabular-nums">{money(x.grossRevenue, c)}</td>
                      <td className="px-3 text-right tabular-nums">{money(x.grossProfit, c)}</td>
                      <td className="px-3 text-right tabular-nums">{money(x.adSpend + x.fixedCosts, c)}</td>
                      <td className={cn("px-3 text-right font-semibold tabular-nums", x.netProfit < 0 && "text-[#d03b3b]")}>{money(x.netProfit, c)}</td>
                      <td className="px-3 text-right tabular-nums">{x.breakEvenUnits !== null ? num(Math.ceil(x.breakEvenUnits)) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </TabsContent>
        <TabsContent value="actuals" className="mt-4">
          <ActualsPanel d={d} set={set} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function ProfitCalculator({ project }: { project: Project }) {
  return (
    <AssetWorkspace
      project={project}
      type="profit-scenario"
      tool="Profit Calculator"
      eyebrow="Profit Studio"
      icon={<Calculator />}
      description="Model price, fees, refunds, affiliate commission, ad spend and fixed costs to see revenue, gross profit, estimated net operating profit and break-even — then compare scenarios and record your actual sales separately."
      createLabel="New profit model"
      onCreate={async () => {
        const s = newScenario({ name: "Base case", price: project.plannedPrice ?? 27 });
        return (await createAsset(project.id, "profit-scenario", { title: `${project.name.replace(/^SAMPLE\s*[—-]\s*/i, "")} — profit model`, data: { currency: project.currency || "USD", scenarios: [s], activeScenarioId: s.id, actuals: [] } })).id;
      }}
      itemMeta={(a) => {
        const s = a.data.scenarios.find((x) => x.id === a.data.activeScenarioId) ?? a.data.scenarios[0];
        const r = s ? calcScenario(s) : null;
        return `${a.data.scenarios.length} scenario${a.data.scenarios.length === 1 ? "" : "s"}${r ? ` · projected ${money(r.netProfit, a.data.currency)}/mo` : ""} · ${a.data.actuals.length} actual records`;
      }}
      renderEditor={(editor) => <ProfitEditor editor={editor} />}
      versionText={(x) => profitReport(x as ProfitData, "Version")}
      headerActions={(editor) => (
        <ExportMenu
          projectId={project.id}
          assetId={editor.asset!.id}
          assetLabel={editor.title}
          beforeExport={editor.save}
          options={[
            { id: "md", label: "Report (Markdown)", run: () => textFile(profitReport(editor.getData()!, editor.title), safeFileName(editor.title, "md"), "text/markdown") },
            {
              id: "csv",
              label: "Scenarios (CSV)",
              run: () => {
                const d = editor.getData()!;
                return textFile(Papa.unparse(d.scenarios.map((s) => ({ scenario: s.name, ...s, ...calcScenario(s), id: undefined }))), safeFileName(`${editor.title} scenarios`, "csv"), "text/csv");
              },
            },
            { id: "actuals", label: "Actual sales (CSV)", run: () => textFile(Papa.unparse(editor.getData()!.actuals.map(({ id: _id, ...a }) => a)), safeFileName(`${editor.title} actual sales`, "csv"), "text/csv") },
          ]}
        />
      )}
    />
  );
}

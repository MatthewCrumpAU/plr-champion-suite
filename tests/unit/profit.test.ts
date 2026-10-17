import { describe, expect, it } from "vitest";
import { newScenario, defaultFunnelData, defaultLaunchPlanData } from "@/lib/models/defaults";
import { calcScenario, contributionPerSale, profitCurve, summariseActuals } from "@/lib/profit/calc";
import { edge, newFunnelNode, projectFunnel, FUNNEL_TEMPLATES } from "@/lib/profit/funnel";
import { addDays, applyTemplate, BUILT_IN_TEMPLATES, launchIcs, launchProgress, taskDue, templateFromPlan, autoDoneKeys } from "@/lib/profit/launch";


describe("profit calculator", () => {
  const s = newScenario({ price: 27, feePercent: 2.9, feeFixed: 0.3, affiliatePercent: 0, variableCost: 0, refundRate: 5, adSpend: 300, fixedCosts: 100, traffic: 2000, conversionRate: 2 });
  it("computes revenue, costs and profit with real arithmetic", () => {
    const r = calcScenario(s);
    expect(r.units).toBe(40);
    expect(r.grossRevenue).toBe(1080);
    expect(r.refunds).toBeCloseTo(54, 6);
    expect(r.processingFees).toBeCloseTo(40 * (27 * 0.029 + 0.3), 6); // 43.32
    expect(r.grossProfit).toBeCloseTo(1080 - 54 - 43.32, 6);
    expect(r.netProfit).toBeCloseTo(1080 - 54 - 43.32 - 400, 6);
  });
  it("finds the break-even point", () => {
    const r = calcScenario(s);
    const cps = contributionPerSale(s); // 27*0.95 - 1.083 = 24.567
    expect(cps).toBeCloseTo(24.567, 3);
    expect(r.breakEvenUnits).toBeCloseTo(400 / 24.567, 3);
    expect(r.breakEvenTraffic).toBeCloseTo(400 / 24.567 / 0.02, 2);
    // Profit at the break-even volume is zero.
    expect(calcScenario(s, r.breakEvenUnits!).netProfit).toBeCloseTo(0, 6);
    // Break-even price gives zero profit at the projected volume.
    expect(calcScenario({ ...s, price: r.breakEvenPrice! }).netProfit).toBeCloseTo(0, 6);
  });
  it("handles no-profit-per-sale and units overrides", () => {
    expect(calcScenario(newScenario({ price: 1, feeFixed: 2 })).breakEvenUnits).toBeNull();
    expect(calcScenario(newScenario({ unitsOverride: 12, price: 10 })).grossRevenue).toBe(120);
    const curve = profitCurve(s);
    expect(curve[0].profit).toBeCloseTo(-400, 6);
    expect(curve.at(-1)!.profit).toBeGreaterThan(0);
  });
  it("summarises actual recorded sales separately", () => {
    const a = summariseActuals([
      { id: "1", date: "2026-10-02", units: 3, grossRevenue: 81, fees: 3.25, refunds: 0, adSpend: 20, notes: "" },
      { id: "2", date: "2026-10-20", units: 2, grossRevenue: 54, fees: 2.17, refunds: 27, adSpend: 0, notes: "" },
      { id: "3", date: "2026-11-01", units: 1, grossRevenue: 27, fees: 1.08, refunds: 0, adSpend: 0, notes: "" },
    ]);
    expect(a.units).toBe(6);
    expect(a.net).toBeCloseTo(162 - 6.5 - 27 - 20, 6);
    expect(a.byMonth.map((m) => m.month)).toEqual(["2026-10", "2026-11"]);
  });
});

describe("funnel projection", () => {
  it("flows buyers and decliners through yes/no/next connections", () => {
    const fe = newFunnelNode("front-end", { x: 0, y: 0 });
    fe.data.price = 20;
    fe.data.conversionRate = 5;
    const ob = newFunnelNode("order-bump", { x: 300, y: 0 });
    ob.data.price = 10;
    ob.data.conversionRate = 20;
    const up = newFunnelNode("upsell", { x: 300, y: 200 });
    up.data.price = 50;
    up.data.conversionRate = 10;
    const dn = newFunnelNode("downsell", { x: 600, y: 200 });
    dn.data.price = 25;
    dn.data.conversionRate = 10;
    const mem = newFunnelNode("membership", { x: 900, y: 0 });
    mem.data.price = 10;
    mem.data.conversionRate = 10;
    mem.data.periods = 3;
    const data = { ...defaultFunnelData(), nodes: [fe, ob, up, dn, mem], edges: [edge(fe.id, ob.id, "yes"), edge(fe.id, up.id, "yes"), edge(up.id, dn.id, "no"), edge(up.id, mem.id, "next")], assumptions: { traffic: 1000, currency: "USD", adSpend: 100 } };
    const p = projectFunnel(data);
    expect(p.nodes[fe.id].takers).toBe(50);
    expect(p.nodes[ob.id].arrivals).toBe(50);
    expect(p.nodes[ob.id].revenue).toBe(100);
    expect(p.nodes[up.id].takers).toBe(5);
    expect(p.nodes[dn.id].arrivals).toBe(45);
    expect(p.nodes[dn.id].revenue).toBeCloseTo(4.5 * 25, 6);
    expect(p.nodes[mem.id].arrivals).toBe(50);
    expect(p.recurringRevenue).toBe(5 * 10 * 3);
    expect(p.totalRevenue).toBeCloseTo(1000 + 100 + 250 + 112.5 + 150, 6);
    expect(p.profitBeforeCosts).toBeCloseTo(p.totalRevenue - 100, 6);
    expect(p.warnings).toHaveLength(0);
  });
  it("warns about loops and disconnected steps", () => {
    const a = newFunnelNode("front-end", { x: 0, y: 0 });
    const b = newFunnelNode("upsell", { x: 100, y: 0 });
    const c = newFunnelNode("downsell", { x: 200, y: 0 });
    const p = projectFunnel({ ...defaultFunnelData(), nodes: [a, b, c], edges: [edge(b.id, c.id, "yes"), edge(c.id, b.id, "yes")] });
    expect(p.warnings.join(" ")).toMatch(/loop/);
  });
  it("builds every template", () => {
    for (const t of FUNNEL_TEMPLATES) {
      const f = t.build({ product: "Calm" });
      const p = projectFunnel({ ...defaultFunnelData(), ...f });
      expect(p.totalRevenue).toBeGreaterThan(0);
      expect(p.entryIds).toHaveLength(1);
    }
  });
});

describe("launch planner", () => {
  it("resolves due dates from the launch date and tracks progress", () => {
    const d = applyTemplate({ ...defaultLaunchPlanData(), launchDate: "2026-11-20" }, BUILT_IN_TEMPLATES[0], "replace");
    expect(d.tasks.length).toBe(BUILT_IN_TEMPLATES[0].tasks.length);
    expect(taskDue(d.tasks[0], d.launchDate)).toBe("2026-10-30");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    d.tasks[0].status = "done";
    const p = launchProgress(d, new Set(["has-cover"]), "2026-11-10");
    expect(p.done).toBe(1);
    expect(p.overdue).toBeGreaterThan(0);
    expect(p.readinessDone).toBe(1);
  });
  it("exports iCalendar events and round-trips templates", () => {
    const d = applyTemplate({ ...defaultLaunchPlanData(), launchDate: "2026-11-20" }, BUILT_IN_TEMPLATES[1], "replace");
    const ics = launchIcs(d, "Launch");
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261120");
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(d.tasks.length + d.milestones.length);
    d.tasks[0] = { ...d.tasks[0], offsetDays: null, dueDate: "2026-11-01" };
    const tpl = templateFromPlan(d, "Mine", "");
    expect(tpl.tasks[0].offsetDays).toBe(-19);
    expect(autoDoneKeys([]).size).toBe(0);
  });
});

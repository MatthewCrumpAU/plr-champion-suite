import type { ActualSale, ProfitScenario } from "@/lib/models/profit";

/**
 * Profit arithmetic. Everything is plain, explainable maths on the user's own assumptions.
 * Results are projections ("what if"), never forecasts or guarantees — the UI labels them as such.
 */
export interface ScenarioResult {
  units: number;
  grossRevenue: number;
  refunds: number;
  netRevenue: number;
  processingFees: number;
  affiliateCommission: number;
  variableCosts: number;
  /** Net revenue minus per-sale costs (contribution before ad spend and fixed costs). */
  grossProfit: number;
  adSpend: number;
  fixedCosts: number;
  /** Gross profit minus ad spend and fixed costs. */
  netProfit: number;
  /** Profit contributed by each sale before ad spend and fixed costs. */
  contributionPerSale: number;
  grossMarginPct: number | null;
  netMarginPct: number | null;
  breakEvenUnits: number | null;
  breakEvenTraffic: number | null;
  breakEvenPrice: number | null;
  costPerSale: number | null;
  roas: number | null;
}

const n = (v: number) => (Number.isFinite(v) ? v : 0);
const pct = (v: number) => n(v) / 100;

export function scenarioUnits(s: ProfitScenario): number {
  if (s.unitsOverride !== null && Number.isFinite(s.unitsOverride)) return Math.max(0, s.unitsOverride);
  return Math.max(0, n(s.traffic) * pct(s.conversionRate));
}

/** Per-sale contribution after refunds, processing fees, affiliate commission and variable costs. */
export function contributionPerSale(s: ProfitScenario): number {
  const price = n(s.price);
  return price * (1 - pct(s.refundRate)) - (price * pct(s.feePercent) + n(s.feeFixed)) - price * pct(s.affiliatePercent) - n(s.variableCost);
}

export function calcScenario(s: ProfitScenario, unitsOverride?: number): ScenarioResult {
  const units = unitsOverride ?? scenarioUnits(s);
  const price = n(s.price);
  const grossRevenue = units * price;
  const refunds = grossRevenue * pct(s.refundRate);
  const netRevenue = grossRevenue - refunds;
  // Processing fees are usually not returned on refunds, so they apply to every sale.
  const processingFees = units * (price * pct(s.feePercent) + n(s.feeFixed));
  const affiliateCommission = units * price * pct(s.affiliatePercent);
  const variableCosts = units * n(s.variableCost);
  const grossProfit = netRevenue - processingFees - affiliateCommission - variableCosts;
  const adSpend = n(s.adSpend);
  const fixedCosts = n(s.fixedCosts);
  const netProfit = grossProfit - adSpend - fixedCosts;
  const cps = contributionPerSale(s);
  const overhead = adSpend + fixedCosts;
  const breakEvenUnits = cps > 0 ? overhead / cps : null;
  const conv = pct(s.conversionRate);
  const breakEvenTraffic = breakEvenUnits !== null && conv > 0 ? breakEvenUnits / conv : null;
  // Price at which net profit is zero for the same number of units:
  // units × (p(1 − r − f − a) − feeFixed − variable) = overhead
  const k = 1 - pct(s.refundRate) - pct(s.feePercent) - pct(s.affiliatePercent);
  const breakEvenPrice = units > 0 && k > 0 ? (overhead / units + n(s.feeFixed) + n(s.variableCost)) / k : null;
  return {
    units,
    grossRevenue,
    refunds,
    netRevenue,
    processingFees,
    affiliateCommission,
    variableCosts,
    grossProfit,
    adSpend,
    fixedCosts,
    netProfit,
    contributionPerSale: cps,
    grossMarginPct: grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : null,
    netMarginPct: grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : null,
    breakEvenUnits,
    breakEvenTraffic,
    breakEvenPrice,
    costPerSale: units > 0 && adSpend > 0 ? adSpend / units : null,
    roas: adSpend > 0 ? grossRevenue / adSpend : null,
  };
}

/** Net profit across a range of sales volumes (for the break-even chart). */
export function profitCurve(s: ProfitScenario, points = 24): { units: number; profit: number }[] {
  const base = scenarioUnits(s);
  const be = calcScenario(s).breakEvenUnits ?? 0;
  const max = Math.max(10, Math.ceil(Math.max(base, be) * 1.6));
  return Array.from({ length: points + 1 }, (_, i) => {
    const units = Math.round((max / points) * i * 100) / 100;
    return { units, profit: Math.round(calcScenario(s, units).netProfit * 100) / 100 };
  });
}

export interface ActualsSummary {
  units: number;
  grossRevenue: number;
  fees: number;
  refunds: number;
  adSpend: number;
  net: number;
  entries: number;
  byMonth: { month: string; grossRevenue: number; net: number; units: number }[];
}

export function summariseActuals(list: ActualSale[]): ActualsSummary {
  const months = new Map<string, { grossRevenue: number; net: number; units: number }>();
  let units = 0,
    grossRevenue = 0,
    fees = 0,
    refunds = 0,
    adSpend = 0;
  for (const a of list) {
    const net = n(a.grossRevenue) - n(a.fees) - n(a.refunds) - n(a.adSpend);
    units += n(a.units);
    grossRevenue += n(a.grossRevenue);
    fees += n(a.fees);
    refunds += n(a.refunds);
    adSpend += n(a.adSpend);
    const m = (a.date || "").slice(0, 7) || "Undated";
    const cur = months.get(m) ?? { grossRevenue: 0, net: 0, units: 0 };
    months.set(m, { grossRevenue: cur.grossRevenue + n(a.grossRevenue), net: cur.net + net, units: cur.units + n(a.units) });
  }
  return {
    units,
    grossRevenue,
    fees,
    refunds,
    adSpend,
    net: grossRevenue - fees - refunds - adSpend,
    entries: list.length,
    byMonth: [...months.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, v]) => ({ month, ...v })),
  };
}

export function money(v: number | null | undefined, currency = "USD", digits?: number): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: digits ?? (Math.abs(v) >= 1000 ? 0 : 2), minimumFractionDigits: 0 }).format(v);
  } catch {
    return `${currency} ${v.toFixed(2)}`;
  }
}

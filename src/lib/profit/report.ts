import type { ProfitData } from "@/lib/models/profit";
import { calcScenario, money, summariseActuals } from "./calc";

const num = (v: number, d = 0) => (Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: d }) : "—");

export function profitReport(d: ProfitData, title: string): string {
  const lines = [`# ${title}`, "", "_Projections are hypothetical what-if calculations from your own assumptions — not forecasts or guaranteed earnings. Actual recorded sales are listed separately._", ""];
  for (const s of d.scenarios) {
    const r = calcScenario(s);
    lines.push(`## Projection: ${s.name}`, "", `Assumptions: price ${money(s.price, d.currency)}, ${s.unitsOverride !== null ? `${s.unitsOverride} sales/month` : `${s.traffic} visitors × ${s.conversionRate}% conversion`}, fees ${s.feePercent}% + ${money(s.feeFixed, d.currency)}, affiliate ${s.affiliatePercent}%, refunds ${s.refundRate}%, other cost ${money(s.variableCost, d.currency)}/sale, ads ${money(s.adSpend, d.currency)}/month, fixed ${money(s.fixedCosts, d.currency)}/month.`, "");
    lines.push("| | Monthly |", "| --- | ---: |", `| Projected sales | ${num(r.units, 1)} |`, `| Revenue | ${money(r.grossRevenue, d.currency)} |`, `| Gross profit | ${money(r.grossProfit, d.currency)} |`, `| Est. net operating profit | ${money(r.netProfit, d.currency)} |`, `| Break-even sales | ${r.breakEvenUnits !== null ? num(Math.ceil(r.breakEvenUnits)) : "not reachable"} |`, `| Break-even price | ${money(r.breakEvenPrice, d.currency)} |`, "");
  }
  const a = summariseActuals(d.actuals);
  lines.push("## Actual recorded sales", "", a.entries ? `${a.entries} records · ${a.units} units · revenue ${money(a.grossRevenue, d.currency)} · net ${money(a.net, d.currency)}` : "No sales recorded yet.", "");
  return lines.join("\n");
}


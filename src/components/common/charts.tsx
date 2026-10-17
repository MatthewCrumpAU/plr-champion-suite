"use client";

import * as React from "react";

/**
 * Chart tokens (validated categorical slots 1–3 on the white card surface; status colours reserved for
 * profit/loss meaning and always paired with a label). Text uses ink colours, never series colours.
 */
export const CHART = {
  series: ["#2a78d6", "#eb6834", "#1baf7a"],
  good: "#0ca30c",
  critical: "#d03b3b",
  grid: "#e1e0d9",
  axis: "#898781",
  ink: "#0b0b0b",
  inkMuted: "#52514e",
  projection: "#2a78d6",
} as const;

export const axisProps = { stroke: CHART.axis, tick: { fill: CHART.axis, fontSize: 11 }, tickLine: false, axisLine: { stroke: CHART.grid } } as const;

export function ChartTooltip({ active, payload, label, format, labelFormat }: { active?: boolean; payload?: { name?: string; value?: number; color?: string; dataKey?: string }[]; label?: string | number; format: (v: number) => string; labelFormat?: (l: string | number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-lg">
      {label !== undefined && <p className="mb-1 font-medium text-foreground">{labelFormat ? labelFormat(label) : label}</p>}
      {payload.map((p) => (
        <p key={String(p.dataKey ?? p.name)} className="flex items-center gap-2 text-muted-foreground">
          <span className="inline-block size-2 rounded-sm" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="ml-auto pl-3 font-medium tabular-nums text-foreground">{format(Number(p.value ?? 0))}</span>
        </p>
      ))}
    </div>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded" style={{ background: i.dashed ? `repeating-linear-gradient(90deg, ${i.color} 0 4px, transparent 4px 7px)` : i.color, height: i.dashed ? 2 : 8, borderRadius: i.dashed ? 0 : 2 }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

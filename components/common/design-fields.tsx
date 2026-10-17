"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { FONTS, fontCss } from "@/lib/fonts";
import type { Fill } from "@/lib/models/design";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect, Slider } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

function toHex(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (/^#[0-9a-f]{3}$/i.test(color)) return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(color);
  if (m) return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
  return "#000000";
}

export function ColorField({ value, onChange, label, className, swatches }: { value: string; onChange: (v: string) => void; label?: string; className?: string; swatches?: string[] }) {
  const [text, setText] = React.useState(value);
  React.useEffect(() => setText(value), [value]);
  const transparent = /rgba\(.*,\s*0\)$/.test(value) || value === "transparent";
  return (
    <div className={cn("grid gap-1", className)}>
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <div className="flex items-center gap-1.5">
        <label className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border shadow-xs" style={{ background: transparent ? "repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0/10px 10px" : value }}>
          <input type="color" value={toHex(value)} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={label ?? "Colour"} />
        </label>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const t = text.trim();
            if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t) || /^rgba?\(/i.test(t)) onChange(t);
            else setText(value);
          }}
          className="h-8 font-mono text-xs"
          aria-label={`${label ?? "Colour"} hex`}
        />
      </div>
      {swatches && swatches.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {swatches.map((s, i) => (
            <button key={`${s}-${i}`} type="button" onClick={() => onChange(s)} className="size-5 rounded border shadow-xs" style={{ background: s }} aria-label={`Use ${s}`} />
          ))}
        </div>
      )}
    </div>
  );
}

export function FontSelect({ value, onChange, id, label }: { value: string; onChange: (v: string) => void; id?: string; label?: string }) {
  return (
    <div className="grid gap-1">
      {label && (
        <Label htmlFor={id} className="text-xs text-muted-foreground">
          {label}
        </Label>
      )}
      <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)} style={{ fontFamily: fontCss(value) }}>
        {(["sans", "serif", "display", "script"] as const).map((cat) => (
          <optgroup key={cat} label={cat === "sans" ? "Sans serif" : cat === "serif" ? "Serif" : cat === "display" ? "Display" : "Handwritten"}>
            {FONTS.filter((f) => f.category === cat).map((f) => (
              <option key={f.id} value={f.id} style={{ fontFamily: f.css }}>
                {f.label}
              </option>
            ))}
          </optgroup>
        ))}
      </NativeSelect>
    </div>
  );
}

export function fillPreviewCss(fill: Fill): string {
  if (fill.kind === "solid") return fill.color;
  const stops = fill.stops.map((s) => `${s.color} ${Math.round(s.offset * 100)}%`).join(", ");
  return fill.kind === "linear" ? `linear-gradient(${fill.angle}deg, ${stops})` : `radial-gradient(circle, ${stops})`;
}

/** Solid / linear / radial fill editor with colour stops. */
export function FillEditor({ value, onChange, swatches, allowTransparent }: { value: Fill; onChange: (f: Fill) => void; swatches?: string[]; allowTransparent?: boolean }) {
  const kind = value.kind;
  const setKind = (k: Fill["kind"]) => {
    if (k === kind) return;
    const first = value.kind === "solid" ? value.color : value.stops[0]?.color ?? "#000000";
    const last = value.kind === "solid" ? "#ffffff" : value.stops[value.stops.length - 1]?.color ?? "#ffffff";
    if (k === "solid") onChange({ kind: "solid", color: first });
    else if (k === "linear") onChange({ kind: "linear", angle: 160, stops: [{ offset: 0, color: first }, { offset: 1, color: last }] });
    else onChange({ kind: "radial", stops: [{ offset: 0, color: first }, { offset: 1, color: last }] });
  };
  return (
    <div className="grid gap-2.5">
      <div className="h-8 rounded-md border" style={{ background: fillPreviewCss(value) }} />
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-secondary p-1 text-xs">
        {(["solid", "linear", "radial"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={cn("rounded-md py-1 font-medium capitalize", kind === k ? "bg-card shadow-sm" : "text-muted-foreground")}>
            {k === "linear" ? "Gradient" : k}
          </button>
        ))}
      </div>
      {value.kind === "solid" ? (
        <>
          <ColorField value={value.color} onChange={(c) => onChange({ kind: "solid", color: c })} swatches={swatches} />
          {allowTransparent && (
            <Button size="xs" variant="ghost" onClick={() => onChange({ kind: "solid", color: "rgba(0,0,0,0)" })}>
              Make transparent
            </Button>
          )}
        </>
      ) : (
        <>
          {value.kind === "linear" && (
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">Angle: {value.angle}°</Label>
              <Slider value={[value.angle]} min={0} max={360} step={5} onValueChange={([a]) => onChange({ ...value, angle: a })} />
            </div>
          )}
          {value.stops.map((s, i) => (
            <div key={i} className="flex items-end gap-1.5">
              <ColorField value={s.color} onChange={(c) => onChange({ ...value, stops: value.stops.map((x, j) => (j === i ? { ...x, color: c } : x)) } as Fill)} className="flex-1" label={`Stop ${i + 1}`} swatches={i === 0 ? swatches : undefined} />
              <Input
                type="number"
                min={0}
                max={100}
                value={Math.round(s.offset * 100)}
                onChange={(e) => onChange({ ...value, stops: value.stops.map((x, j) => (j === i ? { ...x, offset: Math.max(0, Math.min(100, Number(e.target.value))) / 100 } : x)) } as Fill)}
                className="h-8 w-16 text-xs"
                aria-label="Stop position %"
              />
              {value.stops.length > 2 && (
                <Button size="icon-xs" variant="ghost" onClick={() => onChange({ ...value, stops: value.stops.filter((_, j) => j !== i) } as Fill)} aria-label="Remove stop">
                  <X />
                </Button>
              )}
            </div>
          ))}
          {value.stops.length < 5 && (
            <Button size="xs" variant="ghost" onClick={() => onChange({ ...value, stops: [...value.stops, { offset: 1, color: value.stops[value.stops.length - 1]?.color ?? "#ffffff" }] } as Fill)}>
              <Plus /> Colour stop
            </Button>
          )}
        </>
      )}
    </div>
  );
}

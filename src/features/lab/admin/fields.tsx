"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/** A list of short strings edited as one line per item. */
export function LinesField({ id, value, onChange, rows = 4, placeholder, testId }: { id?: string; value: string[]; onChange: (v: string[]) => void; rows?: number; placeholder?: string; testId?: string }) {
  const [text, setText] = React.useState(value.join("\n"));
  const last = React.useRef(value.join("\n"));
  React.useEffect(() => {
    const joined = value.join("\n");
    if (joined !== last.current) {
      last.current = joined;
      setText(joined);
    }
  }, [value]);
  return (
    <Textarea
      id={id}
      rows={rows}
      value={text}
      placeholder={placeholder}
      data-testid={testId}
      onChange={(e) => {
        setText(e.target.value);
        const next = e.target.value.split("\n").map((l) => l.trimEnd());
        const cleaned = next.filter((l, i) => l.trim() || i < next.length - 1);
        last.current = cleaned.join("\n");
        onChange(cleaned.filter((l) => l.trim()));
      }}
    />
  );
}

/** Up / down / remove controls for a row in an editable list. */
export function RowControls({ index, count, onMove, onRemove, label }: { index: number; count: number; onMove: (from: number, to: number) => void; onRemove: () => void; label: string }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button variant="ghost" size="icon-xs" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Move ${label} up`}>
        <ArrowUp />
      </Button>
      <Button variant="ghost" size="icon-xs" disabled={index === count - 1} onClick={() => onMove(index, index + 1)} aria-label={`Move ${label} down`}>
        <ArrowDown />
      </Button>
      <Button variant="ghost" size="icon-xs" onClick={onRemove} aria-label={`Remove ${label}`}>
        <Trash2 />
      </Button>
    </div>
  );
}

export function EditorRow({ children, className, testId }: { children: React.ReactNode; className?: string; testId?: string }) {
  return (
    <div className={cn("grid gap-3 rounded-xl border bg-card p-3", className)} data-testid={testId}>
      {children}
    </div>
  );
}

export function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

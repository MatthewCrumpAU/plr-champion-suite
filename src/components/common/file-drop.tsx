"use client";

import * as React from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export function FileDrop({
  accept,
  onFiles,
  multiple = false,
  title = "Drop a file here, or click to browse",
  hint,
  className,
  compact = false,
  disabled = false,
  testId,
}: {
  accept: string;
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  title?: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  compact?: boolean;
  disabled?: boolean;
  testId?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);

  const handle = (list: FileList | null) => {
    if (!list || !list.length || disabled) return;
    onFiles(Array.from(list).slice(0, multiple ? 50 : 1));
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        handle(e.dataTransfer.files);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-card text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        compact ? "gap-1 px-4 py-5" : "gap-2 px-6 py-10",
        over ? "border-primary bg-primary-soft/60" : "border-border hover:border-primary/50 hover:bg-secondary/40",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
      data-testid={testId}
    >
      <span className={cn("flex items-center justify-center rounded-xl bg-primary-soft text-primary", compact ? "size-8" : "size-11")}>
        <Upload className={compact ? "size-4" : "size-5"} />
      </span>
      <p className={cn("font-medium", compact ? "text-sm" : "text-[15px]")}>{title}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

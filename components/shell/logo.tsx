import { useId } from "react";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const tile = `plrc-tile-${id}`;
  const gold = `plrc-gold-${id}`;
  return (
    <svg viewBox="0 0 40 40" className={cn("size-8 shrink-0", className)} aria-hidden="true">
      <defs>
        <linearGradient id={tile} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6E5BFF" />
          <stop offset="1" stopColor="#3B2FD0" />
        </linearGradient>
        <linearGradient id={gold} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFD983" />
          <stop offset="1" stopColor="#F5A524" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill={`url(#${tile})`} />
      <path d="M11 13.5l3.2 3.2L20 10l5.8 6.7 3.2-3.2-1.6 9.5H12.6z" fill={`url(#${gold})`} />
      <rect x="12.6" y="24.6" width="14.8" height="3" rx="1.2" fill={`url(#${gold})`} />
      <circle cx="20" cy="10" r="1.6" fill="#FFE6A8" />
    </svg>
  );
}

export function Logo({ className, dark = true, compact = false }: { className?: string; dark?: boolean; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <div className="leading-none">
          <div className={cn("text-[15px] font-semibold tracking-tight", dark ? "text-white" : "text-foreground")}>PLR Champion</div>
          <div className={cn("mt-1 text-[10.5px] font-medium", dark ? "text-sidebar-muted" : "text-muted-foreground")}>Software Suite</div>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { useAIStatus } from "@/lib/ai/client";
import { logout } from "@/lib/client/api";
import { NAV, isActive } from "./nav";
import { Logo, LogoMark } from "./logo";

function AIIndicator({ collapsed }: { collapsed: boolean }) {
  const { status, loading } = useAIStatus();
  const label = loading ? "Checking AI…" : status?.testMode ? "AI test mode (not real AI)" : status?.configured ? "AI ready (Claude)" : "AI off — manual mode";
  const dot = cn("size-2 shrink-0 rounded-full", loading ? "bg-sidebar-muted" : status?.configured ? "bg-emerald-400" : "bg-amber-400");
  if (collapsed) {
    return (
      <Tooltip content={label} side="right">
        <Link href="/settings#ai" className="mb-2 mt-2 flex size-8 items-center justify-center rounded-lg hover:bg-sidebar-accent" aria-label={label}>
          <span className={dot} />
        </Link>
      </Tooltip>
    );
  }
  return (
    <Link href="/settings#ai" className="mb-2 flex items-center gap-2 rounded-lg bg-sidebar-accent/60 px-2.5 py-2 text-[11.5px] text-sidebar-foreground transition-colors hover:bg-sidebar-accent">
      <span className={dot} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function OwnerMenu({ collapsed }: { collapsed: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            collapsed && "justify-center px-0",
          )}
          aria-label="Account menu"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6E5BFF] to-[#F5B544] text-white">
            <ShieldCheck className="size-4" />
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-medium text-white">Owner</span>
              <span className="block truncate text-[11px] text-sidebar-muted">Private workspace</span>
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuLabel>Signed in as owner</DropdownMenuLabel>
        <p className="px-2 pb-2 text-xs text-muted-foreground">Projects are stored in this browser. Export backups regularly from the Export Centre.</p>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Sidebar({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center bg-sidebar py-4 text-sidebar-foreground">
        <Link href="/" className="mb-4" aria-label="PLR Champion dashboard">
          <LogoMark />
        </Link>
        <nav className="plr-scroll-dark flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto" aria-label="Main">
          {NAV.map((section, si) => (
            <div key={section.id} className="flex flex-col items-center gap-1">
              {si > 0 && <div className="my-1.5 h-px w-6 bg-sidebar-border" />}
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Tooltip key={item.href} content={item.label} side="right">
                    <Link
                      href={item.href}
                      aria-label={item.label}
                      aria-current={active ? "page" : undefined}
                      className={cn("flex size-9 items-center justify-center rounded-lg transition-colors", active ? "bg-primary text-white" : "text-sidebar-muted hover:bg-sidebar-accent hover:text-white")}
                    >
                      <Icon className="size-4" />
                    </Link>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </nav>
        <AIIndicator collapsed />
        <div className="px-2">
          <OwnerMenu collapsed />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-4 pb-3 pt-5">
        <Link href="/" onClick={onNavigate} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Logo />
        </Link>
      </div>
      <nav className="plr-scroll-dark flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {NAV.map((section) => (
          <div key={section.id} className="mt-3 first:mt-0">
            {section.title && <p className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted">{section.title}</p>}
            <ul className="grid gap-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors",
                        active ? "bg-sidebar-accent text-sidebar-active" : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-white",
                      )}
                    >
                      <span className={cn("flex size-6 items-center justify-center rounded-md transition-colors", active ? "bg-primary text-white" : "bg-white/[0.04] text-sidebar-muted group-hover:text-white")}>
                        <Icon className="size-3.5" />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <AIIndicator collapsed={false} />
        <OwnerMenu collapsed={false} />
      </div>
    </div>
  );
}

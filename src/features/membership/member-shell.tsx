"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeftRight, ChevronsUpDown, Eye, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, ShieldCheck, TriangleAlert, Users, X } from "lucide-react";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Progress, Spinner } from "@/components/ui/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Sheet, SheetContent, SheetTitle, Tooltip, TooltipProvider } from "@/components/ui/overlays";
import { ConfirmProvider } from "@/components/ui/confirm";
import { ToolLinksProvider } from "@/components/common/tool-links";
import { ProjectSwitcher } from "@/components/shell/project-switcher";
import { bootstrapWorkspace } from "@/lib/services/bootstrap";
import { logout } from "@/lib/client/api";
import { bootstrapMembership, type MembershipBootProgress } from "@/lib/membership/hooks";
import { brandCssVars, getBrand, memberPath, type BrandConfig } from "@/lib/membership/brands";
import type { PreviewTier } from "@/lib/membership/account";
import type { BrandId } from "@/lib/membership/types";
import { cn, errorMessage } from "@/lib/utils";
import { MemberProvider, useMember } from "./member-context";
import { memberNav, memberToolRoutes } from "./member-nav";
import { BrandLogo, BrandMark } from "./ui";

const PREVIEW_OPTIONS: { value: PreviewTier; label: string; hint: string }[] = [
  { value: "owner", label: "Owner (admin view)", hint: "See drafts and admin controls" },
  { value: "premium", label: "Premium member", hint: "Everything published" },
  { value: "member", label: "Member", hint: "Member and free content" },
  { value: "free", label: "Free member", hint: "Free content only" },
];

/** Human label for what the owner is currently viewing as. */
function useViewingLabel(): string {
  const m = useMember();
  if (m.previewAccount) return `${m.previewAccount.displayName} (test profile)`;
  return PREVIEW_OPTIONS.find((o) => o.value === m.previewTier)?.label ?? PREVIEW_OPTIONS[0].label;
}

function isActive(pathname: string, base: string, path: string, exact?: boolean) {
  const href = path ? `${base}/${path}` : base;
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function MemberSidebar({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const m = useMember();
  const base = m.href();
  const sections = memberNav(m.brand, m.isAdmin);

  return (
    <div className={cn("flex h-full flex-col bg-sidebar text-sidebar-foreground", collapsed && "items-center")} data-testid="member-sidebar">
      <div className={cn("pb-3 pt-5", collapsed ? "px-2" : "px-4")}>
        <Link href={base} onClick={onNavigate} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`${m.brand.name} dashboard`}>
          {collapsed ? <BrandMark brand={m.brand} /> : <BrandLogo brand={m.brand} />}
        </Link>
      </div>
      <nav className={cn("plr-scroll-dark flex-1 overflow-y-auto pb-4", collapsed ? "w-full px-2" : "px-3")} aria-label={`${m.brand.name} navigation`}>
        {sections.map((section, si) => (
          <div key={section.id} className={cn(collapsed ? "flex flex-col items-center gap-1" : "mt-3 first:mt-0")}>
            {collapsed ? si > 0 && <div className="my-1.5 h-px w-6 bg-sidebar-border" /> : section.title && <p className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted">{section.title}</p>}
            <ul className={cn(collapsed ? "flex flex-col items-center gap-1" : "grid gap-0.5")}>
              {section.items.map((item) => {
                const active = isActive(pathname, base, item.path, item.exact);
                const Icon = item.icon;
                const href = item.path ? `${base}/${item.path}` : base;
                if (collapsed)
                  return (
                    <li key={item.path}>
                      <Tooltip content={item.label} side="right">
                        <Link href={href} aria-label={item.label} aria-current={active ? "page" : undefined} className={cn("flex size-9 items-center justify-center rounded-lg transition-colors", active ? "bg-primary text-white" : "text-sidebar-muted hover:bg-sidebar-accent hover:text-white")}>
                          <Icon className="size-4" />
                        </Link>
                      </Tooltip>
                    </li>
                  );
                return (
                  <li key={item.path}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn("group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors", active ? "bg-sidebar-accent text-sidebar-active" : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-white")}
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
      <div className={cn("w-full border-t border-sidebar-border p-3", collapsed && "flex flex-col items-center px-2")}>
        <AccountMenu collapsed={collapsed} />
      </div>
    </div>
  );
}

function AccountMenu({ collapsed }: { collapsed: boolean }) {
  const m = useMember();
  const viewing = useViewingLabel();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn("flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", collapsed && "justify-center px-0")} aria-label="Account menu">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-white" style={{ background: `linear-gradient(135deg, ${m.brand.theme.primary}, ${m.brand.theme.highlight})` }}>
            <ShieldCheck className="size-4" />
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-medium text-white">{m.account.displayName}</span>
              <span className="block truncate text-[11px] text-sidebar-muted">{m.viewer.previewing ? `Previewing as ${viewing}` : "Owner · private testing"}</span>
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-64">
        <DropdownMenuLabel>Signed in as owner</DropdownMenuLabel>
        <p className="px-2 pb-2 text-xs text-muted-foreground">Member sign-up, subscriptions and payments are not switched on. Only you can open this area.</p>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/">
            <ArrowLeftRight /> Open the studio (owner tools)
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PreviewSwitcher() {
  const m = useMember();
  const viewing = useViewingLabel();
  if (m.account.role !== "owner") return null;
  const profiles = m.accounts.filter((a) => a.role !== "owner");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={m.viewer.previewing ? "soft" : "outline"} size="sm" data-testid="preview-as" aria-label={`Viewing as ${viewing}. Change view`}>
          <Eye /> <span className="hidden max-w-[180px] truncate md:inline">{m.viewer.previewing ? viewing : "View as"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>View this area as…</DropdownMenuLabel>
        {PREVIEW_OPTIONS.map((o) => (
          <DropdownMenuItem key={o.value} onSelect={() => m.setPreviewTier(o.value)} data-testid={`preview-${o.value}`} className={cn(o.value === m.previewTier && "bg-secondary")}>
            <span className="grid grid-cols-1">
              <span className="font-medium">{o.label}</span>
              <span className="text-xs text-muted-foreground">{o.hint}</span>
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Test profiles</DropdownMenuLabel>
        {profiles.map((a) => (
          <DropdownMenuItem key={a.id} onSelect={() => m.setPreviewTier(`account:${a.id}`)} data-testid={`preview-profile-${a.email}`} className={cn(m.previewAccount?.id === a.id && "bg-secondary")}>
            <span className="grid grid-cols-1">
              <span className="truncate font-medium">{a.displayName}</span>
              <span className="truncate text-xs text-muted-foreground">{a.email}</span>
            </span>
          </DropdownMenuItem>
        ))}
        {m.isAdmin || m.viewer.previewing ? (
          <DropdownMenuItem asChild>
            <Link href={m.adminHref("access")} onClick={() => m.viewer.previewing && m.setPreviewTier("owner")}>
              <Users /> {profiles.length ? "Manage test profiles" : "Create a test profile"}
            </Link>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Switch between brand areas the viewer can open (the owner can open all of them). */
function BrandSwitcher() {
  const m = useMember();
  const pathname = usePathname();
  const others = m.brands.filter((b) => b !== m.brandId);
  if (!others.length) return null;
  // Keep the same section when switching (product/drop/course pages go to their list).
  const rest = pathname.slice(m.href().length).split("/").filter(Boolean);
  const section = rest[0] === "admin" ? rest.slice(0, 2) : rest[0] === "tools" ? rest.slice(0, 2) : rest.slice(0, 1);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" data-testid="brand-switcher" aria-label={`Switch from ${m.brand.name} to another membership`}>
          <BrandMark brand={m.brand} className="size-5 rounded-md text-[9px]" />
          <span className="hidden lg:inline">{m.brand.shortName}</span>
          <ChevronsUpDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>{m.viewer.previewing && m.previewAccount ? `${m.previewAccount.displayName}'s memberships` : "Your memberships"}</DropdownMenuLabel>
        {[m.brandId, ...others].map((b) => {
          const brand = getBrand(b);
          return (
            <DropdownMenuItem key={b} asChild className={cn(b === m.brandId && "bg-secondary")}>
              <Link href={memberPath(b, section.join("/"))} data-testid={`switch-${b}`}>
                <BrandMark brand={brand} className="size-6 rounded-md text-[10px]" />
                <span className="grid grid-cols-1">
                  <span className="font-medium">{brand.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{brand.tagline}</span>
                </span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Shown when a previewed member has no membership for this brand — brands keep separate customers. */
function NoBrandAccess() {
  const m = useMember();
  return (
    <div className="mx-auto mt-16 max-w-lg px-4 text-center" data-testid="no-brand-access">
      <BrandMark brand={m.brand} className="mx-auto size-12" />
      <h1 className="mt-4 text-xl font-semibold tracking-tight">No {m.brand.name} membership</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {m.previewAccount?.displayName ?? "This account"} doesn&apos;t have access to {m.brand.name}. Each brand has its own members; a bundle or a linked account can give access to both.
      </p>
      {m.brands.length > 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {m.brands.map((b) => (
            <Button key={b} asChild variant="outline">
              <Link href={memberPath(b)}>Open {getBrand(b).name}</Link>
            </Button>
          ))}
        </div>
      )}
      <Button variant="ghost" className="mt-3" onClick={() => m.setPreviewTier("owner")}>
        Exit preview
      </Button>
    </div>
  );
}

function HeaderSearch() {
  const m = useMember();
  const router = useRouter();
  const [q, setQ] = React.useState("");
  return (
    <form
      role="search"
      className="relative hidden w-full max-w-sm md:block"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`${m.href("library")}${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
      }}
    >
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search the ${m.brand.shortName} library`} className="h-9 pl-8" aria-label="Search the library" data-testid="member-search" />
    </form>
  );
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const m = useMember();
  const viewing = useViewingLabel();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [collapsedPref, setCollapsedPref] = React.useState<"expanded" | "collapsed" | null>(null);
  const base = m.href();
  const toolRoute = pathname.startsWith(`${base}/tools/`);
  const wideTool = /\/tools\/(editor|profit-map)/.test(pathname);
  const collapsed = collapsedPref ? collapsedPref === "collapsed" : wideTool;

  React.useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className={cn("no-print hidden shrink-0 lg:block", collapsed ? "w-[60px]" : "w-[256px]")}>
        <MemberSidebar collapsed={collapsed} />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[272px] border-0 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <MemberSidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 sm:px-5">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <Button variant="ghost" size="icon-sm" className="hidden lg:inline-flex" onClick={() => setCollapsedPref(collapsed ? "expanded" : "collapsed")} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          </Tooltip>
          <Link href={base} className="lg:hidden" aria-label="Dashboard">
            <BrandMark brand={m.brand} className="size-7" />
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-3">{toolRoute ? <ProjectSwitcher /> : <HeaderSearch />}</div>
          <BrandSwitcher />
          <PreviewSwitcher />
        </header>
        {m.viewer.previewing && (
          <div className="no-print flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[13px] text-amber-900" data-testid="preview-banner" data-saved={m.previewSaved}>
            <Eye className="size-4 shrink-0" />
            <span className="min-w-0 flex-1">
              Previewing as <strong>{viewing}</strong>. Drafts and admin controls are hidden; locked items show what members would see.
            </span>
            <Button size="xs" variant="outline" onClick={() => m.setPreviewTier("owner")}>
              <X /> Exit preview
            </Button>
          </div>
        )}
        <main id="main" className="plr-scroll relative min-h-0 flex-1 overflow-y-auto" data-preview-saved={m.previewSaved}>
          {m.viewer.tier === null ? <NoBrandAccess /> : children}
        </main>
      </div>
    </div>
  );
}

type Boot = { status: "booting"; progress: MembershipBootProgress | null } | { status: "ready" } | { status: "error"; message: string };

function useThemeOnRoot(brand: BrandConfig) {
  // Dialogs, menus and toasts render outside the shell (in <body>), so the brand colours go on <html> too.
  React.useEffect(() => {
    const root = document.documentElement;
    const vars = brandCssVars(brand.theme);
    const prev: Record<string, string> = {};
    for (const [k, v] of Object.entries(vars)) {
      prev[k] = root.style.getPropertyValue(k);
      root.style.setProperty(k, v);
    }
    root.dataset.brand = brand.id;
    return () => {
      for (const [k, v] of Object.entries(prev)) {
        if (v) root.style.setProperty(k, v);
        else root.style.removeProperty(k);
      }
      delete root.dataset.brand;
    };
  }, [brand]);
}

export function MemberShell({ brandId, children }: { brandId: BrandId; children: React.ReactNode }) {
  const brand = getBrand(brandId);
  const [boot, setBoot] = React.useState<Boot>({ status: "booting", progress: null });
  useThemeOnRoot(brand);
  const routes = React.useMemo(() => memberToolRoutes(memberPath(brandId)), [brandId]);

  React.useEffect(() => {
    let on = true;
    Promise.all([bootstrapWorkspace(), bootstrapMembership(brandId, (progress) => on && setBoot({ status: "booting", progress }))])
      .then(() => on && setBoot({ status: "ready" }))
      .catch((e) => on && setBoot({ status: "error", message: errorMessage(e) }));
    return () => {
      on = false;
    };
  }, [brandId]);

  return (
    <div style={brandCssVars(brand.theme) as React.CSSProperties} className="contents">
      <TooltipProvider delayDuration={250}>
        <ConfirmProvider>
          <ToolLinksProvider routes={routes}>
            {boot.status === "ready" ? (
              <MemberProvider brandId={brandId}>
                <ShellFrame>{children}</ShellFrame>
              </MemberProvider>
            ) : (
              <div className="flex h-dvh items-center justify-center bg-background p-6">
                {boot.status === "booting" ? (
                  <div className="w-full max-w-sm text-center" data-testid="member-booting">
                    <BrandMark brand={brand} className="mx-auto size-12" />
                    <p className="mt-4 flex items-center justify-center gap-2 text-sm font-medium">
                      <Spinner /> {boot.progress ? "Preparing your sample library…" : `Opening ${brand.name}…`}
                    </p>
                    {boot.progress && (
                      <>
                        <Progress value={(boot.progress.done / boot.progress.total) * 100} className="mt-3" />
                        <p className="mt-2 truncate text-xs text-muted-foreground">{boot.progress.label}</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-900">
                    <div className="flex items-center gap-2 font-semibold">
                      <TriangleAlert className="size-4" /> The membership area couldn&apos;t open
                    </div>
                    <p className="mt-2">Membership data is stored in this browser (IndexedDB). Private windows and blocked site data stop it from working. Open the app in a normal window and try again.</p>
                    <p className="mt-2 font-mono text-xs opacity-70">{boot.message}</p>
                  </div>
                )}
              </div>
            )}
          </ToolLinksProvider>
        </ConfirmProvider>
      </TooltipProvider>
      <Toaster position="bottom-right" richColors closeButton toastOptions={{ className: "text-sm" }} />
    </div>
  );
}

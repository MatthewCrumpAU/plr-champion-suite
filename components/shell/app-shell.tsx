"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, PanelLeftClose, PanelLeftOpen, Plus, TriangleAlert } from "lucide-react";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, TooltipProvider, Tooltip } from "@/components/ui/overlays";
import { ConfirmProvider } from "@/components/ui/confirm";
import { Spinner } from "@/components/ui/primitives";
import { bootstrapWorkspace } from "@/lib/services/bootstrap";
import { cn, errorMessage } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { ProjectSwitcher } from "./project-switcher";
import { LogoMark } from "./logo";
import { findNav, NAV } from "./nav";

/* ------------------------------------------------------------------ */
/* Breadcrumb context: pages can append their current item title       */
/* ------------------------------------------------------------------ */
const CrumbContext = React.createContext<(title: string | null) => void>(() => {});

export function useBreadcrumb(title: string | null | undefined) {
  const set = React.useContext(CrumbContext);
  React.useEffect(() => {
    set(title ?? null);
    return () => set(null);
  }, [title, set]);
}

function Breadcrumbs({ extra }: { extra: string | null }) {
  const pathname = usePathname();
  const item = findNav(pathname);
  const section = NAV.find((s) => s.items.some((i) => i.href === item?.href));
  const crumbs: { label: string; href?: string }[] = [];
  if (pathname !== "/") crumbs.push({ label: "Dashboard", href: "/" });
  if (section?.title && section.id !== "workspace") crumbs.push({ label: section.title });
  if (item) crumbs.push({ label: item.label, href: extra ? item.href : undefined });
  if (extra) crumbs.push({ label: extra });
  if (pathname === "/") return <span className="text-sm font-semibold">Dashboard</span>;
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1 text-[13px] text-muted-foreground md:flex">
      {crumbs.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ChevronRight className="size-3.5 shrink-0 opacity-60" />}
          {c.href ? (
            <Link href={c.href} className="truncate hover:text-foreground">
              {c.label}
            </Link>
          ) : (
            <span className={cn("truncate", i === crumbs.length - 1 && "font-medium text-foreground")}>{c.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

type BootState = { status: "booting" } | { status: "ready" } | { status: "unavailable"; message: string };

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [boot, setBoot] = React.useState<BootState>({ status: "booting" });
  const [collapsedPref, setCollapsedPref] = React.useState<"expanded" | "collapsed" | null>(null);
  const [crumb, setCrumb] = React.useState<string | null>(null);
  const pathname = usePathname();

  React.useEffect(() => {
    try {
      const v = window.localStorage.getItem("plrc.sidebar");
      if (v === "expanded" || v === "collapsed") setCollapsedPref(v);
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    bootstrapWorkspace()
      .then(() => setBoot({ status: "ready" }))
      .catch((e) => setBoot({ status: "unavailable", message: errorMessage(e) }));
  }, []);

  React.useEffect(() => setMobileOpen(false), [pathname]);

  const wideTool = /^\/(editor|covers|funnels|mockups)/.test(pathname);
  const collapsed = collapsedPref ? collapsedPref === "collapsed" : wideTool;

  const toggle = () => {
    const next = collapsed ? "expanded" : "collapsed";
    setCollapsedPref(next);
    try {
      window.localStorage.setItem("plrc.sidebar", next);
    } catch {
      /* ignore */
    }
  };

  return (
    <TooltipProvider delayDuration={250}>
      <ConfirmProvider>
        <CrumbContext.Provider value={setCrumb}>
          <div className="flex h-dvh overflow-hidden">
            <aside className={cn("no-print hidden shrink-0 lg:block", collapsed ? "w-[60px]" : "w-[248px]")}>
              <Sidebar collapsed={collapsed} />
            </aside>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetContent side="left" className="w-[264px] border-0 bg-sidebar p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <Sidebar onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>

            <div className="flex min-w-0 flex-1 flex-col">
              <header className="no-print flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 sm:px-5">
                <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
                  <Menu />
                </Button>
                <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
                  <Button variant="ghost" size="icon-sm" className="hidden lg:inline-flex" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
                    {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                  </Button>
                </Tooltip>
                <Link href="/" className="lg:hidden" aria-label="Dashboard">
                  <LogoMark className="size-7" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Breadcrumbs extra={crumb} />
                </div>
                {boot.status === "ready" && <ProjectSwitcher />}
                <Button asChild variant="gradient" size="sm" className="hidden sm:inline-flex">
                  <Link href="/projects?new=1">
                    <Plus /> New project
                  </Link>
                </Button>
              </header>

              <main id="main" className="plr-scroll relative min-h-0 flex-1 overflow-y-auto">
                {boot.status === "ready" && children}
                {boot.status === "booting" && (
                  <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Spinner /> Loading your workspace…
                  </div>
                )}
                {boot.status === "unavailable" && (
                  <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-900">
                    <div className="flex items-center gap-2 font-semibold">
                      <TriangleAlert className="size-4" /> Local storage is unavailable
                    </div>
                    <p className="mt-2">
                      PLR Champion stores your projects in this browser (IndexedDB), but the browser refused access. This usually happens in private or incognito windows, or when site data is blocked. Open the app in a normal window and allow site data.
                    </p>
                    <p className="mt-2 font-mono text-xs opacity-70">{boot.message}</p>
                  </div>
                )}
              </main>
            </div>
          </div>
          <Toaster position="bottom-right" richColors closeButton toastOptions={{ className: "text-sm" }} />
        </CrumbContext.Provider>
      </ConfirmProvider>
    </TooltipProvider>
  );
}

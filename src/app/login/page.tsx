import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ALL_SESSION_COOKIES, getAuthConfig, getAuthConfigStatus } from "@/lib/auth/config";
import { verifySessionToken } from "@/lib/auth/session";
import { LoginForm } from "./login-form";
import { SetupHelp } from "./setup-help";
import { LogoMark } from "@/components/shell/logo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/api/")) return "/";
  return next;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const cfg = getAuthConfig();
  const status = getAuthConfigStatus(cfg);

  if (status.configured) {
    const jar = await cookies();
    const token = ALL_SESSION_COOKIES.map((n) => jar.get(n)?.value).find(Boolean);
    if (await verifySessionToken(token, cfg.secret, cfg.sessionVersion)) redirect(safeNext(next));
  }
  const h = await headers();
  const host = h.get("host") ?? "";

  return (
    <div className="flex min-h-dvh">
      <div className="relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full bg-[#F5B544]/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <LogoMark className="size-10" />
          <div>
            <p className="text-lg font-semibold text-white">PLR Champion</p>
            <p className="text-xs text-sidebar-muted">Software Suite</p>
          </div>
        </div>
        <div className="relative">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white">Turn private label rights content into finished products.</h1>
          <ul className="mt-6 grid gap-2.5 text-sm">
            {[
              "Import, edit and rebrand PLR documents",
              "Design covers and 3D mockups",
              "Build bonuses, lead magnets and new products",
              "Write sales pages, emails and social posts",
              "Plan funnels, launches and profit scenarios",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="size-1.5 rounded-full bg-[#F5B544]" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-sidebar-muted">Private owner workspace · your projects stay in your browser</p>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark className="size-10" />
            <div>
              <p className="text-lg font-semibold">PLR Champion</p>
              <p className="text-xs text-muted-foreground">Software Suite</p>
            </div>
          </div>
          {status.configured ? (
            <>
              <h2 className="text-2xl font-semibold tracking-tight">Owner sign in</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">Enter the owner password configured for this deployment.</p>
              <LoginForm next={safeNext(next)} />
            </>
          ) : (
            <SetupHelp problems={status.problems} host={host} />
          )}
        </div>
      </div>
    </div>
  );
}

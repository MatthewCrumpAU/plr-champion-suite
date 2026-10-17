import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";

/** Every page in this group is protected by middleware (owner session required). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <Suspense fallback={null}>{children}</Suspense>
    </AppShell>
  );
}

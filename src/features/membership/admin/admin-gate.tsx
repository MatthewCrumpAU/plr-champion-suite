"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageContainer } from "@/components/ui/primitives";
import { useMember } from "../member-context";

/** Admin screens are owner-only. While previewing as a member they're hidden, exactly as members would see. */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const m = useMember();
  if (m.isAdmin) return <>{children}</>;
  return (
    <PageContainer width="narrow">
      {m.viewer.previewing ? (
        <EmptyState
          icon={<Eye />}
          title="Admin is hidden while you preview"
          description="You're viewing the membership as a member. Exit the preview to manage products, categories and releases."
          action={<Button onClick={() => m.setPreviewTier("owner")}>Exit preview</Button>}
        />
      ) : (
        <EmptyState icon={<ShieldAlert />} title="Owner access only" description="Only the owner can manage the membership." action={<Button asChild><Link href={m.href()}>Back to the dashboard</Link></Button>} />
      )}
    </PageContainer>
  );
}

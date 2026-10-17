import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBrand, isLiveBrand } from "@/lib/membership/brands";
import { MemberShell } from "@/features/membership/member-shell";

/** Brand membership area. Protected by middleware like every other page (owner session required). */
export async function generateMetadata({ params }: { params: Promise<{ brand: string }> }): Promise<Metadata> {
  const { brand } = await params;
  if (!isLiveBrand(brand)) return {};
  const b = getBrand(brand);
  return { title: { default: `${b.name} Members`, template: `%s · ${b.name}` } };
}

export default async function MemberLayout({ children, params }: { children: React.ReactNode; params: Promise<{ brand: string }> }) {
  const { brand } = await params;
  if (!isLiveBrand(brand)) notFound();
  return (
    <MemberShell brandId={brand}>
      <Suspense fallback={null}>{children}</Suspense>
    </MemberShell>
  );
}

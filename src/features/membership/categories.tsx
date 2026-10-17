"use client";

import Link from "next/link";
import { ArrowRight, Shapes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageContainer, PageHeader, Spinner } from "@/components/ui/primitives";
import { plural } from "@/lib/utils";
import { useMember, useVisibleProducts } from "./member-context";
import { CategoryIcon, ProductCover } from "./ui";

export function CategoriesPage() {
  const m = useMember();
  const { products, catalog, loading } = useVisibleProducts();
  if (loading || !catalog) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }
  const uncategorised = products.filter((p) => !p.categoryIds.length).length;

  return (
    <PageContainer width="wide">
      <PageHeader eyebrow={m.brand.name} title="Product Categories" description="Browse the library by niche. Each category shows how many products you can open today." actions={m.isAdmin ? <Button asChild variant="outline"><Link href={m.adminHref("categories")}>Manage categories</Link></Button> : undefined} />
      {catalog.categories.length === 0 ? (
        <EmptyState icon={<Shapes />} title="No categories yet" description="Categories group the library into niches." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {catalog.categories.map((c) => {
            const inCat = products.filter((p) => p.categoryIds.includes(c.id));
            const usable = inCat.filter((p) => m.canUse(p)).length;
            return (
              <Link key={c.id} href={`${m.href("library")}?cat=${c.id}`} className="group flex flex-col overflow-hidden rounded-2xl border bg-card transition hover:-translate-y-0.5 hover:shadow-md" data-testid="category-card">
                <div className="flex items-start gap-3 p-5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: c.color }}>
                    <CategoryIcon icon={c.icon} className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold tracking-tight">{c.name}</h2>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                </div>
                <div className="mt-auto flex items-end justify-between gap-3 border-t bg-secondary/40 px-5 py-3">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{plural(inCat.length, "product")}</span>
                    {inCat.length > 0 && ` · ${usable} available to you`}
                  </p>
                  <div className="flex -space-x-2">
                    {inCat.slice(0, 4).map((p) => (
                      <ProductCover key={p.id} product={p} className="w-8 rounded-sm shadow ring-2 ring-card" />
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {uncategorised > 0 && m.isAdmin && <p className="mt-4 text-xs text-muted-foreground">{plural(uncategorised, "product")} have no category.</p>}
    </PageContainer>
  );
}

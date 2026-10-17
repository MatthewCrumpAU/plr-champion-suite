"use client";

import * as React from "react";
import Link from "next/link";
import {
  Baby,
  BookOpen,
  Brain,
  Briefcase,
  Camera,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleX,
  Crown,
  DollarSign,
  Dumbbell,
  Folder,
  Globe,
  GraduationCap,
  HeartPulse,
  House,
  Heart,
  Laptop,
  Leaf,
  Lock,
  Mail,
  Megaphone,
  Palette,
  PawPrint,
  PiggyBank,
  Rocket,
  ShoppingCart,
  Sparkles,
  Target,
  Users,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { markdownToHtml, sanitizeHtml } from "@/lib/doc/parse";
import { Badge } from "@/components/ui/primitives";
import { Tooltip } from "@/components/ui/overlays";
import { LogoMark } from "@/components/shell/logo";
import { useMemberFileUrl } from "@/lib/membership/hooks";
import type { BrandConfig } from "@/lib/membership/brands";
import { ACCESS_TIER_LABELS, LICENCE_RIGHTS, LICENCE_TYPE_LABELS, PRODUCT_FORMAT_LABELS, PUBLISH_STATUS_LABELS, RIGHT_VALUE_LABELS, type AccessTier, type Category, type Licence, type Product, type PublishStatus, type RightValue } from "@/lib/membership/types";

/* ---------------------------------------- Brand ---------------------------------------- */
export function BrandMark({ brand, className }: { brand: BrandConfig; className?: string }) {
  if (brand.id === "plr-champion") return <LogoMark className={className} />;
  return (
    <span
      aria-hidden
      className={cn("flex size-8 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-black tracking-tight text-white", className)}
      style={{ background: `linear-gradient(135deg, ${brand.theme.primary}, ${brand.theme.sidebarAccent})`, boxShadow: `inset 0 -3px 0 ${brand.theme.highlight}` }}
    >
      {brand.monogram}
    </span>
  );
}

export function BrandLogo({ brand, subtitle }: { brand: BrandConfig; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark brand={brand} />
      <div className="min-w-0 leading-none">
        <div className="truncate text-[15px] font-semibold tracking-tight text-white">{brand.name}</div>
        <div className="mt-1 truncate text-[10.5px] font-medium text-sidebar-muted">{subtitle ?? brand.tagline}</div>
      </div>
    </div>
  );
}

/* -------------------------------------- Categories -------------------------------------- */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  folder: Folder,
  "heart-pulse": HeartPulse,
  sparkles: Sparkles,
  briefcase: Briefcase,
  "piggy-bank": PiggyBank,
  users: Users,
  home: House,
  leaf: Leaf,
  dumbbell: Dumbbell,
  brain: Brain,
  "book-open": BookOpen,
  megaphone: Megaphone,
  mail: Mail,
  target: Target,
  rocket: Rocket,
  utensils: Utensils,
  camera: Camera,
  "graduation-cap": GraduationCap,
  "dollar-sign": DollarSign,
  palette: Palette,
  laptop: Laptop,
  "shopping-cart": ShoppingCart,
  globe: Globe,
  baby: Baby,
  "paw-print": PawPrint,
  heart: Heart,
};

export function CategoryIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = CATEGORY_ICONS[icon] ?? Folder;
  return <Icon className={className} aria-hidden />;
}

export function CategoryChip({ category, href }: { category: Category; href?: string }) {
  const body = (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary">
      <span className="size-2 rounded-full" style={{ background: category.color }} />
      {category.name}
    </span>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/* ---------------------------------------- Badges ---------------------------------------- */
export function AccessBadge({ tier, className }: { tier: AccessTier; className?: string }) {
  if (tier === "premium")
    return (
      <Badge className={cn("border-amber-200 bg-amber-50 text-amber-800", className)}>
        <Crown /> Premium
      </Badge>
    );
  if (tier === "free") return <Badge variant="success" className={className}>Free</Badge>;
  return <Badge variant="secondary" className={className}>{ACCESS_TIER_LABELS[tier]}</Badge>;
}

export function StatusBadge({ status, publishAt }: { status: PublishStatus; publishAt: string | null }) {
  const future = publishAt && new Date(publishAt) > new Date();
  if (status === "published" && !future) return <Badge variant="success">Published</Badge>;
  if (status === "scheduled" || (status === "published" && future)) return <Badge variant="warning">Scheduled · {formatDate(publishAt)}</Badge>;
  if (status === "archived") return <Badge variant="outline">Archived</Badge>;
  return <Badge variant="secondary">{PUBLISH_STATUS_LABELS[status]}</Badge>;
}

export function FormatBadge({ product }: { product: Pick<Product, "format"> }) {
  return <Badge variant="outline">{PRODUCT_FORMAT_LABELS[product.format]}</Badge>;
}

/* ---------------------------------------- Images ---------------------------------------- */
export function StoredImage({ fileId, alt, className, fallback }: { fileId: string | null | undefined; alt: string; className?: string; fallback?: React.ReactNode }) {
  const url = useMemberFileUrl(fileId);
  if (!url) return <div className={cn("bg-gradient-to-br from-primary/80 to-sidebar", className)}>{fallback}</div>;
  return <img src={url} alt={alt} className={cn("object-cover", className)} draggable={false} />;
}

export function ProductCover({ product, className }: { product: Pick<Product, "coverFileId" | "title">; className?: string }) {
  return (
    <StoredImage
      fileId={product.coverFileId}
      alt={`Cover of ${product.title}`}
      className={cn("aspect-[3/4] w-full rounded-lg", className)}
      fallback={<div className="flex h-full items-end p-3 text-sm font-semibold leading-tight text-white">{product.title}</div>}
    />
  );
}

/* --------------------------------------- Markdown --------------------------------------- */
export function Markdown({ source, className }: { source: string; className?: string }) {
  const html = React.useMemo(() => sanitizeHtml(markdownToHtml(source || "")), [source]);
  return <div className={cn("plr-doc text-[15px] leading-relaxed", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ---------------------------------------- Licence --------------------------------------- */
const RIGHT_ICON: Record<RightValue, { icon: LucideIcon; cls: string }> = {
  yes: { icon: CircleCheck, cls: "text-success" },
  no: { icon: CircleX, cls: "text-destructive" },
  conditional: { icon: CircleAlert, cls: "text-warning" },
  unclear: { icon: CircleHelp, cls: "text-muted-foreground" },
};

export function LicenceSummary({ licence, compact = false }: { licence: Licence; compact?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="dark">{licence.type.toUpperCase()}</Badge>
        <span className="text-sm font-medium">{LICENCE_TYPE_LABELS[licence.type]}</span>
      </div>
      <ul className={cn("grid gap-1.5", !compact && "sm:grid-cols-2")} data-testid="licence-rights">
        {LICENCE_RIGHTS.map(([key, label]) => {
          const v = licence.rights[key];
          const { icon: Icon, cls } = RIGHT_ICON[v];
          return (
            <li key={key} className="flex items-start gap-2 text-[13px]">
              <Icon className={cn("mt-0.5 size-4 shrink-0", cls)} aria-hidden />
              <span>
                {label} <span className="sr-only">— </span>
                <span className="text-muted-foreground">({RIGHT_VALUE_LABELS[v]})</span>
              </span>
            </li>
          );
        })}
      </ul>
      {licence.terms.trim() && <p className="rounded-lg bg-secondary/70 p-3 text-[13px] leading-relaxed text-secondary-foreground">{licence.terms}</p>}
    </div>
  );
}

/* --------------------------------------- Product card --------------------------------------- */
export function ProductCard({
  product,
  href,
  categories,
  favourite,
  onToggleFavourite,
  lock,
  showStatus,
}: {
  product: Product;
  href: string;
  categories: Category[];
  favourite?: boolean;
  onToggleFavourite?: () => void;
  lock?: string | null;
  showStatus?: boolean;
}) {
  const cats = categories.filter((c) => product.categoryIds.includes(c.id));
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition hover:-translate-y-0.5 hover:shadow-md" data-testid="product-card">
      <div className="relative bg-secondary/60 p-4 pb-0">
        <ProductCover product={product} className="mx-auto max-w-[180px] shadow-lg ring-1 ring-black/5 transition group-hover:scale-[1.02]" />
        {lock && (
          <div className="absolute inset-x-0 top-3 flex justify-center">
            <span className="inline-flex items-center gap-1 rounded-full bg-foreground/85 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
              <Lock className="size-3" /> {lock}
            </span>
          </div>
        )}
        <div className="h-4" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <AccessBadge tier={product.access} />
          <FormatBadge product={product} />
          {showStatus && <StatusBadge status={product.status} publishAt={product.publishAt} />}
        </div>
        <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight">{product.title}</h3>
        </Link>
        {product.subtitle && <p className="line-clamp-2 text-[13px] text-muted-foreground">{product.subtitle}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <p className="truncate text-[11.5px] text-muted-foreground">{cats.map((c) => c.name).join(" · ") || "Uncategorised"}</p>
          {onToggleFavourite && (
            <Tooltip content={favourite ? "Remove from saved" : "Save for later"}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onToggleFavourite();
                }}
                aria-pressed={favourite}
                aria-label={favourite ? `Remove ${product.title} from saved` : `Save ${product.title}`}
                className="relative z-10 flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <Heart className={cn("size-4", favourite && "fill-rose-500 text-rose-500")} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}

export function LockNotice({ reason, className }: { reason: string; className?: string }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900", className)} role="status">
      <Lock className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-semibold">{reason}</p>
        <p className="mt-0.5 text-amber-900/80">You can preview this item, but downloads and tools unlock with the right membership level.</p>
      </div>
    </div>
  );
}

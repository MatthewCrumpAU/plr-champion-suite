"use client";

import * as React from "react";
import { getBrand, memberPath, adminPath, type BrandConfig } from "@/lib/membership/brands";
import { useMemberLive } from "@/lib/membership/hooks";
import { OWNER_ACCOUNT_ID, setPreviewTier as persistPreviewTier, type PreviewTier } from "@/lib/membership/account";
import { canSee, canUse, isAdminView, lockReason, viewerFor, type Viewer } from "@/lib/membership/access";
import type { AccessTier, BrandId, Category, Course, DownloadRecord, LessonProgress, MemberAccount, Product, PublishStatus, Release, Resource } from "@/lib/membership/types";

/**
 * Everything a membership page needs to know about "who is looking": the brand, the signed-in
 * account and the tier being viewed. In private testing the account is always the owner, who can
 * preview the area as any member tier.
 */
export interface MemberContextValue {
  brandId: BrandId;
  brand: BrandConfig;
  account: MemberAccount;
  viewer: Viewer;
  previewTier: PreviewTier;
  setPreviewTier: (t: PreviewTier) => void;
  /** Owner viewing as owner (admin controls visible). */
  isAdmin: boolean;
  href: (path?: string) => string;
  adminHref: (path?: string) => string;
  canSee: (item: { status: PublishStatus; publishAt: string | null }) => boolean;
  canUse: (item: { access: AccessTier; status: PublishStatus; publishAt: string | null }) => boolean;
  lockReason: (item: { access: AccessTier; status: PublishStatus; publishAt: string | null }) => string | null;
}

const MemberContext = React.createContext<MemberContextValue | null>(null);

export function MemberProvider({ brandId, children }: { brandId: BrandId; children: React.ReactNode }) {
  const { data } = useMemberLive(async (r) => ({ account: await r.accounts.get(OWNER_ACCOUNT_ID), preview: (await r.kv.get<PreviewTier>("previewTier")) ?? "owner" }), []);
  const [optimistic, setOptimistic] = React.useState<PreviewTier | null>(null);
  const previewTier = optimistic ?? data?.preview ?? "owner";
  const account = data?.account;

  React.useEffect(() => {
    if (optimistic && data?.preview === optimistic) setOptimistic(null);
  }, [data?.preview, optimistic]);

  const setPreviewTier = React.useCallback((t: PreviewTier) => {
    setOptimistic(t);
    void persistPreviewTier(t);
  }, []);

  const value = React.useMemo<MemberContextValue | null>(() => {
    if (!account) return null;
    const viewer = viewerFor(account, brandId, previewTier);
    return {
      brandId,
      brand: getBrand(brandId),
      account,
      viewer,
      previewTier,
      setPreviewTier,
      isAdmin: isAdminView(viewer),
      href: (p = "") => memberPath(brandId, p),
      adminHref: (p = "") => adminPath(brandId, p),
      canSee: (item) => canSee(viewer, item),
      canUse: (item) => canUse(viewer, item),
      lockReason: (item) => lockReason(viewer, item),
    };
  }, [account, brandId, previewTier, setPreviewTier]);

  if (!value) return null;
  return <MemberContext.Provider value={value}>{children}</MemberContext.Provider>;
}

export function useMember(): MemberContextValue {
  const v = React.useContext(MemberContext);
  if (!v) throw new Error("useMember must be used inside the membership area.");
  return v;
}

export interface BrandCatalog {
  products: Product[];
  categories: Category[];
  releases: Release[];
  courses: Course[];
  resources: Resource[];
}

/** The brand's whole catalogue (small enough to hold in memory; reactive to every change). */
export function useCatalog() {
  const { brandId } = useMember();
  return useMemberLive<BrandCatalog>(
    async (r) => {
      const [products, categories, releases, courses, resources] = await Promise.all([r.products.list(brandId), r.categories.list(brandId), r.releases.list(brandId), r.courses.list(brandId), r.resources.list(brandId)]);
      return {
        products,
        categories: categories.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
        releases: releases.sort((a, b) => b.month.localeCompare(a.month)),
        courses: courses.sort((a, b) => a.order - b.order),
        resources: resources.sort((a, b) => a.order - b.order),
      };
    },
    [brandId],
  );
}

/** Products the current viewer can see, newest first. */
export function useVisibleProducts() {
  const m = useMember();
  const { data, loading } = useCatalog();
  const products = React.useMemo(() => (data?.products ?? []).filter((p) => m.canSee(p)).sort((a, b) => (b.publishAt ?? b.createdAt).localeCompare(a.publishAt ?? a.createdAt)), [data, m]);
  return { products, catalog: data, loading };
}

export interface MemberActivity {
  favourites: Set<string>;
  downloads: DownloadRecord[];
  progress: LessonProgress[];
}

export function useMemberActivity() {
  const { brandId, account } = useMember();
  return useMemberLive<MemberActivity>(
    async (r) => {
      const [favs, downloads, progress] = await Promise.all([r.favourites.listForMember(brandId, account.id), r.downloads.listForMember(brandId, account.id), r.progress.listForMember(brandId, account.id)]);
      return { favourites: new Set(favs.map((f) => f.productId)), downloads: downloads.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), progress };
    },
    [brandId, account.id],
  );
}

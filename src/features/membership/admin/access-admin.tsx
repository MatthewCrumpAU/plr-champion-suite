"use client";

import * as React from "react";
import { Eye, Link2, Package, Pencil, Plus, ShieldCheck, Trash2, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Field, Input, NativeSelect, PageContainer, PageHeader, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { deleteTestProfile, saveTestProfile, type TestProfileInput } from "@/lib/membership/account";
import { BRANDS, LIVE_BRAND_IDS } from "@/lib/membership/brands";
import { BUNDLES, ENTITLEMENT_SOURCE_LABELS, effectiveTier, entitlementsFor, linkedAccounts } from "@/lib/membership/entitlements";
import { ACCESS_TIERS, ACCESS_TIER_LABELS, BRAND_IDS, type AccessTier, type BrandId, type MemberAccount } from "@/lib/membership/types";
import { errorMessage } from "@/lib/utils";
import { useMember } from "../member-context";
import { AccessBadge, BrandMark } from "../ui";
import { AdminGate } from "./admin-gate";

const EMPTY: TestProfileInput = { displayName: "", email: "", brandAccess: {}, bundleIds: [], linkedAccountIds: [], note: "" };

function ProfileDialog({ open, onOpenChange, profile, accounts }: { open: boolean; onOpenChange: (o: boolean) => void; profile: MemberAccount | null; accounts: MemberAccount[] }) {
  const [form, setForm] = React.useState<TestProfileInput>(EMPTY);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) setForm(profile ? { id: profile.id, displayName: profile.displayName, email: profile.email, brandAccess: { ...profile.brandAccess }, bundleIds: [...(profile.bundleIds ?? [])], linkedAccountIds: [...profile.linkedAccountIds], note: profile.note ?? "" } : EMPTY);
  }, [open, profile]);
  const others = accounts.filter((a) => a.role !== "owner" && a.id !== profile?.id);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await saveTestProfile(form);
      toast.success(profile ? "Profile updated" : `Test profile “${saved.displayName}” created`);
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{profile ? "Edit test profile" : "New test profile"}</DialogTitle>
          <DialogDescription>A local profile for checking what a customer would see. It can&apos;t sign in and nothing is emailed.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} id="profile-form" className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="tp-name">
              <Input id="tp-name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="e.g. Bundle buyer" autoFocus />
            </Field>
            <Field label="Email (label only)" htmlFor="tp-email">
              <Input id="tp-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="buyer@example.com" />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <p className="text-[13px] font-medium">Own memberships</p>
            {BRAND_IDS.map((b) => (
              <label key={b} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <BrandMark brand={BRANDS[b]} className="size-6 rounded-md text-[10px]" /> {BRANDS[b].name}
                </span>
                <NativeSelect value={form.brandAccess[b] ?? ""} onChange={(e) => setForm({ ...form, brandAccess: { ...form.brandAccess, [b]: (e.target.value || undefined) as AccessTier | undefined } })} className="h-8 w-36 text-xs" aria-label={`${BRANDS[b].name} access`}>
                  <option value="">No membership</option>
                  {ACCESS_TIERS.map((t) => (
                    <option key={t} value={t}>
                      {ACCESS_TIER_LABELS[t]}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2">
            <p className="text-[13px] font-medium">Bundles</p>
            {BUNDLES.map((b) => (
              <label key={b.id} className="flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm">
                <Checkbox checked={form.bundleIds.includes(b.id)} onCheckedChange={(v) => setForm({ ...form, bundleIds: v ? [...form.bundleIds, b.id] : form.bundleIds.filter((x) => x !== b.id) })} aria-label={b.name} className="mt-0.5" />
                <span>
                  <span className="block font-medium">{b.name}</span>
                  <span className="block text-xs text-muted-foreground">{b.description}</span>
                </span>
              </label>
            ))}
          </div>
          {others.length > 0 && (
            <div className="grid grid-cols-1 gap-2">
              <p className="text-[13px] font-medium">Linked accounts</p>
              <p className="text-xs text-muted-foreground">The same person&apos;s account on another brand. Linked accounts share their access.</p>
              {others.map((a) => (
                <label key={a.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={form.linkedAccountIds.includes(a.id)} onCheckedChange={(v) => setForm({ ...form, linkedAccountIds: v ? [...form.linkedAccountIds, a.id] : form.linkedAccountIds.filter((x) => x !== a.id) })} aria-label={`Link to ${a.displayName}`} />
                  {a.displayName} <span className="text-xs text-muted-foreground">{a.email}</span>
                </label>
              ))}
            </div>
          )}
          <Field label="Note" htmlFor="tp-note" optional>
            <Textarea id="tp-note" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="What this profile is for" />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="profile-form" loading={busy} data-testid="save-profile">
            {profile ? "Save changes" : "Create profile"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AccessAdmin() {
  return (
    <AdminGate>
      <Inner />
    </AdminGate>
  );
}

function Inner() {
  const m = useMember();
  const confirm = useConfirm();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<MemberAccount | null>(null);
  const accounts = m.accounts;
  const liveBrands = LIVE_BRAND_IDS;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Membership Admin"
        title="Members & access"
        description="Who can open which brand, and why. Each brand keeps its own customers; bundles and linked accounts give one person access to more than one brand."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            data-testid="new-profile"
          >
            <Plus /> New test profile
          </Button>
        }
      />
      <Callout tone="neutral" icon={<ShieldCheck />} title="Private testing — no live member accounts" className="mb-6">
        Member sign-up, payments and cross-brand sign-in aren&apos;t switched on. Test profiles live only in this browser so you can check the access rules with <strong>View as</strong>. When memberships go live, real accounts use exactly the same model.
      </Callout>

      <Card className="mb-6 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm" data-testid="access-table">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Account</th>
              {liveBrands.map((b) => (
                <th key={b} className="px-4 py-2.5 font-medium">
                  {BRANDS[b].name}
                </th>
              ))}
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {accounts.map((a) => {
              const ents = entitlementsFor(a, accounts);
              const links = linkedAccounts(a, accounts);
              return (
                <tr key={a.id} data-testid="access-row">
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      {a.role === "owner" ? <ShieldCheck className="size-4 text-primary" /> : <UserRound className="size-4 text-muted-foreground" />}
                      <span className="font-medium">{a.displayName}</span>
                      {a.role === "owner" ? <Badge>Owner</Badge> : <Badge variant="secondary">Test profile</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{a.email}</p>
                    {(a.bundleIds?.length ?? 0) > 0 && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Package className="size-3" /> {a.bundleIds!.map((id) => BUNDLES.find((b) => b.id === id)?.name ?? id).join(", ")}
                      </p>
                    )}
                    {links.length > 0 && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Link2 className="size-3" /> Linked to {links.map((l) => l.displayName).join(", ")}
                      </p>
                    )}
                    {a.note && <p className="mt-1 text-xs italic text-muted-foreground">{a.note}</p>}
                  </td>
                  {liveBrands.map((b: BrandId) => {
                    const tier = effectiveTier(a, b, accounts);
                    const sources = [...new Set(ents.filter((e) => e.brandId === b).map((e) => ENTITLEMENT_SOURCE_LABELS[e.source]))];
                    return (
                      <td key={b} className="px-4 py-3 align-top">
                        {tier ? <AccessBadge tier={tier} /> : <span className="text-xs text-muted-foreground">No access</span>}
                        {tier && <p className="mt-1 text-[11px] text-muted-foreground">via {sources.join(" + ")}</p>}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right align-top">
                    {a.role !== "owner" && (
                      <div className="flex justify-end gap-1">
                        <Button size="xs" variant="outline" onClick={() => m.setPreviewTier(`account:${a.id}`)} data-testid={`view-as-${a.email}`}>
                          <Eye /> View as
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label={`Edit ${a.displayName}`}
                          onClick={() => {
                            setEditing(a);
                            setOpen(true);
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label={`Delete ${a.displayName}`}
                          onClick={async () => {
                            if (!(await confirm({ title: `Delete “${a.displayName}”?`, description: "Only this local test profile is removed.", confirmLabel: "Delete profile", destructive: true }))) return;
                            await deleteTestProfile(a.id);
                            toast.success("Profile deleted");
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="size-4" /> Bundles
            </CardTitle>
            <CardDescription>Defined in code today; sold through checkout once payments are added.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 text-sm">
            {BUNDLES.map((b) => (
              <div key={b.id}>
                <p className="font-medium">{b.name}</p>
                <p className="text-muted-foreground">{b.description}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(Object.entries(b.grants) as [BrandId, AccessTier][]).map(([brand, tier]) => (
                    <Badge key={brand} variant="outline">
                      {BRANDS[brand].name}: {ACCESS_TIER_LABELS[tier]}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" /> How access is worked out
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Own membership</strong> — the tier the account bought on that brand.
            </p>
            <p>
              <strong className="text-foreground">Bundle</strong> — a bundle on the account grants every brand in it.
            </p>
            <p>
              <strong className="text-foreground">Linked account</strong> — the same person&apos;s account on another brand; both accounts get each other&apos;s access.
            </p>
            <p>The highest tier from any source wins. Brands never share products, downloads or progress — only access.</p>
          </CardContent>
        </Card>
      </div>
      <ProfileDialog open={open} onOpenChange={setOpen} profile={editing} accounts={accounts} />
    </PageContainer>
  );
}

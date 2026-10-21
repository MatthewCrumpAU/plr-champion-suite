"use client";

import * as React from "react";
import Link from "next/link";
import { Bot, Copy, Database, Eraser, HardDrive, KeyRound, LogOut, PlugZap, RefreshCw, Save, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import type { AIUsageRecord } from "@/lib/data/types";
import { getRepos } from "@/lib/data";
import { setActiveProjectId, useLive, useSettings } from "@/lib/data/hooks";
import { runAITask, useAIStatus } from "@/lib/ai/client";
import { formatUsd } from "@/lib/ai/models";
import { pruneAllAutoVersions, removeOrphanFiles, requestPersistentStorage, storageReport, type StorageReport } from "@/lib/services/storage";
import { SAMPLE_FLAG, seedSampleProject } from "@/lib/services/sample";
import { logout } from "@/lib/client/api";
import { hashPassword } from "@/lib/auth/password";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Card, Field, Input, NativeSelect, PageContainer, PageHeader, Progress, Switch } from "@/components/ui/primitives";
import { useConfirm } from "@/components/ui/confirm";
import { errorMessage, formatBytes, formatDateTime } from "@/lib/utils";

function Section({ id, icon, title, description, children }: { id: string; icon: React.ReactNode; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="grid scroll-mt-20 gap-4 p-5" data-testid={`settings-${id}`}>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary [&_svg]:size-4">{icon}</span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

function AISection() {
  const { status, loading, refresh } = useAIStatus();
  const { settings, update } = useSettings();
  const [test, setTest] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = React.useState(false);
  const { data: usage } = useLive((r) => r.aiUsage.list(500), ["ai-usage"]);
  const since = Date.now() - 30 * 86_400_000;
  const recent = (usage ?? []).filter((u: AIUsageRecord) => new Date(u.createdAt).getTime() >= since);
  const cost = recent.reduce((n, u) => n + (u.costUsd ?? 0), 0);
  const tokens = recent.reduce((n, u) => n + u.inputTokens + u.outputTokens, 0);
  const confirm = useConfirm();

  return (
    <Section id="ai" icon={<Bot />} title="AI" description="AI is optional. Every tool also works with templates and your own edits.">
      {loading ? (
        <p className="text-sm text-muted-foreground">Checking…</p>
      ) : status?.testMode ? (
        <Callout tone="warning" title="Automated test mode">The server is running the built-in test provider (PLR_AI_TEST_PROVIDER=echo). Output is clearly marked placeholder text, not real AI. Remove that variable in production.</Callout>
      ) : status?.disabledByAdmin ? (
        <Callout tone="neutral" title="AI is switched off on the server">PLR_AI_DISABLED is set to true.</Callout>
      ) : status?.configured ? (
        <Callout tone="success" title={`Connected: ${status.providerLabel}`}>Requests go from this browser to your server, which calls the AI provider with the API key stored on the server. The key is never sent to the browser.</Callout>
      ) : (
        <Callout tone="neutral" title="AI is not configured">
          To enable it, add <code className="font-mono text-[12px]">ANTHROPIC_API_KEY</code> to your hosting environment variables and redeploy. See the deployment guide for step-by-step instructions.
        </Callout>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Model" hint={status?.defaultModel ? `Server default: ${status.defaultModel}` : undefined}>
          <NativeSelect value={settings.aiModel ?? ""} onChange={(e) => void update({ aiModel: e.target.value || null }).then(() => toast.success("Model saved"))} disabled={!status?.models.length} data-testid="ai-model">
            <option value="">Use the server default</option>
            {status?.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} — ${m.inputPerMTok}/${m.outputPerMTok} per million tokens
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="grid content-start gap-1.5">
          <span className="text-[13px] font-medium">Connection test</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              loading={testing}
              disabled={!status?.configured}
              onClick={async () => {
                setTesting(true);
                setTest(null);
                const t0 = performance.now();
                try {
                  const r = await runAITask("test.ping", {});
                  setTest({ ok: true, text: `Replied “${r.text.trim().slice(0, 40)}” in ${Math.round(performance.now() - t0)} ms using ${r.model} (est. ${formatUsd(r.costUsd)}).` });
                } catch (e) {
                  setTest({ ok: false, text: errorMessage(e) });
                } finally {
                  setTesting(false);
                }
              }}
              data-testid="ai-test"
            >
              {!testing && <PlugZap />} Test connection
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void refresh()}>
              <RefreshCw /> Refresh status
            </Button>
          </div>
          {test && <p className={test.ok ? "text-xs text-green-700" : "text-xs text-red-700"} data-testid="ai-test-result">{test.text}</p>}
        </div>
      </div>
      <div className="grid gap-2 rounded-xl border p-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">Usage in this browser (last 30 days)</p>
          {!!usage?.length && (
            <Button
              size="xs"
              variant="ghost"
              className="ml-auto"
              onClick={async () => {
                if (await confirm({ title: "Clear the AI usage log?", description: "This only clears the log kept in this browser. It doesn't affect your provider's billing records.", confirmLabel: "Clear log" })) await getRepos().aiUsage.clear();
              }}
            >
              Clear log
            </Button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm" data-testid="ai-usage-summary">
          <div>
            <p className="text-[11px] text-muted-foreground">Requests</p>
            <p className="font-semibold tabular-nums">{recent.length}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Tokens</p>
            <p className="font-semibold tabular-nums">{tokens.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Estimated cost</p>
            <p className="font-semibold tabular-nums">{formatUsd(cost)}</p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">Estimates use published list prices. Your provider&apos;s invoice is the authoritative figure.</p>
      </div>
    </Section>
  );
}

function EditorSection() {
  const { settings, update } = useSettings();
  const save = (patch: Parameters<typeof update>[0]) => void update(patch).then(() => toast.success("Saved"));
  return (
    <Section id="editor" icon={<Save />} title="Editing & autosave" description="These preferences are stored in this browser.">
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Autosave after">
          <NativeSelect value={settings.autosaveDelayMs} onChange={(e) => save({ autosaveDelayMs: Number(e.target.value) })} data-testid="autosave-delay">
            {[500, 800, 1500, 3000].map((v) => (
              <option key={v} value={v}>
                {v / 1000} seconds idle
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Save an automatic version every">
          <NativeSelect value={settings.autoVersionMinutes} onChange={(e) => save({ autoVersionMinutes: Number(e.target.value) })}>
            {[5, 10, 20, 30, 60].map((v) => (
              <option key={v} value={v}>
                {v} minutes of editing
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Default currency">
          <NativeSelect value={settings.currency} onChange={(e) => save({ currency: e.target.value })}>
            {["USD", "AUD", "GBP", "EUR", "CAD", "NZD"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Editor width">
          <NativeSelect value={settings.editorWidth} onChange={(e) => save({ editorWidth: e.target.value as typeof settings.editorWidth })}>
            <option value="narrow">Narrow</option>
            <option value="normal">Normal</option>
            <option value="wide">Wide</option>
          </NativeSelect>
        </Field>
      </div>
      <div className="grid gap-2 text-sm">
        <label className="flex items-center justify-between gap-4">
          <span>
            Ask before AI output replaces existing text
            <span className="block text-xs text-muted-foreground">Recommended. A version is always saved first either way.</span>
          </span>
          <Switch checked={settings.confirmAIReplace} onCheckedChange={(v) => save({ confirmAIReplace: v })} />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span>
            Licence reminder on export
            <span className="block text-xs text-muted-foreground">Shows a reminder when a project&apos;s licence hasn&apos;t been reviewed.</span>
          </span>
          <Switch checked={settings.licenceReminder} onCheckedChange={(v) => save({ licenceReminder: v })} />
        </label>
      </div>
    </Section>
  );
}

function StorageSection() {
  const [r, setR] = React.useState<StorageReport | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const load = React.useCallback(() => storageReport().then(setR).catch(() => undefined), []);
  React.useEffect(() => {
    void load();
  }, [load]);
  const pct = r?.usage != null && r?.quota ? (r.usage / r.quota) * 100 : null;
  const run = async (id: string, fn: () => Promise<string>) => {
    setBusy(id);
    try {
      toast.success(await fn());
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Section id="storage" icon={<HardDrive />} title="Storage" description="Everything is stored in this browser's private database (IndexedDB). Nothing is uploaded to a cloud database.">
      {r ? (
        <>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span>{r.usage != null ? `${formatBytes(r.usage)} used` : "Usage not available in this browser"}</span>
              <span className="text-muted-foreground">{r.quota != null ? `of about ${formatBytes(r.quota)} available` : ""}</span>
            </div>
            {pct !== null && <Progress value={pct} />}
            {pct !== null && pct > 80 && <Callout tone="warning">Storage is getting full. Download a backup, then prune old versions or remove unused files.</Callout>}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4" data-testid="storage-counts">
            {Object.entries(r.counts).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-secondary/60 p-2">
                <p className="text-[11px] capitalize text-muted-foreground">{k.replace(/([A-Z])/g, " $1").toLowerCase()}</p>
                <p className="font-semibold tabular-nums">{v.toLocaleString()}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Files {formatBytes(r.filesBytes)} · versions {formatBytes(r.versionsBytes)} · snapshots {formatBytes(r.snapshotsBytes)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {r.persisted ? (
              <Badge variant="success">
                <ShieldCheck /> Protected from automatic clean-up
              </Badge>
            ) : (
              <Button size="sm" variant="outline" onClick={() => void run("persist", async () => ((await requestPersistentStorage()) ? "The browser will keep your data" : "The browser declined — keep regular backups"))} loading={busy === "persist"}>
                <ShieldCheck /> Ask the browser to keep my data
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => void run("prune", async () => `Removed ${await pruneAllAutoVersions(10)} old automatic versions`)} loading={busy === "prune"} data-testid="prune-versions">
              Keep only the latest 10 automatic versions
            </Button>
            <Button size="sm" variant="outline" onClick={() => void run("orphans", async () => `Removed ${await removeOrphanFiles()} unused files`)} loading={busy === "orphans"}>
              Remove unused images
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Measuring…</p>
      )}
    </Section>
  );
}

function DataSection() {
  const confirm = useConfirm();
  const [cleaning, setCleaning] = React.useState(false);
  return (
    <Section id="data" icon={<Database />} title="Data" description="Backups, sample content and erasing this browser's data.">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link href="/export#backup">Backup &amp; restore</Link>
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            const p = await seedSampleProject();
            setActiveProjectId(p.id);
            toast.success("Sample project added");
          }}
          data-testid="add-sample"
        >
          Add the sample project
        </Button>
      </div>
      <div className="grid gap-2 rounded-xl border p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Eraser className="size-4" /> Start clean: remove all sample content
        </p>
        <p className="text-xs text-muted-foreground">
          Removes the sample project and sample brand kit, and the sample products, drops, courses and resources in every membership. Your own projects, documents, products, settings and AI key are kept, and a project you copied from the sample stays. Samples won&apos;t be added again — you can bring the sample project back with the button above, or a membership&apos;s samples from its Admin → Data page.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="justify-self-start"
          loading={cleaning}
          data-testid="remove-all-samples"
          onClick={async () => {
            if (!(await confirm({ title: "Remove all sample content?", description: "The sample project, sample brand kit and every membership's sample library are deleted with their files. Your own work is kept.", confirmLabel: "Remove samples", destructive: true }))) return;
            setCleaning(true);
            try {
              const { removeAllSampleContent } = await import("@/lib/services/clean-start");
              const s = await removeAllSampleContent();
              setActiveProjectId(null);
              try {
                localStorage.removeItem("plrc.activeProjectId");
              } catch {
                /* ignore */
              }
              toast.success("Sample content removed", { description: `${s.projects} sample project${s.projects === 1 ? "" : "s"}, ${s.brandKits} brand kit${s.brandKits === 1 ? "" : "s"} and ${s.membershipItems} membership item${s.membershipItems === 1 ? "" : "s"}.` });
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setCleaning(false);
            }
          }}
        >
          <Eraser /> Remove all sample content
        </Button>
      </div>
      <div className="grid gap-2 rounded-xl border border-red-200 bg-red-50/50 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
          <TriangleAlert className="size-4" /> Erase all data in this browser
        </p>
        <p className="text-xs text-red-900/80">Deletes every project, asset, version, snapshot, brand kit, file and setting stored here, plus membership libraries. Download a backup first — this cannot be undone.</p>
        <Button
          variant="destructive"
          size="sm"
          className="justify-self-start"
          onClick={async () => {
            if (!(await confirm({ title: "Erase everything?", description: "All PLR Champion data in this browser will be permanently deleted.", confirmLabel: "Erase everything", destructive: true, typeToConfirm: "ERASE" }))) return;
            await getRepos().clearAll();
            // Membership libraries live in their own database; erase them too.
            try {
              const { getMembershipRepos } = await import("@/lib/membership/db");
              const { markSamplesRemoved } = await import("@/lib/membership/seed");
              const { BRAND_IDS } = await import("@/lib/membership/types");
              const r = getMembershipRepos();
              await r.clearAll();
              // An erased browser stays empty: don't re-create the membership sample libraries either.
              for (const b of BRAND_IDS) await markSamplesRemoved(b, r);
            } catch {
              /* membership area never opened in this browser */
            }
            // Don't re-create the sample project automatically after an intentional erase.
            await getRepos().meta.set(SAMPLE_FLAG, true);
            setActiveProjectId(null);
            try {
              localStorage.removeItem("plrc.activeProjectId");
            } catch {
              /* ignore */
            }
            toast.success("All data erased");
            window.location.assign("/");
          }}
          data-testid="erase-all"
        >
          <Trash2 /> Erase all data
        </Button>
      </div>
    </Section>
  );
}

function AccountSection() {
  return (
    <Section id="account" icon={<KeyRound />} title="Account & security" description="Private, single-owner access.">
      <ul className="grid gap-1.5 text-sm text-muted-foreground">
        <li>• Access is protected by the owner password set in your hosting environment (<code className="font-mono text-[12px]">PLR_OWNER_PASSWORD</code> or a hashed <code className="font-mono text-[12px]">PLR_OWNER_PASSWORD_HASH</code>).</li>
        <li>• Sessions are signed with <code className="font-mono text-[12px]">PLR_SESSION_SECRET</code> and stored in an HttpOnly, Secure cookie.</li>
        <li>• To sign out every device, change <code className="font-mono text-[12px]">PLR_SESSION_VERSION</code> (or the secret) and redeploy.</li>
        <li>• Repeated wrong passwords are slowed down automatically.</li>
      </ul>
      <Button variant="outline" className="justify-self-start" onClick={() => void logout()} data-testid="sign-out">
        <LogOut /> Sign out of this browser
      </Button>
      <PasswordHashTool />
    </Section>
  );
}

/** Generates a new PBKDF2 password hash in the browser. Nothing is sent to the server; the owner pastes it into the hosting settings. */
function PasswordHashTool() {
  const [pw, setPw] = React.useState("");
  const [confirmPw, setConfirmPw] = React.useState("");
  const [hash, setHash] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const problem = pw && pw.length < 10 ? "Use at least 10 characters." : confirmPw && pw !== confirmPw ? "The passwords do not match." : null;
  return (
    <form
      className="grid gap-3 rounded-xl border bg-secondary/40 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (problem || !pw || pw !== confirmPw) return;
        setBusy(true);
        try {
          setHash(await hashPassword(pw));
          setPw("");
          setConfirmPw("");
        } finally {
          setBusy(false);
        }
      }}
      data-testid="password-hash-tool"
    >
      <div>
        <p className="text-sm font-semibold">Change the owner password</p>
        <p className="text-xs text-muted-foreground">
          Generate a hash for a new password here (it is created in this browser and never sent anywhere). Then replace <code className="font-mono">PLR_OWNER_PASSWORD_HASH</code> in your hosting environment variables with it and redeploy. The new password works from the next deployment.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="New password" htmlFor="new-owner-pw" error={pw && pw.length < 10 ? "Use at least 10 characters." : undefined}>
          <Input id="new-owner-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setHash(null); }} />
        </Field>
        <Field label="Repeat password" htmlFor="new-owner-pw2" error={confirmPw && pw !== confirmPw ? "The passwords do not match." : undefined}>
          <Input id="new-owner-pw2" type="password" autoComplete="new-password" value={confirmPw} onChange={(e) => { setConfirmPw(e.target.value); setHash(null); }} />
        </Field>
      </div>
      <Button type="submit" variant="outline" className="justify-self-start" loading={busy} disabled={!pw || !!problem || pw !== confirmPw} data-testid="generate-hash">
        <KeyRound /> Generate hash
      </Button>
      {hash && (
        <div className="grid gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">PLR_OWNER_PASSWORD_HASH</span>
          <div className="flex gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border bg-card px-2 py-1.5 font-mono text-xs" data-testid="generated-hash">{hash}</code>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label="Copy hash"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(hash);
                  toast.success("Hash copied");
                } catch {
                  toast.error("Copy was blocked by the browser — select the text and copy it manually.");
                }
              }}
            >
              <Copy />
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

export function SettingsPage() {
  const sections = [
    ["ai", "AI"],
    ["editor", "Editing"],
    ["storage", "Storage"],
    ["data", "Data"],
    ["account", "Account"],
  ];
  return (
    <PageContainer>
      <PageHeader eyebrow="Workspace" title="Settings" description="AI, editing preferences, storage and security." />
      <nav className="mb-5 flex flex-wrap gap-1.5">
        {sections.map(([id, l]) => (
          <a key={id} href={`#${id}`} className="rounded-full border px-3 py-1 text-sm hover:border-primary hover:text-primary">
            {l}
          </a>
        ))}
      </nav>
      <div className="grid gap-5">
        <AISection />
        <EditorSection />
        <StorageSection />
        <DataSection />
        <AccountSection />
      </div>
      <p className="mt-6 text-xs text-muted-foreground">PLR Champion Software Suite · last opened {formatDateTime(new Date().toISOString())}</p>
    </PageContainer>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, ShieldAlert } from "lucide-react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { hashPassword } from "@/lib/auth/password";

function randomSecret(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border bg-secondary px-2 py-1.5 font-mono text-xs">{value}</code>
        <Button
          size="icon-sm"
          variant="outline"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            toast.success(`${label} copied`);
          }}
        >
          <Copy />
        </Button>
      </div>
    </div>
  );
}

export function SetupHelp({ problems, host }: { problems: string[]; host: string }) {
  const [password, setPassword] = useState("");
  const [hash, setHash] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  useEffect(() => setSecret(randomSecret()), []);
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid gap-5">
      <Toaster position="bottom-center" richColors />
      <div>
        <div className="flex items-center gap-2 text-amber-700">
          <ShieldAlert className="size-5" />
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Finish private setup</h2>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          This deployment{host ? ` (${host})` : ""} has no owner password yet, so the app is locked. Add these environment variables in your Vercel project (Settings → Environment Variables), then redeploy.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-800">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="size-4 text-primary" /> 1. Session secret
        </p>
        {secret && <CopyRow label="PLR_SESSION_SECRET" value={secret} />}
      </div>

      <form
        className="grid gap-3 rounded-xl border bg-card p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (password.length < 10) return toast.error("Use at least 10 characters.");
          setBusy(true);
          setHash(await hashPassword(password));
          setBusy(false);
        }}
      >
        <p className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="size-4 text-primary" /> 2. Owner password
        </p>
        <p className="text-xs text-muted-foreground">Choose a password and generate a hash in your browser (nothing is sent anywhere). Store the hash as PLR_OWNER_PASSWORD_HASH — or store the plain password as PLR_OWNER_PASSWORD.</p>
        <div className="grid gap-1.5">
          <Label htmlFor="newpw">Password (min. 10 characters)</Label>
          <Input id="newpw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </div>
        <Button type="submit" variant="outline" loading={busy}>
          Generate hash
        </Button>
        {hash && <CopyRow label="PLR_OWNER_PASSWORD_HASH" value={hash} />}
      </form>

      <p className="text-xs text-muted-foreground">
        Optional: <code className="font-mono">ANTHROPIC_API_KEY</code> enables AI features. Everything else works without it. Full steps are in <code className="font-mono">docs/DEPLOYMENT.md</code>.
      </p>
    </div>
  );
}

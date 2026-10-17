"use client";

import * as React from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "./overlays";
import { Input } from "./primitives";

export interface ConfirmOptions {
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** When set, the user must type this exact text before confirming. */
  typeToConfirm?: string;
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = React.createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [typed, setTyped] = React.useState("");

  const confirm = React.useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setTyped("");
      setPending({ ...opts, resolve });
    });
  }, []);

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const blocked = !!pending?.typeToConfirm && typed.trim() !== pending.typeToConfirm;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && close(false)}>
        <AlertDialogContent>
          <div className="grid gap-2">
            <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
            {pending?.description && <AlertDialogDescription asChild><div>{pending.description}</div></AlertDialogDescription>}
          </div>
          {pending?.typeToConfirm && (
            <div className="grid gap-1.5">
              <p className="text-xs text-muted-foreground">
                Type <span className="font-mono font-semibold text-foreground">{pending.typeToConfirm}</span> to confirm.
              </p>
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus aria-label="Confirmation text" />
            </div>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel onClick={() => close(false)}>{pending?.cancelLabel ?? "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              destructive={pending?.destructive}
              disabled={blocked}
              onClick={(e) => {
                if (blocked) {
                  e.preventDefault();
                  return;
                }
                close(true);
              }}
            >
              {pending?.confirmLabel ?? "Confirm"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}

"use client";

import * as React from "react";

/**
 * Studio tools link to each other with fixed paths ("/editor?id=…"). When a tool is embedded in
 * another shell — a membership area, for example — that shell can remap those paths so links stay
 * inside it. Outside a provider every path is returned unchanged.
 */
type Remap = (href: string) => string;

const ToolLinksContext = React.createContext<Remap>((href) => href);

export function remapToolHref(routes: Record<string, string>, href: string): string {
  for (const [from, to] of Object.entries(routes)) {
    if (href === from || href.startsWith(`${from}?`) || href.startsWith(`${from}#`) || href.startsWith(`${from}/`)) return to + href.slice(from.length);
  }
  return href;
}

export function ToolLinksProvider({ routes, children }: { routes: Record<string, string>; children: React.ReactNode }) {
  const key = JSON.stringify(routes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const remap = React.useCallback((href: string) => remapToolHref(routes, href), [key]);
  return <ToolLinksContext.Provider value={remap}>{children}</ToolLinksContext.Provider>;
}

/** Returns a function that maps a studio path to where it lives in the current shell. */
export function useToolHref(): Remap {
  return React.useContext(ToolLinksContext);
}

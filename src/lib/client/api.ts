"use client";

/** Browser fetch wrapper: adds the CSRF token to mutating requests and handles expired sessions. */

const CSRF_COOKIES = ["__Host-plrc_csrf", "plrc_csrf"];
export const CSRF_HEADER = "x-plrc-csrf";

export function readCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";").map((c) => c.trim());
  for (const name of CSRF_COOKIES) {
    const hit = cookies.find((c) => c.startsWith(`${name}=`));
    if (hit) return decodeURIComponent(hit.slice(name.length + 1));
  }
  return null;
}

export class SessionExpiredError extends Error {
  constructor() {
    super("Your session has expired. Please sign in again.");
    this.name = "SessionExpiredError";
  }
}

function redirectToLogin() {
  const next = window.location.pathname + window.location.search;
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}

export async function apiFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (method !== "GET" && method !== "HEAD") {
    const token = readCsrfToken();
    if (token) headers.set(CSRF_HEADER, token);
  }
  const res = await fetch(path, { ...init, headers, credentials: "same-origin", cache: "no-store" });
  if (res.status === 401) {
    redirectToLogin();
    throw new SessionExpiredError();
  }
  if (res.status === 403 && retry && method !== "GET") {
    // CSRF cookie may have been cleared — ask the server to re-issue it, then retry once.
    const s = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" });
    if (s.status === 401) {
      redirectToLogin();
      throw new SessionExpiredError();
    }
    return apiFetch(path, init, false);
  }
  return res;
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status}).`);
  return body as T;
}

export async function logout() {
  await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  window.location.assign("/login");
}

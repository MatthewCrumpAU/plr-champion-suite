/**
 * Owner-access configuration, read from environment variables on the server.
 *
 *   PLR_OWNER_PASSWORD        – the owner password (min 10 characters), or
 *   PLR_OWNER_PASSWORD_HASH   – a PBKDF2 hash generated on the login page (preferred; takes precedence)
 *   PLR_SESSION_SECRET        – random string, at least 32 characters, used to sign sessions
 *   PLR_SESSION_DAYS          – optional session length in days (default 7, max 30)
 *   PLR_SESSION_VERSION       – optional; change it to sign out every existing session
 *
 * Nothing here is ever sent to the browser.
 */

export const MIN_PASSWORD_LENGTH = 10;
export const MIN_SECRET_LENGTH = 32;

export interface AuthConfig {
  password: string;
  passwordHash: string;
  secret: string;
  sessionDays: number;
  sessionVersion: string;
}

export interface AuthConfigStatus {
  configured: boolean;
  problems: string[];
}

export function getAuthConfig(): AuthConfig {
  const days = Number(process.env.PLR_SESSION_DAYS ?? 7);
  return {
    password: process.env.PLR_OWNER_PASSWORD ?? "",
    passwordHash: (process.env.PLR_OWNER_PASSWORD_HASH ?? "").trim(),
    secret: process.env.PLR_SESSION_SECRET ?? "",
    sessionDays: Number.isFinite(days) && days > 0 ? Math.min(30, days) : 7,
    sessionVersion: process.env.PLR_SESSION_VERSION ?? "1",
  };
}

export function getAuthConfigStatus(cfg: AuthConfig = getAuthConfig()): AuthConfigStatus {
  const problems: string[] = [];
  if (!cfg.passwordHash && !cfg.password) problems.push("PLR_OWNER_PASSWORD (or PLR_OWNER_PASSWORD_HASH) is not set.");
  if (!cfg.passwordHash && cfg.password && cfg.password.length < MIN_PASSWORD_LENGTH)
    problems.push(`PLR_OWNER_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  if (cfg.passwordHash && !cfg.passwordHash.startsWith("pbkdf2$")) problems.push("PLR_OWNER_PASSWORD_HASH is not in the expected pbkdf2$… format.");
  if (!cfg.secret) problems.push("PLR_SESSION_SECRET is not set.");
  else if (cfg.secret.length < MIN_SECRET_LENGTH) problems.push(`PLR_SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`);
  return { configured: problems.length === 0, problems };
}

/** Cookie names. The `__Host-` prefix is used whenever cookies are Secure (always on Vercel/HTTPS). */
export function cookieNames(secure: boolean) {
  return {
    session: secure ? "__Host-plrc_session" : "plrc_session",
    csrf: secure ? "__Host-plrc_csrf" : "plrc_csrf",
  };
}

export const ALL_SESSION_COOKIES = ["__Host-plrc_session", "plrc_session"];
export const ALL_CSRF_COOKIES = ["__Host-plrc_csrf", "plrc_csrf"];
export const CSRF_HEADER = "x-plrc-csrf";

/** Secure cookies whenever the request arrived over HTTPS (Vercel always forwards x-forwarded-proto). */
export function isSecureRequest(url: URL, headers: Headers): boolean {
  if (process.env.PLR_COOKIE_SECURE === "true") return true;
  if (process.env.PLR_COOKIE_SECURE === "false") return false;
  const proto = headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  return url.protocol === "https:";
}

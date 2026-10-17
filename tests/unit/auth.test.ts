// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword, verifyOwnerPassword, verifyPasswordHash } from "@/lib/auth/password";
import { createSessionToken, safeEqual, verifySessionToken } from "@/lib/auth/session";
import { __resetRateLimit, checkLoginAllowed, clientKey, recordLoginFailure, recordLoginSuccess } from "@/lib/auth/rate-limit";
import { cookieNames, getAuthConfigStatus } from "@/lib/auth/config";

const SECRET = "unit-test-secret-0123456789abcdef0123456789";

describe("password hashing", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const hash = await hashPassword("correct horse battery", 20_000);
    expect(hash.startsWith("pbkdf2$")).toBe(true);
    expect(await verifyPasswordHash("correct horse battery", hash)).toBe(true);
    expect(await verifyPasswordHash("wrong password!!", hash)).toBe(false);
    expect(await verifyPasswordHash("anything", "not-a-hash")).toBe(false);
  });

  it("prefers the hash over a plain password when both are configured", async () => {
    const hash = await hashPassword("hashed-password-1", 20_000);
    expect(await verifyOwnerPassword("hashed-password-1", { password: "plain-password-1", passwordHash: hash })).toBe(true);
    expect(await verifyOwnerPassword("plain-password-1", { password: "plain-password-1", passwordHash: hash })).toBe(false);
    expect(await verifyOwnerPassword("plain-password-1", { password: "plain-password-1", passwordHash: "" })).toBe(true);
    expect(await verifyOwnerPassword("", { password: "", passwordHash: "" })).toBe(false);
  });

  it("compares strings in constant shape", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("signed sessions", () => {
  it("accepts its own token and rejects tampering, other secrets and old versions", async () => {
    const { token, expires } = await createSessionToken(SECRET, 7, "1");
    expect(expires.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    expect(await verifySessionToken(token, SECRET, "1")).not.toBeNull();
    expect(await verifySessionToken(token.slice(0, -2) + "xx", SECRET, "1")).toBeNull();
    expect(await verifySessionToken(token, SECRET + "-other", "1")).toBeNull();
    expect(await verifySessionToken(token, SECRET, "2")).toBeNull();
    expect(await verifySessionToken(undefined, SECRET, "1")).toBeNull();
  });
});

describe("login throttling", () => {
  afterEach(() => __resetRateLimit());

  it("locks an address after five failures and clears on success", () => {
    const now = 1_000_000;
    for (let i = 0; i < 4; i++) expect(recordLoginFailure("1.2.3.4", now).lockedForSec).toBe(0);
    expect(recordLoginFailure("1.2.3.4", now).lockedForSec).toBeGreaterThan(0);
    expect(checkLoginAllowed("1.2.3.4", now + 1000).allowed).toBe(false);
    expect(checkLoginAllowed("5.6.7.8", now + 1000).allowed).toBe(true);
    recordLoginSuccess("1.2.3.4");
    expect(checkLoginAllowed("1.2.3.4", now + 1000).allowed).toBe(true);
  });

  it("reads the client address from proxy headers", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
    expect(clientKey(new Headers())).toBe("unknown");
  });
});

describe("configuration checks", () => {
  it("reports missing or weak settings without exposing values", () => {
    const bad = getAuthConfigStatus({ password: "short", passwordHash: "", secret: "tiny", sessionDays: 7, sessionVersion: "1" });
    expect(bad.configured).toBe(false);
    expect(bad.problems.join(" ")).toMatch(/at least 10/);
    expect(bad.problems.join(" ")).toMatch(/at least 32/);
    expect(bad.problems.join(" ")).not.toContain("short");
    const good = getAuthConfigStatus({ password: "a-long-enough-password", passwordHash: "", secret: SECRET, sessionDays: 7, sessionVersion: "1" });
    expect(good).toEqual({ configured: true, problems: [] });
  });

  it("uses __Host- cookies whenever cookies are Secure", () => {
    expect(cookieNames(true).session).toBe("__Host-plrc_session");
    expect(cookieNames(false).session).toBe("plrc_session");
  });
});

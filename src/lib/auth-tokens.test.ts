import { describe, expect, it } from "vitest";
import {
  EMAIL_VERIFY_TTL_MS,
  PASSWORD_RESET_SENT,
  PASSWORD_RESET_TTL_MS,
  hashToken,
  newToken,
  tokenExpiry,
  tokenIsUsable,
} from "./auth-tokens";

describe("password reset copy", () => {
  it("does not say whether the email exists", () => {
    expect(PASSWORD_RESET_SENT.toLowerCase()).toContain("if an account exists");
    expect(PASSWORD_RESET_SENT.toLowerCase()).not.toContain("not found");
    expect(PASSWORD_RESET_SENT.toLowerCase()).not.toContain("no account");
  });
});

describe("auth tokens", () => {
  it("stores a hash, never the token itself", () => {
    const raw = newToken();
    const hash = hashToken(raw);
    expect(hash).not.toBe(raw);
    expect(hash).toHaveLength(64);
    expect(hashToken(raw)).toBe(hash);
    expect(hashToken(`${raw}x`)).not.toBe(hash);
  });

  it("is usable only before expiry and only once", () => {
    const now = new Date("2026-11-20T12:00:00.000Z");
    const expiresAt = tokenExpiry(now, PASSWORD_RESET_TTL_MS);
    expect(expiresAt.getTime() - now.getTime()).toBe(PASSWORD_RESET_TTL_MS);
    expect(tokenIsUsable({ expiresAt, usedAt: null }, now)).toBe(true);
    expect(tokenIsUsable({ expiresAt, usedAt: null }, new Date(expiresAt.getTime() - 1))).toBe(true);
    expect(tokenIsUsable({ expiresAt, usedAt: null }, expiresAt)).toBe(false);
    expect(tokenIsUsable({ expiresAt, usedAt: now }, now)).toBe(false);
  });

  it("gives a verification link longer than a password reset", () => {
    expect(EMAIL_VERIFY_TTL_MS).toBeGreaterThan(PASSWORD_RESET_TTL_MS);
  });
});

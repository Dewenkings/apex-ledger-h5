// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  createDemoSessionCookie,
  matchesAccessCode,
  verifyDemoSessionCookie,
} from "./session";

describe("controlled demo session", () => {
  it("creates a signed HTTP-only cookie without exposing the access code", () => {
    const cookie = createDemoSessionCookie(
      { sessionId: "session-123", expiresAt: 1788051600000 },
      "session-secret",
      { secure: true, now: 1788048000000 },
    );

    expect(cookie).toMatch(/^apx_demo_session=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+;/);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Max-Age=3600");
    expect(cookie).not.toContain("session-secret");
  });

  it("verifies valid cookies and rejects tampering or expiry", () => {
    const cookie = createDemoSessionCookie(
      { sessionId: "session-123", expiresAt: 1788051600000 },
      "session-secret",
      { secure: false, now: 1788048000000 },
    );
    const value = cookie.match(/^apx_demo_session=([^;]+)/)?.[1] ?? "";

    expect(verifyDemoSessionCookie(value, "session-secret", 1788049000000)).toEqual({
      sessionId: "session-123",
      expiresAt: 1788051600000,
    });
    expect(verifyDemoSessionCookie(`${value}tampered`, "session-secret", 1788049000000)).toBeNull();
    expect(verifyDemoSessionCookie(value, "wrong-secret", 1788049000000)).toBeNull();
    expect(verifyDemoSessionCookie(value, "session-secret", 1788051600000)).toBeNull();
  });

  it("compares the server-side access code without accepting partial values", () => {
    expect(matchesAccessCode("correct-code", "correct-code")).toBe(true);
    expect(matchesAccessCode("correct", "correct-code")).toBe(false);
    expect(matchesAccessCode("wrong-code", "correct-code")).toBe(false);
    expect(matchesAccessCode("", "correct-code")).toBe(false);
  });
});

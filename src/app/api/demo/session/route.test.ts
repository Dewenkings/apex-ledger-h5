// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createSessionHandlers } from "./handlers";
import { DEMO_SESSION_COOKIE, DEMO_VISITOR_COOKIE, verifyDemoSessionCookie, verifyDemoVisitorCookie } from "@/lib/demo-access/session";

const environment = {
  DEMO_ACCESS_CODE: "approved-code",
  SESSION_SECRET: "session-secret",
  NODE_ENV: "production",
};

describe("Demo access session route", () => {
  it("exchanges an approved code for a secure signed session", async () => {
    const handlers = createSessionHandlers({
      environment,
      now: () => 1788048000000,
      sessionId: () => "session-123",
      visitorId: () => "visitor-123",
    });
    const response = await handlers.POST(new Request("https://app.example/api/demo/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessCode: "approved-code" }),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const setCookies = response.headers.getSetCookie();
    expect(setCookies).toHaveLength(2);
    expect(setCookies.join(" ")).toContain("HttpOnly");
    expect(setCookies.join(" ")).toContain("Secure");
    expect(setCookies.some((cookie) => cookie.startsWith(`${DEMO_SESSION_COOKIE}=`))).toBe(true);
    expect(setCookies.some((cookie) => cookie.startsWith(`${DEMO_VISITOR_COOKIE}=`))).toBe(true);
    expect(await response.json()).toEqual({ authenticated: true, expiresAt: 1788062400000 });
  });

  it("reuses the existing visitor identity when a new access session is created", async () => {
    const now = 1788048000000;
    const first = createSessionHandlers({
      environment,
      now: () => now,
      sessionId: () => "session-first",
      visitorId: () => "visitor-stable",
    });
    const login = await first.POST(new Request("https://app.example/api/demo/session", {
      method: "POST",
      body: JSON.stringify({ accessCode: "approved-code" }),
    }));
    const visitorCookie = login.headers.getSetCookie().find((cookie) => cookie.startsWith(`${DEMO_VISITOR_COOKIE}=`))?.split(";")[0] ?? "";
    const second = createSessionHandlers({
      environment,
      now: () => now + 60_000,
      sessionId: () => "session-second",
      visitorId: () => "visitor-must-not-replace",
    });

    const relogin = await second.POST(new Request("https://app.example/api/demo/session", {
      method: "POST",
      headers: { cookie: visitorCookie },
      body: JSON.stringify({ accessCode: "approved-code" }),
    }));
    const sessionValue = relogin.headers.getSetCookie().find((cookie) => cookie.startsWith(`${DEMO_SESSION_COOKIE}=`))?.split(";")[0].split("=")[1];
    const preservedVisitorValue = relogin.headers.getSetCookie().find((cookie) => cookie.startsWith(`${DEMO_VISITOR_COOKIE}=`))?.split(";")[0].split("=")[1];

    expect(verifyDemoSessionCookie(sessionValue, environment.SESSION_SECRET, now + 60_000)?.visitorId).toBe("visitor-stable");
    expect(verifyDemoVisitorCookie(preservedVisitorValue, environment.SESSION_SECRET, now + 60_000)?.visitorId).toBe("visitor-stable");
  });

  it("returns the same generic rejection for incorrect and malformed access", async () => {
    const handlers = createSessionHandlers({ environment });
    const wrong = await handlers.POST(new Request("https://app.example/api/demo/session", {
      method: "POST",
      body: JSON.stringify({ accessCode: "wrong" }),
    }));
    const malformed = await handlers.POST(new Request("https://app.example/api/demo/session", {
      method: "POST",
      body: "not-json",
    }));

    expect(wrong.status).toBe(401);
    expect(malformed.status).toBe(401);
    expect(await wrong.json()).toEqual({ error: "Demo access was not authorized" });
    expect(await malformed.json()).toEqual({ error: "Demo access was not authorized" });
  });

  it("reports session state and clears it on logout", async () => {
    const handlers = createSessionHandlers({
      environment,
      now: () => 1788048000000,
      sessionId: () => "session-123",
      visitorId: () => "visitor-123",
    });
    const login = await handlers.POST(new Request("https://app.example/api/demo/session", {
      method: "POST",
      body: JSON.stringify({ accessCode: "approved-code" }),
    }));
    const cookie = login.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    const state = await handlers.GET(new Request("https://app.example/api/demo/session", {
      headers: { cookie },
    }));
    const logout = await handlers.DELETE();

    expect(await state.json()).toEqual({ authenticated: true, expiresAt: 1788062400000 });
    expect(logout.headers.get("set-cookie")).toContain(`${DEMO_SESSION_COOKIE}=`);
    expect(logout.headers.get("set-cookie")).not.toContain(`${DEMO_VISITOR_COOKIE}=`);
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await logout.json()).toEqual({ authenticated: false });
  });

  it("stays safely unavailable when server secrets are not configured", async () => {
    const handlers = createSessionHandlers({ environment: {} });
    const response = await handlers.POST(new Request("https://app.example/api/demo/session", {
      method: "POST",
      body: JSON.stringify({ accessCode: "anything" }),
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "OKX Demo access is not configured" });
  });
});

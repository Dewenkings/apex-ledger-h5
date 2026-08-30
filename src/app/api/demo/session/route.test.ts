// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createSessionHandlers } from "./route";

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
    });
    const response = await handlers.POST(new Request("https://app.example/api/demo/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessCode: "approved-code" }),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(await response.json()).toEqual({ authenticated: true, expiresAt: 1788062400000 });
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
    });
    const login = await handlers.POST(new Request("https://app.example/api/demo/session", {
      method: "POST",
      body: JSON.stringify({ accessCode: "approved-code" }),
    }));
    const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
    const state = await handlers.GET(new Request("https://app.example/api/demo/session", {
      headers: { cookie },
    }));
    const logout = await handlers.DELETE();

    expect(await state.json()).toEqual({ authenticated: true, expiresAt: 1788062400000 });
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

// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { createDemoSessionCookie, createDemoVisitorCookie, type DemoSession } from "@/lib/demo-access/session";
import { DemoOrderServiceError } from "@/lib/okx-demo/order-service";
import { createWalletSessionCookie } from "@/server/auth/session-cookie";
import { walletOwnerId } from "@/server/identity/owner";
import { MemoryIdentityRepository } from "@/server/identity/repository";
import { createBalanceHandlers, createCancelOrderHandlers, createFillsHandlers, createOrdersHandlers } from "./_handlers";
import { createDefaultDemoApiDependencies, type DemoActor, type DemoApiDependencies } from "./_shared";

const session: DemoSession = { sessionId: "session-123", visitorId: "visitor-123", expiresAt: 1788051600000 };
const actor: DemoActor = { ...session, ownerId: "visitor:visitor-123" };
const origin = "https://apex.example";

function service(overrides: Record<string, unknown> = {}) {
  return {
    place: vi.fn(async () => ({ ordId: "271828", clOrdId: "apx-owned", accepted: true as const })),
    listOrders: vi.fn(async () => []),
    listFills: vi.fn(async () => []),
    getSharedBalance: vi.fn(async () => ({
      totalEquity: "50000",
      updatedAt: 1788048000000,
      assets: [],
      scope: "shared-okx-demo" as const,
      virtual: true as const,
    })),
    cancelOwnedOrder: vi.fn(async () => ({ ordId: "271828", clOrdId: "apx-owned", canceled: true as const })),
    ...overrides,
  };
}

function dependencies(overrides: Partial<DemoApiDependencies> = {}): DemoApiDependencies {
  return {
    getActor: vi.fn(async () => actor),
    getService: vi.fn(() => service()),
    getReferencePrice: vi.fn(async () => "3500"),
    hashClientIp: vi.fn(() => "ip-hash"),
    ...overrides,
  };
}

function mutation(path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`${origin}${path}`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "Idempotency-Key": "request-123",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("OKX Demo private REST routes", () => {
  it("rejects a valid access session when the signed visitor cookie belongs to another workspace", async () => {
    const now = 1788048000000;
    const access = createDemoSessionCookie(session, "session-secret", { secure: true, now });
    const visitor = createDemoVisitorCookie(
      { visitorId: "visitor-other", expiresAt: now + 2_592_000_000 },
      "session-secret",
      { secure: true, now },
    );
    const cookie = [access, visitor].map((value) => value.split(";")[0]).join("; ");
    const deps = createDefaultDemoApiDependencies({ SESSION_SECRET: "session-secret" });

    await expect(deps.getActor(new Request(`${origin}/api/demo/orders`, { headers: { cookie } }))).resolves.toBeNull();
  });

  it("rejects unauthenticated access and never caches private responses", async () => {
    const handlers = createOrdersHandlers(dependencies({ getActor: vi.fn(async () => null) }));

    const response = await handlers.GET(new Request(`${origin}/api/demo/orders`));

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects cross-origin writes and missing idempotency keys", async () => {
    const handlers = createOrdersHandlers(dependencies());
    const crossOrigin = mutation("/api/demo/orders", {}, { Origin: "https://evil.example" });
    const missingKey = mutation("/api/demo/orders", {}, { "Idempotency-Key": "" });

    await expect(handlers.POST(crossOrigin)).resolves.toMatchObject({ status: 403 });
    await expect(handlers.POST(missingKey)).resolves.toMatchObject({ status: 400 });
  });

  it("places a validated limit order and returns 201", async () => {
    const fakeService = service();
    const handlers = createOrdersHandlers(dependencies({ getService: vi.fn(() => fakeService) }));

    const response = await handlers.POST(mutation("/api/demo/orders", {
      instrument: "ETH-USDT",
      side: "buy",
      type: "limit",
      amount: "0.02",
      price: "3500",
    }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ordId: "271828", clOrdId: "apx-owned", accepted: true });
    expect(fakeService.place).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ instrument: "ETH-USDT", amount: "0.02" }),
      "request-123",
      "ip-hash",
    );
  });

  it("ignores a browser-supplied market reference price and injects a trusted quote", async () => {
    const fakeService = service();
    const deps = dependencies({
      getService: vi.fn(() => fakeService),
      getReferencePrice: vi.fn(async () => "3499.75"),
    });
    const handlers = createOrdersHandlers(deps);

    await handlers.POST(mutation("/api/demo/orders", {
      instrument: "ETH-USDT",
      side: "buy",
      type: "market",
      amount: "0.02",
      referencePrice: "0.01",
    }));

    expect(fakeService.place).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ referencePrice: "3499.75" }),
      "request-123",
      "ip-hash",
    );
  });

  it.each([
    ["invalid_order", 400],
    ["idempotency_conflict", 409],
    ["rate_limited", 429],
    ["global_demo_limit", 429],
  ] as const)("maps %s service errors to HTTP %s", async (category, status) => {
    const fakeService = service({
      place: vi.fn(async () => { throw new DemoOrderServiceError(category, "safe message"); }),
    });
    const handlers = createOrdersHandlers(dependencies({ getService: vi.fn(() => fakeService) }));

    const response = await handlers.POST(mutation("/api/demo/orders", {
      instrument: "ETH-USDT",
      side: "buy",
      type: "limit",
      amount: "0.02",
      price: "3500",
    }));

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: "safe message", code: category });
  });

  it("fails closed with 503 and logs safe diagnostics when server credentials or Redis are unavailable", async () => {
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const handlers = createOrdersHandlers(dependencies({
      getService: vi.fn(() => { throw new Error("secrets missing"); }),
    }));

    const response = await handlers.GET(new Request(`${origin}/api/demo/orders`));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "OKX Demo trading is unavailable", code: "demo_unavailable" });
    expect(diagnostic).toHaveBeenCalledWith("Unexpected Demo API failure", {
      name: "Error",
      message: "secrets missing",
    });
    diagnostic.mockRestore();
  });

  it("returns only visitor-owned orders and fills plus explicitly shared virtual balance", async () => {
    const fakeService = service();
    const deps = dependencies({ getService: vi.fn(() => fakeService) });
    const orders = await createOrdersHandlers(deps).GET(new Request(`${origin}/api/demo/orders`));
    const fills = await createFillsHandlers(deps).GET(new Request(`${origin}/api/demo/fills`));
    const balance = await createBalanceHandlers(deps).GET(new Request(`${origin}/api/demo/balance`));

    expect(await orders.json()).toEqual({ orders: [] });
    expect(await fills.json()).toEqual({ fills: [] });
    expect(await balance.json()).toMatchObject({ balance: { scope: "shared-okx-demo", virtual: true } });
    expect([orders, fills, balance].every((response) => response.headers.get("cache-control") === "no-store")).toBe(true);
  });

  it("prevents one session from canceling another session's order", async () => {
    const fakeService = service({
      cancelOwnedOrder: vi.fn(async () => { throw new DemoOrderServiceError("forbidden", "not owned"); }),
    });
    const handlers = createCancelOrderHandlers(dependencies({ getService: vi.fn(() => fakeService) }));

    const response = await handlers.POST(
      mutation("/api/demo/orders/271828/cancel", { instrument: "ETH-USDT" }),
      { params: Promise.resolve({ orderId: "271828" }) },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "not owned", code: "forbidden" });
  });

  it("ignores a forged cancellation instrument and delegates by server-owned order ID", async () => {
    const fakeService = service();
    const handlers = createCancelOrderHandlers(dependencies({ getService: vi.fn(() => fakeService) }));

    const response = await handlers.POST(
      mutation("/api/demo/orders/271828/cancel", { instrument: "SOL-USDT" }),
      { params: Promise.resolve({ orderId: "271828" }) },
    );

    expect(response.status).toBe(200);
    expect(fakeService.cancelOwnedOrder).toHaveBeenCalledWith(actor, "271828");
  });

  it("uses a matching SIWE wallet owner without bypassing Demo authorization", async () => {
    const now = Date.now();
    const activeSession = { ...session, expiresAt: now + 3_600_000 };
    const access = createDemoSessionCookie(activeSession, "session-secret", { secure: true, now }).split(";")[0];
    const visitor = createDemoVisitorCookie(
      { visitorId: session.visitorId, expiresAt: now + 2_592_000_000 },
      "session-secret",
      { secure: true, now },
    ).split(";")[0];
    const walletSessionId = "wallet_session_123456";
    const wallet = createWalletSessionCookie(walletSessionId, true).split(";")[0];
    const identityRepository = new MemoryIdentityRepository(() => now);
    const ownerId = walletOwnerId("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
    await identityRepository.saveSession({
      sessionId: walletSessionId,
      visitorId: activeSession.visitorId,
      ownerId,
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      chainId: 1,
      expiresAt: activeSession.expiresAt,
    }, 3600);
    const deps = createDefaultDemoApiDependencies(
      { SESSION_SECRET: "session-secret" },
      { identityRepository },
    );

    await expect(deps.getActor(new Request(`${origin}/api/demo/orders`, {
      headers: { cookie: `${access}; ${visitor}; ${wallet}` },
    }))).resolves.toMatchObject({ ownerId });

    await expect(deps.getActor(new Request(`${origin}/api/demo/orders`, {
      headers: { cookie: `${visitor}; ${wallet}` },
    }))).resolves.toBeNull();
  });
});

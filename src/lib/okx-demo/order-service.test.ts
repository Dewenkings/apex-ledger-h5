// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { MemoryDemoSafetyStore } from "@/lib/demo-access/store";
import type { DemoOrder } from "./contracts";
import { OkxDemoError } from "./client";
import { OkxDemoOrderService } from "./order-service";

const session = { sessionId: "session-123", visitorId: "visitor-123", expiresAt: 1788051600000 };
const input = {
  instrument: "ETH-USDT",
  side: "buy",
  type: "limit",
  amount: "0.02",
  price: "3500",
} as const;

const acceptedOrder: DemoOrder = {
  instrument: "ETH-USDT",
  ordId: "271828",
  clOrdId: "filled-by-service",
  side: "buy",
  orderType: "limit",
  price: "3500",
  size: "0.02",
  filledSize: "0",
  averagePrice: "",
  status: "live",
  createdAt: 1788048000000,
  updatedAt: 1788048000000,
};

function gateway(overrides: Record<string, unknown> = {}) {
  return {
    placeOrder: vi.fn(async (order) => ({ ordId: "271828", clOrdId: order.clOrdId, accepted: true as const })),
    getOrder: vi.fn(async () => acceptedOrder),
    listPendingOrders: vi.fn(async () => []),
    listOrderHistory: vi.fn(async () => []),
    listFills: vi.fn(async () => []),
    cancelOrder: vi.fn(async () => ({ ordId: "271828", clOrdId: "apxowned", canceled: true as const })),
    getBalance: vi.fn(async () => ({ totalEquity: "50000", updatedAt: 1788048000000, assets: [], scope: "shared-okx-demo" as const, virtual: true as const })),
    ...overrides,
  };
}

describe("OkxDemoOrderService", () => {
  it("places one bounded order with a session-owned idempotent client ID", async () => {
    const store = new MemoryDemoSafetyStore(() => 1788048000000);
    const client = gateway();
    const service = new OkxDemoOrderService(client, store);

    const result = await service.place(session, input, "request-123", "ip-hash");

    expect(result).toMatchObject({ ordId: "271828", accepted: true });
    expect(result.clOrdId).toMatch(/^apx[a-f0-9]{12}[a-f0-9]{12}$/);
    expect(client.placeOrder).toHaveBeenCalledWith({
      instId: "ETH-USDT",
      tdMode: "cash",
      side: "buy",
      ordType: "limit",
      sz: "0.02",
      px: "3500",
      clOrdId: result.clOrdId,
    });
    await expect(store.getOrderOwner("271828")).resolves.toEqual({
      sessionId: "session-123",
      clOrdId: result.clOrdId,
    });
  });

  it("replays the saved response and rejects a conflicting idempotency body", async () => {
    const store = new MemoryDemoSafetyStore(() => 1788048000000);
    const client = gateway();
    const service = new OkxDemoOrderService(client, store);

    const first = await service.place(session, input, "same-request", "ip-hash");
    const replay = await service.place(session, input, "same-request", "ip-hash");

    expect(replay).toEqual(first);
    expect(client.placeOrder).toHaveBeenCalledTimes(1);
    await expect(service.place(session, { ...input, amount: "0.03" }, "same-request", "ip-hash"))
      .rejects.toMatchObject({ category: "idempotency_conflict" });
  });

  it("reconciles an ambiguous placement timeout by clOrdId", async () => {
    const store = new MemoryDemoSafetyStore(() => 1788048000000);
    const client = gateway({
      placeOrder: vi.fn(async () => { throw new OkxDemoError("upstream_timeout", "timeout"); }),
      getOrder: vi.fn(async ({ clOrdId }) => ({ ...acceptedOrder, clOrdId })),
    });
    const service = new OkxDemoOrderService(client, store);

    const result = await service.place(session, input, "timeout-request", "ip-hash");

    expect(result).toMatchObject({ ordId: "271828", accepted: true });
    expect(client.getOrder).toHaveBeenCalledWith({ instrument: "ETH-USDT", clOrdId: result.clOrdId });
  });

  it("enforces session rate and open-order limits before sending another order", async () => {
    const store = new MemoryDemoSafetyStore(() => 1788048000000);
    const client = gateway();
    const rateLimited = new OkxDemoOrderService(client, store, { sessionRateLimit: 1, ipRateLimit: 2 });

    await rateLimited.place(session, input, "request-1", "ip-hash");
    await expect(rateLimited.place(session, input, "request-2", "ip-hash"))
      .rejects.toMatchObject({ category: "rate_limited" });

    const secondStore = new MemoryDemoSafetyStore(() => 1788048000000);
    await secondStore.saveOrderOwner("existing", { sessionId: session.sessionId, clOrdId: "apxexisting" }, 300);
    const capped = new OkxDemoOrderService(gateway(), secondStore, { maxOpenOrders: 1 });
    await expect(capped.place(session, input, "request-3", "other-ip"))
      .rejects.toMatchObject({ category: "open_order_limit" });
  });

  it("filters account-wide orders/fills and denies cross-session cancellation", async () => {
    const store = new MemoryDemoSafetyStore(() => 1788048000000);
    await store.saveOrderOwner("owned", { sessionId: session.sessionId, clOrdId: "apxowned" }, 300);
    await store.saveOrderOwner("other", { sessionId: "session-other", clOrdId: "apxother" }, 300);
    const owned = { ...acceptedOrder, ordId: "owned", clOrdId: "apxowned" };
    const other = { ...acceptedOrder, ordId: "other", clOrdId: "apxother" };
    const client = gateway({
      listPendingOrders: vi.fn(async () => [owned, other]),
      listOrderHistory: vi.fn(async () => []),
      listFills: vi.fn(async () => [
        { instrument: "ETH-USDT", ordId: "owned", clOrdId: "apxowned", tradeId: "1", side: "buy", fillPrice: "3500", fillSize: "0.01", fee: "-0.1", feeCurrency: "USDT", timestamp: 1788048000000 },
        { instrument: "ETH-USDT", ordId: "other", clOrdId: "apxother", tradeId: "2", side: "buy", fillPrice: "3500", fillSize: "0.01", fee: "-0.1", feeCurrency: "USDT", timestamp: 1788048000000 },
      ]),
      getOrder: vi.fn(async () => owned),
    });
    const service = new OkxDemoOrderService(client, store);

    await expect(service.listOrders(session)).resolves.toEqual([owned]);
    await expect(service.listFills(session)).resolves.toEqual([expect.objectContaining({ ordId: "owned" })]);
    await expect(service.cancelOwnedOrder({ ...session, sessionId: "session-other" }, "owned", "ETH-USDT"))
      .rejects.toMatchObject({ category: "forbidden" });
    await expect(service.cancelOwnedOrder(session, "owned", "ETH-USDT")).resolves.toMatchObject({ canceled: true });
  });

  it("logs non-sensitive order visibility counts for production diagnostics", async () => {
    const store = new MemoryDemoSafetyStore(() => 1788048000000);
    await store.saveOrderOwner("owned", { sessionId: session.sessionId, clOrdId: "expected-client-id" }, 300);
    const client = gateway({
      listPendingOrders: vi.fn(async () => [{ ...acceptedOrder, ordId: "owned", clOrdId: "different-client-id" }]),
      listOrderHistory: vi.fn(async () => []),
    });
    const diagnostic = vi.spyOn(console, "info").mockImplementation(() => undefined);

    try {
      const service = new OkxDemoOrderService(client, store);
      await expect(service.listOrders(session)).resolves.toEqual([]);
      expect(diagnostic).toHaveBeenCalledWith("Demo order visibility", {
        pending: 1,
        history: 0,
        unique: 1,
        ownersFound: 1,
        sessionMatches: 1,
        clientOrderMatches: 0,
        visible: 0,
      });
    } finally {
      diagnostic.mockRestore();
    }
  });
});

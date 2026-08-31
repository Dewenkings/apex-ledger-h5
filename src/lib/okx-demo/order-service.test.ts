// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { MemoryDemoSafetyStore } from "@/lib/demo-access/store";
import type { DemoOrder, DemoOrderSnapshot } from "./contracts";
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

function snapshot(overrides: Partial<DemoOrderSnapshot> = {}): DemoOrderSnapshot {
  return {
    ...acceptedOrder,
    visitorId: session.visitorId,
    syncState: "pending",
    lastSyncedAt: null,
    ...overrides,
  };
}

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
  it("keeps an accepted order visible when account lists are empty", async () => {
    const store = new MemoryDemoSafetyStore(() => 1788048000000);
    const client = gateway();
    const service = new OkxDemoOrderService(client, store, {}, () => 1788048000000);

    const placed = await service.place(session, input, "ledger-request", "ip-hash");
    client.getOrder.mockResolvedValue({ ...acceptedOrder, clOrdId: placed.clOrdId });

    await expect(service.listOrders(session)).resolves.toEqual([
      expect.objectContaining({
        ordId: placed.ordId,
        visitorId: session.visitorId,
        syncState: "synced",
      }),
    ]);
    expect(client.listPendingOrders).not.toHaveBeenCalled();
    expect(client.listOrderHistory).not.toHaveBeenCalled();
    expect(client.getOrder).toHaveBeenCalledWith({ instrument: "ETH-USDT", ordId: placed.ordId });
  });

  it("places one bounded order with a visitor-owned idempotent client ID", async () => {
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
    await expect(store.getVisitorOrder("271828")).resolves.toMatchObject({
      visitorId: "visitor-123",
      clOrdId: result.clOrdId,
      syncState: "pending",
    });
  });

  it("replays the saved response and rejects a conflicting idempotency body", async () => {
    const store = new MemoryDemoSafetyStore(() => 1788048000000);
    const client = gateway();
    const service = new OkxDemoOrderService(client, store);

    const first = await service.place(session, input, "same-request", "ip-hash");
    const replay = await service.place({ ...session, sessionId: "session-new" }, input, "same-request", "ip-hash");

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
    await secondStore.saveVisitorOrder(snapshot({ ordId: "existing", clOrdId: "apxexisting" }), 300);
    const capped = new OkxDemoOrderService(gateway(), secondStore, { maxOpenOrders: 1 });
    await expect(capped.place(session, input, "request-3", "other-ip"))
      .rejects.toMatchObject({ category: "open_order_limit" });
  });

  it("isolates visitor ledgers and falls back to a stale snapshot when exact sync fails", async () => {
    const store = new MemoryDemoSafetyStore(() => 1788048000000);
    const owned = snapshot({ ordId: "owned", clOrdId: "apxowned", lastSyncedAt: 1788047000000 });
    const other = snapshot({ visitorId: "visitor-other", ordId: "other", clOrdId: "apxother" });
    await store.saveVisitorOrder(owned, 300);
    await store.saveVisitorOrder(other, 300);
    const client = gateway({
      getOrder: vi.fn(async () => { throw new OkxDemoError("upstream_failure", "unavailable"); }),
    });
    const service = new OkxDemoOrderService(client, store);

    await expect(service.listOrders(session)).resolves.toEqual([
      expect.objectContaining({ ordId: "owned", syncState: "stale", lastSyncedAt: 1788047000000 }),
    ]);
    await expect(service.listOrders({ ...session, visitorId: "visitor-other" })).resolves.toEqual([
      expect.objectContaining({ ordId: "other", syncState: "stale" }),
    ]);
  });

  it("updates exact order state and removes a client-order mismatch", async () => {
    const store = new MemoryDemoSafetyStore(() => 1788048000000);
    await store.saveVisitorOrder(snapshot({ ordId: "owned", clOrdId: "expected-client-id" }), 300);
    const client = gateway({
      getOrder: vi.fn(async () => ({ ...acceptedOrder, ordId: "owned", clOrdId: "expected-client-id", status: "filled", filledSize: "0.02" })),
    });
    const service = new OkxDemoOrderService(client, store, {}, () => 1788048000000);

    await expect(service.listOrders(session)).resolves.toEqual([
      expect.objectContaining({ ordId: "owned", status: "filled", filledSize: "0.02", syncState: "synced", lastSyncedAt: 1788048000000 }),
    ]);

    await store.saveVisitorOrder(snapshot({ ordId: "mismatch", clOrdId: "expected" }), 300);
    client.getOrder.mockResolvedValue({ ...acceptedOrder, ordId: "mismatch", clOrdId: "different" });
    await service.listOrders(session);
    await expect(store.getVisitorOrder("mismatch")).resolves.toBeNull();
  });

  it("stops at the global daily budget before calling OKX", async () => {
    const store = new MemoryDemoSafetyStore(() => 1788048000000);
    const limits = { orders: 100, notionalCents: 1_000_000 };
    const day = new Date(1788048000000).toISOString().slice(0, 10);
    for (let index = 0; index < 100; index += 1) {
      await store.consumeGlobalDailyBudget(day, 1, limits, 90_000);
    }
    const client = gateway();
    const service = new OkxDemoOrderService(client, store, {}, () => 1788048000000);

    await expect(service.place(session, input, "over-global-limit", "ip-hash"))
      .rejects.toMatchObject({ category: "global_demo_limit" });
    expect(client.placeOrder).not.toHaveBeenCalled();
  });

  it("lists fills only for visitor ledger orders", async () => {
    const store = new MemoryDemoSafetyStore(() => 1788048000000);
    await store.saveVisitorOrder(snapshot({ ordId: "owned", clOrdId: "apxowned", status: "partially_filled" }), 300);
    await store.saveVisitorOrder(snapshot({ visitorId: "visitor-other", ordId: "other", clOrdId: "apxother", status: "filled" }), 300);
    const ownedFill = { instrument: "ETH-USDT" as const, ordId: "owned", clOrdId: "apxowned", tradeId: "1", side: "buy" as const, fillPrice: "3500", fillSize: "0.01", fee: "-0.1", feeCurrency: "USDT", timestamp: 1788048000000 };
    const client = gateway({ listFills: vi.fn(async () => [ownedFill]) });
    const service = new OkxDemoOrderService(client, store);

    await expect(service.listFills(session)).resolves.toEqual([ownedFill]);
    expect(client.listFills).toHaveBeenCalledWith({ instrument: "ETH-USDT", ordId: "owned" });
  });

  it("authorizes cancellation from the visitor snapshot instead of client input", async () => {
    const store = new MemoryDemoSafetyStore(() => 1788048000000);
    const owned = snapshot({ ordId: "owned", clOrdId: "apxowned" });
    await store.saveVisitorOrder(owned, 300);
    const client = gateway({
      getOrder: vi.fn(async () => ({ ...acceptedOrder, ordId: "owned", clOrdId: "apxowned" })),
    });
    const service = new OkxDemoOrderService(client, store, {}, () => 1788048000000);

    await expect(service.cancelOwnedOrder({ ...session, visitorId: "visitor-other" }, "owned"))
      .rejects.toMatchObject({ category: "forbidden" });
    await expect(service.cancelOwnedOrder(session, "owned")).resolves.toMatchObject({ canceled: true });
    expect(client.getOrder).toHaveBeenCalledWith({ instrument: "ETH-USDT", ordId: "owned" });
    expect(client.cancelOrder).toHaveBeenCalledWith({ instrument: "ETH-USDT", ordId: "owned" });
    await expect(store.getVisitorOrder("owned")).resolves.toMatchObject({ status: "canceled", syncState: "synced" });
  });
});

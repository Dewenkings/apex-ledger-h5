// @vitest-environment node

import { describe, expect, it } from "vitest";

import { MemoryDemoSafetyStore } from "./store";
import type { DemoOrderSnapshot } from "@/lib/okx-demo/contracts";

const snapshot: DemoOrderSnapshot = {
  visitorId: "visitor-a",
  instrument: "ETH-USDT",
  ordId: "271828",
  clOrdId: "apx-owned",
  side: "buy",
  orderType: "limit",
  price: "3500",
  size: "0.02",
  filledSize: "0",
  averagePrice: "",
  status: "live",
  createdAt: 1_000_000,
  updatedAt: 1_000_020,
  syncState: "pending",
  lastSyncedAt: null,
};

describe("durable demo safety state contract", () => {
  it("enforces a fixed-window rate limit", async () => {
    let now = 1_000_000;
    const store = new MemoryDemoSafetyStore(() => now);

    await expect(store.consumeRateLimit("session:a", 2, 60)).resolves.toEqual({ allowed: true, remaining: 1 });
    await expect(store.consumeRateLimit("session:a", 2, 60)).resolves.toEqual({ allowed: true, remaining: 0 });
    await expect(store.consumeRateLimit("session:a", 2, 60)).resolves.toEqual({ allowed: false, remaining: 0 });
    now += 60_001;
    await expect(store.consumeRateLimit("session:a", 2, 60)).resolves.toEqual({ allowed: true, remaining: 1 });
  });

  it("distinguishes an idempotent replay from a conflicting request", async () => {
    const store = new MemoryDemoSafetyStore(() => 1_000_000);

    await expect(store.claimIdempotency("idem:1", "hash-a", 300)).resolves.toEqual({ claimed: true });
    await store.saveIdempotencyResponse("idem:1", { ordId: "123" });
    await expect(store.claimIdempotency("idem:1", "hash-a", 300)).resolves.toEqual({
      claimed: false,
      conflict: false,
      response: { ordId: "123" },
    });
    await expect(store.claimIdempotency("idem:1", "hash-b", 300)).resolves.toEqual({
      claimed: false,
      conflict: true,
    });
  });

  it("stores order ownership without exposing another session's order", async () => {
    const store = new MemoryDemoSafetyStore(() => 1_000_000);
    await store.saveOrderOwner("271828", { sessionId: "session-a", clOrdId: "apxa123" }, 300);

    await expect(store.getOrderOwner("271828")).resolves.toEqual({ sessionId: "session-a", clOrdId: "apxa123" });
    await expect(store.countSessionOpenOrders("session-a")).resolves.toBe(1);
    await store.markOrderClosed("271828");
    await expect(store.countSessionOpenOrders("session-a")).resolves.toBe(0);
    await expect(store.getOrderOwner("271828")).resolves.toEqual({ sessionId: "session-a", clOrdId: "apxa123" });
    await store.removeOrderOwner("271828");
    await expect(store.getOrderOwner("271828")).resolves.toBeNull();
  });

  it("stores visitor order snapshots newest-first without exposing another visitor", async () => {
    const store = new MemoryDemoSafetyStore(() => 1_000_000);
    const older = { ...snapshot, ordId: "161803", clOrdId: "apx-older", createdAt: 999_000, updatedAt: 999_000 };
    await store.saveVisitorOrder(older, 300);
    await store.saveVisitorOrder(snapshot, 300);

    await expect(store.listVisitorOrders("visitor-a", 50)).resolves.toEqual([snapshot, older]);
    await expect(store.listVisitorOrders("visitor-b", 50)).resolves.toEqual([]);
    await expect(store.countVisitorOpenOrders("visitor-a")).resolves.toBe(2);

    const synced = { ...snapshot, status: "filled" as const, syncState: "synced" as const, filledSize: "0.02", lastSyncedAt: 1_000_100 };
    await store.saveVisitorOrder(synced, 300);
    await expect(store.getVisitorOrder(snapshot.ordId)).resolves.toEqual(synced);
    await expect(store.countVisitorOpenOrders("visitor-a")).resolves.toBe(1);

    await store.removeVisitorOrder("visitor-a", older.ordId);
    await expect(store.listVisitorOrders("visitor-a", 50)).resolves.toEqual([synced]);
  });

  it("enforces atomic global daily order and notional budgets", async () => {
    const store = new MemoryDemoSafetyStore(() => 1_000_000);
    const limits = { orders: 100, notionalCents: 1_000_000 };

    for (let index = 0; index < 100; index += 1) {
      await expect(store.consumeGlobalDailyBudget("2026-08-31", 1, limits, 90_000)).resolves.toEqual({ allowed: true });
    }
    await expect(store.consumeGlobalDailyBudget("2026-08-31", 1, limits, 90_000)).resolves.toEqual({ allowed: false });

    await expect(store.consumeGlobalDailyBudget("2026-09-01", 1_000_001, limits, 90_000)).resolves.toEqual({ allowed: false });
    await expect(store.consumeGlobalDailyBudget("2026-09-01", 1_000_000, limits, 90_000)).resolves.toEqual({ allowed: true });
  });
});

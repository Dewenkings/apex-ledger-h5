// @vitest-environment node

import { describe, expect, it } from "vitest";

import { MemoryDemoSafetyStore } from "./store";

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
    await store.removeOrderOwner("271828");
    await expect(store.getOrderOwner("271828")).resolves.toBeNull();
  });
});

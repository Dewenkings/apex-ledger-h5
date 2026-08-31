// @vitest-environment node

import { describe, expect, it } from "vitest";

import type { SiweNonceRecord, WalletSession } from "@/server/auth/contracts";
import { MemoryIdentityRepository } from "./repository";

const nonce: SiweNonceRecord = {
  nonce: "0123456789abcdef0123456789abcdef",
  visitorId: "visitor-1",
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  chainId: 1,
  domain: "apex.example",
  uri: "https://apex.example",
  issuedAt: "2026-08-31T08:00:00.000Z",
  expirationTime: "2026-08-31T08:05:00.000Z",
};

const session: WalletSession = {
  sessionId: "session-123",
  visitorId: "visitor-1",
  ownerId: "eip155:account:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  chainId: 1,
  expiresAt: 1_086_400_000,
};

describe("identity repository", () => {
  it("atomically consumes a nonce once and expires it", async () => {
    let now = 1_000_000_000;
    const repository = new MemoryIdentityRepository(() => now);
    await repository.saveNonce(nonce, 300);
    await expect(repository.consumeNonce(nonce.nonce)).resolves.toEqual(nonce);
    await expect(repository.consumeNonce(nonce.nonce)).resolves.toBeNull();

    await repository.saveNonce(nonce, 300);
    now += 300_001;
    await expect(repository.consumeNonce(nonce.nonce)).resolves.toBeNull();
  });

  it("round-trips and deletes a wallet session", async () => {
    const repository = new MemoryIdentityRepository(() => 1_000_000_000);
    await repository.saveSession(session, 86_400);
    await expect(repository.getSession(session.sessionId)).resolves.toEqual(session);
    await repository.deleteSession(session.sessionId);
    await expect(repository.getSession(session.sessionId)).resolves.toBeNull();
  });

  it("enforces a fixed-window auth rate limit", async () => {
    const repository = new MemoryIdentityRepository(() => 1_000_000_000);
    await expect(repository.consumeRateLimit("visitor-1", 1, 60)).resolves.toEqual({ allowed: true, remaining: 0 });
    await expect(repository.consumeRateLimit("visitor-1", 1, 60)).resolves.toEqual({ allowed: false, remaining: 0 });
  });
});

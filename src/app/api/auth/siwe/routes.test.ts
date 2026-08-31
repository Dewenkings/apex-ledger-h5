// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { createDemoVisitorCookie } from "@/lib/demo-access/session";
import type { WalletSession } from "@/server/auth/contracts";
import { createWalletSessionCookie } from "@/server/auth/session-cookie";
import { SiweAuthError } from "@/server/auth/siwe-service";
import { createSiweHandlers, type SiweHandlerService } from "./handlers";

const environment = { SESSION_SECRET: "test-secret", NODE_ENV: "test" };
const visitorCookie = createDemoVisitorCookie(
  { visitorId: "visitor-1", expiresAt: 2_000_000_000_000 },
  environment.SESSION_SECRET,
  { secure: false, now: 1_000_000_000_000 },
).split(";")[0];
const walletCookie = createWalletSessionCookie("session_0123456789abcdef", false).split(";")[0];

function service(): SiweHandlerService {
  return {
    issueChallenge: vi.fn(async () => ({
      nonce: "0123456789abcdef0123456789abcdef",
      issuedAt: "2026-08-31T08:00:00.000Z",
      expirationTime: "2026-08-31T08:05:00.000Z",
      statement: "Sign in to Apex Ledger.",
    })),
    verify: vi.fn(async () => ({
      authenticated: true as const,
      sessionId: "session_0123456789abcdef",
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const,
      chainId: 1 as const,
      expiresAt: 2_000_000_000_000,
    })),
    getSession: vi.fn(async (): Promise<WalletSession | null> => ({
      sessionId: "session_0123456789abcdef",
      visitorId: "visitor-1",
      ownerId: "eip155:account:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      chainId: 1,
      expiresAt: 2_000_000_000_000,
    })),
    logout: vi.fn(async () => undefined),
  };
}

describe("SIWE routes", () => {
  it("creates an anonymous visitor while issuing a challenge", async () => {
    const mockService = service();
    const handlers = createSiweHandlers({ service: mockService, environment, now: () => 1_000_000_000_000, visitorId: () => "visitor-1" });
    const response = await handlers.nonce(new Request("https://apex.example/api/auth/siwe/nonce", {
      method: "POST",
      headers: { Origin: "https://apex.example", "Content-Type": "application/json" },
      body: JSON.stringify({ address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chainId: 1 }),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("apx_visitor=");
    expect(mockService.issueChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ chainId: 1 }),
      expect.objectContaining({ visitorId: "visitor-1", origin: "https://apex.example" }),
    );
  });

  it("verifies and exposes only the safe wallet session response", async () => {
    const mockService = service();
    const handlers = createSiweHandlers({ service: mockService, environment });
    const verified = await handlers.verify(new Request("https://apex.example/api/auth/siwe/verify", {
      method: "POST",
      headers: { Origin: "https://apex.example", Cookie: visitorCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ message: "message", signature: "0x1234" }),
    }));
    expect(verified.status).toBe(200);
    expect(verified.headers.get("set-cookie")).toContain("apx_wallet_session=session_0123456789abcdef");
    expect(await verified.json()).toEqual(expect.objectContaining({ authenticated: true, chainId: 1 }));

    const current = await handlers.session(new Request("https://apex.example/api/auth/siwe/session", {
      headers: { Cookie: `${visitorCookie}; ${walletCookie}` },
    }));
    expect(await current.json()).toEqual({
      authenticated: true,
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      chainId: 1,
      expiresAt: 2_000_000_000_000,
    });
  });

  it("rejects cross-origin writes and maps stable auth errors", async () => {
    const mockService = service();
    mockService.verify = vi.fn(async () => { throw new SiweAuthError("signature_invalid", "Wallet signature is invalid"); });
    const handlers = createSiweHandlers({ service: mockService, environment });
    const forbidden = await handlers.nonce(new Request("https://apex.example/api/auth/siwe/nonce", {
      method: "POST",
      headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
      body: JSON.stringify({ address: "0x0", chainId: 1 }),
    }));
    expect(forbidden.status).toBe(403);

    const invalid = await handlers.verify(new Request("https://apex.example/api/auth/siwe/verify", {
      method: "POST",
      headers: { Origin: "https://apex.example", Cookie: visitorCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ message: "message", signature: "0x1234" }),
    }));
    expect(invalid.status).toBe(401);
    expect(await invalid.json()).toEqual({ error: "Wallet signature is invalid", code: "signature_invalid" });
  });
});

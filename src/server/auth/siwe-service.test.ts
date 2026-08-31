// @vitest-environment node

import { SiweMessage } from "siwe";
import { describe, expect, it, vi } from "vitest";

import { MemoryDemoSafetyStore } from "@/lib/demo-access/store";
import { MemoryIdentityRepository } from "@/server/identity/repository";
import { SiweAuthError, SiweAuthService } from "./siwe-service";

const address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
const now = Date.parse("2026-08-31T08:00:00.000Z");
const origin = "https://apex.example";

function createService(overrides: { verify?: boolean; migrateFails?: boolean } = {}) {
  const repository = new MemoryIdentityRepository(() => now);
  const workspace = new MemoryDemoSafetyStore(() => now);
  if (overrides.migrateFails) vi.spyOn(workspace, "migrateVisitorWorkspace").mockRejectedValue(new Error("redis down"));
  const verifyMessage = vi.fn(async () => overrides.verify ?? true);
  return {
    repository,
    workspace,
    verifyMessage,
    service: new SiweAuthService({
      repository,
      workspace,
      verifyMessage,
      now: () => now,
      nonce: () => "0123456789abcdef0123456789abcdef",
      sessionId: () => "session_0123456789abcdef",
    }),
  };
}

async function challengeAndMessage(service: SiweAuthService, changes: Partial<SiweMessage> = {}) {
  const challenge = await service.issueChallenge(
    { address, chainId: 1 },
    { visitorId: "visitor-1", origin, rateScope: "ip-1" },
  );
  const message = new SiweMessage({
    domain: "apex.example",
    address,
    statement: challenge.statement,
    uri: origin,
    version: "1",
    chainId: 1,
    nonce: challenge.nonce,
    issuedAt: challenge.issuedAt,
    expirationTime: challenge.expirationTime,
    ...changes,
  }).prepareMessage();
  return { challenge, message };
}

describe("SIWE auth service", () => {
  it("issues and verifies a one-time challenge", async () => {
    const { service, verifyMessage, repository } = createService();
    const { message } = await challengeAndMessage(service);

    await expect(service.verify(
      { message, signature: "0x1234" },
      { visitorId: "visitor-1", origin },
    )).resolves.toMatchObject({ authenticated: true, address, chainId: 1 });
    expect(verifyMessage).toHaveBeenCalledWith(expect.objectContaining({ address, message, signature: "0x1234", chainId: 1 }));
    await expect(repository.getSession("session_0123456789abcdef")).resolves.toMatchObject({ address, chainId: 1 });

    await expect(service.verify(
      { message, signature: "0x1234" },
      { visitorId: "visitor-1", origin },
    )).rejects.toMatchObject({ code: "nonce_expired" });
  });

  it("rejects unsupported chains and invalid signatures", async () => {
    const unsupported = createService().service;
    await expect(unsupported.issueChallenge(
      { address, chainId: 10 },
      { visitorId: "visitor-1", origin, rateScope: "ip-1" },
    )).rejects.toMatchObject({ code: "unsupported_chain" });

    const { service } = createService({ verify: false });
    const { message } = await challengeAndMessage(service);
    await expect(service.verify(
      { message, signature: "0x1234" },
      { visitorId: "visitor-1", origin },
    )).rejects.toMatchObject({ code: "signature_invalid" });
  });

  it("binds the message to visitor, domain, URI, address and time", async () => {
    const { service } = createService();
    const { message } = await challengeAndMessage(service, { domain: "evil.example" });
    await expect(service.verify(
      { message, signature: "0x1234" },
      { visitorId: "visitor-1", origin },
    )).rejects.toBeInstanceOf(SiweAuthError);
    await expect(service.getSession("missing")).resolves.toBeNull();
  });

  it("does not establish a session when workspace migration fails", async () => {
    const { service, repository } = createService({ migrateFails: true });
    const { message } = await challengeAndMessage(service);
    await expect(service.verify(
      { message, signature: "0x1234" },
      { visitorId: "visitor-1", origin },
    )).rejects.toMatchObject({ code: "auth_unavailable" });
    await expect(repository.getSession("session_0123456789abcdef")).resolves.toBeNull();
  });
});

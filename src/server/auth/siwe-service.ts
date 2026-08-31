import { SiweMessage } from "siwe";
import { getAddress, type Address } from "viem";

import type { DemoSafetyStore } from "@/lib/demo-access/store";
import { isSupportedChainId, type SupportedChainId } from "@/lib/web3/chains";
import { walletOwnerId } from "@/server/identity/owner";
import type { IdentityRepository } from "@/server/identity/repository";
import type { SiweNonceRecord, WalletSession } from "./contracts";

const NONCE_TTL_SECONDS = 5 * 60;
const SESSION_TTL_SECONDS = 24 * 60 * 60;
const SIWE_STATEMENT = "Sign in to Apex Ledger. This does not authorize transfers or trading.";

export type SiweAuthErrorCode =
  | "invalid_request"
  | "unsupported_chain"
  | "nonce_expired"
  | "signature_invalid"
  | "rate_limited"
  | "auth_unavailable";

export class SiweAuthError extends Error {
  constructor(readonly code: SiweAuthErrorCode, message: string) {
    super(message);
    this.name = "SiweAuthError";
  }
}

type VerifyMessage = (input: {
  address: Address;
  message: string;
  signature: `0x${string}`;
  chainId: SupportedChainId;
}) => Promise<boolean>;

type ServiceOptions = {
  repository: IdentityRepository;
  workspace: Pick<DemoSafetyStore, "migrateVisitorWorkspace">;
  verifyMessage: VerifyMessage;
  now?: () => number;
  nonce?: () => string;
  sessionId?: () => string;
};

type RequestContext = { visitorId: string; origin: string; rateScope?: string };

export class SiweAuthService {
  private readonly now: () => number;
  private readonly nonce: () => string;
  private readonly sessionId: () => string;

  constructor(private readonly options: ServiceOptions) {
    this.now = options.now ?? Date.now;
    this.nonce = options.nonce ?? (() => crypto.randomUUID().replaceAll("-", ""));
    this.sessionId = options.sessionId ?? (() => crypto.randomUUID().replaceAll("-", ""));
  }

  async issueChallenge(
    input: { address: string; chainId: number },
    context: RequestContext,
  ): Promise<Pick<SiweNonceRecord, "nonce" | "issuedAt" | "expirationTime"> & { statement: string }> {
    const rate = await this.options.repository.consumeRateLimit(
      `challenge:${context.rateScope ?? "unknown"}:${context.visitorId}`,
      10,
      60,
    );
    if (!rate.allowed) throw new SiweAuthError("rate_limited", "Too many wallet login attempts");
    if (!isSupportedChainId(input.chainId)) {
      throw new SiweAuthError("unsupported_chain", "Wallet network is not supported");
    }
    const address = normalizeAddress(input.address);
    const origin = parseOrigin(context.origin);
    const issuedAt = new Date(this.now()).toISOString();
    const expirationTime = new Date(this.now() + NONCE_TTL_SECONDS * 1000).toISOString();
    const record: SiweNonceRecord = {
      nonce: this.nonce(),
      visitorId: context.visitorId,
      address,
      chainId: input.chainId,
      domain: origin.host,
      uri: origin.origin,
      issuedAt,
      expirationTime,
    };
    await this.options.repository.saveNonce(record, NONCE_TTL_SECONDS);
    return { nonce: record.nonce, issuedAt, expirationTime, statement: SIWE_STATEMENT };
  }

  async verify(
    input: { message: string; signature: string },
    context: Omit<RequestContext, "rateScope">,
  ): Promise<{ authenticated: true; sessionId: string; address: Address; chainId: SupportedChainId; expiresAt: number }> {
    const rate = await this.options.repository.consumeRateLimit(`verify:${context.visitorId}`, 10, 60);
    if (!rate.allowed) throw new SiweAuthError("rate_limited", "Too many wallet signature attempts");
    const parsed = parseMessage(input.message);
    const record = await this.options.repository.getNonce(parsed.nonce);
    if (!record) throw new SiweAuthError("nonce_expired", "Wallet login challenge expired or was already used");
    validateMessage(parsed, record, context, this.now());
    if (!/^0x[0-9a-fA-F]+$/.test(input.signature)) {
      throw new SiweAuthError("signature_invalid", "Wallet signature is invalid");
    }
    const verified = await this.options.verifyMessage({
      address: record.address,
      message: input.message,
      signature: input.signature as `0x${string}`,
      chainId: record.chainId,
    });
    if (!verified) throw new SiweAuthError("signature_invalid", "Wallet signature is invalid");
    const consumed = await this.options.repository.consumeNonce(record.nonce);
    if (!consumed) throw new SiweAuthError("nonce_expired", "Wallet login challenge expired or was already used");

    const ownerId = walletOwnerId(record.address);
    try {
      await this.options.workspace.migrateVisitorWorkspace(record.visitorId, ownerId, 30 * 24 * 60 * 60);
      const expiresAt = this.now() + SESSION_TTL_SECONDS * 1000;
      const session: WalletSession = {
        sessionId: this.sessionId(),
        visitorId: record.visitorId,
        ownerId,
        address: record.address,
        chainId: record.chainId,
        expiresAt,
      };
      await this.options.repository.saveSession(session, SESSION_TTL_SECONDS);
      return { authenticated: true, sessionId: session.sessionId, address: session.address, chainId: session.chainId, expiresAt };
    } catch {
      throw new SiweAuthError("auth_unavailable", "Wallet login is temporarily unavailable");
    }
  }

  async getSession(sessionId: string): Promise<WalletSession | null> {
    return this.options.repository.getSession(sessionId);
  }

  async logout(sessionId: string): Promise<void> {
    await this.options.repository.deleteSession(sessionId);
  }
}

function normalizeAddress(value: string): Address {
  try {
    return getAddress(value);
  } catch {
    throw new SiweAuthError("invalid_request", "Wallet address is invalid");
  }
}

function parseOrigin(value: string): URL {
  try {
    const origin = new URL(value);
    if (origin.origin !== value.replace(/\/$/, "")) throw new Error("not an origin");
    if (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname))) {
      throw new Error("insecure origin");
    }
    return origin;
  } catch {
    throw new SiweAuthError("invalid_request", "Authentication origin is invalid");
  }
}

function parseMessage(value: string): SiweMessage {
  try {
    return new SiweMessage(value);
  } catch {
    throw new SiweAuthError("invalid_request", "SIWE message is invalid");
  }
}

function validateMessage(parsed: SiweMessage, record: SiweNonceRecord, context: Omit<RequestContext, "rateScope">, now: number): void {
  const origin = parseOrigin(context.origin);
  const address = normalizeAddress(parsed.address);
  const matches = parsed.version === "1"
    && parsed.domain === record.domain
    && parsed.domain === origin.host
    && parsed.uri === record.uri
    && parsed.uri === origin.origin
    && parsed.nonce === record.nonce
    && address === record.address
    && parsed.chainId === record.chainId
    && parsed.issuedAt === record.issuedAt
    && parsed.expirationTime === record.expirationTime
    && record.visitorId === context.visitorId
    && Date.parse(record.expirationTime) > now
    && Date.parse(record.issuedAt) <= now + 60_000;
  if (!matches) throw new SiweAuthError("invalid_request", "SIWE message does not match the login challenge");
}

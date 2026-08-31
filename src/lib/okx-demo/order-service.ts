import { createHash } from "node:crypto";

import { validateDemoOrderInput, type DemoOrderInput } from "@/lib/demo-access/rules";
import type { DemoSession } from "@/lib/demo-access/session";
import type { DemoSafetyStore } from "@/lib/demo-access/store";
import type { TradableInstrument } from "@/lib/trading/pairs";
import { OkxDemoError } from "./client";
import type {
  DemoBalance,
  DemoCancelReceipt,
  DemoFill,
  DemoOrder,
  DemoOrderReceipt,
  PlaceDemoOrderInput,
} from "./contracts";

export type OkxDemoGateway = {
  placeOrder(input: PlaceDemoOrderInput): Promise<DemoOrderReceipt>;
  getOrder(input: { instrument: TradableInstrument; ordId?: string; clOrdId?: string }): Promise<DemoOrder>;
  listPendingOrders(instrument?: TradableInstrument): Promise<DemoOrder[]>;
  listOrderHistory(instrument?: TradableInstrument): Promise<DemoOrder[]>;
  listFills(instrument?: TradableInstrument): Promise<DemoFill[]>;
  cancelOrder(input: { instrument: TradableInstrument; ordId: string }): Promise<DemoCancelReceipt>;
  getBalance(): Promise<DemoBalance>;
};

type ServiceErrorCategory =
  | "invalid_order"
  | "idempotency_conflict"
  | "request_in_progress"
  | "rate_limited"
  | "open_order_limit"
  | "forbidden"
  | "unknown_outcome";

export class DemoOrderServiceError extends Error {
  readonly name = "DemoOrderServiceError";

  constructor(readonly category: ServiceErrorCategory, message: string) {
    super(message);
  }
}

type OrderServicePolicy = {
  sessionRateLimit: number;
  ipRateLimit: number;
  rateWindowSeconds: number;
  maxOpenOrders: number;
  idempotencyTtlSeconds: number;
  ownershipTtlSeconds: number;
};

const DEFAULT_POLICY: OrderServicePolicy = {
  sessionRateLimit: 10,
  ipRateLimit: 30,
  rateWindowSeconds: 60,
  maxOpenOrders: 5,
  idempotencyTtlSeconds: 5 * 60,
  ownershipTtlSeconds: 24 * 60 * 60,
};

export class OkxDemoOrderService {
  private readonly policy: OrderServicePolicy;

  constructor(
    private readonly client: OkxDemoGateway,
    private readonly store: DemoSafetyStore,
    policy: Partial<OrderServicePolicy> = {},
  ) {
    this.policy = { ...DEFAULT_POLICY, ...policy };
  }

  async place(
    session: DemoSession,
    rawInput: unknown,
    requestId: string,
    clientIpKey: string,
  ): Promise<DemoOrderReceipt> {
    const validation = validateDemoOrderInput(rawInput);
    if (!validation.success) throw new DemoOrderServiceError("invalid_order", validation.error);
    if (!requestId || requestId.length > 128) {
      throw new DemoOrderServiceError("invalid_order", "Invalid idempotency key");
    }

    const [sessionRate, ipRate] = await Promise.all([
      this.store.consumeRateLimit(`session:${session.sessionId}`, this.policy.sessionRateLimit, this.policy.rateWindowSeconds),
      this.store.consumeRateLimit(`ip:${clientIpKey}`, this.policy.ipRateLimit, this.policy.rateWindowSeconds),
    ]);
    if (!sessionRate.allowed || !ipRate.allowed) {
      throw new DemoOrderServiceError("rate_limited", "Demo order rate limit exceeded");
    }
    if (await this.store.countSessionOpenOrders(session.sessionId) >= this.policy.maxOpenOrders) {
      throw new DemoOrderServiceError("open_order_limit", "Too many open Demo orders");
    }

    const idempotencyKey = `${session.sessionId}:${requestId}`;
    const requestHash = hashCanonical(validation.data);
    const claim = await this.store.claimIdempotency(
      idempotencyKey,
      requestHash,
      this.policy.idempotencyTtlSeconds,
    );
    if (!claim.claimed) {
      if (claim.conflict) throw new DemoOrderServiceError("idempotency_conflict", "Idempotency key was reused with different order data");
      if (isOrderReceipt(claim.response)) return claim.response;
      throw new DemoOrderServiceError("request_in_progress", "The Demo order request is still being reconciled");
    }

    const clOrdId = createClientOrderId(session.sessionId, requestId);
    const submission = toSubmission(validation.data, clOrdId);
    let receipt: DemoOrderReceipt;
    try {
      receipt = await this.client.placeOrder(submission);
    } catch (error) {
      if (!(error instanceof OkxDemoError) || error.category !== "upstream_timeout") throw error;
      try {
        const reconciled = await this.client.getOrder({
          instrument: validation.data.instrument,
          clOrdId,
        });
        receipt = { ordId: reconciled.ordId, clOrdId: reconciled.clOrdId, accepted: true };
      } catch {
        throw new DemoOrderServiceError("unknown_outcome", "Demo order outcome is still unknown");
      }
    }

    await Promise.all([
      this.store.saveOrderOwner(receipt.ordId, { sessionId: session.sessionId, clOrdId: receipt.clOrdId }, this.policy.ownershipTtlSeconds),
      this.store.saveIdempotencyResponse(idempotencyKey, receipt),
    ]);
    return receipt;
  }

  async listOrders(session: DemoSession): Promise<DemoOrder[]> {
    const [pending, history] = await Promise.all([
      this.client.listPendingOrders(),
      this.client.listOrderHistory(),
    ]);
    const unique = new Map([...pending, ...history].map((order) => [order.ordId, order]));
    const visible: DemoOrder[] = [];
    let ownersFound = 0;
    let sessionMatches = 0;
    let clientOrderMatches = 0;
    for (const order of unique.values()) {
      const owner = await this.store.getOrderOwner(order.ordId);
      if (owner) ownersFound += 1;
      if (owner?.sessionId === session.sessionId) sessionMatches += 1;
      if (owner?.sessionId !== session.sessionId || owner.clOrdId !== order.clOrdId) continue;
      clientOrderMatches += 1;
      visible.push(order);
      if (order.status === "filled" || order.status === "canceled" || order.status === "rejected") {
        await this.store.markOrderClosed(order.ordId);
      }
    }
    if (visible.length === 0) {
      console.info("Demo order visibility", {
        pending: pending.length,
        history: history.length,
        unique: unique.size,
        ownersFound,
        sessionMatches,
        clientOrderMatches,
        visible: visible.length,
      });
    }
    return visible.sort((left, right) => right.updatedAt - left.updatedAt);
  }

  async listFills(session: DemoSession): Promise<DemoFill[]> {
    const fills = await this.client.listFills();
    const visible: DemoFill[] = [];
    for (const fill of fills) {
      const owner = await this.store.getOrderOwner(fill.ordId);
      if (owner?.sessionId === session.sessionId && owner.clOrdId === fill.clOrdId) visible.push(fill);
    }
    return visible.sort((left, right) => right.timestamp - left.timestamp);
  }

  getSharedBalance(): Promise<DemoBalance> {
    return this.client.getBalance();
  }

  async cancelOwnedOrder(
    session: DemoSession,
    ordId: string,
    instrument: TradableInstrument,
  ): Promise<DemoCancelReceipt> {
    const owner = await this.store.getOrderOwner(ordId);
    if (!owner || owner.sessionId !== session.sessionId) {
      throw new DemoOrderServiceError("forbidden", "Demo order is not owned by this session");
    }
    const order = await this.client.getOrder({ instrument, ordId });
    if (order.clOrdId !== owner.clOrdId || order.instrument !== instrument) {
      throw new DemoOrderServiceError("forbidden", "Demo order ownership could not be verified");
    }
    const result = await this.client.cancelOrder({ instrument, ordId });
    await this.store.markOrderClosed(ordId);
    return result;
  }
}

function toSubmission(input: DemoOrderInput, clOrdId: string): PlaceDemoOrderInput {
  return {
    instId: input.instrument,
    tdMode: "cash",
    side: input.side,
    ordType: input.type,
    sz: input.amount,
    ...(input.type === "limit" ? { px: input.price } : {}),
    clOrdId,
  };
}

function createClientOrderId(sessionId: string, requestId: string): string {
  const sessionPrefix = createHash("sha256").update(sessionId).digest("hex").slice(0, 12);
  const requestSuffix = createHash("sha256").update(requestId).digest("hex").slice(0, 12);
  return `apx${sessionPrefix}${requestSuffix}`;
}

function hashCanonical(input: DemoOrderInput): string {
  return createHash("sha256").update(JSON.stringify({
    instrument: input.instrument,
    side: input.side,
    type: input.type,
    amount: input.amount,
    price: input.price ?? null,
    referencePrice: input.referencePrice ?? null,
  })).digest("hex");
}

function isOrderReceipt(value: unknown): value is DemoOrderReceipt {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DemoOrderReceipt>;
  return candidate.accepted === true
    && typeof candidate.ordId === "string"
    && typeof candidate.clOrdId === "string";
}

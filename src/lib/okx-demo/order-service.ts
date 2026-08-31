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
  DemoOrderSnapshot,
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
  | "global_demo_limit"
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
  ownershipTtlSeconds: 30 * 24 * 60 * 60,
};

const GLOBAL_DAILY_LIMITS = { orders: 100, notionalCents: 1_000_000 };
const GLOBAL_BUDGET_TTL_SECONDS = 2 * 24 * 60 * 60;

export class OkxDemoOrderService {
  private readonly policy: OrderServicePolicy;

  constructor(
    private readonly client: OkxDemoGateway,
    private readonly store: DemoSafetyStore,
    policy: Partial<OrderServicePolicy> = {},
    private readonly now: () => number = Date.now,
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
      this.store.consumeRateLimit(`visitor:${session.visitorId}`, this.policy.sessionRateLimit, this.policy.rateWindowSeconds),
      this.store.consumeRateLimit(`ip:${clientIpKey}`, this.policy.ipRateLimit, this.policy.rateWindowSeconds),
    ]);
    if (!sessionRate.allowed || !ipRate.allowed) {
      throw new DemoOrderServiceError("rate_limited", "Demo order rate limit exceeded");
    }
    if (await this.store.countVisitorOpenOrders(session.visitorId) >= this.policy.maxOpenOrders) {
      throw new DemoOrderServiceError("open_order_limit", "Too many open Demo orders");
    }

    const idempotencyKey = `${session.visitorId}:${requestId}`;
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

    const notionalCents = calculateNotionalCents(validation.data);
    const day = new Date(this.now()).toISOString().slice(0, 10);
    const globalBudget = await this.store.consumeGlobalDailyBudget(
      day,
      notionalCents,
      GLOBAL_DAILY_LIMITS,
      GLOBAL_BUDGET_TTL_SECONDS,
    );
    if (!globalBudget.allowed) {
      throw new DemoOrderServiceError("global_demo_limit", "The public Demo daily limit has been reached");
    }

    const clOrdId = createClientOrderId(session.visitorId, requestId);
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

    const createdAt = this.now();
    const pending: DemoOrderSnapshot = {
      visitorId: session.visitorId,
      instrument: validation.data.instrument,
      ordId: receipt.ordId,
      clOrdId: receipt.clOrdId,
      side: validation.data.side,
      orderType: validation.data.type,
      price: validation.data.price ?? "",
      size: validation.data.amount,
      filledSize: "0",
      averagePrice: "",
      status: "live",
      createdAt,
      updatedAt: createdAt,
      syncState: "pending",
      lastSyncedAt: null,
    };
    await Promise.all([
      this.store.saveVisitorOrder(pending, this.policy.ownershipTtlSeconds),
      this.store.saveIdempotencyResponse(idempotencyKey, receipt),
    ]);
    try {
      const synced = await this.client.getOrder({ instrument: pending.instrument, ordId: pending.ordId });
      if (synced.clOrdId === pending.clOrdId) {
        await this.store.saveVisitorOrder(toSyncedSnapshot(pending.visitorId, synced, this.now()), this.policy.ownershipTtlSeconds);
      }
    } catch {
      // The accepted snapshot remains visible until the next exact-order reconciliation.
    }
    return receipt;
  }

  async listOrders(session: DemoSession): Promise<DemoOrderSnapshot[]> {
    const snapshots = await this.store.listVisitorOrders(session.visitorId, 50);
    const reconciled = await mapWithConcurrency(snapshots, 5, async (snapshot) => {
      try {
        const order = await this.client.getOrder({ instrument: snapshot.instrument, ordId: snapshot.ordId });
        if (order.clOrdId !== snapshot.clOrdId) {
          await this.store.removeVisitorOrder(session.visitorId, snapshot.ordId);
          return null;
        }
        const synced = toSyncedSnapshot(session.visitorId, order, this.now());
        await this.store.saveVisitorOrder(synced, this.policy.ownershipTtlSeconds);
        return synced;
      } catch {
        const stale = { ...snapshot, syncState: "stale" as const };
        await this.store.saveVisitorOrder(stale, this.policy.ownershipTtlSeconds);
        return stale;
      }
    });
    return reconciled
      .filter((snapshot): snapshot is DemoOrderSnapshot => snapshot !== null)
      .sort((left, right) => right.updatedAt - left.updatedAt);
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

function calculateNotionalCents(input: DemoOrderInput): number {
  const quote = input.type === "limit" ? input.price : input.referencePrice;
  const cents = Math.ceil(Number(input.amount) * Number(quote) * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new DemoOrderServiceError("invalid_order", "Invalid Demo order notional");
  }
  return cents;
}

function isOrderReceipt(value: unknown): value is DemoOrderReceipt {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DemoOrderReceipt>;
  return candidate.accepted === true
    && typeof candidate.ordId === "string"
    && typeof candidate.clOrdId === "string";
}

function toSyncedSnapshot(visitorId: string, order: DemoOrder, syncedAt: number): DemoOrderSnapshot {
  return {
    ...order,
    visitorId,
    syncState: "synced",
    lastSyncedAt: syncedAt,
  };
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()));
  return results;
}

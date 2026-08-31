import { Redis } from "@upstash/redis";
import type { DemoOrderSnapshot } from "@/lib/okx-demo/contracts";

export type RateLimitResult = { allowed: boolean; remaining: number };
export type IdempotencyClaim =
  | { claimed: true }
  | { claimed: false; conflict: true }
  | { claimed: false; conflict: false; response?: unknown };
export type OrderOwner = { sessionId: string; clOrdId: string };

export interface DemoSafetyStore {
  consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
  claimIdempotency(key: string, requestHash: string, ttlSeconds: number): Promise<IdempotencyClaim>;
  saveIdempotencyResponse(key: string, response: unknown): Promise<void>;
  saveOrderOwner(ordId: string, owner: OrderOwner, ttlSeconds: number): Promise<void>;
  getOrderOwner(ordId: string): Promise<OrderOwner | null>;
  markOrderClosed(ordId: string): Promise<void>;
  removeOrderOwner(ordId: string): Promise<void>;
  countSessionOpenOrders(sessionId: string): Promise<number>;
  saveVisitorOrder(snapshot: DemoOrderSnapshot, ttlSeconds: number): Promise<void>;
  getVisitorOrder(ordId: string): Promise<DemoOrderSnapshot | null>;
  listVisitorOrders(visitorId: string, limit: number): Promise<DemoOrderSnapshot[]>;
  removeVisitorOrder(visitorId: string, ordId: string): Promise<void>;
  countVisitorOpenOrders(visitorId: string): Promise<number>;
  consumeGlobalDailyBudget(
    day: string,
    notionalCents: number,
    limits: { orders: number; notionalCents: number },
    ttlSeconds: number,
  ): Promise<{ allowed: boolean }>;
}

type Expiring<T> = { value: T; expiresAt: number };
type IdempotencyRecord = { requestHash: string; response?: unknown };
type DailyBudget = { orders: number; notionalCents: number };

export class MemoryDemoSafetyStore implements DemoSafetyStore {
  private readonly rates = new Map<string, Expiring<number>>();
  private readonly idempotency = new Map<string, Expiring<IdempotencyRecord>>();
  private readonly owners = new Map<string, Expiring<OrderOwner>>();
  private readonly openOrderIds = new Set<string>();
  private readonly visitorOrders = new Map<string, Expiring<DemoOrderSnapshot>>();
  private readonly dailyBudgets = new Map<string, Expiring<DailyBudget>>();

  constructor(private readonly now: () => number = Date.now) {}

  async consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = this.now();
    const existing = this.rates.get(key);
    const count = existing && existing.expiresAt > now ? existing.value + 1 : 1;
    this.rates.set(key, { value: count, expiresAt: now + windowSeconds * 1000 });
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  }

  async claimIdempotency(key: string, requestHash: string, ttlSeconds: number): Promise<IdempotencyClaim> {
    const now = this.now();
    const existing = this.idempotency.get(key);
    if (existing && existing.expiresAt > now) {
      if (existing.value.requestHash !== requestHash) return { claimed: false, conflict: true };
      return { claimed: false, conflict: false, response: existing.value.response };
    }
    this.idempotency.set(key, {
      value: { requestHash },
      expiresAt: now + ttlSeconds * 1000,
    });
    return { claimed: true };
  }

  async saveIdempotencyResponse(key: string, response: unknown): Promise<void> {
    const existing = this.idempotency.get(key);
    if (!existing || existing.expiresAt <= this.now()) return;
    this.idempotency.set(key, {
      ...existing,
      value: { ...existing.value, response },
    });
  }

  async saveOrderOwner(ordId: string, owner: OrderOwner, ttlSeconds: number): Promise<void> {
    this.owners.set(ordId, { value: owner, expiresAt: this.now() + ttlSeconds * 1000 });
    this.openOrderIds.add(ordId);
  }

  async getOrderOwner(ordId: string): Promise<OrderOwner | null> {
    const owner = this.owners.get(ordId);
    if (!owner || owner.expiresAt <= this.now()) {
      this.owners.delete(ordId);
      return null;
    }
    return owner.value;
  }

  async removeOrderOwner(ordId: string): Promise<void> {
    this.owners.delete(ordId);
    this.openOrderIds.delete(ordId);
  }

  async markOrderClosed(ordId: string): Promise<void> {
    this.openOrderIds.delete(ordId);
  }

  async countSessionOpenOrders(sessionId: string): Promise<number> {
    const owners = await Promise.all([...this.openOrderIds].map((ordId) => this.getOrderOwner(ordId)));
    return owners.filter((owner) => owner?.sessionId === sessionId).length;
  }

  async saveVisitorOrder(snapshot: DemoOrderSnapshot, ttlSeconds: number): Promise<void> {
    this.visitorOrders.set(snapshot.ordId, {
      value: snapshot,
      expiresAt: this.now() + ttlSeconds * 1000,
    });
  }

  async getVisitorOrder(ordId: string): Promise<DemoOrderSnapshot | null> {
    const record = this.visitorOrders.get(ordId);
    if (!record || record.expiresAt <= this.now()) {
      this.visitorOrders.delete(ordId);
      return null;
    }
    return record.value;
  }

  async listVisitorOrders(visitorId: string, limit: number): Promise<DemoOrderSnapshot[]> {
    const snapshots = await Promise.all([...this.visitorOrders.keys()].map((ordId) => this.getVisitorOrder(ordId)));
    return snapshots
      .filter((snapshot): snapshot is DemoOrderSnapshot => snapshot?.visitorId === visitorId)
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, Math.max(0, limit));
  }

  async removeVisitorOrder(visitorId: string, ordId: string): Promise<void> {
    const snapshot = await this.getVisitorOrder(ordId);
    if (snapshot?.visitorId === visitorId) this.visitorOrders.delete(ordId);
  }

  async countVisitorOpenOrders(visitorId: string): Promise<number> {
    const snapshots = await this.listVisitorOrders(visitorId, 50);
    return snapshots.filter((snapshot) => snapshot.status === "live" || snapshot.status === "partially_filled").length;
  }

  async consumeGlobalDailyBudget(
    day: string,
    notionalCents: number,
    limits: { orders: number; notionalCents: number },
    ttlSeconds: number,
  ): Promise<{ allowed: boolean }> {
    const current = this.dailyBudgets.get(day);
    const budget = current && current.expiresAt > this.now()
      ? current.value
      : { orders: 0, notionalCents: 0 };
    if (budget.orders + 1 > limits.orders || budget.notionalCents + notionalCents > limits.notionalCents) {
      return { allowed: false };
    }
    this.dailyBudgets.set(day, {
      value: { orders: budget.orders + 1, notionalCents: budget.notionalCents + notionalCents },
      expiresAt: this.now() + ttlSeconds * 1000,
    });
    return { allowed: true };
  }
}

export class RedisDemoSafetyStore implements DemoSafetyStore {
  constructor(private readonly redis: Redis) {}

  async consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const count = await this.redis.eval<unknown[], number>(
      "local c=redis.call('INCR',KEYS[1]); if c==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return c",
      [`apx:rate:${key}`],
      [windowSeconds],
    );
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  }

  async claimIdempotency(key: string, requestHash: string, ttlSeconds: number): Promise<IdempotencyClaim> {
    const redisKey = `apx:idem:${key}`;
    const created = await this.redis.set(redisKey, { requestHash } satisfies IdempotencyRecord, { nx: true, ex: ttlSeconds });
    if (created === "OK") return { claimed: true };
    const existing = await this.redis.get<IdempotencyRecord>(redisKey);
    if (!existing || existing.requestHash !== requestHash) return { claimed: false, conflict: true };
    return { claimed: false, conflict: false, response: existing.response };
  }

  async saveIdempotencyResponse(key: string, response: unknown): Promise<void> {
    const redisKey = `apx:idem:${key}`;
    const existing = await this.redis.get<IdempotencyRecord>(redisKey);
    if (!existing) return;
    await this.redis.set(redisKey, { ...existing, response }, { xx: true, keepTtl: true });
  }

  async saveOrderOwner(ordId: string, owner: OrderOwner, ttlSeconds: number): Promise<void> {
    const ownerKey = `apx:owner:${ordId}`;
    const sessionKey = `apx:session-orders:${owner.sessionId}`;
    await Promise.all([
      this.redis.set(ownerKey, owner, { ex: ttlSeconds }),
      this.redis.sadd(sessionKey, ordId),
      this.redis.expire(sessionKey, ttlSeconds),
    ]);
  }

  async getOrderOwner(ordId: string): Promise<OrderOwner | null> {
    return this.redis.get<OrderOwner>(`apx:owner:${ordId}`);
  }

  async removeOrderOwner(ordId: string): Promise<void> {
    const owner = await this.getOrderOwner(ordId);
    await this.redis.del(`apx:owner:${ordId}`);
    if (owner) await this.redis.srem(`apx:session-orders:${owner.sessionId}`, ordId);
  }

  async markOrderClosed(ordId: string): Promise<void> {
    const owner = await this.getOrderOwner(ordId);
    if (owner) await this.redis.srem(`apx:session-orders:${owner.sessionId}`, ordId);
  }

  async countSessionOpenOrders(sessionId: string): Promise<number> {
    const sessionKey = `apx:session-orders:${sessionId}`;
    const orderIds = await this.redis.smembers<string[]>(sessionKey);
    const owners = await Promise.all(orderIds.map((ordId) => this.getOrderOwner(ordId)));
    const stale = orderIds.filter((_, index) => !owners[index]);
    if (stale.length > 0) await this.redis.srem(sessionKey, ...stale);
    return owners.filter(Boolean).length;
  }

  async saveVisitorOrder(snapshot: DemoOrderSnapshot, ttlSeconds: number): Promise<void> {
    const orderKey = `apx:order:${snapshot.ordId}`;
    const visitorKey = `apx:visitor-orders:${snapshot.visitorId}`;
    await Promise.all([
      this.redis.set(orderKey, snapshot, { ex: ttlSeconds }),
      this.redis.zadd(visitorKey, { score: snapshot.createdAt, member: snapshot.ordId }),
      this.redis.expire(visitorKey, ttlSeconds),
    ]);
  }

  async getVisitorOrder(ordId: string): Promise<DemoOrderSnapshot | null> {
    return this.redis.get<DemoOrderSnapshot>(`apx:order:${ordId}`);
  }

  async listVisitorOrders(visitorId: string, limit: number): Promise<DemoOrderSnapshot[]> {
    const visitorKey = `apx:visitor-orders:${visitorId}`;
    const orderIds = await this.redis.zrange<string[]>(visitorKey, 0, Math.max(0, limit - 1), { rev: true });
    const snapshots = await Promise.all(orderIds.map((ordId) => this.getVisitorOrder(ordId)));
    const staleIds = orderIds.filter((_, index) => snapshots[index]?.visitorId !== visitorId);
    if (staleIds.length > 0) await this.redis.zrem(visitorKey, ...staleIds);
    return snapshots.filter((snapshot): snapshot is DemoOrderSnapshot => snapshot?.visitorId === visitorId);
  }

  async removeVisitorOrder(visitorId: string, ordId: string): Promise<void> {
    const snapshot = await this.getVisitorOrder(ordId);
    if (snapshot?.visitorId !== visitorId) return;
    await Promise.all([
      this.redis.del(`apx:order:${ordId}`),
      this.redis.zrem(`apx:visitor-orders:${visitorId}`, ordId),
    ]);
  }

  async countVisitorOpenOrders(visitorId: string): Promise<number> {
    const snapshots = await this.listVisitorOrders(visitorId, 50);
    return snapshots.filter((snapshot) => snapshot.status === "live" || snapshot.status === "partially_filled").length;
  }

  async consumeGlobalDailyBudget(
    day: string,
    notionalCents: number,
    limits: { orders: number; notionalCents: number },
    ttlSeconds: number,
  ): Promise<{ allowed: boolean }> {
    const allowed = await this.redis.eval<unknown[], number>(
      "local o=tonumber(redis.call('GET',KEYS[1]) or '0'); local n=tonumber(redis.call('GET',KEYS[2]) or '0'); if o+1>tonumber(ARGV[1]) or n+tonumber(ARGV[3])>tonumber(ARGV[2]) then return 0 end; redis.call('INCR',KEYS[1]); redis.call('INCRBY',KEYS[2],ARGV[3]); redis.call('EXPIRE',KEYS[1],ARGV[4]); redis.call('EXPIRE',KEYS[2],ARGV[4]); return 1",
      [`apx:daily:${day}:orders`, `apx:daily:${day}:notional`],
      [limits.orders, limits.notionalCents, notionalCents, ttlSeconds],
    );
    return { allowed: allowed === 1 };
  }
}

export function createRedisDemoSafetyStore(environment: Record<string, string | undefined> = process.env): RedisDemoSafetyStore {
  const url = environment.UPSTASH_REDIS_REST_URL;
  const token = environment.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Demo safety store is unavailable");
  return new RedisDemoSafetyStore(new Redis({ url, token }));
}

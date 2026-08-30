import { Redis } from "@upstash/redis";

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
  removeOrderOwner(ordId: string): Promise<void>;
  countSessionOpenOrders(sessionId: string): Promise<number>;
}

type Expiring<T> = { value: T; expiresAt: number };
type IdempotencyRecord = { requestHash: string; response?: unknown };

export class MemoryDemoSafetyStore implements DemoSafetyStore {
  private readonly rates = new Map<string, Expiring<number>>();
  private readonly idempotency = new Map<string, Expiring<IdempotencyRecord>>();
  private readonly owners = new Map<string, Expiring<OrderOwner>>();

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
  }

  async countSessionOpenOrders(sessionId: string): Promise<number> {
    const owners = await Promise.all([...this.owners.keys()].map((ordId) => this.getOrderOwner(ordId)));
    return owners.filter((owner) => owner?.sessionId === sessionId).length;
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

  async countSessionOpenOrders(sessionId: string): Promise<number> {
    const sessionKey = `apx:session-orders:${sessionId}`;
    const orderIds = await this.redis.smembers<string[]>(sessionKey);
    const owners = await Promise.all(orderIds.map((ordId) => this.getOrderOwner(ordId)));
    const stale = orderIds.filter((_, index) => !owners[index]);
    if (stale.length > 0) await this.redis.srem(sessionKey, ...stale);
    return owners.filter(Boolean).length;
  }
}

export function createRedisDemoSafetyStore(environment: Record<string, string | undefined> = process.env): RedisDemoSafetyStore {
  const url = environment.UPSTASH_REDIS_REST_URL;
  const token = environment.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Demo safety store is unavailable");
  return new RedisDemoSafetyStore(new Redis({ url, token }));
}

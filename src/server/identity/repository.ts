import { Redis } from "@upstash/redis";

import type { SiweNonceRecord, WalletSession } from "@/server/auth/contracts";

type Expiring<T> = { value: T; expiresAt: number };
export type AuthRateLimit = { allowed: boolean; remaining: number };

export interface IdentityRepository {
  saveNonce(record: SiweNonceRecord, ttlSeconds: number): Promise<void>;
  getNonce(nonce: string): Promise<SiweNonceRecord | null>;
  consumeNonce(nonce: string): Promise<SiweNonceRecord | null>;
  saveSession(session: WalletSession, ttlSeconds: number): Promise<void>;
  getSession(sessionId: string): Promise<WalletSession | null>;
  deleteSession(sessionId: string): Promise<void>;
  consumeRateLimit(scope: string, limit: number, windowSeconds: number): Promise<AuthRateLimit>;
}

export class MemoryIdentityRepository implements IdentityRepository {
  private readonly nonces = new Map<string, Expiring<SiweNonceRecord>>();
  private readonly sessions = new Map<string, Expiring<WalletSession>>();
  private readonly rates = new Map<string, Expiring<number>>();

  constructor(private readonly now: () => number = Date.now) {}

  async saveNonce(record: SiweNonceRecord, ttlSeconds: number): Promise<void> {
    this.nonces.set(record.nonce, { value: record, expiresAt: this.now() + ttlSeconds * 1000 });
  }

  async consumeNonce(nonce: string): Promise<SiweNonceRecord | null> {
    const existing = this.nonces.get(nonce);
    this.nonces.delete(nonce);
    return existing && existing.expiresAt > this.now() ? existing.value : null;
  }

  async getNonce(nonce: string): Promise<SiweNonceRecord | null> {
    const existing = this.nonces.get(nonce);
    if (!existing || existing.expiresAt <= this.now()) {
      this.nonces.delete(nonce);
      return null;
    }
    return existing.value;
  }

  async saveSession(session: WalletSession, ttlSeconds: number): Promise<void> {
    this.sessions.set(session.sessionId, { value: session, expiresAt: this.now() + ttlSeconds * 1000 });
  }

  async getSession(sessionId: string): Promise<WalletSession | null> {
    const existing = this.sessions.get(sessionId);
    if (!existing || existing.expiresAt <= this.now()) {
      this.sessions.delete(sessionId);
      return null;
    }
    return existing.value;
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async consumeRateLimit(scope: string, limit: number, windowSeconds: number): Promise<AuthRateLimit> {
    const existing = this.rates.get(scope);
    const count = existing && existing.expiresAt > this.now() ? existing.value + 1 : 1;
    this.rates.set(scope, { value: count, expiresAt: this.now() + windowSeconds * 1000 });
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  }
}

export class RedisIdentityRepository implements IdentityRepository {
  constructor(private readonly redis: Redis) {}

  async saveNonce(record: SiweNonceRecord, ttlSeconds: number): Promise<void> {
    await this.redis.set(`apx:siwe:nonce:${record.nonce}`, record, { ex: ttlSeconds });
  }

  async consumeNonce(nonce: string): Promise<SiweNonceRecord | null> {
    const result = await this.redis.eval<unknown[], unknown>(
      "local v=redis.call('GET',KEYS[1]); if v then redis.call('DEL',KEYS[1]) end; return v",
      [`apx:siwe:nonce:${nonce}`],
      [],
    );
    if (!result) return null;
    if (typeof result === "string") return JSON.parse(result) as SiweNonceRecord;
    return result as SiweNonceRecord;
  }

  async getNonce(nonce: string): Promise<SiweNonceRecord | null> {
    return this.redis.get<SiweNonceRecord>(`apx:siwe:nonce:${nonce}`);
  }

  async saveSession(session: WalletSession, ttlSeconds: number): Promise<void> {
    await this.redis.set(`apx:wallet-session:${session.sessionId}`, session, { ex: ttlSeconds });
  }

  async getSession(sessionId: string): Promise<WalletSession | null> {
    return this.redis.get<WalletSession>(`apx:wallet-session:${sessionId}`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.redis.del(`apx:wallet-session:${sessionId}`);
  }

  async consumeRateLimit(scope: string, limit: number, windowSeconds: number): Promise<AuthRateLimit> {
    const count = await this.redis.eval<unknown[], number>(
      "local c=redis.call('INCR',KEYS[1]); if c==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return c",
      [`apx:siwe-rate:${scope}`],
      [windowSeconds],
    );
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  }
}

export function createRedisIdentityRepository(
  environment: Record<string, string | undefined> = process.env,
): RedisIdentityRepository {
  const url = environment.UPSTASH_REDIS_REST_URL;
  const token = environment.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Identity repository is unavailable");
  return new RedisIdentityRepository(new Redis({ url, token }));
}

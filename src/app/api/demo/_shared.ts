import { createHash } from "node:crypto";

import { DEMO_SESSION_COOKIE, DEMO_VISITOR_COOKIE, verifyDemoSessionCookie, verifyDemoVisitorCookie, type DemoSession } from "@/lib/demo-access/session";
import { createRedisDemoSafetyStore } from "@/lib/demo-access/store";
import { createLiveMarketProviders, getTickerFromProviders } from "@/lib/market-data/market-service";
import { OkxDemoClient, OkxDemoError } from "@/lib/okx-demo/client";
import type { DemoBalance, DemoCancelReceipt, DemoFill, DemoOrderReceipt, DemoOrderSnapshot } from "@/lib/okx-demo/contracts";
import { readOkxDemoConfig } from "@/lib/okx-demo/config";
import { DemoOrderServiceError, OkxDemoOrderService, type DemoActor } from "@/lib/okx-demo/order-service";
import type { TradableInstrument } from "@/lib/trading/pairs";
import { readWalletSessionId } from "@/server/auth/session-cookie";
import { anonymousOwnerId } from "@/server/identity/owner";
import { createRedisIdentityRepository, type IdentityRepository } from "@/server/identity/repository";

export type { DemoActor } from "@/lib/okx-demo/order-service";

export type DemoTradingService = {
  place(session: DemoActor, input: unknown, requestId: string, clientIpKey: string): Promise<DemoOrderReceipt>;
  listOrders(session: DemoActor): Promise<DemoOrderSnapshot[]>;
  listFills(session: DemoActor): Promise<DemoFill[]>;
  getSharedBalance(): Promise<DemoBalance>;
  cancelOwnedOrder(session: DemoActor, ordId: string): Promise<DemoCancelReceipt>;
};

export type DemoApiDependencies = {
  getActor(request: Request): Promise<DemoActor | null>;
  getService(): DemoTradingService;
  getReferencePrice(instrument: TradableInstrument): Promise<string>;
  hashClientIp(request: Request): string;
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export function createDefaultDemoApiDependencies(
  environment: Record<string, string | undefined> = process.env,
  options: { identityRepository?: IdentityRepository } = {},
): DemoApiDependencies {
  return {
    async getActor(request) {
      const secret = environment.SESSION_SECRET;
      if (!secret) return null;
      const header = request.headers.get("cookie");
      const session = verifyDemoSessionCookie(readCookie(header, DEMO_SESSION_COOKIE), secret);
      const visitor = verifyDemoVisitorCookie(readCookie(header, DEMO_VISITOR_COOKIE), secret);
      if (!session || !visitor || session.visitorId !== visitor.visitorId) return null;
      const sessionId = readWalletSessionId(header);
      if (!sessionId) return { ...session, ownerId: anonymousOwnerId(visitor.visitorId) };
      const identityRepository = options.identityRepository ?? createRedisIdentityRepository(environment);
      const walletSession = await identityRepository.getSession(sessionId);
      return {
        ...session,
        ownerId: walletSession?.visitorId === visitor.visitorId
          ? walletSession.ownerId
          : anonymousOwnerId(visitor.visitorId),
      };
    },
    getService() {
      const client = new OkxDemoClient(readOkxDemoConfig(environment));
      return new OkxDemoOrderService(client, createRedisDemoSafetyStore(environment));
    },
    async getReferencePrice(instrument) {
      const result = await getTickerFromProviders(instrument, createLiveMarketProviders());
      return String(result.data.last);
    },
    hashClientIp(request) {
      const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
      const address = forwarded || request.headers.get("x-real-ip") || "unknown";
      return createHash("sha256").update(address.slice(0, 128)).digest("hex");
    },
  };
}

export function noStoreJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function requireDemoActor(
  request: Request,
  dependencies: DemoApiDependencies,
): Promise<DemoActor | Response> {
  const actor = await dependencies.getActor(request);
  return actor ?? noStoreJson({ error: "Demo access is required", code: "unauthorized" }, 401);
}

export function requireSameOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  if (origin === new URL(request.url).origin) return null;
  return noStoreJson({ error: "Cross-origin Demo writes are not allowed", code: "forbidden" }, 403);
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value = await request.json() as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export function demoErrorResponse(error: unknown): Response {
  if (error instanceof DemoOrderServiceError) {
    const status = {
      invalid_order: 400,
      idempotency_conflict: 409,
      request_in_progress: 409,
      rate_limited: 429,
      global_demo_limit: 429,
      open_order_limit: 429,
      forbidden: 403,
      unknown_outcome: 409,
    }[error.category];
    return noStoreJson({ error: error.message, code: error.category }, status);
  }
  if (error instanceof OkxDemoError) {
    const status = error.category === "business_rejection" ? 422 : 502;
    return noStoreJson({ error: error.message, code: error.category }, status);
  }
  console.error("Unexpected Demo API failure", safeDiagnostic(error));
  return noStoreJson(
    { error: "OKX Demo trading is unavailable", code: "demo_unavailable" },
    503,
  );
}

function safeDiagnostic(error: unknown): { name: string; message: string } {
  if (!(error instanceof Error)) return { name: "UnknownError", message: "Non-Error value thrown" };
  return {
    name: error.name || "Error",
    message: error.message
      .replace(/(authorization:\s*bearer\s+)\S+/gi, "$1[redacted]")
      .replace(/(rediss?:\/\/[^:]+:)[^@]+@/gi, "$1[redacted]@")
      .slice(0, 500),
  };
}

function readCookie(header: string | null, name: string): string | undefined {
  return header
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

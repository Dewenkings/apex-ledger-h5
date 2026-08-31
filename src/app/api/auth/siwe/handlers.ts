import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { createPublicClient, http } from "viem";

import {
  createDemoVisitorCookie,
  DEMO_VISITOR_COOKIE,
  verifyDemoVisitorCookie,
  type DemoVisitor,
} from "@/lib/demo-access/session";
import { createRedisDemoSafetyStore } from "@/lib/demo-access/store";
import { SUPPORTED_CHAINS } from "@/lib/web3/chains";
import type { WalletSession } from "@/server/auth/contracts";
import {
  clearWalletSessionCookie,
  createWalletSessionCookie,
  readWalletSessionId,
} from "@/server/auth/session-cookie";
import { SiweAuthError, SiweAuthService } from "@/server/auth/siwe-service";
import { requireTrustedOrigin } from "@/server/http/origin";
import { createRedisIdentityRepository } from "@/server/identity/repository";

const NO_STORE = { "Cache-Control": "no-store" };
const VISITOR_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const challengeSchema = z.object({ address: z.string().min(1).max(128), chainId: z.number().int() });
const verifySchema = z.object({
  message: z.string().min(1).max(4096),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/).max(2048),
});

export type SiweHandlerService = Pick<SiweAuthService, "issueChallenge" | "verify" | "getSession" | "logout">;

type HandlerOptions = {
  service?: SiweHandlerService;
  environment?: Record<string, string | undefined>;
  now?: () => number;
  visitorId?: () => string;
};

export function createSiweHandlers(options: HandlerOptions = {}) {
  const environment = options.environment ?? process.env;
  const now = options.now ?? Date.now;
  const createVisitorId = options.visitorId ?? randomUUID;
  const secure = environment.NODE_ENV === "production";
  let service = options.service;
  const getService = () => {
    service ??= createDefaultService(environment);
    return service;
  };
  const canonicalOrigin = environment.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  return {
    async nonce(request: Request): Promise<Response> {
      const forbidden = requireTrustedOrigin(request, canonicalOrigin);
      if (forbidden) return forbidden;
      const visitorResult = ensureVisitor(request, environment.SESSION_SECRET, now(), createVisitorId);
      if (visitorResult instanceof Response) return visitorResult;
      const input = challengeSchema.safeParse(await readJson(request));
      if (!input.success) return errorJson("invalid_request", "Wallet login request is invalid", 400);
      try {
        const challenge = await getService().issueChallenge(input.data, {
          visitorId: visitorResult.visitor.visitorId,
          origin: canonicalOrigin ?? new URL(request.url).origin,
          rateScope: hashClientIp(request),
        });
        const headers = new Headers(NO_STORE);
        if (visitorResult.created) {
          headers.append("Set-Cookie", createDemoVisitorCookie(visitorResult.visitor, environment.SESSION_SECRET!, {
            secure,
            now: now(),
          }));
        }
        return Response.json(challenge, { headers });
      } catch (error) {
        return authErrorResponse(error);
      }
    },

    async verify(request: Request): Promise<Response> {
      const forbidden = requireTrustedOrigin(request, canonicalOrigin);
      if (forbidden) return forbidden;
      const visitor = getVisitor(request, environment.SESSION_SECRET, now());
      if (!visitor) return errorJson("invalid_request", "A visitor session is required", 401);
      const input = verifySchema.safeParse(await readJson(request));
      if (!input.success) return errorJson("invalid_request", "SIWE verification request is invalid", 400);
      try {
        const result = await getService().verify(input.data, {
          visitorId: visitor.visitorId,
          origin: canonicalOrigin ?? new URL(request.url).origin,
        });
        const headers = new Headers(NO_STORE);
        headers.append("Set-Cookie", createWalletSessionCookie(result.sessionId, secure));
        return Response.json({
          authenticated: true,
          address: result.address,
          chainId: result.chainId,
          expiresAt: result.expiresAt,
        }, { headers });
      } catch (error) {
        return authErrorResponse(error);
      }
    },

    async session(request: Request): Promise<Response> {
      const visitor = getVisitor(request, environment.SESSION_SECRET, now());
      const sessionId = readWalletSessionId(request.headers.get("cookie"));
      if (!visitor || !sessionId) return Response.json({ authenticated: false }, { headers: NO_STORE });
      try {
        const session = await getService().getSession(sessionId);
        return Response.json(toPublicSession(session, visitor.visitorId), { headers: NO_STORE });
      } catch {
        return errorJson("auth_unavailable", "Wallet session is temporarily unavailable", 503);
      }
    },

    async logout(request: Request): Promise<Response> {
      const forbidden = requireTrustedOrigin(request, canonicalOrigin);
      if (forbidden) return forbidden;
      const sessionId = readWalletSessionId(request.headers.get("cookie"));
      try {
        if (sessionId) await getService().logout(sessionId);
      } catch {
        return errorJson("auth_unavailable", "Wallet logout is temporarily unavailable", 503);
      }
      return Response.json({ authenticated: false }, {
        headers: { ...NO_STORE, "Set-Cookie": clearWalletSessionCookie(secure) },
      });
    },
  };
}

function createDefaultService(environment: Record<string, string | undefined>): SiweAuthService {
  const repository = createRedisIdentityRepository(environment);
  return new SiweAuthService({
    repository,
    workspace: createRedisDemoSafetyStore(environment),
    nonce: () => randomBytes(16).toString("hex"),
    sessionId: () => randomBytes(32).toString("base64url"),
    async verifyMessage(input) {
      const chain = SUPPORTED_CHAINS.find((item) => item.id === input.chainId);
      if (!chain) return false;
      const client = createPublicClient({ chain, transport: http() });
      return client.verifyMessage({ address: input.address, message: input.message, signature: input.signature });
    },
  });
}

function ensureVisitor(
  request: Request,
  secret: string | undefined,
  currentTime: number,
  createId: () => string,
): { visitor: DemoVisitor; created: boolean } | Response {
  if (!secret) return errorJson("auth_unavailable", "Wallet login is not configured", 503);
  const existing = getVisitor(request, secret, currentTime);
  if (existing) return { visitor: existing, created: false };
  return { visitor: { visitorId: createId(), expiresAt: currentTime + VISITOR_TTL_MS }, created: true };
}

function getVisitor(request: Request, secret: string | undefined, currentTime: number): DemoVisitor | null {
  if (!secret) return null;
  return verifyDemoVisitorCookie(readCookie(request.headers.get("cookie"), DEMO_VISITOR_COOKIE), secret, currentTime);
}

function toPublicSession(session: WalletSession | null, visitorId: string) {
  if (!session || session.visitorId !== visitorId) return { authenticated: false } as const;
  return {
    authenticated: true as const,
    address: session.address,
    chainId: session.chainId,
    expiresAt: session.expiresAt,
  };
}

function authErrorResponse(error: unknown): Response {
  if (error instanceof SiweAuthError) {
    const status = {
      invalid_request: 400,
      unsupported_chain: 400,
      nonce_expired: 401,
      signature_invalid: 401,
      rate_limited: 429,
      auth_unavailable: 503,
    }[error.code];
    return errorJson(error.code, error.message, status);
  }
  console.error("Unexpected SIWE failure", error instanceof Error ? { name: error.name, message: error.message.slice(0, 200) } : { name: "UnknownError" });
  return errorJson("auth_unavailable", "Wallet login is temporarily unavailable", 503);
}

function errorJson(code: string, error: string, status: number): Response {
  return Response.json({ error, code }, { status, headers: NO_STORE });
}

async function readJson(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { return null; }
}

function readCookie(header: string | null, name: string): string | undefined {
  return header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

function hashClientIp(request: Request): string {
  const value = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
  return createHash("sha256").update(value.slice(0, 128)).digest("hex");
}

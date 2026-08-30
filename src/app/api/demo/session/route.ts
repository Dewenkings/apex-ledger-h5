import { randomUUID } from "node:crypto";

import {
  clearDemoSessionCookie,
  createDemoSessionCookie,
  DEMO_SESSION_COOKIE,
  matchesAccessCode,
  verifyDemoSessionCookie,
} from "@/lib/demo-access/session";

type SessionHandlerOptions = {
  environment?: Record<string, string | undefined>;
  now?: () => number;
  sessionId?: () => string;
};

const SESSION_DURATION_MS = 4 * 60 * 60 * 1000;
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export function createSessionHandlers(options: SessionHandlerOptions = {}) {
  const environment = options.environment ?? process.env;
  const now = options.now ?? Date.now;
  const sessionId = options.sessionId ?? randomUUID;
  const secure = environment.NODE_ENV === "production";

  return {
    async POST(request: Request): Promise<Response> {
      const expectedCode = environment.DEMO_ACCESS_CODE;
      const sessionSecret = environment.SESSION_SECRET;
      if (!expectedCode || !sessionSecret) {
        return Response.json(
          { error: "OKX Demo access is not configured" },
          { status: 503, headers: NO_STORE_HEADERS },
        );
      }

      const accessCode = await readAccessCode(request);
      if (!accessCode || !matchesAccessCode(accessCode, expectedCode)) {
        return Response.json(
          { error: "Demo access was not authorized" },
          { status: 401, headers: NO_STORE_HEADERS },
        );
      }

      const createdAt = now();
      const session = { sessionId: sessionId(), expiresAt: createdAt + SESSION_DURATION_MS };
      const cookie = createDemoSessionCookie(session, sessionSecret, { secure, now: createdAt });
      return Response.json(
        { authenticated: true, expiresAt: session.expiresAt },
        { headers: { ...NO_STORE_HEADERS, "Set-Cookie": cookie } },
      );
    },

    async GET(request: Request): Promise<Response> {
      const sessionSecret = environment.SESSION_SECRET;
      const value = readCookie(request.headers.get("cookie"), DEMO_SESSION_COOKIE);
      const session = sessionSecret ? verifyDemoSessionCookie(value, sessionSecret, now()) : null;
      return Response.json(
        session
          ? { authenticated: true, expiresAt: session.expiresAt }
          : { authenticated: false },
        { headers: NO_STORE_HEADERS },
      );
    },

    async DELETE(): Promise<Response> {
      return Response.json(
        { authenticated: false },
        {
          headers: {
            ...NO_STORE_HEADERS,
            "Set-Cookie": clearDemoSessionCookie(secure),
          },
        },
      );
    },
  };
}

async function readAccessCode(request: Request): Promise<string | null> {
  try {
    const body = await request.json() as unknown;
    if (!body || typeof body !== "object") return null;
    const accessCode = (body as Record<string, unknown>).accessCode;
    return typeof accessCode === "string" ? accessCode : null;
  } catch {
    return null;
  }
}

function readCookie(header: string | null, name: string): string | undefined {
  return header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

const handlers = createSessionHandlers();
export const POST = handlers.POST;
export const GET = handlers.GET;
export const DELETE = handlers.DELETE;

import { randomUUID } from "node:crypto";
import { clearDemoSessionCookie, createDemoSessionCookie, createDemoVisitorCookie, DEMO_SESSION_COOKIE, DEMO_VISITOR_COOKIE, matchesAccessCode, verifyDemoSessionCookie, verifyDemoVisitorCookie } from "@/lib/demo-access/session";

type SessionHandlerOptions = { environment?: Record<string, string | undefined>; now?: () => number; sessionId?: () => string; visitorId?: () => string };
const SESSION_DURATION_MS = 4 * 60 * 60 * 1000;
const VISITOR_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export function createSessionHandlers(options: SessionHandlerOptions = {}) {
  const environment = options.environment ?? process.env;
  const now = options.now ?? Date.now;
  const sessionId = options.sessionId ?? randomUUID;
  const visitorId = options.visitorId ?? randomUUID;
  const secure = environment.NODE_ENV === "production";
  return {
    async POST(request: Request) {
      const expectedCode = environment.DEMO_ACCESS_CODE; const secret = environment.SESSION_SECRET;
      if (!expectedCode || !secret) return Response.json({ error: "OKX Demo access is not configured" }, { status: 503, headers: NO_STORE_HEADERS });
      const accessCode = await readAccessCode(request);
      if (!accessCode || !matchesAccessCode(accessCode, expectedCode)) return Response.json({ error: "Demo access was not authorized" }, { status: 401, headers: NO_STORE_HEADERS });
      const createdAt = now();
      const existingVisitor = verifyDemoVisitorCookie(readCookie(request.headers.get("cookie"), DEMO_VISITOR_COOKIE), secret, createdAt);
      const visitor = existingVisitor ?? { visitorId: visitorId(), expiresAt: createdAt + VISITOR_DURATION_MS };
      const session = { sessionId: sessionId(), visitorId: visitor.visitorId, expiresAt: createdAt + SESSION_DURATION_MS };
      const headers = new Headers(NO_STORE_HEADERS);
      headers.append("Set-Cookie", createDemoSessionCookie(session, secret, { secure, now: createdAt }));
      headers.append("Set-Cookie", createDemoVisitorCookie(visitor, secret, { secure, now: createdAt }));
      return Response.json({ authenticated: true, expiresAt: session.expiresAt }, { headers });
    },
    async GET(request: Request) {
      const secret = environment.SESSION_SECRET;
      const currentTime = now();
      const header = request.headers.get("cookie");
      const session = secret ? verifyDemoSessionCookie(readCookie(header, DEMO_SESSION_COOKIE), secret, currentTime) : null;
      const visitor = secret ? verifyDemoVisitorCookie(readCookie(header, DEMO_VISITOR_COOKIE), secret, currentTime) : null;
      const authenticated = session && visitor && session.visitorId === visitor.visitorId ? session : null;
      return Response.json(authenticated ? { authenticated: true, expiresAt: authenticated.expiresAt } : { authenticated: false }, { headers: NO_STORE_HEADERS });
    },
    async DELETE() { return Response.json({ authenticated: false }, { headers: { ...NO_STORE_HEADERS, "Set-Cookie": clearDemoSessionCookie(secure) } }); },
  };
}

async function readAccessCode(request: Request) { try { const body = await request.json() as unknown; if (!body || typeof body !== "object") return null; const value = (body as Record<string, unknown>).accessCode; return typeof value === "string" ? value : null; } catch { return null; } }
function readCookie(header: string | null, name: string) { return header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1); }

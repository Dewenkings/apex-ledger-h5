import { createHmac, timingSafeEqual } from "node:crypto";

export const DEMO_SESSION_COOKIE = "apx_demo_session";
export const DEMO_VISITOR_COOKIE = "apx_visitor";

export type DemoSession = {
  sessionId: string;
  visitorId: string;
  expiresAt: number;
};

export type DemoVisitor = {
  visitorId: string;
  expiresAt: number;
};

type SignedCookieOptions = { secure: boolean; now?: number };

export function createDemoSessionCookie(
  session: DemoSession,
  secret: string,
  options: SignedCookieOptions,
): string {
  return createSignedCookie(DEMO_SESSION_COOKIE, session, secret, options);
}

export function createDemoVisitorCookie(
  visitor: DemoVisitor,
  secret: string,
  options: SignedCookieOptions,
): string {
  return createSignedCookie(DEMO_VISITOR_COOKIE, visitor, secret, options);
}

export function clearDemoSessionCookie(secure: boolean): string {
  return serializeCookie(DEMO_SESSION_COOKIE, "", 0, secure);
}

export function verifyDemoSessionCookie(
  value: string | undefined,
  secret: string,
  now = Date.now(),
): DemoSession | null {
  const parsed = verifySignedCookie(value, secret);
  if (!parsed || typeof parsed !== "object") return null;
  const candidate = parsed as Partial<DemoSession>;
  if (typeof candidate.sessionId !== "string" || candidate.sessionId.length < 8) return null;
  if (typeof candidate.visitorId !== "string" || candidate.visitorId.length < 8) return null;
  if (!Number.isSafeInteger(candidate.expiresAt) || Number(candidate.expiresAt) <= now) return null;
  return {
    sessionId: candidate.sessionId,
    visitorId: candidate.visitorId,
    expiresAt: Number(candidate.expiresAt),
  };
}

export function verifyDemoVisitorCookie(
  value: string | undefined,
  secret: string,
  now = Date.now(),
): DemoVisitor | null {
  const parsed = verifySignedCookie(value, secret);
  if (!parsed || typeof parsed !== "object") return null;
  const candidate = parsed as Partial<DemoVisitor>;
  if (typeof candidate.visitorId !== "string" || candidate.visitorId.length < 8) return null;
  if (!Number.isSafeInteger(candidate.expiresAt) || Number(candidate.expiresAt) <= now) return null;
  return { visitorId: candidate.visitorId, expiresAt: Number(candidate.expiresAt) };
}

export function matchesAccessCode(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const providedHash = createHmac("sha256", "apex-demo-access").update(provided).digest();
  const expectedHash = createHmac("sha256", "apex-demo-access").update(expected).digest();
  return timingSafeEqual(providedHash, expectedHash);
}

function createSignedCookie(
  name: string,
  value: { expiresAt: number },
  secret: string,
  options: SignedCookieOptions,
): string {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = sign(payload, secret);
  const now = options.now ?? Date.now();
  const maxAge = Math.max(0, Math.floor((value.expiresAt - now) / 1000));
  return serializeCookie(name, `${payload}.${signature}`, maxAge, options.secure);
}

function verifySignedCookie(value: string | undefined, secret: string): unknown | null {
  if (!value || !secret) return null;
  const [payload, providedSignature, extra] = value.split(".");
  if (!payload || !providedSignature || extra) return null;
  const expectedSignature = sign(payload, secret);
  if (!safeEqual(providedSignature, expectedSignature)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
  } catch {
    return null;
  }
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function serializeCookie(name: string, value: string, maxAge: number, secure: boolean): string {
  return [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    `Max-Age=${maxAge}`,
  ].filter(Boolean).join("; ");
}

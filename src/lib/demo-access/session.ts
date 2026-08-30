import { createHmac, timingSafeEqual } from "node:crypto";

export const DEMO_SESSION_COOKIE = "apx_demo_session";

export type DemoSession = {
  sessionId: string;
  expiresAt: number;
};

export function createDemoSessionCookie(
  session: DemoSession,
  secret: string,
  options: { secure: boolean; now?: number },
): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = sign(payload, secret);
  const now = options.now ?? Date.now();
  const maxAge = Math.max(0, Math.floor((session.expiresAt - now) / 1000));
  return serializeCookie(`${payload}.${signature}`, maxAge, options.secure);
}

export function clearDemoSessionCookie(secure: boolean): string {
  return serializeCookie("", 0, secure);
}

export function verifyDemoSessionCookie(
  value: string | undefined,
  secret: string,
  now = Date.now(),
): DemoSession | null {
  if (!value || !secret) return null;
  const [payload, providedSignature, extra] = value.split(".");
  if (!payload || !providedSignature || extra) return null;
  const expectedSignature = sign(payload, secret);
  if (!safeEqual(providedSignature, expectedSignature)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Partial<DemoSession>;
    if (typeof candidate.sessionId !== "string" || candidate.sessionId.length < 8) return null;
    if (!Number.isSafeInteger(candidate.expiresAt) || Number(candidate.expiresAt) <= now) return null;
    return { sessionId: candidate.sessionId, expiresAt: Number(candidate.expiresAt) };
  } catch {
    return null;
  }
}

export function matchesAccessCode(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const providedHash = createHmac("sha256", "apex-demo-access").update(provided).digest();
  const expectedHash = createHmac("sha256", "apex-demo-access").update(expected).digest();
  return timingSafeEqual(providedHash, expectedHash);
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function serializeCookie(value: string, maxAge: number, secure: boolean): string {
  return [
    `${DEMO_SESSION_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    `Max-Age=${maxAge}`,
  ].filter(Boolean).join("; ");
}

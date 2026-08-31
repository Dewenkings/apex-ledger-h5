export const WALLET_SESSION_COOKIE = "apx_wallet_session";
const WALLET_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export function createWalletSessionCookie(sessionId: string, secure: boolean): string {
  if (!SESSION_ID_PATTERN.test(sessionId)) throw new Error("Invalid wallet session id");
  return serializeWalletCookie(sessionId, WALLET_SESSION_MAX_AGE_SECONDS, secure);
}

export function clearWalletSessionCookie(secure: boolean): string {
  return serializeWalletCookie("", 0, secure);
}

export function readWalletSessionId(cookieHeader: string | null | undefined): string | undefined {
  const value = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${WALLET_SESSION_COOKIE}=`))
    ?.slice(WALLET_SESSION_COOKIE.length + 1);
  return value && SESSION_ID_PATTERN.test(value) ? value : undefined;
}

function serializeWalletCookie(value: string, maxAge: number, secure: boolean): string {
  return [
    `${WALLET_SESSION_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    `Max-Age=${maxAge}`,
  ].filter(Boolean).join("; ");
}

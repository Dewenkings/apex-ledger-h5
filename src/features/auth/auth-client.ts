import type { Address } from "viem";

export type SiweChallenge = {
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  statement: string;
};

export type PublicSiweSession =
  | { authenticated: false }
  | { authenticated: true; address: Address; chainId: number; expiresAt: number };

export class AuthClientError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "AuthClientError";
  }
}

export function getChallenge(address: Address, chainId: number): Promise<SiweChallenge> {
  return requestJson<SiweChallenge>("/api/auth/siwe/nonce", {
    method: "POST",
    body: JSON.stringify({ address, chainId }),
  });
}

export function verifySiwe(message: string, signature: string): Promise<PublicSiweSession> {
  return requestJson<PublicSiweSession>("/api/auth/siwe/verify", {
    method: "POST",
    body: JSON.stringify({ message, signature }),
  });
}

export function getSiweSession(): Promise<PublicSiweSession> {
  return requestJson<PublicSiweSession>("/api/auth/siwe/session", { method: "GET" });
}

export function logoutSiwe(): Promise<PublicSiweSession> {
  return requestJson<PublicSiweSession>("/api/auth/siwe/session", { method: "DELETE" });
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new AuthClientError("network_error", "无法连接钱包登录服务，请检查网络后重试");
  }
  const body = await response.json().catch(() => null) as { code?: string; error?: string } | null;
  if (!response.ok) {
    throw new AuthClientError(body?.code ?? "auth_error", body?.error ?? "钱包登录暂时不可用");
  }
  return body as T;
}

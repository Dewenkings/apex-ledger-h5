"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { SiweMessage } from "siwe";
import { useAccount, useSignMessage } from "wagmi";

import { isSupportedChainId } from "@/lib/web3/chains";
import {
  AuthClientError,
  getChallenge,
  getSiweSession,
  logoutSiwe,
  verifySiwe,
  type PublicSiweSession,
} from "./auth-client";

const SESSION_QUERY_KEY = ["wallet", "siwe-session"] as const;

export type SiweUiStatus = "disconnected" | "connected" | "signing" | "authenticated" | "error";

export function useSiweSession() {
  const account = useAccount();
  const { signMessageAsync } = useSignMessage();
  const queryClient = useQueryClient();
  const [operation, setOperation] = useState<"idle" | "signing">("idle");
  const [error, setError] = useState<string | null>(null);
  const sessionQuery = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: getSiweSession,
    staleTime: 30_000,
    retry: false,
  });

  const session = sessionQuery.data;
  const authenticated = account.isConnected
    && session?.authenticated === true
    && session.address.toLowerCase() === account.address?.toLowerCase();
  const unsupportedNetwork = account.isConnected
    && typeof account.chainId === "number"
    && !isSupportedChainId(account.chainId);

  const status = useMemo<SiweUiStatus>(() => {
    if (!account.isConnected) return "disconnected";
    if (operation === "signing") return "signing";
    if (error) return "error";
    if (authenticated) return "authenticated";
    return "connected";
  }, [account.isConnected, authenticated, error, operation]);

  const signIn = useCallback(async () => {
    if (!account.isConnected || !account.address || typeof account.chainId !== "number") return;
    if (!isSupportedChainId(account.chainId)) {
      setError("请切换至 Ethereum、Base、Arbitrum 或 BNB Smart Chain 网络");
      return;
    }
    setOperation("signing");
    setError(null);
    try {
      let verified: PublicSiweSession | undefined;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const challenge = await getChallenge(account.address, account.chainId);
        const origin = window.location.origin;
        const message = new SiweMessage({
          domain: window.location.host,
          address: account.address,
          statement: challenge.statement,
          uri: origin,
          version: "1",
          chainId: account.chainId,
          nonce: challenge.nonce,
          issuedAt: challenge.issuedAt,
          expirationTime: challenge.expirationTime,
        }).prepareMessage();
        const signature = await signMessageAsync({ message });
        try {
          verified = await verifySiwe(message, signature);
          break;
        } catch (verifyError) {
          if (!(verifyError instanceof AuthClientError) || verifyError.code !== "nonce_expired" || attempt > 0) throw verifyError;
        }
      }
      if (!verified?.authenticated) throw new AuthClientError("signature_invalid", "钱包身份验证失败");
      queryClient.setQueryData(SESSION_QUERY_KEY, verified);
    } catch (signInError) {
      setError(toFriendlyError(signInError));
    } finally {
      setOperation("idle");
    }
  }, [account.address, account.chainId, account.isConnected, queryClient, signMessageAsync]);

  const logout = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      const nextSession = await logoutSiwe();
      queryClient.setQueryData(SESSION_QUERY_KEY, nextSession);
      return true;
    } catch (logoutError) {
      setError(toFriendlyError(logoutError));
      return false;
    }
  }, [queryClient]);

  return {
    status,
    address: account.address,
    chainId: account.chainId,
    error: error ?? (sessionQuery.error ? "无法读取钱包登录状态，请稍后重试" : null),
    unsupportedNetwork,
    sessionLoading: sessionQuery.isLoading,
    signIn,
    logout,
  };
}

function toFriendlyError(error: unknown): string {
  if (error instanceof AuthClientError) {
    if (error.code === "unsupported_chain") return "请切换至 Ethereum、Base、Arbitrum 或 BNB Smart Chain 网络";
    if (error.code === "rate_limited") return "登录尝试过于频繁，请稍后再试";
    return error.message;
  }
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("reject") || message.includes("denied") || message.includes("cancel")) {
    return "你已取消签名，钱包没有执行任何交易";
  }
  return "钱包签名未完成，请重试";
}

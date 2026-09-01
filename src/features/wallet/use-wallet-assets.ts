"use client";

import { erc20Abi, formatUnits, type Address } from "viem";
import { useBalance, useReadContracts } from "wagmi";

import { SUPPORTED_CHAINS, isSupportedChainId } from "@/lib/web3/chains";
import { getTrackedTokens } from "@/lib/web3/tokens";

export type WalletAsset = {
  source: "onchain";
  chainId: number;
  symbol: string;
  balance: string;
  decimals: number;
  usdValue: string | null;
  updatedAt: number;
};

export type WalletAssetsState = "loading" | "ready" | "stale" | "error" | "unsupported";

export function useWalletAssets(address: Address | undefined, chainId: number | undefined): {
  state: WalletAssetsState;
  assets: WalletAsset[];
} {
  const supported = typeof chainId === "number" && isSupportedChainId(chainId);
  const tokens = supported ? getTrackedTokens(chainId) : [];
  const nativeBalance = useBalance({
    address,
    chainId: supported ? chainId : undefined,
    query: { enabled: Boolean(address && supported) },
  });
  const tokenBalances = useReadContracts({
    chainId: supported ? chainId : undefined,
    allowFailure: true,
    contracts: tokens.map((token) => ({
      address: token.address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: address ? [address] : undefined,
    })),
    query: { enabled: Boolean(address && supported && tokens.length) },
  });

  if (!address) return { state: "ready", assets: [] };
  if (!supported) return { state: "unsupported", assets: [] };
  const loading = nativeBalance.isLoading || (tokens.length > 0 && tokenBalances.isLoading);
  if (loading && !nativeBalance.data && !tokenBalances.data) return { state: "loading", assets: [] };

  const updatedAt = Math.max(nativeBalance.dataUpdatedAt, tokenBalances.dataUpdatedAt);
  const assets: WalletAsset[] = [];
  if (nativeBalance.data) {
    assets.push({
      source: "onchain",
      chainId,
      symbol: nativeBalance.data.symbol,
      balance: formatUnits(nativeBalance.data.value, nativeBalance.data.decimals),
      decimals: nativeBalance.data.decimals,
      usdValue: null,
      updatedAt,
    });
  }
  const results = tokenBalances.data as readonly { status: "success" | "failure"; result?: unknown }[] | undefined;
  tokens.forEach((token, index) => {
    const result = results?.[index];
    if (result?.status !== "success" || typeof result.result !== "bigint") return;
    assets.push({
      source: "onchain",
      chainId,
      symbol: token.symbol,
      balance: formatUnits(result.result, token.decimals),
      decimals: token.decimals,
      usdValue: null,
      updatedAt,
    });
  });

  if ((nativeBalance.isError || tokenBalances.isError) && assets.length === 0) return { state: "error", assets };
  if (nativeBalance.isFetching || tokenBalances.isFetching || nativeBalance.isError || tokenBalances.isError) {
    return { state: "stale", assets };
  }
  return { state: "ready", assets };
}

export function getWalletChainName(chainId: number | undefined): string {
  return SUPPORTED_CHAINS.find((chain) => chain.id === chainId)?.name ?? "Unsupported network";
}

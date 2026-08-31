import type { Address } from "viem";

import type { SupportedChainId } from "./chains";

export type TrackedToken = Readonly<{
  chainId: SupportedChainId;
  address: Address;
  symbol: "USDC" | "USDT";
  decimals: 6;
}>;

export const TOKENS_BY_CHAIN: Readonly<Record<SupportedChainId, readonly TrackedToken[]>> = {
  1: [
    { chainId: 1, address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6 },
    { chainId: 1, address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", decimals: 6 },
  ],
  8453: [
    { chainId: 8453, address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 },
  ],
  42161: [
    { chainId: 42161, address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", decimals: 6 },
  ],
};

export function getTrackedTokens(chainId: number): readonly TrackedToken[] {
  return TOKENS_BY_CHAIN[chainId as SupportedChainId] ?? [];
}

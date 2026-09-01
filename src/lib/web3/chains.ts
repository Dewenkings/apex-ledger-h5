import { arbitrum, base, bsc, mainnet } from "viem/chains";

export const SUPPORTED_CHAINS = [mainnet, base, arbitrum, bsc] as const;
export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number]["id"];

const SUPPORTED_CHAIN_IDS = new Set<number>(SUPPORTED_CHAINS.map((chain) => chain.id));

export function isSupportedChainId(value: number): value is SupportedChainId {
  return SUPPORTED_CHAIN_IDS.has(value);
}

export function readReownProjectId(
  environment: Record<string, string | undefined> = process.env,
): string {
  const projectId = environment.NEXT_PUBLIC_REOWN_PROJECT_ID?.trim();
  if (!projectId) throw new Error("NEXT_PUBLIC_REOWN_PROJECT_ID is required");
  return projectId;
}

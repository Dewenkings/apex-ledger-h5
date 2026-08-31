import type { Address } from "viem";

import type { SupportedChainId } from "@/lib/web3/chains";
import type { OwnerId } from "@/server/identity/owner";

export type SiweNonceRecord = {
  nonce: string;
  visitorId: string;
  address: Address;
  chainId: SupportedChainId;
  domain: string;
  uri: string;
  issuedAt: string;
  expirationTime: string;
};

export type WalletSession = {
  sessionId: string;
  visitorId: string;
  ownerId: OwnerId;
  address: Address;
  chainId: SupportedChainId;
  expiresAt: number;
};

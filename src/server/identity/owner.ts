import { getAddress, type Address } from "viem";

export type AnonymousOwnerId = `visitor:${string}`;
export type WalletOwnerId = `eip155:account:${Address}`;
export type OwnerId = AnonymousOwnerId | WalletOwnerId;

export function anonymousOwnerId(visitorId: string): AnonymousOwnerId {
  return `visitor:${visitorId}`;
}

export function walletOwnerId(address: string): WalletOwnerId {
  return `eip155:account:${getAddress(address)}`;
}

export function snapshotOwnerId(snapshot: { ownerId?: OwnerId; visitorId: string }): OwnerId {
  return snapshot.ownerId ?? anonymousOwnerId(snapshot.visitorId);
}

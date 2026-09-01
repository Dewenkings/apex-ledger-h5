import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  balance: {} as Record<string, unknown>,
  contracts: {} as Record<string, unknown>,
  useBalance: vi.fn(),
  useReadContracts: vi.fn(),
}));

vi.mock("wagmi", () => ({
  useBalance: mocks.useBalance,
  useReadContracts: mocks.useReadContracts,
}));

import { useWalletAssets } from "./use-wallet-assets";

describe("useWalletAssets", () => {
  beforeEach(() => {
    mocks.balance = {
      data: { value: BigInt("1250000000000000000"), symbol: "ETH", decimals: 18 },
      isLoading: false,
      isFetching: false,
      isError: false,
      dataUpdatedAt: 100,
    };
    mocks.contracts = {
      data: [{ status: "success", result: BigInt("2500000") }],
      isLoading: false,
      isFetching: false,
      isError: false,
      dataUpdatedAt: 200,
    };
    mocks.useBalance.mockImplementation(() => mocks.balance);
    mocks.useReadContracts.mockImplementation(() => mocks.contracts);
  });

  it("maps native and allowlisted token balances without estimating USD", () => {
    const { result } = renderHook(() => useWalletAssets("0x0000000000000000000000000000000000000001", 8453));
    expect(result.current.state).toBe("ready");
    expect(result.current.assets).toEqual([
      expect.objectContaining({ source: "onchain", chainId: 8453, symbol: "ETH", balance: "1.25", usdValue: null }),
      expect.objectContaining({ source: "onchain", chainId: 8453, symbol: "USDC", balance: "2.5", usdValue: null }),
    ]);
  });

  it("reports a stale state while refreshing previously loaded balances", () => {
    mocks.balance.isFetching = true;
    const { result } = renderHook(() => useWalletAssets("0x0000000000000000000000000000000000000001", 1));
    expect(result.current.state).toBe("stale");
    expect(result.current.assets).toHaveLength(2);
  });

  it("isolates RPC failures as a wallet-only error state", () => {
    mocks.balance = { data: undefined, isLoading: false, isFetching: false, isError: true, dataUpdatedAt: 0 };
    mocks.contracts = { data: undefined, isLoading: false, isFetching: false, isError: true, dataUpdatedAt: 0 };
    const { result } = renderHook(() => useWalletAssets("0x0000000000000000000000000000000000000001", 1));
    expect(result.current.state).toBe("error");
    expect(result.current.assets).toEqual([]);
  });

  it("does not describe an unsupported network as a synced zero balance", () => {
    const { result } = renderHook(() => useWalletAssets("0x0000000000000000000000000000000000000001", 137));
    expect(result.current.state).toBe("unsupported");
    expect(result.current.assets).toEqual([]);
  });
});

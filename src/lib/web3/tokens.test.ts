import { describe, expect, it } from "vitest";

import { getTrackedTokens } from "./tokens";

describe("tracked wallet tokens", () => {
  it("uses the issuer-verified stablecoin allowlist", () => {
    expect(getTrackedTokens(1).map((token) => token.symbol)).toEqual(["USDC", "USDT"]);
    expect(getTrackedTokens(8453)[0]?.address).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(getTrackedTokens(42161)[0]?.address).toBe("0xaf88d065e77c8cC2239327C5EDb3A432268e5831");
    expect(getTrackedTokens(56)).toEqual([
      {
        chainId: 56,
        address: "0x55d398326f99059fF775485246999027B3197955",
        symbol: "USDT",
        decimals: 18,
      },
    ]);
  });

  it("returns no contracts for an unsupported chain", () => {
    expect(getTrackedTokens(10)).toEqual([]);
  });
});

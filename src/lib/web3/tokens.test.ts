import { describe, expect, it } from "vitest";

import { getTrackedTokens } from "./tokens";

describe("tracked wallet tokens", () => {
  it("uses the issuer-verified stablecoin allowlist", () => {
    expect(getTrackedTokens(1).map((token) => token.symbol)).toEqual(["USDC", "USDT"]);
    expect(getTrackedTokens(8453)[0]?.address).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(getTrackedTokens(42161)[0]?.address).toBe("0xaf88d065e77c8cC2239327C5EDb3A432268e5831");
  });

  it("returns no contracts for an unsupported chain", () => {
    expect(getTrackedTokens(10)).toEqual([]);
  });
});

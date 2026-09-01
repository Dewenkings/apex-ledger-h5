import { describe, expect, it } from "vitest";

import { isSupportedChainId, readReownProjectId, SUPPORTED_CHAINS } from "./chains";

describe("wallet chain configuration", () => {
  it("allows the four EVM networks in the product scope", () => {
    expect(SUPPORTED_CHAINS.map((chain) => chain.id)).toEqual([1, 8453, 42161, 56]);
    expect(isSupportedChainId(8453)).toBe(true);
    expect(isSupportedChainId(56)).toBe(true);
    expect(isSupportedChainId(10)).toBe(false);
  });

  it("requires a Reown public project id", () => {
    expect(() => readReownProjectId({})).toThrow("NEXT_PUBLIC_REOWN_PROJECT_ID is required");
    expect(readReownProjectId({ NEXT_PUBLIC_REOWN_PROJECT_ID: " project-id " })).toBe("project-id");
  });
});

import { describe, expect, it } from "vitest";

import { formatEquity, formatTokenBalance, isNonZeroBalance } from "./asset-format";

describe("portfolio asset formatting", () => {
  it("keeps large decimal equity exact without IEEE-754 conversion", () => {
    expect(formatEquity("9007199254740993.12")).toBe("9,007,199,254,740,993.12");
  });

  it("distinguishes a tiny non-zero token balance from zero", () => {
    expect(isNonZeroBalance("0.0000001")).toBe(true);
    expect(formatTokenBalance("0.0000001")).toBe("<0.000001");
    expect(isNonZeroBalance("0.0000000")).toBe(false);
  });

  it("trims insignificant trailing zeroes from ordinary token balances", () => {
    expect(formatTokenBalance("1.25000000")).toBe("1.25");
  });
});

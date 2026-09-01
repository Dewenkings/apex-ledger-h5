import { describe, expect, it } from "vitest";

import { formatSpotPrice } from "./market-format";

describe("spot market formatting", () => {
  it("preserves small prices using the exchange tick size", () => {
    expect(formatSpotPrice("0.00001234", "0.00000001", "USDT")).toBe("0.00001234 USDT");
  });

  it("groups large values without changing the exchange precision", () => {
    expect(formatSpotPrice("69000", "0.1", "USDT")).toBe("69,000.0 USDT");
  });
});

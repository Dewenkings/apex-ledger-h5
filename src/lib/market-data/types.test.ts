import { describe, expect, it } from "vitest";

import { markets } from "@/lib/data";
import { marketSymbols, toMarketInstrument } from "./types";

describe("multi-asset market contracts", () => {
  it("defines the eight supported assets in product order", () => {
    expect(marketSymbols).toEqual(["BTC", "ETH", "SOL", "BNB", "ADA", "AVAX", "DOT", "POL"]);
    expect(markets.map(({ symbol }) => symbol)).toEqual(marketSymbols);
  });

  it("maps a supported symbol to its USDT spot instrument", () => {
    expect(toMarketInstrument("POL")).toBe("POL-USDT");
  });
});

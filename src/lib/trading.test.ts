import { describe, expect, it } from "vitest";
import { estimatePaperOrder, filterMarkets, getActiveNav } from "./trading";

describe("market helpers", () => {
  it("filters by symbol and asset name without case sensitivity", () => {
    const markets = [
      { symbol: "BTC", name: "Bitcoin" },
      { symbol: "ETH", name: "Ethereum" },
    ];
    expect(filterMarkets(markets, "eth")).toEqual([{ symbol: "ETH", name: "Ethereum" }]);
    expect(filterMarkets(markets, "BIT")).toEqual([{ symbol: "BTC", name: "Bitcoin" }]);
  });

  it("estimates a paper order without introducing real-chain fees", () => {
    expect(estimatePaperOrder({ amount: 0.025, price: 68342.1, feeRate: 0.001 })).toEqual({
      subtotal: 1708.55,
      fee: 1.71,
      total: 1710.26,
    });
  });

  it("maps nested routes to the correct primary navigation item", () => {
    expect(getActiveNav("/trade/btc-usdt/confirm")).toBe("trade");
    expect(getActiveNav("/portfolio/btc")).toBe("portfolio");
    expect(getActiveNav("/orders")).toBe("orders");
  });
});

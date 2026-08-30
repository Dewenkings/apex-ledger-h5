import { describe, expect, it } from "vitest";

import {
  formatPairAmount,
  getPairBySlug,
  getPairBySymbol,
  parseTradableInstrument,
  tradingPairs,
} from "./pairs";

describe("tradable pair contract", () => {
  it("maps the three supported route slugs to exact OKX instruments", () => {
    expect(tradingPairs.map(({ instrument }) => instrument)).toEqual([
      "BTC-USDT",
      "ETH-USDT",
      "SOL-USDT",
    ]);
    expect(getPairBySlug("eth-usdt")).toMatchObject({
      instrument: "ETH-USDT",
      baseSymbol: "ETH",
      quoteSymbol: "USDT",
      pairSlug: "eth-usdt",
    });
    expect(getPairBySymbol("SOL")?.instrument).toBe("SOL-USDT");
  });

  it("rejects unsupported and incorrectly cased instruments at the trust boundary", () => {
    expect(parseTradableInstrument("BTC-USDT")).toBe("BTC-USDT");
    expect(parseTradableInstrument("DOGE-USDT")).toBeNull();
    expect(parseTradableInstrument("eth-usdt")).toBeNull();
    expect(parseTradableInstrument(null)).toBeNull();
    expect(getPairBySlug("doge-usdt")).toBeNull();
  });

  it("formats base amounts without inventing more precision", () => {
    const bitcoin = getPairBySlug("btc-usdt");
    const solana = getPairBySlug("sol-usdt");

    expect(bitcoin && formatPairAmount(bitcoin, "0.02500000")).toBe("0.025");
    expect(solana && formatPairAmount(solana, "1.2345678")).toBe("1.234567");
    expect(solana && formatPairAmount(solana, "2")).toBe("2");
  });
});

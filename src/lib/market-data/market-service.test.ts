// @vitest-environment node

import { describe, expect, it } from "vitest";

import { getCandlesFromProviders, getTickerFromProviders } from "./market-service";
import type { MarketCandle, MarketTicker } from "./types";

const ticker: MarketTicker = {
  instrument: "BTC-USDT",
  last: 70000,
  open24h: 68000,
  high24h: 71000,
  low24h: 67000,
  volume24h: 19000,
  timestamp: 1788048000000,
};

const candles: MarketCandle[] = [
  { time: 1788044400, open: 68000, high: 69000, low: 67500, close: 68800, volume: 42, confirmed: true },
  { time: 1788048000, open: 68800, high: 70500, low: 68400, close: 70000, volume: 38, confirmed: false },
];

describe("market provider fallback", () => {
  it("returns the backup live ticker and its source when OKX is unavailable", async () => {
    const result = await getTickerFromProviders([
      { source: "okx", getTicker: async () => { throw new Error("OKX unavailable"); }, getCandles: async () => candles },
      { source: "kraken", getTicker: async () => ticker, getCandles: async () => candles },
    ]);

    expect(result).toEqual({ data: ticker, source: "kraken" });
  });

  it("returns OKX candles without replacing a healthy primary source", async () => {
    const result = await getCandlesFromProviders("1D", [
      { source: "okx", getTicker: async () => ticker, getCandles: async () => candles },
      { source: "kraken", getTicker: async () => ticker, getCandles: async () => [] },
    ]);

    expect(result).toEqual({ data: candles, source: "okx" });
  });

  it("fails when no live provider returns market data", async () => {
    const down = (source: "okx" | "kraken") => ({
      source,
      getTicker: async (): Promise<MarketTicker> => { throw new Error(`${source} unavailable`); },
      getCandles: async (): Promise<MarketCandle[]> => { throw new Error(`${source} unavailable`); },
    });

    await expect(getTickerFromProviders([down("okx"), down("kraken")]))
      .rejects.toThrow("All live market providers failed");
  });
});

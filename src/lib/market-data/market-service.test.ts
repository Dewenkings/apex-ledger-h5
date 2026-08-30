// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

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
    const krakenTicker = vi.fn(async (instrument: "ETH-USDT") => ({ ...ticker, instrument }));
    const result = await getTickerFromProviders("ETH-USDT", [
      {
        source: "okx",
        getTickerForInstrument: async () => { throw new Error("OKX unavailable"); },
        getCandlesForInstrument: async () => candles,
      },
      {
        source: "kraken",
        getTickerForInstrument: krakenTicker,
        getCandlesForInstrument: async () => candles,
      },
    ]);

    expect(result).toEqual({ data: { ...ticker, instrument: "ETH-USDT" }, source: "kraken" });
    expect(krakenTicker).toHaveBeenCalledWith("ETH-USDT");
  });

  it("returns OKX candles without replacing a healthy primary source", async () => {
    const okxCandles = vi.fn(async () => candles);
    const result = await getCandlesFromProviders("SOL-USDT", "1D", [
      {
        source: "okx",
        getTickerForInstrument: async () => ticker,
        getCandlesForInstrument: okxCandles,
      },
      {
        source: "kraken",
        getTickerForInstrument: async () => ticker,
        getCandlesForInstrument: async () => [],
      },
    ]);

    expect(result).toEqual({ data: candles, source: "okx" });
    expect(okxCandles).toHaveBeenCalledWith("SOL-USDT", "1D", 120);
  });

  it("fails when no live provider returns market data", async () => {
    const down = (source: "okx" | "kraken") => ({
      source,
      getTickerForInstrument: async (): Promise<MarketTicker> => { throw new Error(`${source} unavailable`); },
      getCandlesForInstrument: async (): Promise<MarketCandle[]> => { throw new Error(`${source} unavailable`); },
    });

    await expect(getTickerFromProviders("BTC-USDT", [down("okx"), down("kraken")]))
      .rejects.toThrow("All live market providers failed");
  });
});

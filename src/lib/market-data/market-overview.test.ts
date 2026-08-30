import { describe, expect, it } from "vitest";

import type { MarketCandle, MarketInstrument, MarketTicker } from "./types";
import { getMarketOverview, type OverviewProvider } from "./market-overview";

function ticker(instrument: MarketInstrument, last: number): MarketTicker {
  return {
    instrument,
    last,
    open24h: last - 100,
    high24h: last + 100,
    low24h: last - 200,
    volume24h: 50,
    timestamp: 2000,
  };
}

function candle(close: number): MarketCandle {
  return { time: close, open: close - 1, high: close + 1, low: close - 2, close, volume: 2, confirmed: true };
}

function provider(
  source: "okx" | "kraken",
  tickers: MarketTicker[],
  candles: MarketCandle[] = [candle(10), candle(12)],
): OverviewProvider {
  return {
    source,
    getTickers: async (instruments) => tickers.filter((item) => instruments.includes(item.instrument)),
    getCandlesForInstrument: async () => candles,
  };
}

describe("live market overview aggregation", () => {
  it("fills missing OKX rows from Kraken and preserves catalogue order", async () => {
    const result = await getMarketOverview([
      provider("okx", [ticker("BTC-USDT", 69000)]),
      provider("kraken", [ticker("ETH-USDT", 3500)]),
    ], ["BTC-USDT", "ETH-USDT"]);

    expect(result.source).toBe("mixed");
    expect(result.data.map(({ instrument, source }) => [instrument, source])).toEqual([
      ["BTC-USDT", "okx"],
      ["ETH-USDT", "kraken"],
    ]);
  });

  it("reports one provider when it serves every requested row", async () => {
    const result = await getMarketOverview([
      provider("okx", [ticker("BTC-USDT", 69000), ticker("ETH-USDT", 3500)]),
    ], ["BTC-USDT", "ETH-USDT"]);

    expect(result.source).toBe("okx");
    expect(result.data.every(({ source }) => source === "okx")).toBe(true);
  });

  it("uses candle closes as spark data without discarding a ticker when candles fail", async () => {
    const healthy = await getMarketOverview([
      provider("okx", [ticker("BTC-USDT", 69000)], [candle(8), candle(9)]),
    ], ["BTC-USDT"]);
    const candleFailure: OverviewProvider = {
      ...provider("okx", [ticker("BTC-USDT", 69000)]),
      getCandlesForInstrument: async () => { throw new Error("candles unavailable"); },
    };
    const degraded = await getMarketOverview([candleFailure], ["BTC-USDT"]);

    expect(healthy.data[0].spark).toEqual([8, 9]);
    expect(degraded.data[0]).toMatchObject({ last: 69000, spark: [] });
  });

  it("throws when no provider returns a usable ticker", async () => {
    const failed: OverviewProvider = {
      ...provider("okx", []),
      getTickers: async () => { throw new Error("unavailable"); },
    };

    await expect(getMarketOverview([failed], ["BTC-USDT"]))
      .rejects.toThrow("All live overview providers failed");
  });
});

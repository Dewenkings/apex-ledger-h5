// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import {
  getKrakenPair,
  KrakenMarketAdapter,
  normalizeKrakenCandles,
  normalizeKrakenTicker,
  toKrakenInterval,
} from "./kraken";

describe("Kraken market-data normalization", () => {
  it("maps only explicitly supported USDT instruments", () => {
    expect(getKrakenPair("BTC-USDT")).toBe("XBTUSDT");
    expect(getKrakenPair("ETH-USDT")).toBe("ETHUSDT");
    expect(getKrakenPair("BNB-USDT")).toBeUndefined();
  });

  it.each([
    ["1H", 60],
    ["4H", 240],
    ["1D", 1440],
    ["1W", 10080],
  ] as const)("maps %s to the matching Kraken OHLC interval", (period, expected) => {
    expect(toKrakenInterval(period)).toBe(expected);
  });

  it("normalizes Kraken's XBTUSDT ticker into the BTC-USDT contract", () => {
    expect(normalizeKrakenTicker({
      error: [],
      result: {
        XBTUSDT: {
          a: ["68342.2", "1", "1"],
          b: ["68342.0", "1", "1"],
          c: ["68342.1", "0.01"],
          v: ["12000", "18743.2"],
          p: ["67000", "67200"],
          t: [1200, 1800],
          l: ["66100", "65911.4"],
          h: ["68600", "69180"],
          o: "66455.6",
        },
      },
    }, "BTC-USDT", 1788048000000)).toEqual({
      instrument: "BTC-USDT",
      last: 68342.1,
      open24h: 66455.6,
      high24h: 69180,
      low24h: 65911.4,
      volume24h: 18743.2,
      timestamp: 1788048000000,
    });
  });

  it("normalizes a supported non-BTC ticker into the requested contract", () => {
    expect(normalizeKrakenTicker({
      error: [],
      result: {
        ETHUSDT: {
          c: ["3521", "1"], v: ["80", "90"],
          l: ["3400", "3400"], h: ["3600", "3600"], o: "3500",
        },
      },
    }, "ETH-USDT", 2000)).toMatchObject({ instrument: "ETH-USDT", last: 3521, timestamp: 2000 });
  });

  it("normalizes Kraken OHLC rows and marks only closed candles confirmed", () => {
    expect(normalizeKrakenCandles({
      error: [],
      result: {
        XBTUSDT: [
          [1000, "10", "15", "9", "14", "12", "5", 8],
          [2000, "14", "18", "13", "17", "16", "7", 10],
        ],
        last: 2000,
      },
    })).toEqual([
      { time: 1000, open: 10, high: 15, low: 9, close: 14, volume: 5, confirmed: true },
      { time: 2000, open: 14, high: 18, low: 13, close: 17, volume: 7, confirmed: false },
    ]);
  });

  it("rejects malformed Kraken numeric data", () => {
    expect(() => normalizeKrakenCandles({
      error: [],
      result: { XBTUSDT: [[1000, "bad", "15", "9", "14", "12", "5", 8]], last: 1000 },
    })).toThrow("Invalid Kraken candle payload");
  });
});

describe("KrakenMarketAdapter", () => {
  it("returns supported tickers and omits unsupported instruments", async () => {
    const fetcher = vi.fn(async () => Response.json({
      error: [],
      result: {
        XBTUSDT: {
          c: ["69000", "1"], v: ["100", "120"],
          l: ["67000", "67000"], h: ["70000", "70000"], o: "68000",
        },
      },
    }));

    const adapter = new KrakenMarketAdapter(fetcher, 3500, () => 2000);
    const result = await adapter.getTickers(["BTC-USDT", "BNB-USDT"]);

    expect(result).toEqual([expect.objectContaining({ instrument: "BTC-USDT", last: 69000 })]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("requests XBTUSDT candles with the selected real interval", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return Response.json({
        error: [],
        result: { XBTUSDT: [[1000, "10", "15", "9", "14", "12", "5", 8]], last: 1000 },
      });
    });

    const adapter = new KrakenMarketAdapter(fetcher, 3500);
    await adapter.getCandles("4H", 120);

    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("https://api.kraken.com/0/public/OHLC");
    expect(Object.fromEntries(url.searchParams)).toEqual({ pair: "XBTUSDT", interval: "240" });
    expect(fetcher.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
});

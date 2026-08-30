// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import {
  OkxMarketAdapter,
  normalizeOkxCandles,
  normalizeOkxTicker,
  toOkxBar,
} from "./okx";

describe("OKX market-data normalization", () => {
  it.each([
    ["1H", "1H"],
    ["4H", "4H"],
    ["1D", "1Dutc"],
    ["1W", "1Wutc"],
  ] as const)("maps %s to the intended OKX candle bar", (period, expected) => {
    expect(toOkxBar(period)).toBe(expected);
  });

  it("normalizes the ticker fields needed by the trade screen", () => {
    expect(normalizeOkxTicker({
      code: "0",
      msg: "",
      data: [{
        instType: "SPOT",
        instId: "BTC-USDT",
        last: "68342.1",
        lastSz: "0.003",
        askPx: "68342.2",
        askSz: "0.18",
        bidPx: "68342.0",
        bidSz: "0.21",
        open24h: "66455.6",
        high24h: "69180",
        low24h: "65911.4",
        volCcy24h: "1276450000",
        vol24h: "18743.2",
        sodUtc0: "67000",
        sodUtc8: "67200",
        ts: "1788048000000",
      }],
    })).toEqual({
      instrument: "BTC-USDT",
      last: 68342.1,
      open24h: 66455.6,
      high24h: 69180,
      low24h: 65911.4,
      volume24h: 18743.2,
      timestamp: 1788048000000,
    });
  });

  it("sorts reverse-chronological OKX candles into chart order", () => {
    expect(normalizeOkxCandles({
      code: "0",
      msg: "",
      data: [
        ["2000", "20", "24", "19", "23", "8", "0", "0", "1"],
        ["1000", "10", "15", "9", "14", "5", "0", "0", "0"],
      ],
    })).toEqual([
      { time: 1, open: 10, high: 15, low: 9, close: 14, volume: 5, confirmed: false },
      { time: 2, open: 20, high: 24, low: 19, close: 23, volume: 8, confirmed: true },
    ]);
  });

  it("rejects malformed numeric data instead of leaking NaN to the chart", () => {
    expect(() => normalizeOkxCandles({
      code: "0",
      msg: "",
      data: [["1000", "bad", "15", "9", "14", "5", "0", "0", "1"]],
    })).toThrow("Invalid OKX candle payload");
  });
});

describe("OkxMarketAdapter", () => {
  it("requests public BTC-USDT candles with the selected bar and limit", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(JSON.stringify({
        code: "0",
        msg: "",
        data: [["1000", "10", "15", "9", "14", "5", "0", "0", "1"]],
      }), { status: 200 });
    });

    const adapter = new OkxMarketAdapter(fetcher);
    await adapter.getCandles("4H", 120);

    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("https://openapi.okx.com/api/v5/market/candles");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      instId: "BTC-USDT",
      bar: "4H",
      limit: "120",
    });
    expect(fetcher.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
});

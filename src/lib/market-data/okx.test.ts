// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import * as okxModule from "./okx";

import {
  OkxMarketAdapter,
  normalizeOkxCandles,
  normalizeOkxInstruments,
  normalizeOkxSpotSearch,
  normalizeOkxTicker,
  normalizeOkxTickers,
  toOkxBar,
} from "./okx";

const orderBookPayload = {
  arg: { channel: "books5", instId: "BTC-USDT" },
  data: [{
    asks: [
      ["68343.0", "0.200", "0", "2"],
      ["68342.0", "0.100", "0", "1"],
    ],
    bids: [
      ["68340.0", "0.300", "0", "3"],
      ["68341.0", "0.150", "0", "2"],
    ],
    ts: "1788048000000",
    seqId: 42,
  }],
};

class FakeSocket {
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  send(message: string) { this.sent.push(message); }
  close() { this.readyState = 3; this.onclose?.(); }
  open() { this.readyState = 1; this.onopen?.(); }
  message(data: string) { this.onmessage?.({ data }); }
}

afterEach(() => vi.useRealTimers());

describe("OKX market-data normalization", () => {
  it("normalizes public spot instrument rules without inventing project metadata", () => {
    expect(normalizeOkxInstruments({ code: "0", data: [{
      instType: "SPOT",
      instId: "BTC-USDT",
      baseCcy: "BTC",
      quoteCcy: "USDT",
      tickSz: "0.1",
      lotSz: "0.00000001",
      minSz: "0.00001",
      state: "live",
      listTime: "1539820800000",
    }] })).toEqual([{
      instrument: "BTC-USDT",
      baseSymbol: "BTC",
      quoteSymbol: "USDT",
      tickSize: "0.1",
      lotSize: "0.00000001",
      minSize: "0.00001",
      state: "live",
      listedAt: 1539820800000,
    }]);
  });

  it("drops instruments with non-positive or malformed execution increments", () => {
    expect(normalizeOkxInstruments({ code: "0", data: [
      { instType: "SPOT", instId: "ZERO-USDT", baseCcy: "ZERO", quoteCcy: "USDT", tickSz: "0", lotSz: "1", minSz: "1", state: "live", listTime: "1" },
      { instType: "SPOT", instId: "BAD-USDT", baseCcy: "BAD", quoteCcy: "USDT", tickSz: "bad", lotSz: "1", minSz: "1", state: "live", listTime: "1" },
    ] })).toEqual([]);
  });

  it("joins public instruments with live tickers and ranks exact symbol matches first", () => {
    const instruments = normalizeOkxInstruments({ code: "0", data: [
      { instType: "SPOT", instId: "WBTC-USDT", baseCcy: "WBTC", quoteCcy: "USDT", tickSz: "0.1", lotSz: "0.0001", minSz: "0.001", state: "live", listTime: "2" },
      { instType: "SPOT", instId: "BTC-USDT", baseCcy: "BTC", quoteCcy: "USDT", tickSz: "0.1", lotSz: "0.00001", minSz: "0.0001", state: "live", listTime: "1" },
    ] });
    const results = normalizeOkxSpotSearch(instruments, { code: "0", data: [
      { instId: "WBTC-USDT", last: "69001", open24h: "68000", high24h: "70000", low24h: "67000", vol24h: "10", volCcy24h: "690010", ts: "2000" },
      { instId: "BTC-USDT", last: "69000", open24h: "68000", high24h: "70000", low24h: "67000", vol24h: "120", volCcy24h: "8280000", ts: "2000" },
    ] }, "btc", 10);

    expect(results.map(({ instrument }) => instrument)).toEqual(["BTC-USDT", "WBTC-USDT"]);
    expect(results[0]).toMatchObject({ last: "69000", quoteVolume24h: "8280000" });
    expect(results[0].change24h).toBeCloseTo(1.4705882352941175);
  });

  it("normalizes, sorts, and accumulates a books5 snapshot", () => {
    const normalize = Reflect.get(okxModule, "normalizeOkxOrderBook");
    expect(normalize).toBeTypeOf("function");
    if (typeof normalize !== "function") return;

    const snapshot = normalize(orderBookPayload, "BTC-USDT", 5);

    expect(snapshot).toMatchObject({
      instrument: "BTC-USDT",
      timestamp: 1788048000000,
      sequenceId: 42,
      asks: [
        { price: 68342, size: 0.1, orderCount: 1 },
        { price: 68343, size: 0.2, orderCount: 2 },
      ],
      bids: [
        { price: 68341, size: 0.15, orderCount: 2 },
        { price: 68340, size: 0.3, orderCount: 3 },
      ],
    });
    expect(snapshot.asks[0].totalQuote).toBeCloseTo(6834.2);
    expect(snapshot.asks[1].totalQuote).toBeCloseTo(20502.8);
    expect(snapshot.bids[1].totalQuote).toBeCloseTo(30753.15);
  });

  it("rejects malformed order-book levels instead of publishing partial depth", () => {
    const normalize = Reflect.get(okxModule, "normalizeOkxOrderBook");
    expect(normalize).toBeTypeOf("function");
    if (typeof normalize !== "function") return;

    expect(() => normalize({
      ...orderBookPayload,
      data: [{ ...orderBookPayload.data[0], bids: [["bad", "0.1", "0", "1"]] }],
    }, "BTC-USDT", 5)).toThrow("Invalid OKX order book payload");
  });

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

  it("filters and normalizes requested USDT tickers in requested order", () => {
    const result = normalizeOkxTickers({ code: "0", data: [
      { instId: "ETH-USDT", last: "3521", open24h: "3500", high24h: "3600", low24h: "3400", vol24h: "90", ts: "2000" },
      { instId: "BTC-EUR", last: "1", open24h: "1", high24h: "1", low24h: "1", vol24h: "1", ts: "2000" },
      { instId: "BTC-USDT", last: "69000", open24h: "68000", high24h: "70000", low24h: "67000", vol24h: "120", ts: "2000" },
    ] }, ["BTC-USDT", "ETH-USDT"]);

    expect(result.map(({ instrument }) => instrument)).toEqual(["BTC-USDT", "ETH-USDT"]);
    expect(result[0].last).toBe(69000);
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
  it("requests public instruments and tickers for server-side spot search", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const pathname = new URL(String(input)).pathname;
      return Response.json(pathname.endsWith("/public/instruments")
        ? { code: "0", data: [{ instType: "SPOT", instId: "DOGE-USDT", baseCcy: "DOGE", quoteCcy: "USDT", tickSz: "0.00001", lotSz: "1", minSz: "1", state: "live", listTime: "1000" }] }
        : { code: "0", data: [{ instId: "DOGE-USDT", last: "0.2", open24h: "0.19", high24h: "0.21", low24h: "0.18", vol24h: "1000", volCcy24h: "200", ts: "2000" }] });
    });

    const result = await new OkxMarketAdapter(fetcher).searchSpotMarkets("doge", 10);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual([
      "/api/v5/public/instruments",
      "/api/v5/market/tickers",
    ]);
    expect(result).toEqual([expect.objectContaining({ instrument: "DOGE-USDT", last: "0.2" })]);
  });
  it("requests a five-level public order-book snapshot without shared caching", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return Response.json({ code: "0", data: orderBookPayload.data });
    });
    const adapter = new OkxMarketAdapter(fetcher);
    const getOrderBook = Reflect.get(adapter, "getOrderBookForInstrument");
    expect(getOrderBook).toBeTypeOf("function");
    if (typeof getOrderBook !== "function") return;

    const snapshot = await getOrderBook.call(adapter, "BTC-USDT", 5);

    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("https://openapi.okx.com/api/v5/market/books");
    expect(Object.fromEntries(url.searchParams)).toEqual({ instId: "BTC-USDT", sz: "5" });
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
    expect(snapshot.bids[0].price).toBe(68341);
  });

  it("requests all public spot tickers once and filters the requested instruments", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return Response.json({ code: "0", data: [
      { instId: "BTC-USDT", last: "69000", open24h: "68000", high24h: "70000", low24h: "67000", vol24h: "120", ts: "2000" },
      { instId: "ETH-USDT", last: "3521", open24h: "3500", high24h: "3600", low24h: "3400", vol24h: "90", ts: "2000" },
      ] });
    });

    const adapter = new OkxMarketAdapter(fetcher);
    const result = await adapter.getTickers(["ETH-USDT", "BTC-USDT"]);

    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("https://openapi.okx.com/api/v5/market/tickers");
    expect(Object.fromEntries(url.searchParams)).toEqual({ instType: "SPOT" });
    expect(result.map(({ instrument }) => instrument)).toEqual(["ETH-USDT", "BTC-USDT"]);
  });

  it("requests candles for the supplied instrument", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return Response.json({
        code: "0",
        data: [["1000", "10", "15", "9", "14", "5", "0", "0", "1"]],
      });
    });

    const adapter = new OkxMarketAdapter(fetcher);
    await adapter.getCandlesForInstrument("ETH-USDT", "1H", 24);

    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(Object.fromEntries(url.searchParams)).toEqual({
      instId: "ETH-USDT",
      bar: "1H",
      limit: "24",
    });
  });

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

describe("OkxBooks5Client", () => {
  it("subscribes to books5, emits validated snapshots, and pings an idle connection", () => {
    vi.useFakeTimers();
    const Client = Reflect.get(okxModule, "OkxBooks5Client");
    expect(Client).toBeTypeOf("function");
    if (typeof Client !== "function") return;

    const socket = new FakeSocket();
    const snapshots: unknown[] = [];
    const statuses: string[] = [];
    const client = new Client({
      instrument: "BTC-USDT",
      createSocket: () => socket,
      onSnapshot: (snapshot: unknown) => snapshots.push(snapshot),
      onStatus: (status: string) => statuses.push(status),
      heartbeatMs: 20_000,
      random: () => 0.5,
    });

    client.start();
    socket.open();
    expect(JSON.parse(socket.sent[0])).toEqual({
      op: "subscribe",
      args: [{ channel: "books5", instId: "BTC-USDT" }],
    });

    socket.message(JSON.stringify(orderBookPayload));
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({ instrument: "BTC-USDT", sequenceId: 42 });
    expect(statuses).toEqual(["connecting", "live"]);

    vi.advanceTimersByTime(20_000);
    expect(socket.sent).toContain("ping");
    client.stop();
  });

  it("reconnects with bounded backoff and never reconnects after stop", () => {
    vi.useFakeTimers();
    const Client = Reflect.get(okxModule, "OkxBooks5Client");
    expect(Client).toBeTypeOf("function");
    if (typeof Client !== "function") return;

    const sockets: FakeSocket[] = [];
    const statuses: string[] = [];
    const client = new Client({
      instrument: "BTC-USDT",
      createSocket: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      onSnapshot: () => undefined,
      onStatus: (status: string) => statuses.push(status),
      reconnectBaseDelayMs: 500,
      reconnectMaxDelayMs: 8_000,
      random: () => 0.5,
    });

    client.start();
    sockets[0].open();
    sockets[0].close();
    expect(statuses.at(-1)).toBe("reconnecting");

    vi.advanceTimersByTime(499);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);

    client.stop();
    sockets[1].close();
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(2);
    expect(statuses.at(-1)).toBe("stopped");
  });
});

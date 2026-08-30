// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as getCandles } from "./candles/route";
import { GET as getOverview } from "./overview/route";
import { GET as getTicker } from "./ticker/route";

const tickerPayload = {
  code: "0",
  msg: "",
  data: [{
    instType: "SPOT", instId: "BTC-USDT", last: "68342.1", lastSz: "0.003",
    askPx: "68342.2", askSz: "0.18", bidPx: "68342.0", bidSz: "0.21",
    open24h: "66455.6", high24h: "69180", low24h: "65911.4",
    volCcy24h: "1276450000", vol24h: "18743.2", sodUtc0: "67000",
    sodUtc8: "67200", ts: "1788048000000",
  }],
};

afterEach(() => vi.unstubAllGlobals());

describe("market-data Route Handlers", () => {
  it("returns a cacheable source-labelled market overview", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v5/market/tickers")) return Response.json(tickerPayload);
      if (url.includes("/api/v5/market/candles")) return Response.json({
        code: "0",
        data: [["1000", "68000", "69200", "67900", "69000", "5", "0", "0", "1"]],
      });
      return new Response("unavailable", { status: 503 });
    }));

    const response = await getOverview();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, s-maxage=30, stale-while-revalidate=120");
    expect(await response.json()).toMatchObject({
      source: "okx",
      data: [{ instrument: "BTC-USDT", source: "okx", spark: [69000] }],
    });
  });

  it("maps total overview failure to a sanitized response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));

    const response = await getOverview();

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Market overview temporarily unavailable" });
  });

  it("returns a normalized public ticker with short shared caching", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(tickerPayload))));

    const response = await getTicker(new Request("http://localhost/api/market/ticker?instrument=BTC-USDT"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, s-maxage=5, stale-while-revalidate=15");
    expect(await response.json()).toMatchObject({
      source: "okx",
      data: { instrument: "BTC-USDT", last: 68342.1 },
    });
  });

  it("returns ascending normalized candles for a supported period", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      code: "0", msg: "", data: [
        ["2000", "20", "24", "19", "23", "8", "0", "0", "1"],
        ["1000", "10", "15", "9", "14", "5", "0", "0", "1"],
      ],
    }))));

    const response = await getCandles(new Request("http://localhost/api/market/candles?instrument=BTC-USDT&period=4H"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      source: "okx",
      data: [
        { time: 1, open: 10, high: 15, low: 9, close: 14, volume: 5, confirmed: true },
        { time: 2, open: 20, high: 24, low: 19, close: 23, volume: 8, confirmed: true },
      ],
    });
  });

  it("rejects an unsupported period before contacting OKX", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    const response = await getCandles(new Request("http://localhost/api/market/candles?instrument=BTC-USDT&period=5m"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Unsupported chart period" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("maps an upstream failure to a sanitized 502 response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));

    const response = await getTicker(new Request("http://localhost/api/market/ticker?instrument=BTC-USDT"));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Market data temporarily unavailable" });
  });

  it("returns a labelled Kraken live ticker when OKX is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("openapi.okx.com")) {
        return new Response("unavailable", { status: 503 });
      }
      return Response.json({
        error: [],
        result: {
          XBTUSDT: {
            a: ["68342.2", "1", "1"], b: ["68342.0", "1", "1"],
            c: ["68342.1", "0.01"], v: ["12000", "18743.2"],
            p: ["67000", "67200"], t: [1200, 1800],
            l: ["66100", "65911.4"], h: ["68600", "69180"], o: "66455.6",
          },
        },
      });
    }));

    const response = await getTicker(new Request("http://localhost/api/market/ticker?instrument=BTC-USDT"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      source: "kraken",
      data: { instrument: "BTC-USDT", last: 68342.1 },
    });
  });

  it("requests and returns the exact supported non-BTC instrument", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.searchParams.get("instId")).toBe("ETH-USDT");
      return Response.json({
        ...tickerPayload,
        data: [{ ...tickerPayload.data[0], instId: "ETH-USDT", last: "3521.64" }],
      });
    });
    vi.stubGlobal("fetch", fetcher);

    const response = await getTicker(new Request("http://localhost/api/market/ticker?instrument=ETH-USDT"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      source: "okx",
      data: { instrument: "ETH-USDT", last: 3521.64 },
    });
  });

  it("rejects missing or unsupported instruments before contacting providers", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    const missing = await getTicker(new Request("http://localhost/api/market/ticker"));
    const unsupported = await getCandles(new Request("http://localhost/api/market/candles?instrument=DOGE-USDT&period=1D"));

    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ error: "Unsupported trading instrument" });
    expect(unsupported.status).toBe(400);
    expect(await unsupported.json()).toEqual({ error: "Unsupported trading instrument" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

describe("market search route", () => {
  it("returns live public USDT spot matches for a normalized query", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const pathname = new URL(String(input)).pathname;
      return Response.json(pathname.endsWith("/public/instruments")
        ? { code: "0", data: [{ instType: "SPOT", instId: "DOGE-USDT", baseCcy: "DOGE", quoteCcy: "USDT", tickSz: "0.00001", lotSz: "1", minSz: "1", state: "live", listTime: "1000" }] }
        : { code: "0", data: [{ instId: "DOGE-USDT", last: "0.2", open24h: "0.19", high24h: "0.21", low24h: "0.18", vol24h: "1000", volCcy24h: "200", ts: "2000" }] });
    }));
    const route = await import("./route");

    const response = await route.GET(new Request("http://localhost/api/market/search?q=%20doge%20"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=10");
    expect(await response.json()).toEqual({
      data: [expect.objectContaining({ instrument: "DOGE-USDT", baseSymbol: "DOGE", last: "0.2" })],
    });
  });

  it("rejects short or malformed queries before contacting the provider", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const route = await import("./route");

    const short = await route.GET(new Request("http://localhost/api/market/search?q=b"));
    const malformed = await route.GET(new Request("http://localhost/api/market/search?q=btc%3Cscript%3E"));

    expect(short.status).toBe(400);
    expect(malformed.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("accepts a slash-separated trading pair", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const pathname = new URL(String(input)).pathname;
      return Response.json(pathname.endsWith("/public/instruments")
        ? { code: "0", data: [{ instType: "SPOT", instId: "BTC-USDT", baseCcy: "BTC", quoteCcy: "USDT", tickSz: "0.1", lotSz: "0.00001", minSz: "0.0001", state: "live", listTime: "1000" }] }
        : { code: "0", data: [{ instId: "BTC-USDT", last: "69000", open24h: "68000", high24h: "70000", low24h: "67000", vol24h: "120", volCcy24h: "8280000", ts: "2000" }] });
    }));
    const route = await import("./route");

    const response = await route.GET(new Request("http://localhost/api/market/search?q=btc%2Fusdt"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [expect.objectContaining({ instrument: "BTC-USDT" })] });
  });
});

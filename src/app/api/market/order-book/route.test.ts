// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

const payload = {
  code: "0",
  data: [{
    asks: [["68342.2", "0.18", "0", "2"]],
    bids: [["68342.0", "0.21", "0", "3"]],
    ts: "1788048000000",
    seqId: 42,
  }],
};

afterEach(() => vi.unstubAllGlobals());

describe("order-book route", () => {
  it("returns a normalized no-store OKX depth snapshot", async () => {
    const routePath = "./route";
    const route = await import(/* @vite-ignore */ routePath).catch(() => null);
    expect(route).not.toBeNull();
    if (!route) return;

    vi.stubGlobal("fetch", vi.fn(async () => Response.json(payload)));
    const response = await route.GET(new Request("http://localhost/api/market/order-book?instrument=BTC-USDT"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      source: "okx",
      data: { instrument: "BTC-USDT", sequenceId: 42 },
    });
  });

  it("rejects unsupported instruments before contacting OKX", async () => {
    const routePath = "./route";
    const route = await import(/* @vite-ignore */ routePath).catch(() => null);
    expect(route).not.toBeNull();
    if (!route) return;

    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const response = await route.GET(new Request("http://localhost/api/market/order-book?instrument=DOGE-USDT"));

    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

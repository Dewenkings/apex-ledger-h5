// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

describe("instrument information route", () => {
  it("returns public trading rules for a supported instrument", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "0", data: [{
      instType: "SPOT", instId: "BTC-USDT", baseCcy: "BTC", quoteCcy: "USDT",
      tickSz: "0.1", lotSz: "0.00000001", minSz: "0.00001", state: "live", listTime: "1539820800000",
    }] })));
    const route = await import("./route");

    const response = await route.GET(new Request("http://localhost/api/market/instrument?instrument=BTC-USDT"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: expect.objectContaining({ instrument: "BTC-USDT", state: "live", minSize: "0.00001" }) });
  });

  it("rejects unsupported instruments", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const route = await import("./route");

    const response = await route.GET(new Request("http://localhost/api/market/instrument?instrument=DOGE-USDT"));

    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

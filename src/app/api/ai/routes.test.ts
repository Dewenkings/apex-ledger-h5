// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { createDeterministicInsight, MarketContextSchema } from "@/lib/ai/contracts";
import { createAIHandler } from "./_handler";

const context = MarketContextSchema.parse({
  version: "1.0", source: "OKX", instrument: "BTC-USDT", bar: "1H", asOf: "2026-09-02T08:00:00.000Z",
  dataQuality: "high", warnings: [], ticker: { last: 100, open24h: 99, high24h: 105, low24h: 95, change24hPct: 1.01, volume24h: 1000 },
  candles: [], orderBook: { asks: [], bids: [] }, technical: {
    version: "1.0", source: "OKX", instrument: "BTC-USDT", asOf: "2026-09-02T08:00:00.000Z",
    marketBias: "neutral", priceRangePosition: 50, realizedVolatilityPct: 1, volumeRatio: 1,
    orderBookImbalance: 0, dataQuality: "high", warnings: [],
    metrics: { priceRangePosition: 50, realizedVolatilityPct: 1, volumeRatio: 1, orderBookImbalance: 0 },
  },
});

const body = { instrument: "BTC-USDT", timeframe: "1H", question: "当前行情风险如何" };

function request(payload: unknown = body, origin = "http://localhost") {
  return new Request("http://localhost/api/ai/chat", {
    method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(payload),
  });
}

describe("AI route handler", () => {
  it("accepts the browser origin represented by forwarded host headers", async () => {
    const run = vi.fn().mockResolvedValue({ intent: "market_summary", insight: createDeterministicInsight(context) });
    const handler = createAIHandler({ run, consume: async () => true });
    const result = await handler(new Request("http://localhost:3000/api/ai/insight", {
      method: "POST",
      headers: { origin: "http://127.0.0.1:3000", "x-forwarded-host": "127.0.0.1:3000", "x-forwarded-proto": "http" },
      body: JSON.stringify(body),
    }));

    expect(result.status).toBe(200);
    expect(run).toHaveBeenCalledOnce();
  });

  it("returns no-store validated copilot output", async () => {
    const run = vi.fn().mockResolvedValue({ intent: "risk_analysis", insight: createDeterministicInsight(context) });
    const handler = createAIHandler({ run, consume: vi.fn().mockResolvedValue(true) });

    const response = await handler(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ intent: "risk_analysis", insight: { fallback: true } });
  });

  it("rejects cross-origin and malformed requests before running the agent", async () => {
    const run = vi.fn();
    const handler = createAIHandler({ run, consume: vi.fn().mockResolvedValue(true) });

    expect((await handler(request(body, "https://evil.example"))).status).toBe(403);
    expect((await handler(request({ instrument: "BTC-USD" }))).status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });

  it("rate-limits before model execution and sanitizes service failures", async () => {
    const limited = createAIHandler({ run: vi.fn(), consume: vi.fn().mockResolvedValue(false) });
    expect((await limited(request())).status).toBe(429);

    const failing = createAIHandler({ run: vi.fn().mockRejectedValue(new Error("secret upstream detail")), consume: vi.fn().mockResolvedValue(true) });
    const response = await failing(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "AI market analysis is temporarily unavailable", code: "ai_unavailable" });
  });
});

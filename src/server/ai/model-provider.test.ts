import { describe, expect, it, vi } from "vitest";

import { createDeterministicInsight, MarketContextSchema } from "@/lib/ai/contracts";
import { createDeepSeekInsightProvider } from "./model-provider";

const context = MarketContextSchema.parse({
  version: "1.0", source: "OKX", instrument: "BTC-USDT", bar: "1H",
  asOf: "2026-09-02T08:00:00.000Z", dataQuality: "high", warnings: [],
  ticker: { last: 100, open24h: 99, high24h: 105, low24h: 95, change24hPct: 1.01, volume24h: 1000 },
  candles: [], orderBook: { asks: [], bids: [] },
  technical: {
    version: "1.0", source: "OKX", instrument: "BTC-USDT", asOf: "2026-09-02T08:00:00.000Z",
    marketBias: "neutral", priceRangePosition: 50, realizedVolatilityPct: 1, volumeRatio: 1,
    orderBookImbalance: 0, dataQuality: "high", warnings: [],
    metrics: { priceRangePosition: 50, realizedVolatilityPct: 1, volumeRatio: 1, orderBookImbalance: 0 },
  },
});

describe("DeepSeek insight provider", () => {
  it("does not call the network without a server-side API key", async () => {
    const fetcher = vi.fn();
    const provider = createDeepSeekInsightProvider({ apiKey: "", fetcher });

    await expect(provider.generate({ question: "风险如何", context })).rejects.toThrow("not configured");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("validates model JSON and attaches trusted evidence metadata", async () => {
    const base = createDeterministicInsight(context);
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        marketBias: base.marketBias, title: "区间震荡", summary: "行情处于区间中部。",
        keyFactors: ["均价结构中性"], risks: ["短周期波动仍可能放大"], dataQuality: "high",
      }) } }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const provider = createDeepSeekInsightProvider({ apiKey: "secret", fetcher });

    const result = await provider.generate({ question: "风险如何", context });

    expect(result.fallback).toBe(false);
    expect(result.sources[0]).toEqual({ tool: "get_market_context", source: "OKX", asOf: context.asOf });
    expect(result.disclaimer).toContain("不构成投资建议");
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain("NEXT_PUBLIC");
  });

  it("rejects unsupported or malformed model output", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "not-json" } }] }), { status: 200 }));
    const provider = createDeepSeekInsightProvider({ apiKey: "secret", fetcher });

    await expect(provider.generate({ question: "直接告诉我买还是卖", context })).rejects.toThrow("Invalid model output");
  });
});

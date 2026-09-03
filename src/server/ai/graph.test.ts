import { describe, expect, it, vi } from "vitest";

import { createDeterministicInsight, MarketContextSchema, type MarketContext } from "@/lib/ai/contracts";
import { classifyIntent, runTradingCopilot } from "./graph";
import type { GenerateInput } from "./model-provider";

function context(instrument = "BTC-USDT"): MarketContext {
  return MarketContextSchema.parse({
    version: "1.0", source: "OKX", instrument, bar: "1H", asOf: "2026-09-02T08:00:00.000Z",
    dataQuality: "high", warnings: [],
    ticker: { last: 100, open24h: 99, high24h: 105, low24h: 95, change24hPct: 1.01, volume24h: 1000 },
    candles: [], orderBook: { asks: [], bids: [] },
    technical: {
      version: "1.0", source: "OKX", instrument, asOf: "2026-09-02T08:00:00.000Z",
      marketBias: "neutral", priceRangePosition: 50, realizedVolatilityPct: 1, volumeRatio: 1,
      orderBookImbalance: 0, dataQuality: "high", warnings: [],
      metrics: { priceRangePosition: 50, realizedVolatilityPct: 1, volumeRatio: 1, orderBookImbalance: 0 },
    },
  });
}

describe("classifyIntent", () => {
  it("routes risk, comparison, order-impact, and summary questions deterministically", () => {
    expect(classifyIntent("当前最大的风险是什么")).toBe("risk_analysis");
    expect(classifyIntent("BTC 和 ETH 哪个更强")).toBe("pair_comparison");
    expect(classifyIntent("买入 0.01 BTC 对余额有什么影响")).toBe("order_impact");
    expect(classifyIntent("总结当前行情")).toBe("market_summary");
  });

  it("classifies unrelated lifestyle questions as out of scope", () => {
    expect(classifyIntent("上海天气怎么样？")).toBe("out_of_scope");
    expect(classifyIntent("帮我写一首诗")).toBe("out_of_scope");
  });

  it("keeps context-dependent short questions in the active market", () => {
    expect(classifyIntent("现在怎么看？")).toBe("market_summary");
  });
});

describe("runTradingCopilot", () => {
  it("returns capability guidance without calling market tools or the model for unrelated questions", async () => {
    const marketTools = { getMarketContext: vi.fn() };
    const provider = { generate: vi.fn() };

    const result = await runTradingCopilot(
      { instrument: "BTC-USDT", timeframe: "1H", question: "上海天气怎么样？" },
      { marketTools, provider },
    );

    expect(result).toMatchObject({
      intent: "out_of_scope",
      guidance: {
        title: "这个问题不在行情助手的能力范围内",
      },
    });
    expect(marketTools.getMarketContext).not.toHaveBeenCalled();
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it("collects the active market context and returns validated model output", async () => {
    const marketTools = { getMarketContext: vi.fn().mockResolvedValue(context()) };
    const expected = { ...createDeterministicInsight(context()), fallback: false };
    const provider = { generate: vi.fn().mockResolvedValue(expected) };

    const result = await runTradingCopilot(
      { instrument: "BTC-USDT", timeframe: "1H", question: "当前风险如何" },
      { marketTools, provider },
    );

    expect(result.intent).toBe("risk_analysis");
    if (result.intent === "out_of_scope") throw new Error("Expected a risk response");
    expect(result.insight.fallback).toBe(false);
    expect(marketTools.getMarketContext).toHaveBeenCalledWith("BTC-USDT", "1H");
  });

  it("loads both pairs for comparisons", async () => {
    const marketTools = { getMarketContext: vi.fn((instrument: string) => Promise.resolve(context(instrument))) };
    const provider = { generate: vi.fn(({ context: primary }: GenerateInput) => Promise.resolve(createDeterministicInsight(primary))) };

    await runTradingCopilot(
      { instrument: "BTC-USDT", comparisonInstrument: "ETH-USDT", timeframe: "1H", question: "BTC和ETH哪个更强" },
      { marketTools, provider },
    );

    expect(marketTools.getMarketContext).toHaveBeenCalledTimes(2);
    expect(provider.generate.mock.calls[0]![0].comparisonContext?.instrument).toBe("ETH-USDT");
  });

  it("falls back to deterministic evidence when model generation fails", async () => {
    const marketTools = { getMarketContext: vi.fn().mockResolvedValue(context()) };
    const provider = { generate: vi.fn().mockRejectedValue(new Error("model unavailable")) };

    const result = await runTradingCopilot(
      { instrument: "BTC-USDT", timeframe: "1H", question: "总结行情" },
      { marketTools, provider },
    );

    if (result.intent === "out_of_scope") throw new Error("Expected a market response");
    expect(result.insight.fallback).toBe(true);
    expect(result.degradedReason).toBe("model_unavailable");
  });
});

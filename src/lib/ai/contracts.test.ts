import { describe, expect, it } from "vitest";

import {
  AgentRequestSchema,
  AIInsightSchema,
  CopilotResponseSchema,
  MarketContextSchema,
  createDeterministicInsight,
} from "./contracts";

const context = MarketContextSchema.parse({
  version: "1.0",
  source: "OKX",
  instrument: "BTC-USDT",
  bar: "1H",
  asOf: "2026-09-02T08:00:00.000Z",
  dataQuality: "high",
  warnings: [],
  ticker: { last: 112000, open24h: 110000, high24h: 115000, low24h: 105000, change24hPct: 1.82, volume24h: 1000 },
  candles: [],
  orderBook: { asks: [], bids: [] },
  technical: {
    version: "1.0", source: "OKX", instrument: "BTC-USDT", asOf: "2026-09-02T08:00:00.000Z",
    marketBias: "bullish", priceRangePosition: 70, realizedVolatilityPct: 2.5,
    volumeRatio: 1.4, orderBookImbalance: 0.2, dataQuality: "high", warnings: [],
    metrics: { priceRangePosition: 70, realizedVolatilityPct: 2.5, volumeRatio: 1.4, orderBookImbalance: 0.2 },
  },
});

describe("AI contracts", () => {
  it("parses the API response envelope", () => {
    const insight = createDeterministicInsight(context);
    expect(CopilotResponseSchema.parse({ intent: "market_summary", insight }).insight.title).toBe(insight.title);
  });

  it("rejects unsupported instruments and oversized questions", () => {
    expect(() => AgentRequestSchema.parse({ instrument: "BTC-USD", timeframe: "1H", question: "risk" })).toThrow();
    expect(() => AgentRequestSchema.parse({ instrument: "BTC-USDT", timeframe: "1H", question: "x".repeat(1001) })).toThrow();
  });

  it("requires evidence and a non-advisory disclaimer", () => {
    expect(() => AIInsightSchema.parse({ marketBias: "bullish", title: "偏强", summary: "test", keyFactors: [], risks: [], dataQuality: "high", sources: [] })).toThrow();
  });
});

describe("createDeterministicInsight", () => {
  it("turns verified metrics into a cited fallback insight", () => {
    const insight = createDeterministicInsight(context);

    expect(insight.marketBias).toBe("bullish");
    expect(insight.keyFactors.join(" ")).toContain("量能");
    expect(insight.risks.join(" ")).toContain("区间高位");
    expect(insight.sources).toEqual([{ tool: "get_market_context", source: "OKX", asOf: context.asOf }]);
    expect(insight.fallback).toBe(true);
    expect(insight.disclaimer).toContain("不构成投资建议");
  });
});

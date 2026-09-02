import { z } from "zod";

import { chartPeriods, marketSymbols } from "@/lib/market-data/types";

const MarketBiasSchema = z.enum(["bullish", "bearish", "neutral"]);
const DataQualitySchema = z.enum(["high", "medium", "low"]);

export const AgentIntentSchema = z.enum([
  "market_summary",
  "risk_analysis",
  "pair_comparison",
  "order_impact",
]);

export const AgentRequestSchema = z.object({
  instrument: z.string().trim().toUpperCase().refine(
    (value) => marketSymbols.some((symbol) => value === `${symbol}-USDT`),
    "Unsupported instrument",
  ),
  timeframe: z.enum(chartPeriods).default("1H"),
  question: z.string().trim().min(1).max(1000),
  comparisonInstrument: z.string().trim().toUpperCase().optional().refine(
    (value) => !value || marketSymbols.some((symbol) => value === `${symbol}-USDT`),
    "Unsupported comparison instrument",
  ),
});

const TechnicalSnapshotSchema = z.object({
  version: z.literal("1.0"),
  source: z.literal("OKX"),
  instrument: z.string(),
  asOf: z.string().datetime(),
  marketBias: MarketBiasSchema,
  priceRangePosition: z.number().finite(),
  realizedVolatilityPct: z.number().finite(),
  volumeRatio: z.number().finite(),
  orderBookImbalance: z.number().finite(),
  dataQuality: DataQualitySchema,
  warnings: z.array(z.string()),
  metrics: z.object({
    priceRangePosition: z.number().finite(),
    realizedVolatilityPct: z.number().finite(),
    volumeRatio: z.number().finite(),
    orderBookImbalance: z.number().finite(),
  }),
});

export const MarketContextSchema = z.object({
  version: z.literal("1.0"),
  source: z.literal("OKX"),
  instrument: z.string(),
  bar: z.string(),
  asOf: z.string().datetime(),
  dataQuality: DataQualitySchema,
  warnings: z.array(z.string()),
  ticker: z.object({
    last: z.number().finite(),
    open24h: z.number().finite(),
    high24h: z.number().finite(),
    low24h: z.number().finite(),
    change24hPct: z.number().finite(),
    volume24h: z.number().finite(),
  }),
  candles: z.array(z.object({
    ts: z.number().finite(), open: z.number().finite(), high: z.number().finite(),
    low: z.number().finite(), close: z.number().finite(), volume: z.number().finite(),
  })),
  orderBook: z.object({
    asks: z.array(z.object({ price: z.number().finite(), size: z.number().finite() })),
    bids: z.array(z.object({ price: z.number().finite(), size: z.number().finite() })),
  }),
  technical: TechnicalSnapshotSchema,
});

export const AIInsightSchema = z.object({
  marketBias: MarketBiasSchema,
  title: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(600),
  keyFactors: z.array(z.string().trim().min(1).max(180)).min(1).max(4),
  risks: z.array(z.string().trim().min(1).max(180)).min(1).max(4),
  dataQuality: DataQualitySchema,
  sources: z.array(z.object({
    tool: z.string().min(1),
    source: z.literal("OKX"),
    asOf: z.string().datetime(),
  })).min(1),
  disclaimer: z.string().refine((value) => value.includes("不构成投资建议"), "Disclaimer required"),
  fallback: z.boolean(),
});

export const CopilotResponseSchema = z.object({
  intent: AgentIntentSchema,
  insight: AIInsightSchema,
  degradedReason: z.literal("model_unavailable").optional(),
});

export type AgentRequest = z.infer<typeof AgentRequestSchema>;
export type AgentIntent = z.infer<typeof AgentIntentSchema>;
export type MarketContext = z.infer<typeof MarketContextSchema>;
export type AIInsight = z.infer<typeof AIInsightSchema>;
export type CopilotResponse = z.infer<typeof CopilotResponseSchema>;
export type MarketBias = z.infer<typeof MarketBiasSchema>;

const pct = (value: number): string => `${value.toFixed(1)}%`;

export function createDeterministicInsight(context: MarketContext): AIInsight {
  const metrics = context.technical;
  const keyFactors = [
    metrics.marketBias === "bullish"
      ? "短周期均价结构偏强"
      : metrics.marketBias === "bearish"
        ? "短周期均价结构偏弱"
        : "短周期均价结构暂未形成明确方向",
    metrics.volumeRatio >= 1.2
      ? `最新量能约为近期均值的 ${metrics.volumeRatio.toFixed(1)} 倍`
      : `最新量能约为近期均值的 ${metrics.volumeRatio.toFixed(1)} 倍，未明显放大`,
    metrics.orderBookImbalance > 0.1
      ? "可见盘口买方名义深度略占优"
      : metrics.orderBookImbalance < -0.1
        ? "可见盘口卖方名义深度略占优"
        : "可见盘口买卖深度相对均衡",
  ];
  const risks = [
    metrics.priceRangePosition >= 70
      ? `价格处于 24 小时区间高位（${pct(metrics.priceRangePosition)}）`
      : metrics.priceRangePosition <= 30
        ? `价格处于 24 小时区间低位（${pct(metrics.priceRangePosition)}）`
        : `价格位于 24 小时区间中部（${pct(metrics.priceRangePosition)}）`,
    `短周期已实现波动率为 ${pct(metrics.realizedVolatilityPct)}`,
    "盘口为实时快照，深度结构可能快速变化",
  ];

  return AIInsightSchema.parse({
    marketBias: metrics.marketBias,
    title: metrics.marketBias === "bullish" ? "短周期结构偏强" : metrics.marketBias === "bearish" ? "短周期结构偏弱" : "短周期方向中性",
    summary: `${context.instrument} 当前 24 小时涨跌幅为 ${pct(context.ticker.change24hPct)}。以下结论仅基于公开行情与技术指标。`,
    keyFactors,
    risks,
    dataQuality: context.dataQuality,
    sources: [{ tool: "get_market_context", source: "OKX", asOf: context.asOf }],
    disclaimer: "仅供产品演示与信息参考，不构成投资建议。",
    fallback: true,
  });
}

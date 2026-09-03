import { z } from "zod";

import { AIInsightSchema, type AIInsight, type MarketContext } from "@/lib/ai/contracts";

const ChineseTextSchema = z.string().min(1).max(600).refine(
  (value) => /\p{Script=Han}/u.test(value),
  "Chinese user-facing copy required",
);

const ModelInsightSchema = z.object({
  marketBias: z.enum(["bullish", "bearish", "neutral"]),
  title: ChineseTextSchema.refine((value) => value.length <= 80),
  summary: ChineseTextSchema,
  keyFactors: z.array(ChineseTextSchema.refine((value) => value.length <= 180)).min(1).max(4),
  risks: z.array(ChineseTextSchema.refine((value) => value.length <= 180)).min(1).max(4),
  dataQuality: z.enum(["high", "medium", "low"]),
});

type ProviderOptions = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};

export type GenerateInput = {
  question: string;
  context: MarketContext;
  comparisonContext?: MarketContext;
};

export interface InsightProvider {
  generate(input: GenerateInput): Promise<AIInsight>;
}

function buildPrompt(input: GenerateInput): string {
  return JSON.stringify({
    task: "仅根据 evidence 使用简体中文解释市场状态，不提供买卖建议，不引入新闻、政策或链上事件。",
    question: input.question,
    evidence: {
      instrument: input.context.instrument,
      timeframe: input.context.bar,
      ticker: input.context.ticker,
      technical: input.context.technical,
      comparison: input.comparisonContext ? {
        instrument: input.comparisonContext.instrument,
        ticker: input.comparisonContext.ticker,
        technical: input.comparisonContext.technical,
      } : undefined,
    },
    output: {
      marketBias: "bullish | bearish | neutral",
      title: "string",
      summary: "string",
      keyFactors: ["1-4 items"],
      risks: ["1-4 items"],
      dataQuality: "high | medium | low",
    },
  });
}

export function createDeepSeekInsightProvider(options: ProviderOptions = {}): InsightProvider {
  const fetcher = options.fetcher ?? fetch;
  const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY ?? "";
  const baseUrl = (options.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
  const model = options.model ?? process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
  const timeoutMs = options.timeoutMs ?? 12_000;

  return {
    async generate(input): Promise<AIInsight> {
      if (!apiKey) throw new Error("DeepSeek is not configured");
      let response: Response | undefined;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          response = await fetcher(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              temperature: 0.1,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: "你是行情数据解释助手。所有面向用户的字段必须使用简体中文；不得编造证据或提供投资建议；仅返回 JSON。" },
                { role: "user", content: buildPrompt(input) },
              ],
            }),
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (response.ok || response.status < 500) break;
        } catch (error) {
          if (attempt === 1) throw error;
        }
      }
      if (!response?.ok) throw new Error(`DeepSeek request failed${response ? ` (${response.status})` : ""}`);
      const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = json.choices?.[0]?.message?.content;
      if (!content) throw new Error("Invalid model output: empty response");
      try {
        const generated = ModelInsightSchema.parse(JSON.parse(content));
        return AIInsightSchema.parse({
          ...generated,
          dataQuality: input.context.dataQuality === "low" ? "low" : generated.dataQuality,
          sources: [input.context, ...(input.comparisonContext ? [input.comparisonContext] : [])]
            .map((context) => ({ tool: "get_market_context", source: "OKX" as const, asOf: context.asOf })),
          disclaimer: "基于公开市场数据，仅供信息参考，不构成投资建议。",
          fallback: false,
        });
      } catch {
        throw new Error("Invalid model output: schema validation failed");
      }
    },
  };
}

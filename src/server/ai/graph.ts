import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import {
  AgentRequestSchema,
  AIInsightSchema,
  createDeterministicInsight,
  type AgentIntent,
  type AgentRequest,
  type AIInsight,
  type CopilotGuidance,
  type MarketContext,
} from "@/lib/ai/contracts";
import type { InsightProvider } from "./model-provider";
import type { MarketToolsClient } from "./mcp-client";

type CopilotDependencies = {
  marketTools: Pick<MarketToolsClient, "getMarketContext">;
  provider: InsightProvider;
};

export type CopilotResponse =
  | { intent: Exclude<AgentIntent, "out_of_scope">; insight: AIInsight; degradedReason?: "model_unavailable" }
  | { intent: "out_of_scope"; guidance: CopilotGuidance };

const explicitOutOfScopePattern = /天气|气温|下雨|空气质量|新闻联播|体育|足球|篮球|电影|电视剧|音乐|菜谱|做饭|旅游攻略|酒店推荐|写.{0,4}(诗|作文|邮件|故事)|翻译|编程|代码|weather|temperature|recipe|movie|football|basketball/i;

const outOfScopeGuidance: CopilotGuidance = {
  title: "这个问题不在行情助手的能力范围内",
  message: "我目前只回答数字资产行情、风险、盘口和订单影响相关问题。实时天气等生活信息需要对应的数据工具支持。",
  suggestions: [
    "BTC 当前最大的风险是什么？",
    "ETH 和 SOL 哪个短期波动更高？",
    "当前盘口买卖力量是否失衡？",
  ],
};

export function classifyIntent(question: string): AgentIntent {
  const value = question.toLowerCase();
  if (explicitOutOfScopePattern.test(value)) return "out_of_scope";
  if (/比较|哪个更|对比|compare|versus|\bvs\b/.test(value)) return "pair_comparison";
  if (/下单|买入|卖出|订单|余额|仓位|amount|order/.test(value)) return "order_impact";
  if (/风险|波动|回撤|risk|volatile/.test(value)) return "risk_analysis";
  return "market_summary";
}

const CopilotState = Annotation.Root({
  request: Annotation<AgentRequest>(),
  intent: Annotation<AgentIntent>(),
  context: Annotation<MarketContext>(),
  comparisonContext: Annotation<MarketContext | undefined>(),
  insight: Annotation<AIInsight>(),
  degradedReason: Annotation<"model_unavailable" | undefined>(),
});

export async function runTradingCopilot(
  input: unknown,
  dependencies: CopilotDependencies,
): Promise<CopilotResponse> {
  const request = AgentRequestSchema.parse(input);
  const intent = classifyIntent(request.question);
  if (intent === "out_of_scope") {
    return { intent, guidance: outOfScopeGuidance };
  }
  const workflow = new StateGraph(CopilotState)
    .addNode("classify", () => ({ intent }))
    .addNode("collectEvidence", async (state) => {
      const context = await dependencies.marketTools.getMarketContext(state.request.instrument, state.request.timeframe);
      const comparisonContext = state.intent === "pair_comparison" && state.request.comparisonInstrument
        ? await dependencies.marketTools.getMarketContext(state.request.comparisonInstrument, state.request.timeframe)
        : undefined;
      return { context, comparisonContext };
    })
    .addNode("compose", async (state) => {
      try {
        const insight = AIInsightSchema.parse(await dependencies.provider.generate({
          question: state.request.question,
          context: state.context,
          comparisonContext: state.comparisonContext,
        }));
        return { insight, degradedReason: undefined };
      } catch {
        return {
          insight: createDeterministicInsight(state.context),
          degradedReason: "model_unavailable" as const,
        };
      }
    })
    .addEdge(START, "classify")
    .addEdge("classify", "collectEvidence")
    .addEdge("collectEvidence", "compose")
    .addEdge("compose", END)
    .compile();

  const result = await workflow.invoke({ request });
  return {
    intent: result.intent as Exclude<AgentIntent, "out_of_scope">,
    insight: result.insight,
    ...(result.degradedReason ? { degradedReason: result.degradedReason } : {}),
  };
}

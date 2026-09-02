import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import {
  AgentRequestSchema,
  AIInsightSchema,
  createDeterministicInsight,
  type AgentIntent,
  type AgentRequest,
  type AIInsight,
  type MarketContext,
} from "@/lib/ai/contracts";
import type { InsightProvider } from "./model-provider";
import type { MarketToolsClient } from "./mcp-client";

type CopilotDependencies = {
  marketTools: Pick<MarketToolsClient, "getMarketContext">;
  provider: InsightProvider;
};

export type CopilotResponse = {
  intent: AgentIntent;
  insight: AIInsight;
  degradedReason?: "model_unavailable";
};

export function classifyIntent(question: string): AgentIntent {
  const value = question.toLowerCase();
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
  const workflow = new StateGraph(CopilotState)
    .addNode("classify", (state) => ({ intent: classifyIntent(state.request.question) }))
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
    intent: result.intent,
    insight: result.insight,
    ...(result.degradedReason ? { degradedReason: result.degradedReason } : {}),
  };
}

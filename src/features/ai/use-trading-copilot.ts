"use client";

import { useCallback, useEffect, useState } from "react";

import { CopilotResponseSchema, type AIInsight } from "@/lib/ai/contracts";
import type { ChartPeriod } from "@/lib/market-data/types";

type CopilotEndpoint = "/api/ai/insight" | "/api/ai/chat";

async function requestInsight(endpoint: CopilotEndpoint, body: object, signal?: AbortSignal): Promise<AIInsight> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw new Error("AI 分析暂不可用");
  return CopilotResponseSchema.parse(await response.json()).insight;
}

export function useTradingCopilot(instrument: string, timeframe: ChartPeriod) {
  const requestKey = `${instrument}:${timeframe}`;
  const [insightState, setInsightState] = useState<{ key: string; insight: AIInsight | null; error: string | null } | null>(null);
  const [response, setResponse] = useState<AIInsight | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    requestInsight("/api/ai/insight", {
      instrument,
      timeframe,
      question: "总结当前市场结构、关键动因与主要风险。",
    }, controller.signal)
      .then((insight) => setInsightState({ key: requestKey, insight, error: null }))
      .catch((cause: unknown) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          setInsightState({ key: requestKey, insight: null, error: "AI 分析暂不可用" });
        }
      });
    return () => controller.abort();
  }, [instrument, requestKey, timeframe]);

  const ask = useCallback(async (question: string) => {
    setIsAsking(true);
    setChatError(null);
    try {
      const next = await requestInsight("/api/ai/chat", { instrument, timeframe, question });
      setResponse(next);
    } catch {
      setChatError("AI 回答暂不可用，请稍后重试。");
    } finally {
      setIsAsking(false);
    }
  }, [instrument, timeframe]);

  const isLoading = insightState?.key !== requestKey;
  return {
    insight: isLoading ? null : (insightState?.insight ?? null),
    response,
    isLoading,
    isAsking,
    error: chatError ?? (isLoading ? null : (insightState?.error ?? null)),
    ask,
  };
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

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

export function useTradingCopilot(instrument: string, timeframe: ChartPeriod, enabled = true) {
  const requestKey = `${instrument}:${timeframe}`;
  const [chatState, setChatState] = useState<{ key: string; response: AIInsight | null; error: string | null } | null>(null);
  const [askingKey, setAskingKey] = useState<string | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const insightQuery = useQuery({
    queryKey: ["ai", "insight", instrument, timeframe],
    queryFn: ({ signal }) => requestInsight("/api/ai/insight", {
      instrument,
      timeframe,
      question: "总结当前市场结构、关键动因与主要风险。",
    }, signal),
    enabled,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    return () => {
      chatAbortRef.current?.abort();
      chatAbortRef.current = null;
    };
  }, [requestKey]);

  const ask = useCallback(async (question: string) => {
    const chatKey = requestKey;
    chatAbortRef.current?.abort();
    const controller = new AbortController();
    chatAbortRef.current = controller;
    setAskingKey(chatKey);
    setChatState({ key: chatKey, response: null, error: null });
    try {
      const next = await requestInsight("/api/ai/chat", { instrument, timeframe, question }, controller.signal);
      if (!controller.signal.aborted) setChatState({ key: chatKey, response: next, error: null });
    } catch (cause: unknown) {
      if (!(cause instanceof DOMException && cause.name === "AbortError") && !controller.signal.aborted) {
        setChatState({ key: chatKey, response: null, error: "AI 回答暂不可用，请稍后重试。" });
      }
    } finally {
      if (chatAbortRef.current === controller) {
        chatAbortRef.current = null;
        setAskingKey(null);
      }
    }
  }, [instrument, requestKey, timeframe]);

  const isLoading = enabled && insightQuery.isPending;
  const insightError = insightQuery.isError ? "AI 分析暂不可用" : null;
  const currentChatState = chatState?.key === requestKey ? chatState : null;
  return {
    insight: insightQuery.data ?? null,
    response: currentChatState?.response ?? null,
    isLoading,
    isAsking: askingKey === requestKey,
    insightError,
    chatError: currentChatState?.error ?? null,
    ask,
  };
}

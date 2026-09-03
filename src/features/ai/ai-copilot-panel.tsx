"use client";

import { ChatCircleDots, PaperPlaneRight, Sparkle } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";

import type { AIInsight } from "@/lib/ai/contracts";
import { AIInsightCard } from "./ai-insight-card";

const suggestions = [
  "为什么会得出当前判断？",
  "当前最大的波动风险是什么？",
  "盘口买卖力量如何？",
];

type Props = {
  instrument: string;
  timeframe: string;
  insight: AIInsight | null;
  response: AIInsight | null;
  isLoading: boolean;
  isAsking: boolean;
  insightError: string | null;
  chatError: string | null;
  onAsk: (question: string) => Promise<void>;
};

export function AICopilotPanel({ instrument, timeframe, insight, response, isLoading, isAsking, insightError, chatError, onAsk }: Props) {
  const [question, setQuestion] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = question.trim();
    if (!normalized || isAsking) return;
    await onAsk(normalized);
  };

  return <div className="ai-copilot-page">
    <header className="ai-copilot-hero">
      <div className="ai-copilot-mark"><Sparkle weight="fill" /></div>
      <div><span>AI MARKET COPILOT</span><h2>AI 行情洞察</h2><p>{instrument} · {timeframe} · 基于 OKX 实时市场数据</p></div>
    </header>

    <AIInsightCard insight={insight} isLoading={isLoading} error={insightError} />

    <section className="ai-assistant-panel" aria-labelledby="ai-assistant-title">
      <header><div><ChatCircleDots weight="fill" /><div><span>连续问答</span><h2 id="ai-assistant-title">AI 行情助手</h2></div></div><small>仅解释数据</small></header>
      <p className="ai-chat-context">助手会自动携带当前交易对与周期，只基于可追溯的行情证据回答。</p>
      <div className="ai-chat-suggestions" aria-label="推荐问题">{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => setQuestion(suggestion)}>{suggestion}</button>)}</div>
      {response && <article className="ai-chat-answer" aria-live="polite"><strong>{response.title}</strong><p>{response.summary}</p><ul>{response.keyFactors.slice(0, 3).map((factor) => <li key={factor}>{factor}</li>)}</ul><small>{response.disclaimer}</small></article>}
      {chatError && <p className="ai-chat-error" role="alert">{chatError}</p>}
      <form onSubmit={submit} className="ai-chat-form"><input value={question} maxLength={1000} onChange={(event) => setQuestion(event.target.value)} aria-label="向 AI 询问行情" placeholder="询问行情动因、风险或盘口结构…" /><button type="submit" aria-label="发送问题" disabled={!question.trim() || isAsking}>{isAsking ? <span className="ai-chat-spinner" /> : <PaperPlaneRight weight="fill" />}</button></form>
      <p className="ai-assistant-disclaimer">AI 输出仅用于作品演示与行情解释，不构成投资建议，也不会触发交易。</p>
    </section>
  </div>;
}

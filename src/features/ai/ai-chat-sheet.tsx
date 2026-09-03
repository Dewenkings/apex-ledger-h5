"use client";

import { PaperPlaneRight, Sparkle, X } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import type { AIInsight, CopilotGuidance } from "@/lib/ai/contracts";

const suggestions = [
  "当前最大的波动风险是什么？",
  "为什么判断为当前趋势？",
  "盘口买卖力量如何？",
];

type Props = {
  open: boolean;
  instrument: string;
  isAsking: boolean;
  response: AIInsight | null;
  guidance?: CopilotGuidance | null;
  error: string | null;
  onAsk: (question: string) => Promise<void>;
  onClose: () => void;
};

export function AIChatSheet({ open, instrument, isAsking, response, guidance, error, onAsk, onClose }: Props) {
  const [question, setQuestion] = useState("");
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("keydown", onKeyDown); };
  }, [onClose, open]);

  if (!open) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = question.trim();
    if (!normalized || isAsking) return;
    await onAsk(normalized);
  };

  return <div className="ai-chat-layer">
    <button type="button" className="ai-chat-backdrop" aria-label="关闭 AI 助手背景" onClick={onClose} />
    <section className="ai-chat-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="ai-chat-handle" />
      <header><div><span><Sparkle weight="fill" /> AI MARKET COPILOT</span><h2 id={titleId}>{instrument} 行情问答</h2></div><button type="button" aria-label="关闭 AI 助手" onClick={onClose}><X /></button></header>
      <p className="ai-chat-context">回答仅使用当前 OKX 行情工具数据，不连接真实交易执行。</p>
      <div className="ai-chat-suggestions" aria-label="推荐问题">{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => setQuestion(suggestion)}>{suggestion}</button>)}</div>
      {response && <article className="ai-chat-answer" aria-live="polite"><strong>{response.title}</strong><p>{response.summary}</p><ul>{response.keyFactors.slice(0, 3).map((factor) => <li key={factor}>{factor}</li>)}</ul><small>{response.disclaimer}</small></article>}
      {guidance && <article className="ai-chat-answer" aria-live="polite"><strong>{guidance.title}</strong><p>{guidance.message}</p><div className="ai-chat-suggestions" aria-label="支持的问题">{guidance.suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => setQuestion(suggestion)}>{suggestion}</button>)}</div></article>}
      {error && <p className="ai-chat-error" role="alert">{error}</p>}
      <form onSubmit={submit} className="ai-chat-form"><input ref={inputRef} value={question} maxLength={1000} onChange={(event) => setQuestion(event.target.value)} aria-label="向 AI 询问行情" placeholder="询问行情动因、风险或盘口结构…" /><button type="submit" aria-label="发送问题" disabled={!question.trim() || isAsking}>{isAsking ? <span className="ai-chat-spinner" /> : <PaperPlaneRight weight="fill" />}</button></form>
    </section>
  </div>;
}

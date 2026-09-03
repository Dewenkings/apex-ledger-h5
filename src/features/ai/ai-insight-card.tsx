"use client";

import { ArrowRight, Brain, Database, ShieldWarning, Sparkle } from "@phosphor-icons/react";

import type { AIInsight } from "@/lib/ai/contracts";

const qualityLabel = { high: "高", medium: "中", low: "低" } as const;
const biasLabel = { bullish: "偏强", bearish: "偏弱", neutral: "中性" } as const;

type Props = {
  insight: AIInsight | null;
  isLoading: boolean;
  error: string | null;
  onOpen?: () => void;
};

export function AIInsightCard({ insight, isLoading, error, onOpen }: Props) {
  if (isLoading) return <section className="ai-insight-card ai-insight-loading" role="status" aria-label="AI 正在分析行情">
    <div className="ai-insight-skeleton title" />
    <div className="ai-insight-skeleton copy" />
    <div className="ai-insight-skeleton copy short" />
  </section>;

  if (!insight) return <section className="ai-insight-card ai-insight-unavailable" aria-label="AI 行情洞察">
    <div className="ai-insight-icon"><Brain /></div>
    <div><strong>{error ?? "AI 分析暂不可用"}</strong><p>不会影响行情与模拟交易，可稍后重试。</p></div>
  </section>;

  return <section className={`ai-insight-card ${insight.marketBias}`} aria-label="AI 行情洞察">
    <header className="ai-insight-header">
      <div className="ai-insight-brand"><span><Sparkle weight="fill" /> AI 行情洞察</span><small>{insight.fallback ? "规则降级" : "模型分析"}</small></div>
      <span className={`ai-bias-pill ${insight.marketBias}`}>{biasLabel[insight.marketBias]}</span>
    </header>
    <h2>{insight.title}</h2>
    <p className="ai-insight-summary">{insight.summary}</p>
    <div className="ai-insight-grid">
      <div><strong><Database />关键动因</strong><ul>{insight.keyFactors.slice(0, 3).map((factor) => <li key={factor}>{factor}</li>)}</ul></div>
      <div><strong><ShieldWarning />风险提示</strong><ul>{insight.risks.slice(0, 3).map((risk) => <li key={risk}>{risk}</li>)}</ul></div>
    </div>
    <footer className="ai-insight-footer">
      <div><span>数据质量：{qualityLabel[insight.dataQuality]}</span><span>来源：{[...new Set(insight.sources.map((source) => source.source))].join(" · ")}</span></div>
      {onOpen && <button type="button" onClick={onOpen}>询问 AI <ArrowRight /></button>}
    </footer>
    <p className="ai-disclaimer">{insight.disclaimer}</p>
  </section>;
}

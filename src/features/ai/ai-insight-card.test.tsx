import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AIInsightCard } from "./ai-insight-card";
import type { AIInsight } from "@/lib/ai/contracts";

const insight: AIInsight = {
  marketBias: "bullish",
  title: "短周期结构偏强",
  summary: "BTC-USDT 量价结构偏强，但价格接近区间高位。",
  keyFactors: ["短周期均价上行", "成交量高于近期均值"],
  risks: ["价格接近 24 小时区间高位", "盘口结构可能快速变化"],
  dataQuality: "high",
  sources: [{ tool: "get_market_context", source: "OKX", asOf: "2026-09-02T08:00:00.000Z" }],
  disclaimer: "仅供产品演示与信息参考，不构成投资建议。",
  fallback: false,
};

describe("AIInsightCard", () => {
  it("renders traceable insight and opens the copilot", () => {
    const onOpen = vi.fn();
    render(<AIInsightCard insight={insight} isLoading={false} error={null} onOpen={onOpen} />);

    expect(screen.getByRole("heading", { name: "短周期结构偏强" })).toBeInTheDocument();
    expect(screen.getByText("数据质量：高")).toBeInTheDocument();
    expect(screen.getByText(/来源：OKX/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "询问 AI" }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("shows loading and non-blocking unavailable states", () => {
    const { rerender } = render(<AIInsightCard insight={null} isLoading error={null} onOpen={() => undefined} />);
    expect(screen.getByRole("status", { name: "AI 正在分析行情" })).toBeInTheDocument();

    rerender(<AIInsightCard insight={null} isLoading={false} error="AI 分析暂不可用" onOpen={() => undefined} />);
    expect(screen.getByText("AI 分析暂不可用")).toBeInTheDocument();
    expect(screen.getByText(/不会影响行情与模拟交易/)).toBeInTheDocument();
  });
});

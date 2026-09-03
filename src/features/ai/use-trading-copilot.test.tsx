import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import type { ChartPeriod } from "@/lib/market-data/types";
import { useTradingCopilot } from "./use-trading-copilot";

const insightResponse = {
  intent: "market_summary",
  insight: {
    marketBias: "neutral",
    title: "行情结构中性",
    summary: "当前行情暂未形成明确方向。",
    keyFactors: ["盘口买卖深度相对均衡"],
    risks: ["短周期波动仍可能放大"],
    dataQuality: "high",
    sources: [{ tool: "get_market_context", source: "OKX", asOf: "2026-09-03T03:00:00.000Z" }],
    disclaimer: "基于公开市场数据，仅供信息参考，不构成投资建议。",
    fallback: false,
  },
};

afterEach(() => vi.unstubAllGlobals());

function createQueryWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useTradingCopilot", () => {
  it("cancels an old chat request and clears its answer when market context changes", async () => {
    let resolveChat!: (response: Response) => void;
    const chatResponse = new Promise<Response>((resolve) => { resolveChat = resolve; });
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => String(input).includes("/chat")
      ? chatResponse
      : Promise.resolve(Response.json(insightResponse))));

    const { result, rerender } = renderHook(
      ({ timeframe }) => useTradingCopilot("BTC-USDT", timeframe, true),
      { initialProps: { timeframe: "1D" as ChartPeriod }, wrapper: createQueryWrapper() },
    );
    await waitFor(() => expect(result.current.insight?.title).toBe("行情结构中性"));

    let pending!: Promise<void>;
    act(() => { pending = result.current.ask("当前风险是什么？"); });
    rerender({ timeframe: "1H" });
    resolveChat(Response.json(insightResponse));
    await act(async () => pending);

    expect(result.current.response).toBeNull();
    expect(result.current.chatError).toBeNull();
  });

  it("reuses a fresh automatic insight after the AI tab is hidden and shown", async () => {
    const fetcher = vi.fn(() => Promise.resolve(Response.json(insightResponse)));
    vi.stubGlobal("fetch", fetcher);
    const { result, rerender } = renderHook(
      ({ enabled }) => useTradingCopilot("BTC-USDT", "1D", enabled),
      { initialProps: { enabled: true }, wrapper: createQueryWrapper() },
    );
    await waitFor(() => expect(result.current.insight?.title).toBe("行情结构中性"));

    rerender({ enabled: false });
    rerender({ enabled: true });

    await waitFor(() => expect(result.current.insight?.title).toBe("行情结构中性"));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

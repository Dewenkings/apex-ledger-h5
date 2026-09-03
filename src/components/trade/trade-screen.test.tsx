import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TradeScreen } from "@/components/screens";
import { tradingPairs } from "@/lib/trading/pairs";

vi.mock("next/navigation", () => ({
  usePathname: () => "/trade/btc-usdt",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/wallet/wallet-account-control", () => ({ WalletAccountControl: () => <button type="button">连接钱包</button> }));

const ticker = {
  instrument: "BTC-USDT",
  last: 70000,
  open24h: 68000,
  high24h: 71000,
  low24h: 67000,
  volume24h: 19000,
  timestamp: 1788048000000,
};

const candles = [
  { time: 1788044400, open: 68000, high: 69000, low: 67500, close: 68800, volume: 42, confirmed: true },
  { time: 1788048000, open: 68800, high: 70500, low: 68400, close: 70000, volume: 38, confirmed: false },
];

const aiInsight = {
  intent: "market_summary",
  insight: {
    marketBias: "bullish",
    title: "短周期结构偏强",
    summary: "价格与盘口数据暂时偏强，但仍需注意区间高位波动。",
    keyFactors: ["短周期均价结构偏强", "盘口买方深度略占优"],
    risks: ["价格接近 24 小时区间高位", "短线波动可能放大"],
    dataQuality: "high",
    sources: [{ tool: "get_market_context", source: "OKX", asOf: "2026-09-03T03:00:00.000Z" }],
    disclaimer: "基于公开市场数据，仅供信息参考，不构成投资建议。",
    fallback: false,
  },
};

afterEach(() => vi.unstubAllGlobals());

describe("TradeScreen live market integration", () => {
  it("prevents confirmation until the live price is ready", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));

    render(<TradeScreen pair={tradingPairs[0]} />);

    expect(screen.getByText("确认买入 BTC")).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("link", { name: "确认买入 BTC" })).not.toBeInTheDocument();
  });

  it("keeps a side-specific paper order ticket inline with the live order book", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => Promise.resolve(Response.json({
      source: "okx",
      data: String(input).includes("/ticker") ? ticker : candles,
    }))));

    render(<TradeScreen pair={tradingPairs[1]} />);

    const ticket = await screen.findByRole("region", { name: "ETH 模拟交易" });
    expect(ticket).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "买入" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "卖出" })).toHaveAttribute("aria-pressed", "false");
    expect(await screen.findByDisplayValue("70000.00")).toBeInTheDocument();
    expect(screen.getByText("预计费用")).toBeInTheDocument();
    expect(screen.getByText("$1.40")).toBeInTheDocument();
    const buyUrl = new URL(screen.getByRole("link", { name: "确认买入 ETH" }).getAttribute("href")!, "http://app.local");
    expect(buyUrl.pathname).toBe("/trade/eth-usdt/confirm");
    expect(buyUrl.searchParams.get("side")).toBe("buy");
    expect(screen.getByRole("button", { name: "限价" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "市价" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "卖出" }));
    expect(screen.getByRole("button", { name: "卖出" })).toHaveAttribute("aria-pressed", "true");
    const sellUrl = new URL(screen.getByRole("link", { name: "确认卖出 ETH" }).getAttribute("href")!, "http://app.local");
    expect(sellUrl.pathname).toBe("/trade/eth-usdt/confirm");
    expect(sellUrl.searchParams.get("side")).toBe("sell");
    expect(screen.getByLabelText("ETH-USDT 实时深度")).toBeInTheDocument();
  });

  it("switches real candle periods while preserving the PAPER LIVE boundary", async () => {
    const fetcher = vi.fn((input: RequestInfo | URL) => Promise.resolve(
      Response.json({
        source: "okx",
        data: String(input).includes("/ticker") ? ticker : candles,
      }),
    ));
    vi.stubGlobal("fetch", fetcher);

    render(<TradeScreen pair={tradingPairs[1]} />);

    expect(await screen.findByText("70,000.00")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "ETH/USDT" })).toBeInTheDocument();
    expect(screen.getByText("现货")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "AI 洞察" })).toBeInTheDocument();
    expect(screen.queryByLabelText("AI 行情洞察")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "收藏 ETH/USDT" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "更多行情选项" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "行情" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "行情" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "ETH 模拟交易" })).toBeInTheDocument();
    expect(screen.getAllByText("PAPER LIVE").length).toBeGreaterThan(0);
    expect(screen.getByText(/模拟费率 0\.10%/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1D" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "EMA" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "1H" }));

    await waitFor(() => {
      expect(fetcher.mock.calls.some(([url]) => String(url) === "/api/market/candles?instrument=ETH-USDT&period=1H")).toBe(true);
    });
  });

  it("opens a full Chinese AI insight tab with embedded assistant instead of a dialog", async () => {
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/ai/")) return Promise.resolve(Response.json(aiInsight));
      return Promise.resolve(Response.json({ source: "okx", data: url.includes("/ticker") ? ticker : candles }));
    });
    vi.stubGlobal("fetch", fetcher);

    render(<TradeScreen pair={tradingPairs[0]} />);

    expect(fetcher.mock.calls.some(([url]) => String(url).includes("/api/ai/insight"))).toBe(false);
    fireEvent.click(screen.getByRole("tab", { name: "AI 洞察" }));

    expect(await screen.findByRole("tabpanel", { name: "AI 洞察" })).toBeInTheDocument();
    expect(await screen.findByText("短周期结构偏强")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AI 行情助手" })).toBeInTheDocument();
    expect(screen.getByLabelText("向 AI 询问行情")).toBeInTheDocument();
    expect(screen.getByText("风险提示")).toBeInTheDocument();
    expect(screen.getByText("助手会自动携带当前交易对与周期，只基于可追溯的行情证据回答。")).toBeInTheDocument();
    expect(screen.getByText("AI 输出基于公开市场数据，仅供信息参考，不构成投资建议，也不会自动触发交易。")).toBeInTheDocument();
    expect(screen.queryByText(/作品演示|产品演示/)).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "BTC 模拟交易" })).not.toBeInTheDocument();
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("/api/ai/insight"))).toBe(true);
  });

  it("replaces the market terminal with real public instrument information", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/market/instrument")) return Promise.resolve(Response.json({ data: {
        instrument: "ETH-USDT", baseSymbol: "ETH", quoteSymbol: "USDT", state: "live",
        tickSize: "0.01", lotSize: "0.00000001", minSize: "0.0001", listedAt: 1438992000000,
      } }));
      return Promise.resolve(Response.json({ source: "okx", data: url.includes("/ticker") ? ticker : candles }));
    }));
    render(<TradeScreen pair={tradingPairs[1]} />);

    fireEvent.click(screen.getByRole("tab", { name: "信息" }));

    expect(await screen.findByText("交易规则")).toBeInTheDocument();
    expect(screen.getByText("0.0001 ETH")).toBeInTheDocument();
    expect(screen.getByText("0.01 USDT")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "买入 ETH" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "信息" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "信息" })).toBeInTheDocument();
  });
});

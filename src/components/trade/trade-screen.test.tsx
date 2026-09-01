import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TradeScreen } from "@/components/screens";
import { tradingPairs } from "@/lib/trading/pairs";

vi.mock("next/navigation", () => ({
  usePathname: () => "/trade/btc-usdt",
  useSearchParams: () => new URLSearchParams(),
}));

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

afterEach(() => vi.unstubAllGlobals());

describe("TradeScreen live market integration", () => {
  it("offers independent buy and sell confirmation links from the order ticket", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => Promise.resolve(Response.json({
      source: "okx",
      data: String(input).includes("/ticker") ? ticker : candles,
    }))));

    render(<TradeScreen pair={tradingPairs[1]} />);

    expect(await screen.findByDisplayValue("70000.00")).toBeInTheDocument();

    const buyUrl = new URL(screen.getByRole("link", { name: "买入 ETH" }).getAttribute("href")!, "http://app.local");
    const sellUrl = new URL(screen.getByRole("link", { name: "卖出 ETH" }).getAttribute("href")!, "http://app.local");
    expect(buyUrl.pathname).toBe("/trade/eth-usdt/confirm");
    expect(buyUrl.searchParams.get("side")).toBe("buy");
    expect(sellUrl.pathname).toBe("/trade/eth-usdt/confirm");
    expect(sellUrl.searchParams.get("side")).toBe("sell");
    expect(screen.getByRole("button", { name: "限价" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "市价" })).toHaveAttribute("aria-pressed", "false");
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

    expect(await screen.findByDisplayValue("70000.00")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "ETH/USDT" })).toBeInTheDocument();
    expect(screen.getByText("现货")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /AI 信号/ })).toBeDisabled();
    expect(screen.getByText("即将上线")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收藏 ETH/USDT" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "行情" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("link", { name: "买入 ETH" })).toBeInTheDocument();
    expect(screen.getAllByText("PAPER LIVE").length).toBeGreaterThan(0);
    expect(screen.getByText("模拟撮合环境，不会请求钱包交易签名或扣除真实资产")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1D" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "1H" }));

    await waitFor(() => {
      expect(fetcher.mock.calls.some(([url]) => String(url) === "/api/market/candles?instrument=ETH-USDT&period=1H")).toBe(true);
    });
  });
});

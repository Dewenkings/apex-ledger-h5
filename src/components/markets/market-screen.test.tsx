import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { marketSymbols, toMarketInstrument, type MarketSymbol } from "@/lib/market-data/types";
import { MarketScreen } from "./market-screen";

vi.mock("next/navigation", () => ({
  usePathname: () => "/markets",
}));

function overviewItem(symbol: MarketSymbol) {
  const index = marketSymbols.indexOf(symbol);
  const last = 69000 / (index + 1);
  return {
    instrument: toMarketInstrument(symbol), symbol, last,
    open24h: last * 0.98, high24h: last * 1.02, low24h: last * 0.96,
    volume24h: 1000 + index, timestamp: 1788048000000,
    spark: [last * 0.97, last * 0.99, last], source: "okx",
  };
}

function liveResponse() {
  return Response.json({
    data: marketSymbols.map(overviewItem),
    source: "okx",
    updatedAt: 1788048000000,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("MarketScreen", () => {
  it("uses one compact page heading and exposes the selected market category", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => liveResponse()));
    render(<MarketScreen />);

    await screen.findByText("实时行情");

    expect(screen.getByRole("heading", { level: 1, name: "行情概览" })).toBeInTheDocument();
    expect(screen.queryByText("全球加密市场")).not.toBeInTheDocument();
    expect(screen.queryByText("发现你的下一个机会")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "自选" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "现货" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "涨幅榜" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Layer 1" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "行情提醒" })).not.toBeInTheDocument();
  });

  it("renders a compact mover rail and eight provider-neutral assets with supported trading routes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => liveResponse()));
    render(<MarketScreen />);

    expect(screen.getByRole("status", { name: "正在加载市场行情" })).toBeInTheDocument();
    expect(await screen.findByText("实时行情")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "自选行情" }).children).toHaveLength(3);
    expect(screen.queryByText(/OKX|KRAKEN/)).not.toBeInTheDocument();
    expect(screen.getAllByText("POL").length).toBeGreaterThan(0);
    expect(screen.queryByText("MATIC")).not.toBeInTheDocument();
    expect(screen.getByTestId("market-row-BTC").closest("a")).toHaveAttribute("href", "/trade/btc-usdt");
    expect(screen.getByTestId("market-row-ETH").closest("a")).toHaveAttribute("href", "/trade/eth-usdt");
    expect(screen.getByTestId("market-row-SOL").closest("a")).toHaveAttribute("href", "/trade/sol-usdt");
    expect(screen.getByTestId("market-row-ADA").closest("a")).toBeNull();
  });

  it("filters live rows immediately for a short query and applies categories", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => liveResponse()));
    render(<MarketScreen />);
    await screen.findByText("实时行情");

    fireEvent.change(screen.getByPlaceholderText("搜索资产或交易对"), { target: { value: "p" } });
    expect(screen.getByTestId("market-row-POL")).toBeInTheDocument();
    expect(screen.queryByTestId("market-row-BTC")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("搜索资产或交易对"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "DeFi" }));
    expect(screen.getByTestId("market-row-POL")).toBeInTheDocument();
    expect(screen.queryByTestId("market-row-ETH")).not.toBeInTheDocument();
  });

  it("shows an explicit demo warning and retries public data", async () => {
    const fetcher = vi.fn(async () => new Response("unavailable", { status: 502 }));
    vi.stubGlobal("fetch", fetcher);
    render(<MarketScreen />);

    expect(await screen.findByText("演示数据")).toBeInTheDocument();
    expect(screen.getByText(/两个实时数据源暂时不可用/)).toBeInTheDocument();

    fetcher.mockImplementation(async () => liveResponse());
    fireEvent.click(screen.getByRole("button", { name: "重试市场行情" }));
    expect(await screen.findByText("实时行情")).toBeInTheDocument();
  });

  it("debounces remote spot search and distinguishes tradable from quote-only results", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith("/api/market/search")) return Response.json({ data: [
        { instrument: "DOGE-USDT", baseSymbol: "DOGE", quoteSymbol: "USDT", state: "live", tickSize: "0.00001", lotSize: "1", minSize: "1", listedAt: 1, last: "0.2", open24h: "0.19", high24h: "0.21", low24h: "0.18", volume24h: "1000", quoteVolume24h: "200", change24h: 5.263, timestamp: 2 },
        { instrument: "BTC-USDT", baseSymbol: "BTC", quoteSymbol: "USDT", state: "live", tickSize: "0.1", lotSize: "0.00001", minSize: "0.0001", listedAt: 1, last: "69000", open24h: "68000", high24h: "70000", low24h: "67000", volume24h: "120", quoteVolume24h: "8280000", change24h: 1.47, timestamp: 2 },
      ] });
      return liveResponse();
    });
    vi.stubGlobal("fetch", fetcher);
    render(<MarketScreen />);
    await act(async () => { await Promise.resolve(); });

    fireEvent.change(screen.getByPlaceholderText("搜索资产或交易对"), { target: { value: "doge" } });
    expect(fetcher.mock.calls.some(([url]) => String(url).startsWith("/api/market/search"))).toBe(false);

    expect(await screen.findByTestId("search-result-DOGE")).toBeInTheDocument();
    expect(screen.getByTestId("search-result-DOGE").closest("a")).toBeNull();
    expect(screen.getByText("仅行情")).toBeInTheDocument();
    expect(screen.getByText("0.20000 USDT")).toBeInTheDocument();
    expect(screen.getByTestId("search-result-BTC").closest("a")).toHaveAttribute("href", "/trade/btc-usdt");
  });
});

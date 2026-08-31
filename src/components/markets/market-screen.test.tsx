import { fireEvent, render, screen } from "@testing-library/react";
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

afterEach(() => vi.unstubAllGlobals());

describe("MarketScreen", () => {
  it("renders eight source-labelled live assets and links BTC, ETH and SOL trading routes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => liveResponse()));
    render(<MarketScreen />);

    expect(screen.getByRole("status", { name: "正在加载市场行情" })).toBeInTheDocument();
    expect(await screen.findByText("OKX LIVE")).toBeInTheDocument();
    expect(screen.getAllByText("POL").length).toBeGreaterThan(0);
    expect(screen.queryByText("MATIC")).not.toBeInTheDocument();
    expect(screen.getByTestId("market-row-BTC").closest("a")).toHaveAttribute("href", "/trade/btc-usdt");
    expect(screen.getByTestId("market-row-ETH").closest("a")).toHaveAttribute("href", "/trade/eth-usdt");
    expect(screen.getByTestId("market-row-SOL").closest("a")).toHaveAttribute("href", "/trade/sol-usdt");
    expect(screen.getByTestId("market-row-ADA").closest("a")).toBeNull();
  });

  it("filters live rows by query and category without changing favourites", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => liveResponse()));
    render(<MarketScreen />);
    await screen.findByText("OKX LIVE");

    fireEvent.change(screen.getByPlaceholderText("搜索资产或交易对"), { target: { value: "polygon" } });
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

    expect(await screen.findByText("DEMO DATA")).toBeInTheDocument();
    expect(screen.getByText(/两个实时数据源暂时不可用/)).toBeInTheDocument();

    fetcher.mockImplementation(async () => liveResponse());
    fireEvent.click(screen.getByRole("button", { name: "重试市场行情" }));
    expect(await screen.findByText("OKX LIVE")).toBeInTheDocument();
  });
});

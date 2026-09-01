import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TradeMarketPanel } from "./trade-market-panel";
import { tradingPairs } from "@/lib/trading/pairs";

const ticker = {
  instrument: "BTC-USDT",
  last: 68342.1,
  open24h: 66455.6,
  high24h: 69180,
  low24h: 65911.4,
  volume24h: 18743.2,
  timestamp: 1788048000000,
};

const candles = [
  { time: 1788044400, open: 68000, high: 68400, low: 67900, close: 68200, volume: 42, confirmed: true },
  { time: 1788048000, open: 68200, high: 68500, low: 68100, close: 68342.1, volume: 38, confirmed: false },
];

function okMarketFetch(input: RequestInfo | URL): Promise<Response> {
  const url = String(input);
  return Promise.resolve(Response.json({
    source: "okx",
    data: url.includes("/ticker") ? ticker : candles,
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe("TradeMarketPanel", () => {
  it("loads BTC-USDT public data with 1D selected by default", async () => {
    vi.stubGlobal("fetch", vi.fn(okMarketFetch));

    render(<TradeMarketPanel pair={tradingPairs[0]} />);

    expect(screen.getByRole("status", { name: "正在加载实时行情" })).toBeInTheDocument();
    expect(await screen.findByText("68,342.10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1D" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("实时行情")).toBeInTheDocument();
    expect(screen.getByText("24H 最高")).toBeInTheDocument();
    expect(screen.getByText("24H 最低")).toBeInTheDocument();
    expect(screen.getByText("24H 成交量 (BTC)")).toBeInTheDocument();
    expect(screen.getByText("24H 成交额 (USDT)")).toBeInTheDocument();
    expect(screen.queryByText(/OKX|KRAKEN/)).not.toBeInTheDocument();
    expect(screen.queryByText("标记价格")).not.toBeInTheDocument();
    expect(screen.queryByText("持仓量")).not.toBeInTheDocument();
  });

  it("requests and selects the candle period the user taps", async () => {
    const fetcher = vi.fn(okMarketFetch);
    vi.stubGlobal("fetch", fetcher);
    render(<TradeMarketPanel pair={tradingPairs[0]} />);
    await screen.findByText("68,342.10");

    fireEvent.click(screen.getByRole("button", { name: "4H" }));

    expect(screen.getByRole("button", { name: "4H" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => {
      expect(fetcher.mock.calls.some(([url]) => String(url) === "/api/market/candles?instrument=BTC-USDT&period=4H")).toBe(true);
    });
  });

  it("labels fallback data and retries failed public requests", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return new Response("unavailable", { status: 502 });
    });
    vi.stubGlobal("fetch", fetcher);
    render(<TradeMarketPanel pair={tradingPairs[0]} />);

    expect(await screen.findByText("演示数据")).toBeInTheDocument();
    fetcher.mockImplementation(okMarketFetch);
    fireEvent.click(screen.getByRole("button", { name: "重试实时行情" }));

    expect(await screen.findByText("实时行情")).toBeInTheDocument();
  });

  it("keeps the upstream provider neutral when backup real data serves the market", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => Promise.resolve(Response.json({
      source: "kraken",
      data: String(input).includes("/ticker") ? ticker : candles,
    }))));

    render(<TradeMarketPanel pair={tradingPairs[0]} />);

    expect(await screen.findByText("实时行情")).toBeInTheDocument();
    expect(screen.queryByText(/KRAKEN|OKX/)).not.toBeInTheDocument();
  });

  it("queries and labels ETH when the route selects ETH-USDT", async () => {
    const ethTicker = { ...ticker, instrument: "ETH-USDT", last: 3500, volume24h: 125000 };
    const fetcher = vi.fn((input: RequestInfo | URL) => Promise.resolve(Response.json({
      source: "okx",
      data: String(input).includes("/ticker") ? ethTicker : candles,
    })));
    vi.stubGlobal("fetch", fetcher);

    render(<TradeMarketPanel pair={tradingPairs[1]} />);

    expect(await screen.findByRole("region", { name: "ETH/USDT 实时行情" })).toBeInTheDocument();
    expect(screen.getByLabelText("ETH-USDT 蜡烛图")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith(
      "/api/market/ticker?instrument=ETH-USDT",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});

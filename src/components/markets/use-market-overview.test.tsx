import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { marketSymbols, toMarketInstrument, type MarketSymbol } from "@/lib/market-data/types";
import { useMarketOverview, type OverviewDisplaySource } from "./use-market-overview";

const labels: Record<OverviewDisplaySource, string> = {
  okx: "OKX LIVE",
  kraken: "KRAKEN LIVE",
  mixed: "MIXED LIVE",
  "mixed-data": "MIXED DATA",
  demo: "DEMO DATA",
};

function liveItem(symbol: MarketSymbol, source: "okx" | "kraken" = "okx") {
  const index = marketSymbols.indexOf(symbol);
  const last = 69000 - index * 1000;
  return {
    instrument: toMarketInstrument(symbol),
    symbol,
    last,
    open24h: last - 100,
    high24h: last + 200,
    low24h: last - 200,
    volume24h: 100 + index,
    timestamp: 1788048000000,
    spark: [last - 50, last],
    source,
  };
}

function responseFor(symbols: MarketSymbol[]) {
  return Response.json({
    data: symbols.map((symbol) => liveItem(symbol)),
    source: "okx",
    updatedAt: 1788048000000,
  });
}

function OverviewProbe() {
  const overview = useMarketOverview();
  if (overview.isInitialLoading) return <span>LOADING</span>;
  return <div>
    <span>{labels[overview.source]}</span>
    <span>{overview.hasError ? "ERROR" : "HEALTHY"}</span>
    {overview.markets.map((market) => <span key={market.symbol}>{market.symbol}:{market.price}</span>)}
    <button type="button" onClick={overview.retry}>RETRY</button>
  </div>;
}

afterEach(() => vi.unstubAllGlobals());

describe("useMarketOverview", () => {
  it("keeps live rows and labels missing catalogue rows as demo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responseFor(["BTC"])));

    render(<OverviewProbe />);

    expect(screen.getByText("LOADING")).toBeInTheDocument();
    expect(await screen.findByText("MIXED DATA")).toBeInTheDocument();
    expect(screen.getByText("BTC:69000")).toBeInTheDocument();
    expect(screen.getByText(/BNB:/)).toBeInTheDocument();
  });

  it("uses explicit demo data after total failure and retries into live data", async () => {
    const fetcher = vi.fn(async () => new Response("unavailable", { status: 502 }));
    vi.stubGlobal("fetch", fetcher);
    render(<OverviewProbe />);

    expect(await screen.findByText("DEMO DATA")).toBeInTheDocument();
    expect(screen.getByText("ERROR")).toBeInTheDocument();

    fetcher.mockImplementation(async () => responseFor([...marketSymbols]));
    fireEvent.click(screen.getByRole("button", { name: "RETRY" }));

    expect(await screen.findByText("OKX LIVE")).toBeInTheDocument();
    expect(screen.getByText("HEALTHY")).toBeInTheDocument();
  });

  it("retains the last live rows when a refresh fails", async () => {
    const fetcher = vi.fn(async () => responseFor([...marketSymbols]));
    vi.stubGlobal("fetch", fetcher);
    render(<OverviewProbe />);
    await screen.findByText("OKX LIVE");

    fetcher.mockImplementation(async () => new Response("unavailable", { status: 502 }));
    fireEvent.click(screen.getByRole("button", { name: "RETRY" }));

    await waitFor(() => expect(screen.getByText("ERROR")).toBeInTheDocument());
    expect(screen.getByText("OKX LIVE")).toBeInTheDocument();
    expect(screen.getByText("BTC:69000")).toBeInTheDocument();
  });
});

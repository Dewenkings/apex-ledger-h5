"use client";

import { TrendUp, WarningCircle } from "@phosphor-icons/react";
import { useEffect } from "react";

import { chartPeriods } from "@/lib/market-data/types";
import { Change } from "@/components/ui";
import { CandlestickChart } from "./candlestick-chart";
import { useTradeMarket } from "./use-trade-market";
import type { TradingPairConfig } from "@/lib/trading/pairs";

const priceFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function compactVolume(value: number, symbol: string): string {
  return `${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value)} ${symbol}`;
}

const sourceLabels = {
  okx: "OKX LIVE",
  kraken: "KRAKEN LIVE",
  mixed: "MIXED LIVE",
  demo: "DEMO DATA",
} as const;

export function TradeMarketPanel({ pair, onPriceChange }: { pair: TradingPairConfig; onPriceChange?: (price: number) => void }) {
  const market = useTradeMarket(pair);
  const ticker = market.ticker;
  const change = ticker && ticker.open24h !== 0
    ? ((ticker.last - ticker.open24h) / ticker.open24h) * 100
    : 0;

  useEffect(() => {
    if (ticker) onPriceChange?.(ticker.last);
  }, [onPriceChange, ticker]);

  if (market.isInitialLoading) {
    return <div className="market-loading" role="status" aria-label="正在加载实时行情">
      <div className="market-skeleton quote" />
      <div className="market-skeleton chart" />
    </div>;
  }

  return <>
    <section className="quote-card">
      <div>
        <div className="row gap-10">
          <span className="muted">{pair.baseSymbol}/{pair.quoteSymbol}</span>
          <span className={`market-source ${market.isFallback ? "fallback" : market.source !== "okx" ? "backup" : ""}`}>
            {sourceLabels[market.source]}
          </span>
        </div>
        <div className="quote-price mono">{priceFormatter.format(ticker?.last ?? 0)}</div>
        <Change value={change} />
      </div>
      <div className="quote-stats">
        <span><i>24h High</i><b className="mono">{priceFormatter.format(ticker?.high24h ?? 0)}</b></span>
        <span><i>24h Low</i><b className="mono">{priceFormatter.format(ticker?.low24h ?? 0)}</b></span>
        <span><i>Volume</i><b className="mono">{compactVolume(ticker?.volume24h ?? 0, pair.baseSymbol)}</b></span>
      </div>
    </section>
    <section className="chart-card live-chart-card">
      <div className="row between chart-toolbar">
        <div className="time-tabs" aria-label="K线周期">
          {chartPeriods.map((period) => <button
            type="button"
            aria-pressed={market.period === period}
            className={market.period === period ? "active" : ""}
            onClick={() => market.setPeriod(period)}
            key={period}
          >{period}</button>)}
        </div>
        <div className="row gap-10">
          {market.isRefreshing && <span className="chart-refreshing" role="status">更新中</span>}
          <TrendUp className="muted" />
        </div>
      </div>
      <CandlestickChart instrument={pair.instrument} candles={market.candles} />
      {market.hasError && <div className="market-error">
        <WarningCircle />
        <span>实时行情暂时不可用，当前展示演示回退数据。</span>
        <button type="button" aria-label="重试实时行情" onClick={market.retry}>重试</button>
      </div>}
    </section>
  </>;
}

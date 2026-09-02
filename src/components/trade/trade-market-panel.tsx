"use client";

import { TrendUp, WarningCircle } from "@phosphor-icons/react";
import { useEffect } from "react";

import { chartPeriods, type ChartPeriod } from "@/lib/market-data/types";
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

export function TradeMarketPanel({ pair, onPriceChange, onPeriodChange }: { pair: TradingPairConfig; onPriceChange?: (price: number) => void; onPeriodChange?: (period: ChartPeriod) => void }) {
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

  const lastPrice = ticker?.last ?? 0;
  const volume = ticker?.volume24h ?? 0;
  const turnover = lastPrice * volume;

  return <>
    <section className="trade-quote-summary" aria-label={`${pair.baseSymbol}/${pair.quoteSymbol} 实时行情`}>
      <div className="trade-primary-quote">
        <div className="trade-quote-label"><span className={`live-dot ${market.isFallback ? "fallback" : ""}`} />{market.isFallback ? "演示数据" : "实时行情"}</div>
        <div className="trade-live-price mono">{priceFormatter.format(lastPrice)}</div>
        <Change value={change} />
      </div>
      <dl className="trade-quote-metrics">
        <div><dt>24H 最高</dt><dd className="mono">{priceFormatter.format(ticker?.high24h ?? 0)}</dd></div>
        <div><dt>24H 最低</dt><dd className="mono">{priceFormatter.format(ticker?.low24h ?? 0)}</dd></div>
        <div><dt>24H 成交量 ({pair.baseSymbol})</dt><dd className="mono">{compactVolume(volume, "").trim()}</dd></div>
        <div><dt>24H 成交额 ({pair.quoteSymbol})</dt><dd className="mono">{compactVolume(turnover, "").trim()}</dd></div>
      </dl>
    </section>
    <section className="chart-card live-chart-card">
      <div className="row between chart-toolbar">
        <div className="time-tabs" aria-label="K线周期">
          {chartPeriods.map((period) => <button
            type="button"
            aria-pressed={market.period === period}
            className={market.period === period ? "active" : ""}
            onClick={() => { market.setPeriod(period); onPeriodChange?.(period); }}
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

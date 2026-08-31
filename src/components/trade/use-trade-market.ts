"use client";

import { useCallback, useEffect, useState } from "react";

import type { ChartPeriod, LiveMarketResponse, LiveMarketSource, MarketCandle, MarketTicker } from "@/lib/market-data/types";
import type { TradingPairConfig } from "@/lib/trading/pairs";

type DataSource = LiveMarketSource | "demo";
export type MarketDisplaySource = DataSource | "mixed";

const fallbackPrices = { BTC: 68342.1, ETH: 3498.2, SOL: 174.8 } as const;
const periodSeconds: Record<ChartPeriod, number> = { "1H": 3600, "4H": 14400, "1D": 86400, "1W": 604800 };

function fallbackTicker(pair: TradingPairConfig): MarketTicker {
  const last = fallbackPrices[pair.baseSymbol];
  return { instrument: pair.instrument, last, open24h: last * .975, high24h: last * 1.018, low24h: last * .965, volume24h: 18743.2, timestamp: 1788048000000 };
}

function buildFallbackCandles(pair: TradingPairConfig, period: ChartPeriod): MarketCandle[] {
  const step = periodSeconds[period];
  const last = fallbackPrices[pair.baseSymbol];
  let previousClose = last * .945;
  return Array.from({ length: 72 }, (_, index) => {
    const direction = Math.sin(index * .73) * last * .006 + last * .0008;
    const open = previousClose;
    const close = open + direction;
    previousClose = close;
    return { time: 1788048000 - (71 - index) * step, open, high: Math.max(open, close) + last * .0025, low: Math.min(open, close) - last * .0022, close, volume: 24 + (index % 9) * 4.7, confirmed: index < 71 };
  });
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Market data request failed");
  return response.json() as Promise<T>;
}

export function useTradeMarket(pair: TradingPairConfig) {
  const [period, setPeriod] = useState<ChartPeriod>("1D");
  const [ticker, setTicker] = useState<MarketTicker | null>(null);
  const [candles, setCandles] = useState<MarketCandle[]>([]);
  const [tickerLoading, setTickerLoading] = useState(true);
  const [candlesLoading, setCandlesLoading] = useState(true);
  const [tickerSource, setTickerSource] = useState<DataSource>("okx");
  const [candlesSource, setCandlesSource] = useState<DataSource>("okx");
  const [tickerError, setTickerError] = useState(false);
  const [candlesError, setCandlesError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getJson<LiveMarketResponse<MarketTicker>>(`/api/market/ticker?instrument=${pair.instrument}`, controller.signal)
      .then((response) => { setTicker(response.data); setTickerSource(response.source); setTickerError(false); })
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) { setTicker(fallbackTicker(pair)); setTickerSource("demo"); setTickerError(true); } })
      .finally(() => { if (!controller.signal.aborted) setTickerLoading(false); });
    return () => controller.abort();
  }, [pair, retryKey]);

  useEffect(() => {
    const controller = new AbortController();
    getJson<LiveMarketResponse<MarketCandle[]>>(`/api/market/candles?instrument=${pair.instrument}&period=${period}`, controller.signal)
      .then((response) => { if (!response.data.length) throw new Error("Empty candle response"); setCandles(response.data); setCandlesSource(response.source); setCandlesError(false); })
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) { setCandles(buildFallbackCandles(pair, period)); setCandlesSource("demo"); setCandlesError(true); } })
      .finally(() => { if (!controller.signal.aborted) setCandlesLoading(false); });
    return () => controller.abort();
  }, [pair, period, retryKey]);

  const selectPeriod = useCallback((next: ChartPeriod) => { setCandlesLoading(true); setPeriod(next); }, []);
  const retry = useCallback(() => { setTickerLoading(true); setCandlesLoading(true); setRetryKey((key) => key + 1); }, []);
  const source: MarketDisplaySource = tickerSource === "demo" || candlesSource === "demo" ? "demo" : tickerSource === candlesSource ? tickerSource : "mixed";
  return { period, setPeriod: selectPeriod, ticker, candles, isInitialLoading: (!ticker || !candles.length) && (tickerLoading || candlesLoading), isRefreshing: !!candles.length && candlesLoading, source, isFallback: source === "demo", hasError: tickerError || candlesError, retry };
}

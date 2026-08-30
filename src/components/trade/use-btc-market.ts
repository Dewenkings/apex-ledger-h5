"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  ChartPeriod,
  LiveMarketResponse,
  LiveMarketSource,
  MarketCandle,
  MarketTicker,
} from "@/lib/market-data/types";

type DataSource = LiveMarketSource | "demo";
export type MarketDisplaySource = DataSource | "mixed";

const fallbackTicker: MarketTicker = {
  instrument: "BTC-USDT",
  last: 68342.1,
  open24h: 66455.6,
  high24h: 69180,
  low24h: 65911.4,
  volume24h: 18743.2,
  timestamp: 1788048000000,
};

const periodSeconds: Record<ChartPeriod, number> = {
  "1H": 60 * 60,
  "4H": 4 * 60 * 60,
  "1D": 24 * 60 * 60,
  "1W": 7 * 24 * 60 * 60,
};

function buildFallbackCandles(period: ChartPeriod): MarketCandle[] {
  const step = periodSeconds[period];
  const end = 1788048000;
  let previousClose = 64600;

  return Array.from({ length: 72 }, (_, index) => {
    const direction = Math.sin(index * 0.73) * 430 + 55;
    const open = previousClose;
    const close = open + direction;
    const candle: MarketCandle = {
      time: end - (71 - index) * step,
      open,
      high: Math.max(open, close) + 170 + (index % 4) * 22,
      low: Math.min(open, close) - 150 - (index % 3) * 18,
      close,
      volume: 24 + (index % 9) * 4.7,
      confirmed: index < 71,
    };
    previousClose = close;
    return candle;
  });
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Market data request failed");
  return response.json() as Promise<T>;
}

export function useBtcMarket() {
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
    getJson<LiveMarketResponse<MarketTicker>>("/api/market/ticker", controller.signal)
      .then((response) => {
        setTicker(response.data);
        setTickerSource(response.source);
        setTickerError(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setTicker(fallbackTicker);
        setTickerSource("demo");
        setTickerError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setTickerLoading(false);
      });
    return () => controller.abort();
  }, [retryKey]);

  useEffect(() => {
    const controller = new AbortController();
    getJson<LiveMarketResponse<MarketCandle[]>>(`/api/market/candles?period=${period}`, controller.signal)
      .then((response) => {
        const nextCandles = response.data;
        if (!Array.isArray(nextCandles) || nextCandles.length === 0) {
          throw new Error("Empty candle response");
        }
        setCandles(nextCandles);
        setCandlesSource(response.source);
        setCandlesError(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCandles(buildFallbackCandles(period));
        setCandlesSource("demo");
        setCandlesError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCandlesLoading(false);
      });
    return () => controller.abort();
  }, [period, retryKey]);

  const selectPeriod = useCallback((nextPeriod: ChartPeriod) => {
    setCandlesLoading(true);
    setPeriod(nextPeriod);
  }, []);
  const retry = useCallback(() => {
    setTickerLoading(true);
    setCandlesLoading(true);
    setRetryKey((key) => key + 1);
  }, []);
  const source: MarketDisplaySource = tickerSource === "demo" || candlesSource === "demo"
    ? "demo"
    : tickerSource === candlesSource ? tickerSource : "mixed";

  return {
    period,
    setPeriod: selectPeriod,
    ticker,
    candles,
    isInitialLoading: (!ticker || candles.length === 0) && (tickerLoading || candlesLoading),
    isRefreshing: candles.length > 0 && candlesLoading,
    source,
    isFallback: source === "demo",
    hasError: tickerError || candlesError,
    retry,
  };
}

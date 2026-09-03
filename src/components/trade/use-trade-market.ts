"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

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
  const tickerQuery = useQuery({
    queryKey: ["market", "ticker", pair.instrument],
    queryFn: ({ signal }) => getJson<LiveMarketResponse<MarketTicker>>(`/api/market/ticker?instrument=${pair.instrument}`, signal),
    staleTime: 10_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const candlesQuery = useQuery({
    queryKey: ["market", "candles", pair.instrument, period],
    queryFn: async ({ signal }) => {
      const response = await getJson<LiveMarketResponse<MarketCandle[]>>(`/api/market/candles?instrument=${pair.instrument}&period=${period}`, signal);
      if (!response.data.length) throw new Error("Empty candle response");
      return response;
    },
    staleTime: 30_000,
    gcTime: 15 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const ticker = tickerQuery.data?.data ?? (tickerQuery.isError ? fallbackTicker(pair) : null);
  const candles = candlesQuery.data?.data ?? (candlesQuery.isError ? buildFallbackCandles(pair, period) : []);
  const tickerSource: DataSource = tickerQuery.isError ? "demo" : (tickerQuery.data?.source ?? "okx");
  const candlesSource: DataSource = candlesQuery.isError ? "demo" : (candlesQuery.data?.source ?? "okx");
  const selectPeriod = useCallback((next: ChartPeriod) => setPeriod(next), []);
  const retry = useCallback(() => { void tickerQuery.refetch(); void candlesQuery.refetch(); }, [candlesQuery, tickerQuery]);
  const source: MarketDisplaySource = tickerSource === "demo" || candlesSource === "demo" ? "demo" : tickerSource === candlesSource ? tickerSource : "mixed";
  return {
    period,
    setPeriod: selectPeriod,
    ticker,
    candles,
    isInitialLoading: (!ticker || !candles.length) && (tickerQuery.isPending || candlesQuery.isPending),
    isRefreshing: !!candles.length && candlesQuery.isFetching,
    source,
    isFallback: source === "demo",
    hasError: tickerQuery.isError || candlesQuery.isError,
    retry,
  };
}

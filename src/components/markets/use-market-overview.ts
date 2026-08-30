"use client";

import { useCallback, useEffect, useState } from "react";

import { markets as marketCatalogue, type MarketCatalogueItem } from "@/lib/data";
import type {
  LiveMarketSource,
  MarketOverviewItem,
  MarketOverviewResponse,
} from "@/lib/market-data/types";

export type OverviewDisplaySource = LiveMarketSource | "mixed" | "mixed-data" | "demo";

export type OverviewMarket = MarketCatalogueItem & {
  open24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: number;
  source: LiveMarketSource | "demo";
};

type OverviewSnapshot = {
  markets: OverviewMarket[];
  source: OverviewDisplaySource;
  updatedAt: number | null;
};

function demoMarket(market: MarketCatalogueItem): OverviewMarket {
  const open24h = market.price / (1 + market.change / 100);
  return {
    ...market,
    open24h,
    high24h: Math.max(open24h, market.price),
    low24h: Math.min(open24h, market.price),
    volume24h: 0,
    timestamp: 0,
    source: "demo",
  };
}

function liveMarket(catalogue: MarketCatalogueItem, item: MarketOverviewItem): OverviewMarket {
  const change = item.open24h === 0 ? 0 : ((item.last - item.open24h) / item.open24h) * 100;
  return {
    ...catalogue,
    price: item.last,
    change,
    spark: item.spark,
    open24h: item.open24h,
    high24h: item.high24h,
    low24h: item.low24h,
    volume24h: item.volume24h,
    timestamp: item.timestamp,
    source: item.source,
  };
}

function mergeOverview(response: MarketOverviewResponse): OverviewSnapshot {
  if (!Array.isArray(response.data) || response.data.length === 0) {
    throw new Error("Empty market overview response");
  }
  const liveBySymbol = new Map(response.data.map((item) => [item.symbol, item]));
  const merged = marketCatalogue.map((catalogue) => {
    const live = liveBySymbol.get(catalogue.symbol);
    return live ? liveMarket(catalogue, live) : demoMarket(catalogue);
  });
  const containsDemo = merged.some(({ source }) => source === "demo");

  return {
    markets: merged,
    source: containsDemo ? "mixed-data" : response.source,
    updatedAt: response.updatedAt,
  };
}

const demoSnapshot: OverviewSnapshot = {
  markets: marketCatalogue.map(demoMarket),
  source: "demo",
  updatedAt: null,
};

export function useMarketOverview() {
  const [snapshot, setSnapshot] = useState<OverviewSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/market/overview", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Market overview request failed");
        return response.json() as Promise<MarketOverviewResponse>;
      })
      .then((response) => {
        setSnapshot(mergeOverview(response));
        setHasError(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSnapshot((current) => current ?? demoSnapshot);
        setHasError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retryKey]);

  const retry = useCallback(() => setRetryKey((key) => key + 1), []);

  return {
    markets: snapshot?.markets ?? [],
    source: snapshot?.source ?? "demo",
    updatedAt: snapshot?.updatedAt ?? null,
    isInitialLoading: snapshot === null && loading,
    isRefreshing: snapshot !== null && loading,
    hasError,
    retry,
  };
}

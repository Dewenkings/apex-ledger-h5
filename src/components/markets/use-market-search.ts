"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { SpotMarketSearchResult } from "@/lib/market-data/types";

type SearchState = "idle" | "loading" | "ready" | "error";
type SearchSnapshot = { query: string; results: SpotMarketSearchResult[]; state: SearchState };

export function useMarketSearch(query: string) {
  const normalizedQuery = query.trim();
  const [snapshot, setSnapshot] = useState<SearchSnapshot>({ query: "", results: [], state: "idle" });
  const [retryKey, setRetryKey] = useState(0);
  const requestVersion = useRef(0);

  useEffect(() => {
    const version = ++requestVersion.current;
    if (normalizedQuery.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (requestVersion.current !== version) return;
      setSnapshot({ query: normalizedQuery, results: [], state: "loading" });
      fetch(`/api/market/search?q=${encodeURIComponent(normalizedQuery)}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("Market search request failed");
          return response.json() as Promise<{ data: SpotMarketSearchResult[] }>;
        })
        .then(({ data }) => {
          if (requestVersion.current !== version || controller.signal.aborted) return;
          setSnapshot({ query: normalizedQuery, results: Array.isArray(data) ? data : [], state: "ready" });
        })
        .catch((error: unknown) => {
          void error;
          if (requestVersion.current !== version || controller.signal.aborted) return;
          setSnapshot({ query: normalizedQuery, results: [], state: "error" });
        });
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedQuery, retryKey]);

  const retry = useCallback(() => {
    setSnapshot({ query: normalizedQuery, results: [], state: "loading" });
    setRetryKey((key) => key + 1);
  }, [normalizedQuery]);
  const isActive = normalizedQuery.length >= 2;
  const current = isActive && snapshot.query === normalizedQuery
    ? snapshot
    : { query: normalizedQuery, results: [], state: isActive ? "loading" as const : "idle" as const };
  return { results: current.results, state: current.state, retry, isActive };
}

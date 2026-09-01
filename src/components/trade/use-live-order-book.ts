"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { OkxBooks5Client, type OrderBookConnectionStatus } from "@/lib/market-data/okx-books5-client";
import type { LiveMarketResponse, OrderBookSnapshot } from "@/lib/market-data/types";
import type { TradingPairConfig } from "@/lib/trading/pairs";

type DisplayStatus = Exclude<OrderBookConnectionStatus, "stopped"> | "snapshot";

async function loadRestSnapshot(instrument: string, signal?: AbortSignal): Promise<OrderBookSnapshot> {
  const response = await fetch(`/api/market/order-book?instrument=${instrument}`, { signal });
  if (!response.ok) throw new Error("Order book request failed");
  const payload = await response.json() as LiveMarketResponse<OrderBookSnapshot>;
  return payload.data;
}

export function useLiveOrderBook(pair: TradingPairConfig) {
  const [snapshot, setSnapshot] = useState<OrderBookSnapshot | null>(null);
  const [status, setStatus] = useState<DisplayStatus>("connecting");
  const hasSnapshot = useRef(false);
  const statusRef = useRef<DisplayStatus>("connecting");
  const pendingSnapshot = useRef<OrderBookSnapshot | null>(null);
  const animationFrame = useRef<number | null>(null);

  const updateStatus = useCallback((next: DisplayStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const publishSnapshot = useCallback((next: OrderBookSnapshot, live: boolean) => {
    pendingSnapshot.current = next;
    if (animationFrame.current !== null) return;
    animationFrame.current = requestAnimationFrame(() => {
      animationFrame.current = null;
      const pending = pendingSnapshot.current;
      if (!pending) return;
      hasSnapshot.current = true;
      setSnapshot(pending);
      updateStatus(live ? "live" : "snapshot");
    });
  }, [updateStatus]);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const refreshSnapshot = () => loadRestSnapshot(pair.instrument, controller.signal)
      .then((next) => {
        if (!disposed && statusRef.current !== "live") publishSnapshot(next, false);
      })
      .catch(() => undefined);

    void refreshSnapshot();
    const client = new OkxBooks5Client({
      instrument: pair.instrument,
      onSnapshot: (next) => publishSnapshot(next, true),
      onStatus: (next) => {
        if (next === "live") return;
        if (next === "stopped") {
          if (hasSnapshot.current) updateStatus("snapshot");
          return;
        }
        updateStatus(hasSnapshot.current ? "snapshot" : next);
      },
    });
    client.start();

    const poll = setInterval(() => {
      if (statusRef.current !== "live") void refreshSnapshot();
    }, 5_000);
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") client.stop();
      else client.start();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      disposed = true;
      controller.abort();
      clearInterval(poll);
      document.removeEventListener("visibilitychange", handleVisibility);
      client.stop();
      if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
      pendingSnapshot.current = null;
    };
  }, [pair.instrument, publishSnapshot, updateStatus]);

  return { snapshot, status };
}

"use client";

import { useCallback, useEffect, useState } from "react";

import type { DemoBalance, DemoFill, DemoOrder, DemoOrderSnapshot } from "@/lib/okx-demo/contracts";

type AccountState = "loading" | "locked" | "ready" | "error";

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "OKX Demo request failed");
  return result;
}

export function useDemoAccount() {
  const [state, setState] = useState<AccountState>("loading");
  const [orders, setOrders] = useState<DemoOrderSnapshot[]>([]);
  const [fills, setFills] = useState<DemoFill[]>([]);
  const [balance, setBalance] = useState<DemoBalance | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const session = await getJson<{ authenticated: boolean }>("/api/demo/session");
      if (!session.authenticated) { setState("locked"); return; }
      const [orderResult, fillResult, balanceResult] = await Promise.all([
        getJson<{ orders: DemoOrderSnapshot[] }>("/api/demo/orders"),
        getJson<{ fills: DemoFill[] }>("/api/demo/fills"),
        getJson<{ balance: DemoBalance }>("/api/demo/balance"),
      ]);
      setOrders(orderResult.orders); setFills(fillResult.fills); setBalance(balanceResult.balance); setState("ready");
    } catch (error) { setMessage(error instanceof Error ? error.message : "OKX Demo 暂时不可用"); setState("error"); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const reload = useCallback(() => {
    setState("loading");
    void load();
  }, [load]);

  const cancel = useCallback(async (order: DemoOrder) => {
    try {
      await getJson(`/api/demo/orders/${encodeURIComponent(order.ordId)}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instrument: order.instrument }) });
      setMessage("撤单请求已发送");
    } catch (error) { setMessage(error instanceof Error ? error.message : "撤单失败"); }
  }, []);

  return { state, orders, fills, balance, message, cancel, reload };
}

"use client";

import { ArrowRight, Check, CheckCircle, Info, ShieldCheck } from "@phosphor-icons/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { BrandHeader } from "@/components/brand-header";
import { PaperBadge } from "@/components/ui";
import type { TradingPairConfig } from "@/lib/trading/pairs";

type AccessState = "checking" | "locked" | "ready";
type Receipt = { ordId: string; clOrdId: string; accepted: true };

export function ConfirmScreen({ pair }: { pair: TradingPairConfig }) {
  const params = useSearchParams();
  const side = params.get("side") === "sell" ? "sell" : "buy";
  const type = params.get("type") === "market" ? "market" : "limit";
  const amount = params.get("amount") || pair.demoAmount;
  const price = params.get("price") || "";
  const [access, setAccess] = useState<AccessState>("checking");
  const [accessCode, setAccessCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/demo/session", { credentials: "same-origin", signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<{ authenticated?: boolean }> : { authenticated: false })
      .then((result) => setAccess(result.authenticated ? "ready" : "locked"))
      .catch((requestError: unknown) => { if (!(requestError instanceof DOMException && requestError.name === "AbortError")) setAccess("locked"); });
    return () => controller.abort();
  }, []);

  async function unlock() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/demo/session", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessCode }) });
      const result = await response.json() as { authenticated?: boolean; error?: string };
      if (!response.ok || !result.authenticated) throw new Error(result.error || "演示访问码无效");
      setAccess("ready");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "无法进入模拟盘"); }
    finally { setBusy(false); }
  }

  async function submit() {
    setBusy(true); setError("");
    try {
      const order = { instrument: pair.instrument, side, type, amount, ...(type === "limit" ? { price } : {}) };
      const response = await fetch("/api/demo/orders", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "Idempotency-Key": globalThis.crypto?.randomUUID?.() ?? `${Date.now()}` }, body: JSON.stringify(order) });
      const result = await response.json() as Receipt & { error?: string };
      if (!response.ok || !result.accepted) throw new Error(result.error || "OKX Demo 未受理订单");
      setReceipt(result);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "订单提交失败"); }
    finally { setBusy(false); }
  }

  if (receipt) return <AppShell hideNav><div className="result-screen"><div className="success-orb"><Check /></div><PaperBadge /><h1>OKX 模拟订单已受理</h1><p>{side === "buy" ? "买入" : "卖出"} {amount} {pair.baseSymbol} 已提交到 OKX Demo Trading。</p><div className="receipt"><span>OKX 订单号 <b className="mono">{receipt.ordId}</b></span><span>客户端订单号 <b className="mono">{receipt.clOrdId}</b></span><span>真实扣款 <b className="positive">¥0.00</b></span></div><Link href="/orders" className="primary-button">查看订单 <ArrowRight /></Link><Link href="/markets" className="secondary-button">返回行情</Link></div></AppShell>;

  return <AppShell hideNav><div className="modal-page"><BrandHeader title="确认模拟订单" subtitle="OKX DEMO ORDER" back={`/trade/${pair.pairSlug}`} /><section className="confirm-hero"><div className="security-icon"><ShieldCheck /></div><h2>请核对订单信息</h2><p>订单将进入 OKX 官方 Demo Trading 环境；不会生成链上交易，不会扣除钱包资产。</p></section><section className="confirm-card"><div className="row between"><span className="muted">订单方向</span><strong className={side === "buy" ? "positive" : "negative"}>{side === "buy" ? "买入" : "卖出"} {pair.baseSymbol}</strong></div><div className="detail-list"><span>交易对 <b>{pair.baseSymbol}/{pair.quoteSymbol}</b></span><span>订单类型 <b>{type === "limit" ? "限价单" : "市价单"}</b></span>{type === "limit" && <span>限价 <b className="mono">{price} USDT</b></span>}<span>数量 <b className="mono">{amount} {pair.baseSymbol}</b></span><span>环境 <PaperBadge /></span></div></section><div className="warning-box"><Info /><span><strong>共享的虚拟交易所账户</strong>订单仅展示在当前访客工作区；余额会明确标注为共享 Demo 余额。</span></div>
    {access === "checking" && <p className="safety-note" role="status">正在验证演示权限…</p>}
    {access === "locked" && <section className="trade-panel"><h3>需要演示访问码</h3><label className="field"><span>演示访问码</span><div><input aria-label="演示访问码" type="password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} autoComplete="off" /></div></label><button type="button" disabled={busy || !accessCode} onClick={unlock} className="primary-button">进入 OKX 模拟盘</button></section>}
    {access === "ready" && <button type="button" disabled={busy} onClick={submit} className="primary-button">{busy ? "正在提交…" : "提交到 OKX Demo Trading"} <CheckCircle /></button>}
    {error && <div className="market-overview-warning" role="alert"><Info /><span>{error}</span></div>}
    <Link href={`/trade/${pair.pairSlug}`} className="secondary-button">返回修改</Link></div></AppShell>;
}

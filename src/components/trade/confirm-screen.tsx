"use client";

import { ArrowRight, Check, CheckCircle, Info, ShieldCheck } from "@phosphor-icons/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { BrandHeader } from "@/components/layout/brand-header";
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

  if (receipt) {
    return <AppShell hideNav>
      <div className="result-screen compact-result">
        <div className="success-orb"><Check weight="bold" /></div>
        <PaperBadge />
        <h1>模拟订单已受理</h1>
        <p>{side === "buy" ? "买入" : "卖出"} {amount} {pair.baseSymbol} 已提交至 OKX Demo Trading。</p>
        <section className="receipt-ticket" aria-label="订单回执">
          <div className="receipt-ticket-head">
            <span>OKX DEMO RECEIPT</span>
            <strong className={side === "buy" ? "positive" : "negative"}>{side === "buy" ? "买入" : "卖出"} {pair.baseSymbol}</strong>
          </div>
          <dl className="receipt">
            <div><dt>OKX 订单号</dt><dd className="mono">{receipt.ordId}</dd></div>
            <div><dt>客户端订单号</dt><dd className="mono">{receipt.clOrdId}</dd></div>
            <div><dt>真实扣款</dt><dd className="positive">¥0.00</dd></div>
          </dl>
        </section>
        <div className="confirm-actions">
          <Link href="/orders" className="confirm-primary buy">查看订单 <ArrowRight /></Link>
          <Link href="/markets" className="confirm-text-link">返回行情</Link>
        </div>
      </div>
    </AppShell>;
  }

  return <AppShell hideNav>
    <div className="modal-page confirm-page">
      <BrandHeader title="确认模拟订单" subtitle="OKX DEMO ORDER" back={`/trade/${pair.pairSlug}`} />

      <section className="confirm-intro" aria-labelledby="confirm-intro-title">
        <div className="confirm-shield"><ShieldCheck weight="bold" /></div>
        <div>
          <h2 id="confirm-intro-title">核对订单</h2>
          <p>模拟撮合，不生成链上交易，也不会扣除钱包资产。</p>
        </div>
      </section>

      <section className={`confirm-ticket ${side}`} aria-label="订单摘要">
        <div className="confirm-ticket-head">
          <div>
            <span className="confirm-ticket-kicker">{side === "buy" ? "BUY ORDER" : "SELL ORDER"}</span>
            <h3 className={side === "buy" ? "positive" : "negative"}>{side === "buy" ? "买入" : "卖出"} {pair.baseSymbol}</h3>
          </div>
          <strong>{pair.baseSymbol}/{pair.quoteSymbol}</strong>
        </div>
        <dl className="confirm-metrics">
          <div><dt>订单类型</dt><dd>{type === "limit" ? "限价单" : "市价单"}</dd></div>
          {type === "limit" && <div><dt>限价</dt><dd className="mono">{price} USDT</dd></div>}
          <div><dt>数量</dt><dd className="mono">{amount} {pair.baseSymbol}</dd></div>
          <div><dt>执行环境</dt><dd>OKX Demo Trading</dd></div>
        </dl>
        <div className="confirm-disclosure"><Info /><p><strong>共享 Demo 账户</strong><span>订单仅展示在当前访客工作区，余额与真实钱包完全隔离。</span></p></div>
      </section>

      {access === "checking" && <div className="confirm-checking" role="status"><i />正在验证演示权限…</div>}
      {access === "locked" && <section className="confirm-access" aria-labelledby="access-title">
        <div className="confirm-access-copy">
          <div><span>ACCESS GATE</span><h3 id="access-title">需要演示访问码</h3></div>
          <ShieldCheck />
        </div>
        <label className="confirm-access-field">
          <span>演示访问码</span>
          <input aria-label="演示访问码" type="password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} autoComplete="off" placeholder="请输入访问码" />
        </label>
        <button type="button" disabled={busy || !accessCode} onClick={unlock} className="confirm-primary buy">{busy ? "正在验证…" : "进入 OKX 模拟盘"}</button>
      </section>}
      {access === "ready" && <button type="button" disabled={busy} onClick={submit} className={`confirm-primary ${side}`}>{busy ? "正在提交…" : "提交到 OKX Demo Trading"} <CheckCircle weight="bold" /></button>}
      {error && <div className="market-overview-warning" role="alert"><Info /><span>{error}</span></div>}
      <Link href={`/trade/${pair.pairSlug}`} className="confirm-text-link">返回修改</Link>
    </div>
  </AppShell>;
}

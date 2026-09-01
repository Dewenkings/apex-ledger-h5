"use client";

import { ArrowLeft, DotsThree, ShieldCheck, Sparkle, Star } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { PaperBadge } from "@/components/ui";
import { estimatePaperOrder } from "@/lib/trading";
import type { TradingPairConfig } from "@/lib/trading/pairs";
import { OrderBookCard } from "./order-book-card";
import { TradeMarketPanel } from "./trade-market-panel";

const money = (value: number, digits = 2) => `$${value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export function TradeScreen({ pair }: { pair: TradingPairConfig }) {
  const [type, setType] = useState<"limit" | "market">("limit");
  const [amount, setAmount] = useState<string>(pair.demoAmount);
  const [marketPrice, setMarketPrice] = useState(0);
  const [limitPrice, setLimitPrice] = useState("");
  const priceEdited = useRef(false);
  const numericAmount = Number(amount) || 0;
  const effectivePrice = Number(limitPrice) || marketPrice;
  const quote = estimatePaperOrder({ amount: numericAmount, price: effectivePrice, feeRate: .001 });

  const receivePrice = useCallback((price: number) => {
    setMarketPrice(price);
    if (!priceEdited.current) setLimitPrice(price.toFixed(pair.priceDecimals));
  }, [pair.priceDecimals]);

  const confirmationHref = (side: "buy" | "sell") => {
    const query = new URLSearchParams({ side, type, amount });
    if (type === "limit") query.set("price", limitPrice);
    return `/trade/${pair.pairSlug}/confirm?${query}`;
  };

  return <AppShell>
    <div className="trade-screen">
      <header className="instrument-header">
        <div className="instrument-heading">
          <Link href="/markets" className="icon-button" aria-label="返回行情"><ArrowLeft /></Link>
          <div className="instrument-title">
            <div className="row gap-10"><h1>{pair.baseSymbol}/{pair.quoteSymbol}</h1><span className="spot-badge">现货</span></div>
            <span className="instrument-subtitle">SPOT · PAPER TRADING</span>
          </div>
        </div>
        <div className="instrument-actions">
          <PaperBadge />
          <button type="button" className="icon-button ai-header-action" aria-label="AI 信号即将上线" disabled><Sparkle /></button>
          <button type="button" className="icon-button" aria-label={`收藏 ${pair.baseSymbol}/${pair.quoteSymbol}`}><Star /></button>
          <button type="button" className="icon-button instrument-more" aria-label="更多行情选项"><DotsThree weight="bold" /></button>
        </div>
      </header>
      <nav className="trade-page-tabs" aria-label="交易对详情" role="tablist">
        <button type="button" role="tab" aria-selected="true" className="active">行情</button>
        <button type="button" role="tab" aria-selected="false" disabled>AI 信号 <span>即将上线</span></button>
        <button type="button" role="tab" aria-selected="false">信息</button>
      </nav>
      <TradeMarketPanel pair={pair} onPriceChange={receivePrice} />
      <section className="trade-panel order-entry-card">
        <div className="order-ticket-heading"><div><span className="trade-kicker">SIMULATED EXECUTION</span><h2>模拟委托</h2></div><span className="market-source">PAPER LIVE</span></div>
        <div className="order-type">{(["limit", "market"] as const).map((orderType) => <button type="button" aria-pressed={type === orderType} onClick={() => setType(orderType)} className={type === orderType ? "active" : ""} key={orderType}>{orderType === "limit" ? "限价" : "市价"}</button>)}</div>
        <label className="field"><span>{type === "limit" ? `价格 (${pair.quoteSymbol})` : "实时参考价"}</span><div><input aria-label="订单价格" value={type === "limit" ? limitPrice : marketPrice ? marketPrice.toFixed(pair.priceDecimals) : ""} readOnly={type === "market"} onChange={(event) => { priceEdited.current = true; setLimitPrice(event.target.value); }} inputMode="decimal" /><b>{pair.quoteSymbol}</b></div></label>
        <label className="field"><span>数量 ({pair.baseSymbol})</span><div><input aria-label="订单数量" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" /><b>{pair.baseSymbol}</b></div></label>
        <div className="percent-row" aria-label="订单数量比例">{[25, 50, 75, 100].map((percent) => <button type="button" key={percent} onClick={() => setAmount((Number(pair.demoAmount) * percent / 100).toFixed(Math.min(pair.amountDecimals, 6)).replace(/0+$/, "").replace(/\.$/, ""))}>{percent}%</button>)}</div>
        <div className="order-summary"><span>单笔上限 <b className="mono">{pair.maxDemoNotionalUsdt} USDT</b></span><span>预计金额 <b className="mono">{money(quote.total)}</b></span></div>
        <div className="trade-actions"><Link href={confirmationHref("buy")} className="trade-action buy">买入 {pair.baseSymbol}</Link><Link href={confirmationHref("sell")} className="trade-action sell">卖出 {pair.baseSymbol}</Link></div>
        <p className="safety-note"><ShieldCheck /> 模拟撮合环境，不会请求钱包交易签名或扣除真实资产</p>
      </section>
      <OrderBookCard pair={pair} />
      <p className="market-data-disclosure">行情与深度来自第三方公开市场数据，仅供作品演示，不构成投资建议。</p>
    </div>
  </AppShell>;
}

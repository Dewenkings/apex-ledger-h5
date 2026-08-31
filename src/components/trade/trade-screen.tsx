"use client";

import { ArrowRight, ShieldCheck } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { BrandHeader } from "@/components/brand-header";
import { estimatePaperOrder } from "@/lib/trading";
import type { TradingPairConfig } from "@/lib/trading/pairs";
import { TradeMarketPanel } from "./trade-market-panel";

const money = (value: number, digits = 2) => `$${value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export function TradeScreen({ pair }: { pair: TradingPairConfig }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
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

  const query = new URLSearchParams({ side, type, amount });
  if (type === "limit") query.set("price", limitPrice);

  return <AppShell>
    <BrandHeader title={`${pair.baseSymbol} / ${pair.quoteSymbol}`} subtitle="SPOT · OKX DEMO TRADING" back="/markets" />
    <TradeMarketPanel pair={pair} onPriceChange={receivePrice} />
    <section className="trade-panel">
      <div className="segmented">
        <button type="button" onClick={() => setSide("buy")} className={side === "buy" ? "buy active" : ""}>买入 {pair.baseSymbol}</button>
        <button type="button" onClick={() => setSide("sell")} className={side === "sell" ? "sell active" : ""}>卖出 {pair.baseSymbol}</button>
      </div>
      <div className="order-type">{(["limit", "market"] as const).map((orderType) => <button type="button" onClick={() => setType(orderType)} className={type === orderType ? "active" : ""} key={orderType}>{orderType === "limit" ? "限价" : "市价"}</button>)}</div>
      <label className="field"><span>{type === "limit" ? "限价" : "实时参考价"}</span><div><input aria-label="订单价格" value={type === "limit" ? limitPrice : marketPrice ? marketPrice.toFixed(pair.priceDecimals) : ""} readOnly={type === "market"} onChange={(event) => { priceEdited.current = true; setLimitPrice(event.target.value); }} inputMode="decimal" /><b>{pair.quoteSymbol}</b></div></label>
      <label className="field"><span>数量</span><div><input aria-label="订单数量" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" /><b>{pair.baseSymbol}</b></div></label>
      <div className="percent-row">{[25, 50, 75, 100].map((percent) => <button type="button" key={percent} onClick={() => setAmount((Number(pair.demoAmount) * percent / 100).toFixed(Math.min(pair.amountDecimals, 6)).replace(/0+$/, "").replace(/\.$/, ""))}>{percent}%</button>)}</div>
      <div className="order-summary"><span>单笔上限 <b className="mono">{pair.maxDemoNotionalUsdt} USDT</b></span><span>预计金额 <b className="mono">{money(quote.total)}</b></span></div>
      <Link href={`/trade/${pair.pairSlug}/confirm?${query}`} className={`primary-button ${side === "sell" ? "danger-button" : ""}`}>预览{side === "buy" ? "买入" : "卖出"}订单<ArrowRight /></Link>
      <p className="safety-note"><ShieldCheck /> OKX 官方模拟盘，不会请求钱包交易签名或扣除真实资产</p>
    </section>
    <section><div className="section-title"><h3>演示深度</h3><span className="muted mono">非交易所订单簿</span></div><div className="orderbook"><div><span>价格 ({pair.quoteSymbol})</span><span>数量 ({pair.baseSymbol})</span><span>合计</span></div>{[-.0007, -.0003, -.0001, .0001, .0003, .0007].map((offset, index) => { const price = effectivePrice * (1 + offset); const size = Number(pair.demoAmount) * (index + 1) / 3; return <div key={offset} className={offset < 0 ? "sell" : "buy"}><b>{price.toFixed(pair.priceDecimals)}</b><span>{size.toFixed(Math.min(pair.amountDecimals, 6))}</span><span>{money(price * size, 0)}</span></div>; })}</div></section>
  </AppShell>;
}

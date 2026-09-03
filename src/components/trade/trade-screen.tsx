"use client";

import { ArrowLeft, ShieldCheck, Sparkle } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useRef, useState, type KeyboardEvent } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { PaperBadge } from "@/components/ui";
import { WalletAccountControl } from "@/components/wallet/wallet-account-control";
import { AICopilotPanel } from "@/features/ai/ai-copilot-panel";
import { useTradingCopilot } from "@/features/ai/use-trading-copilot";
import type { ChartPeriod } from "@/lib/market-data/types";
import { estimatePaperOrder } from "@/lib/trading";
import type { TradingPairConfig } from "@/lib/trading/pairs";
import { OrderBookCard } from "./order-book-card";
import { TradeInstrumentInfo } from "./trade-instrument-info";
import { TradeMarketPanel } from "./trade-market-panel";

const money = (value: number, digits = 2) => `$${value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export function TradeScreen({ pair }: { pair: TradingPairConfig }) {
  const [activeTab, setActiveTab] = useState<"market" | "information" | "ai">("market");
  const [type, setType] = useState<"limit" | "market">("limit");
  const [amount, setAmount] = useState<string>(pair.demoAmount);
  const [marketPrice, setMarketPrice] = useState(0);
  const [limitPrice, setLimitPrice] = useState("");
  const [activeSide, setActiveSide] = useState<"buy" | "sell">("buy");
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("1D");
  const priceEdited = useRef(false);
  const marketTabRef = useRef<HTMLButtonElement>(null);
  const informationTabRef = useRef<HTMLButtonElement>(null);
  const aiTabRef = useRef<HTMLButtonElement>(null);
  const numericAmount = Number(amount) || 0;
  const effectivePrice = Number(limitPrice) || marketPrice;
  const quote = estimatePaperOrder({ amount: numericAmount, price: effectivePrice, feeRate: .001 });
  const canSubmit = effectivePrice > 0 && numericAmount > 0;
  const copilot = useTradingCopilot(pair.instrument, chartPeriod, activeTab === "ai");

  const receivePrice = useCallback((price: number) => {
    setMarketPrice(price);
    if (!priceEdited.current) setLimitPrice(price.toFixed(pair.priceDecimals));
  }, [pair.priceDecimals]);

  const confirmationHref = (side: "buy" | "sell") => {
    const query = new URLSearchParams({ side, type, amount });
    if (type === "limit") query.set("price", limitPrice);
    return `/trade/${pair.pairSlug}/confirm?${query}`;
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const tabs = ["market", "information", "ai"] as const;
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const nextTab = tabs[(tabs.indexOf(activeTab) + offset + tabs.length) % tabs.length];
    setActiveTab(nextTab);
    ({ market: marketTabRef, information: informationTabRef, ai: aiTabRef }[nextTab]).current?.focus();
  };

  return <AppShell>
    <div className="trade-screen">
      <header className="instrument-header">
        <div className="instrument-heading">
          <Link href="/markets" className="icon-button" aria-label="返回行情"><ArrowLeft /></Link>
          <div className="instrument-title">
            <div className="row gap-10"><h1>{pair.baseSymbol}/{pair.quoteSymbol}</h1></div>
            <span className="instrument-subtitle">SPOT · PAPER TRADING</span>
          </div>
        </div>
        <div className="instrument-actions">
          <span className="spot-badge">现货</span>
          <PaperBadge />
          <WalletAccountControl compact />
        </div>
      </header>
      <nav className="trade-page-tabs" aria-label="交易对详情" role="tablist">
        <button ref={marketTabRef} id="trade-tab-market" aria-controls="trade-panel-market" tabIndex={activeTab === "market" ? 0 : -1} type="button" role="tab" aria-selected={activeTab === "market"} className={activeTab === "market" ? "active" : ""} onKeyDown={handleTabKeyDown} onClick={() => setActiveTab("market")}>行情</button>
        <button ref={informationTabRef} id="trade-tab-information" aria-controls="trade-panel-information" tabIndex={activeTab === "information" ? 0 : -1} type="button" role="tab" aria-selected={activeTab === "information"} className={activeTab === "information" ? "active" : ""} onKeyDown={handleTabKeyDown} onClick={() => setActiveTab("information")}>信息</button>
        <button ref={aiTabRef} id="trade-tab-ai" aria-controls="trade-panel-ai" tabIndex={activeTab === "ai" ? 0 : -1} type="button" role="tab" aria-selected={activeTab === "ai"} className={activeTab === "ai" ? "active" : ""} onKeyDown={handleTabKeyDown} onClick={() => setActiveTab("ai")}><Sparkle weight="fill" />AI 洞察</button>
      </nav>
      {activeTab === "information" ? <div id="trade-panel-information" role="tabpanel" tabIndex={0} aria-labelledby="trade-tab-information"><TradeInstrumentInfo pair={pair} /></div> : activeTab === "ai" ? <div id="trade-panel-ai" role="tabpanel" tabIndex={0} aria-labelledby="trade-tab-ai">
        <AICopilotPanel instrument={pair.instrument} timeframe={chartPeriod} insight={copilot.insight} response={copilot.response} isLoading={copilot.isLoading} isAsking={copilot.isAsking} insightError={copilot.insightError} chatError={copilot.chatError} onAsk={copilot.ask} />
      </div> : <div id="trade-panel-market" role="tabpanel" tabIndex={0} aria-labelledby="trade-tab-market">
        <TradeMarketPanel pair={pair} onPriceChange={receivePrice} onPeriodChange={setChartPeriod} />
        <OrderBookCard pair={pair} />
        <section className={`inline-order-ticket ${activeSide}`} aria-label={`${pair.baseSymbol} 模拟交易`}>
          <div className="order-ticket-topline">
            <div className="order-ticket-heading">
              <div><span className="trade-kicker">SIMULATED EXECUTION</span><h2>交易 {pair.baseSymbol}</h2></div>
              <span className="market-source">PAPER LIVE</span>
            </div>
            <div className="order-side-switch" aria-label="交易方向">
              <button type="button" aria-pressed={activeSide === "buy"} className={activeSide === "buy" ? "active buy" : ""} onClick={() => setActiveSide("buy")}>买入</button>
              <button type="button" aria-pressed={activeSide === "sell"} className={activeSide === "sell" ? "active sell" : ""} onClick={() => setActiveSide("sell")}>卖出</button>
            </div>
          </div>
            <div className="order-type">{(["limit", "market"] as const).map((orderType) => <button type="button" aria-pressed={type === orderType} onClick={() => setType(orderType)} className={type === orderType ? "active" : ""} key={orderType}>{orderType === "limit" ? "限价" : "市价"}</button>)}</div>
            <label className="field"><span>{type === "limit" ? `价格 (${pair.quoteSymbol})` : "实时参考价"}</span><div><input aria-label="订单价格" placeholder="等待行情" value={type === "limit" ? limitPrice : marketPrice ? marketPrice.toFixed(pair.priceDecimals) : ""} readOnly={type === "market"} onChange={(event) => { priceEdited.current = true; setLimitPrice(event.target.value); }} inputMode="decimal" /><b>{pair.quoteSymbol}</b></div></label>
            <label className="field"><span>数量 ({pair.baseSymbol})</span><div><input aria-label="订单数量" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" /><b>{pair.baseSymbol}</b></div></label>
            <div className="percent-row" aria-label="订单数量比例">{[25, 50, 75, 100].map((percent) => <button type="button" key={percent} onClick={() => setAmount((Number(pair.demoAmount) * percent / 100).toFixed(Math.min(pair.amountDecimals, 6)).replace(/0+$/, "").replace(/\.$/, ""))}>{percent}%</button>)}</div>
            <div className="order-summary inline-summary">
              <span>预计金额 <b className="mono">{money(quote.total)}</b></span>
              <span>预计费用 <b className="mono">{money(quote.fee)}</b></span>
              <span>单笔上限 <b className="mono">{pair.maxDemoNotionalUsdt} USDT</b></span>
            </div>
            {canSubmit
              ? <Link href={confirmationHref(activeSide)} className={`order-submit ${activeSide}`}>确认{activeSide === "buy" ? "买入" : "卖出"} {pair.baseSymbol}</Link>
              : <span className="order-submit disabled" aria-disabled="true">确认{activeSide === "buy" ? "买入" : "卖出"} {pair.baseSymbol}</span>}
            <p className="safety-note"><ShieldCheck /> 模拟费率 0.10%，不会请求钱包签名或扣除真实资产</p>
        </section>
        <p className="market-data-disclosure">行情与深度来自第三方公开市场数据，仅供作品演示，不构成投资建议。</p>
      </div>}
    </div>
  </AppShell>;
}

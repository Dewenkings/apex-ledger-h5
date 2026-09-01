"use client";

import { ArrowLeft, ShieldCheck, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { PaperBadge } from "@/components/ui";
import { estimatePaperOrder } from "@/lib/trading";
import type { TradingPairConfig } from "@/lib/trading/pairs";
import { OrderBookCard } from "./order-book-card";
import { TradeInstrumentInfo } from "./trade-instrument-info";
import { TradeMarketPanel } from "./trade-market-panel";

const money = (value: number, digits = 2) => `$${value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export function TradeScreen({ pair }: { pair: TradingPairConfig }) {
  const [activeTab, setActiveTab] = useState<"market" | "information">("market");
  const [type, setType] = useState<"limit" | "market">("limit");
  const [amount, setAmount] = useState<string>(pair.demoAmount);
  const [marketPrice, setMarketPrice] = useState(0);
  const [limitPrice, setLimitPrice] = useState("");
  const [activeSide, setActiveSide] = useState<"buy" | "sell" | null>(null);
  const priceEdited = useRef(false);
  const sheetTrigger = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const marketTabRef = useRef<HTMLButtonElement>(null);
  const informationTabRef = useRef<HTMLButtonElement>(null);
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

  const closeOrderSheet = useCallback(() => {
    setActiveSide(null);
    sheetTrigger.current?.focus();
  }, []);

  const openOrderSheet = (side: "buy" | "sell", event: MouseEvent<HTMLButtonElement>) => {
    sheetTrigger.current = event.currentTarget;
    setActiveSide(side);
  };

  useEffect(() => {
    if (!activeSide) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeOrderSheet();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = closeButtonRef.current?.closest('[role="dialog"]');
      if (!(dialog instanceof HTMLElement)) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled])',
      ));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeSide, closeOrderSheet]);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const nextTab = activeTab === "market" ? "information" : "market";
    setActiveTab(nextTab);
    (nextTab === "market" ? marketTabRef : informationTabRef).current?.focus();
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
        </div>
      </header>
      <nav className="trade-page-tabs" aria-label="交易对详情" role="tablist">
        <button ref={marketTabRef} id="trade-tab-market" aria-controls="trade-panel-market" tabIndex={activeTab === "market" ? 0 : -1} type="button" role="tab" aria-selected={activeTab === "market"} className={activeTab === "market" ? "active" : ""} onKeyDown={handleTabKeyDown} onClick={() => setActiveTab("market")}>行情</button>
        <button ref={informationTabRef} id="trade-tab-information" aria-controls="trade-panel-information" tabIndex={activeTab === "information" ? 0 : -1} type="button" role="tab" aria-selected={activeTab === "information"} className={activeTab === "information" ? "active" : ""} onKeyDown={handleTabKeyDown} onClick={() => setActiveTab("information")}>信息</button>
      </nav>
      {activeTab === "information" ? <div id="trade-panel-information" role="tabpanel" aria-labelledby="trade-tab-information"><TradeInstrumentInfo pair={pair} /></div> : <div id="trade-panel-market" role="tabpanel" aria-labelledby="trade-tab-market">
        <TradeMarketPanel pair={pair} onPriceChange={receivePrice} />
        <OrderBookCard pair={pair} />
        <p className="market-data-disclosure">行情与深度来自第三方公开市场数据，仅供作品演示，不构成投资建议。</p>
        <div className="trade-action-dock" aria-label="模拟交易操作">
          <button type="button" className="trade-action buy" aria-haspopup="dialog" onClick={(event) => openOrderSheet("buy", event)}>买入 {pair.baseSymbol}</button>
          <button type="button" className="trade-action sell" aria-haspopup="dialog" onClick={(event) => openOrderSheet("sell", event)}>卖出 {pair.baseSymbol}</button>
        </div>
        {activeSide && <div className="order-sheet-layer" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeOrderSheet();
        }}>
          <section className={`order-sheet ${activeSide}`} role="dialog" aria-modal="true" aria-labelledby="order-sheet-title">
            <div className="order-sheet-handle" aria-hidden="true" />
            <div className="order-ticket-heading">
              <div><span className="trade-kicker">SIMULATED EXECUTION</span><h2 id="order-sheet-title">{activeSide === "buy" ? "买入" : "卖出"} {pair.baseSymbol}</h2></div>
              <div className="order-sheet-actions"><span className="market-source">PAPER LIVE</span><button ref={closeButtonRef} type="button" className="icon-button" aria-label="关闭下单面板" onClick={closeOrderSheet}><X /></button></div>
            </div>
            <div className="order-type">{(["limit", "market"] as const).map((orderType) => <button type="button" aria-pressed={type === orderType} onClick={() => setType(orderType)} className={type === orderType ? "active" : ""} key={orderType}>{orderType === "limit" ? "限价" : "市价"}</button>)}</div>
            <label className="field"><span>{type === "limit" ? `价格 (${pair.quoteSymbol})` : "实时参考价"}</span><div><input aria-label="订单价格" value={type === "limit" ? limitPrice : marketPrice ? marketPrice.toFixed(pair.priceDecimals) : ""} readOnly={type === "market"} onChange={(event) => { priceEdited.current = true; setLimitPrice(event.target.value); }} inputMode="decimal" /><b>{pair.quoteSymbol}</b></div></label>
            <label className="field"><span>数量 ({pair.baseSymbol})</span><div><input aria-label="订单数量" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" /><b>{pair.baseSymbol}</b></div></label>
            <div className="percent-row" aria-label="订单数量比例">{[25, 50, 75, 100].map((percent) => <button type="button" key={percent} onClick={() => setAmount((Number(pair.demoAmount) * percent / 100).toFixed(Math.min(pair.amountDecimals, 6)).replace(/0+$/, "").replace(/\.$/, ""))}>{percent}%</button>)}</div>
            <div className="order-summary"><span>预计金额 <b className="mono">{money(quote.total)}</b></span><span>单笔上限 <b className="mono">{pair.maxDemoNotionalUsdt} USDT</b></span></div>
            <Link href={confirmationHref(activeSide)} className={`order-submit ${activeSide}`}>确认{activeSide === "buy" ? "买入" : "卖出"} {pair.baseSymbol}</Link>
            <p className="safety-note"><ShieldCheck /> 模拟撮合环境，不会请求钱包交易签名或扣除真实资产</p>
          </section>
        </div>}
      </div>}
    </div>
  </AppShell>;
}

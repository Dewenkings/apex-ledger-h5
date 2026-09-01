"use client";

import type { CSSProperties } from "react";

import type { OrderBookLevel } from "@/lib/market-data/types";
import type { TradingPairConfig } from "@/lib/trading/pairs";
import { useLiveOrderBook } from "./use-live-order-book";

const amountFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 });
const totalFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

function DepthRow({ level, side, maxTotal, priceDecimals }: {
  level: OrderBookLevel;
  side: "buy" | "sell";
  maxTotal: number;
  priceDecimals: number;
}) {
  const depth = maxTotal > 0 ? Math.max(3, (level.totalQuote / maxTotal) * 100) : 0;
  return <div className={`orderbook-grid orderbook-row ${side}`} style={{ "--depth": `${depth}%` } as CSSProperties}>
    <b>{level.price.toLocaleString("en-US", { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })}</b>
    <span>{amountFormatter.format(level.size)}</span>
    <span>{totalFormatter.format(level.totalQuote)}</span>
  </div>;
}

const statusLabels = {
  connecting: "连接中",
  reconnecting: "重新连接",
  snapshot: "REST SNAPSHOT",
  live: "实时同步",
} as const;

export function OrderBookCard({ pair }: { pair: TradingPairConfig }) {
  const { snapshot, status } = useLiveOrderBook(pair);
  const asks = snapshot?.asks ?? [];
  const bids = snapshot?.bids ?? [];
  const maxTotal = Math.max(1, ...asks.map((level) => level.totalQuote), ...bids.map((level) => level.totalQuote));
  const bestAsk = asks[0]?.price;
  const bestBid = bids[0]?.price;
  const midpoint = bestAsk && bestBid ? (bestAsk + bestBid) / 2 : 0;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;

  return <section className="orderbook-card" aria-label={`${pair.instrument} 实时深度`}>
    <div className="orderbook-heading">
      <div><span className="trade-kicker">PUBLIC BOOKS5</span><h2>实时深度</h2></div>
      <div className="orderbook-status"><span className={`market-source ${status === "live" ? "" : "fallback"}`}>{statusLabels[status]}</span><small>100ms snapshot</small></div>
    </div>
    {snapshot ? <div className="orderbook">
      <div className="orderbook-grid orderbook-head"><span>价格 ({pair.quoteSymbol})</span><span>数量 ({pair.baseSymbol})</span><span>累计 ({pair.quoteSymbol})</span></div>
      {[...asks].reverse().map((level) => <DepthRow key={`ask-${level.price}`} level={level} side="sell" maxTotal={maxTotal} priceDecimals={pair.priceDecimals} />)}
      <div className="orderbook-mid">
        <div><strong className="mono">{midpoint.toLocaleString("en-US", { minimumFractionDigits: pair.priceDecimals, maximumFractionDigits: pair.priceDecimals })}</strong><span>中间价</span></div>
        <div><span>价差</span><b className="mono">{spread.toFixed(pair.priceDecimals)} {pair.quoteSymbol}</b></div>
      </div>
      {bids.map((level) => <DepthRow key={`bid-${level.price}`} level={level} side="buy" maxTotal={maxTotal} priceDecimals={pair.priceDecimals} />)}
      <div className="orderbook-foot"><span>公开市场深度</span><span className="mono">SEQ {snapshot.sequenceId ?? "—"}</span></div>
    </div> : <div className="orderbook-empty" role="status">正在连接实时深度…</div>}
  </section>;
}

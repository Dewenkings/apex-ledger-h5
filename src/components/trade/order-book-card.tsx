"use client";

import type { CSSProperties } from "react";

import type { OrderBookLevel } from "@/lib/market-data/types";
import type { TradingPairConfig } from "@/lib/trading/pairs";
import { useLiveOrderBook } from "./use-live-order-book";

const amountFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 });
function formatPrice(value: number | undefined, priceDecimals: number): string {
  return value === undefined
    ? "—"
    : value.toLocaleString("en-US", {
      minimumFractionDigits: priceDecimals,
      maximumFractionDigits: priceDecimals,
    });
}

function PairedDepthRow({ bid, ask, maxSize, priceDecimals }: {
  bid?: OrderBookLevel;
  ask?: OrderBookLevel;
  maxSize: number;
  priceDecimals: number;
}) {
  const bidDepth = bid ? Math.max(4, bid.size / maxSize * 100) : 0;
  const askDepth = ask ? Math.max(4, ask.size / maxSize * 100) : 0;
  return <div className="orderbook-pair-row" role="row" style={{
    "--bid-depth": `${bidDepth}%`,
    "--ask-depth": `${askDepth}%`,
  } as CSSProperties}>
    <span className="book-size bid-size">{bid ? amountFormatter.format(bid.size) : "—"}</span>
    <b className="book-price bid-price">{formatPrice(bid?.price, priceDecimals)}</b>
    <b className="book-price ask-price">{formatPrice(ask?.price, priceDecimals)}</b>
    <span className="book-size ask-size">{ask ? amountFormatter.format(ask.size) : "—"}</span>
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
  const bestAsk = asks[0]?.price;
  const bestBid = bids[0]?.price;
  const midpoint = bestAsk && bestBid ? (bestAsk + bestBid) / 2 : 0;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;
  const bidSize = bids.reduce((total, level) => total + level.size, 0);
  const askSize = asks.reduce((total, level) => total + level.size, 0);
  const visibleSize = bidSize + askSize;
  const bidShare = visibleSize > 0 ? Math.round(bidSize / visibleSize * 100) : 50;
  const askShare = 100 - bidShare;
  const maxSize = Math.max(1e-12, ...bids.map((level) => level.size), ...asks.map((level) => level.size));
  const rowCount = Math.max(bids.length, asks.length);

  return <section className="orderbook-card" aria-label={`${pair.instrument} 实时深度`}>
    <div className="orderbook-heading">
      <div><span className="trade-kicker">PUBLIC LIQUIDITY</span><h2>订单簿</h2></div>
      <div className="orderbook-status"><span className={`market-source ${status === "live" ? "" : "fallback"}`}>{statusLabels[status]}</span><small>100ms snapshot</small></div>
    </div>
    {snapshot ? <div className="orderbook">
      <div className="book-balance" aria-label={`可见深度买方 ${bidShare}%，卖方 ${askShare}%`}>
        <b>B {bidShare}%</b>
        <div aria-hidden="true"><i style={{ width: `${bidShare}%` }} /></div>
        <b>{askShare}% S</b>
      </div>
      <div className="orderbook-spread">
        <span>中间价 <strong className="mono">{formatPrice(midpoint, pair.priceDecimals)}</strong></span>
        <span>价差 <b className="mono">{spread.toFixed(pair.priceDecimals)} {pair.quoteSymbol}</b></span>
      </div>
      <div className="orderbook-pair-head" role="row">
        <span role="columnheader">买量</span><span role="columnheader">买价</span>
        <span role="columnheader">卖价</span><span role="columnheader">卖量</span>
      </div>
      <div className="orderbook-pairs" role="table" aria-label="双边订单簿">
        {Array.from({ length: rowCount }, (_, index) => <PairedDepthRow key={index} bid={bids[index]} ask={asks[index]} maxSize={maxSize} priceDecimals={pair.priceDecimals} />)}
      </div>
      <div className="orderbook-foot"><span>公开市场深度</span><span className="mono">SEQ {snapshot.sequenceId ?? "—"}</span></div>
    </div> : <div className="orderbook-empty" role="status">正在连接实时深度…</div>}
  </section>;
}

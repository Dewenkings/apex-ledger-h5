"use client";

import { Receipt } from "@phosphor-icons/react";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { BrandHeader } from "@/components/layout/brand-header";
import type { DemoFill, DemoOrderSnapshot } from "@/lib/okx-demo/contracts";
import { useDemoAccount } from "./use-demo-account";

type OrdersTab = "Open" | "History" | "Fills";

const tabs: Array<{ id: OrdersTab; label: string }> = [
  { id: "Open", label: "当前委托" },
  { id: "History", label: "历史订单" },
  { id: "Fills", label: "成交记录" },
];

export function OrdersScreen() {
  const [tab, setTab] = useState<OrdersTab>("Open");
  const account = useDemoAccount();
  const orders = tab === "Open"
    ? account.orders.filter((order) => order.status === "live" || order.status === "partially_filled")
    : account.orders;

  return <AppShell>
    <BrandHeader title="订单管理" subtitle="PAPER ORDER CENTER" />

    <div className="orders-environment" aria-label="模拟交易执行环境">
      <span><i /> 模拟盘已连接</span>
      <b>执行环境 · OKX Demo Trading</b>
    </div>

    <div className="page-actions">
      <div className="tabs" role="tablist" aria-label="订单视图">
        {tabs.map((item) => <button
          type="button"
          role="tab"
          aria-selected={tab === item.id}
          aria-controls="orders-panel"
          onClick={() => setTab(item.id)}
          className={tab === item.id ? "active" : ""}
          key={item.id}
        >{item.label}</button>)}
      </div>
    </div>

    {account.state === "loading" && <div className="empty" role="status">正在同步模拟盘…</div>}
    {account.state === "locked" && <div className="info-panel"><Receipt /><div><strong>受控演示访问</strong><span>请先从交易确认页输入演示访问码</span></div></div>}
    {account.state === "error" && <div className="market-overview-warning" role="alert"><Receipt /><span>{account.message}</span><button type="button" onClick={account.reload}>重试</button></div>}
    {account.state === "ready" && account.orders.length === 0 && tab !== "Fills" && <div className="empty"><Receipt /><strong>尚无个人模拟订单</strong><span>从市场选择交易对，体验模拟盘下单。</span><a href="/markets" className="text-button">前往市场</a></div>}

    {account.state === "ready" && <section id="orders-panel" className="orders-stack" role="tabpanel">
      {tab === "Fills"
        ? account.fills.map((fill) => <FillCard fill={fill} key={fill.tradeId} />)
        : orders.map((order) => <OrderCard order={order} onCancel={() => account.cancel(order)} onReload={account.reload} key={order.ordId} />)}
    </section>}

    {account.message && account.state === "ready" && <div className="warning-box success"><Receipt /><span>{account.message}</span></div>}

    <details className="orders-disclosure">
      <summary><Receipt /> 当前访客工作区 <span>模拟盘说明</span></summary>
      <p>订单通过共享的 OKX Demo Trading 虚拟账户执行，仅展示在当前访客工作区，不涉及真实资金；Apex Ledger 与 OKX 无隶属或官方合作关系。</p>
    </details>
  </AppShell>;
}

function OrderCard({ order, onCancel, onReload }: { order: DemoOrderSnapshot; onCancel: () => void; onReload: () => void }) {
  const [baseSymbol] = order.instrument.split("-");
  const isOpen = order.status === "live" || order.status === "partially_filled";

  return <article className={`order-card order-card-${order.side}`}>
    <header className="order-card-head">
      <div>
        <strong>{order.instrument.replace("-", "/")}</strong>
        <span>{formatOrderType(order.orderType)}{order.side === "buy" ? "买入" : "卖出"}</span>
      </div>
      <span className={`status ${order.status}`}>{formatOrderStatus(order.status)}</span>
    </header>

    <dl className="order-metrics">
      <div><dt>委托价</dt><dd className="mono">{order.price || "市价"}<small>{order.price ? " USDT" : ""}</small></dd></div>
      <div><dt>委托量</dt><dd className="mono">{order.size}<small> {baseSymbol}</small></dd></div>
    </dl>

    <div className="order-progress">
      <span>已成交</span>
      <b className="mono">{order.filledSize || "0"} / {order.size} {baseSymbol}</b>
    </div>

    {order.syncState === "pending" && <div className="order-sync"><i /> 正在同步交易所状态</div>}
    {order.syncState === "stale" && <div className="order-sync stale"><span>上次同步于 {formatSyncTime(order.lastSyncedAt)}</span><button type="button" onClick={onReload}>刷新状态</button></div>}

    <footer className="order-card-foot">
      <div><span>交易所订单号</span><b className="mono" title={order.ordId}>{order.ordId}</b></div>
      <time dateTime={new Date(order.createdAt).toISOString()}>{formatOrderTime(order.createdAt)}</time>
      {isOpen && <button type="button" className="cancel-order-button" aria-label="撤销模拟订单" onClick={onCancel}>撤单</button>}
    </footer>
  </article>;
}

function FillCard({ fill }: { fill: DemoFill }) {
  const [baseSymbol] = fill.instrument.split("-");

  return <article className={`order-card order-card-${fill.side}`}>
    <header className="order-card-head">
      <div><strong>{fill.instrument.replace("-", "/")}</strong><span>{fill.side === "buy" ? "买入成交" : "卖出成交"}</span></div>
      <span className="status filled">已成交</span>
    </header>
    <dl className="order-metrics">
      <div><dt>成交价</dt><dd className="mono">{fill.fillPrice}<small> USDT</small></dd></div>
      <div><dt>成交量</dt><dd className="mono">{fill.fillSize}<small> {baseSymbol}</small></dd></div>
    </dl>
    <footer className="order-card-foot">
      <div><span>交易所成交号</span><b className="mono" title={fill.tradeId}>{fill.tradeId}</b></div>
      <time dateTime={new Date(fill.timestamp).toISOString()}>{formatOrderTime(fill.timestamp)}</time>
    </footer>
  </article>;
}

function formatOrderType(type: string): string {
  return type === "market" ? "市价" : "限价";
}

function formatOrderStatus(status: string): string {
  if (status === "live") return "挂单中";
  if (status === "partially_filled") return "部分成交";
  if (status === "filled") return "已成交";
  if (status === "canceled") return "已撤单";
  return status;
}

function formatOrderTime(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(timestamp);
}

function formatSyncTime(timestamp: number | null): string {
  if (!timestamp) return "未知";
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(timestamp);
}

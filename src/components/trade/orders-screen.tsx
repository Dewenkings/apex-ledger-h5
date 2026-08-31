"use client";

import { DownloadSimple, Receipt } from "@phosphor-icons/react";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { BrandHeader } from "@/components/brand-header";
import { useDemoAccount } from "./use-demo-account";

export function OrdersScreen() {
  const [tab, setTab] = useState<"Open" | "History" | "Fills">("Open");
  const account = useDemoAccount();
  const orders = tab === "Open" ? account.orders.filter((order) => order.status === "live" || order.status === "partially_filled") : account.orders;

  return <AppShell><BrandHeader title="订单管理" subtitle="OKX DEMO ORDERS" /><div className="page-actions"><div className="tabs">{(["Open", "History", "Fills"] as const).map((item) => <button type="button" onClick={() => setTab(item)} className={tab === item ? "active" : ""} key={item}>{item === "Open" ? "当前委托" : item === "History" ? "历史订单" : "成交记录"}</button>)}</div><button type="button" aria-label="导出" className="icon-button"><DownloadSimple /></button></div>
    {account.state === "loading" && <div className="empty" role="status">正在同步 OKX Demo…</div>}
    {account.state === "locked" && <div className="info-panel"><Receipt /><div><strong>受控演示访问</strong><span>请先从交易确认页输入演示访问码</span></div></div>}
    {account.state === "error" && <div className="market-overview-warning" role="alert"><Receipt /><span>{account.message}</span><button type="button" onClick={account.reload}>重试</button></div>}
    {account.state === "ready" && <section className="orders-stack">{tab === "Fills" ? account.fills.map((fill) => <article className="order-card" key={fill.tradeId}><div className="row between"><strong>{fill.instrument.replace("-", "/")}</strong><span className="status filled">FILLED</span></div><div className="order-grid"><span><i>成交号</i><b className="mono">{fill.tradeId}</b></span><span><i>成交数量</i><b className="mono">{fill.fillSize}</b></span><span><i>成交价</i><b className="mono">{fill.fillPrice}</b></span></div></article>) : orders.map((order) => <article className="order-card" key={order.ordId}><div className="row between"><div className="row gap-10"><span className={`side-tag ${order.side}`}>{order.side.toUpperCase()}</span><strong>{order.instrument.replace("-", "/")}</strong><span className="muted">{order.orderType}</span></div><span className={`status ${order.status}`}>{order.status}</span></div><div className="order-grid"><span><i>OKX 订单号</i><b className="mono">{order.ordId}</b></span><span><i>数量</i><b className="mono">{order.size}</b></span><span><i>价格</i><b className="mono">{order.price || "Market"}</b></span></div>{(order.status === "live" || order.status === "partially_filled") && <button type="button" className="text-button danger" onClick={() => account.cancel(order)}>撤销模拟订单</button>}</article>)}</section>}
    {account.message && account.state === "ready" && <div className="warning-box success"><Receipt /><span>{account.message}</span></div>}
    <div className="info-panel"><Receipt /><div><strong>OKX 官方 Demo Trading</strong><span>订单来自共享虚拟账户，但仅展示当前访问会话创建的记录。</span></div></div>
  </AppShell>;
}

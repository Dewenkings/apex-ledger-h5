"use client";

import { Eye, EyeSlash, Plus, Receipt } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { BrandHeader } from "@/components/brand-header";
import { useDemoAccount } from "./use-demo-account";

export function PortfolioScreen() {
  const [visible, setVisible] = useState(true);
  const account = useDemoAccount();
  const balance = account.balance;
  return <AppShell><BrandHeader title="资产总览" subtitle="OKX DEMO PORTFOLIO" /><section className="balance-card"><div className="row between"><span>共享 OKX Demo 虚拟余额</span><button type="button" aria-label="切换余额可见性" className="icon-button" onClick={() => setVisible((value) => !value)}>{visible ? <Eye /> : <EyeSlash />}</button></div><h2 className="mono">{account.state === "ready" && balance ? visible ? `${Number(balance.totalEquity).toLocaleString()} USDT` : "••••••••" : "—"}</h2><span className="muted">不会代表当前钱包资产</span></section>
    {account.state === "loading" && <div className="empty" role="status">正在同步虚拟余额…</div>}
    {account.state === "locked" && <div className="info-panel"><Receipt /><div><strong>受控演示访问</strong><span>请先从交易确认页输入演示访问码</span></div></div>}
    {account.state === "ready" && balance && <section><div className="section-title"><h3>虚拟资产</h3><span className="muted">SHARED ACCOUNT</span></div><div className="asset-list">{balance.assets.filter((asset) => Number(asset.equity) !== 0).map((asset) => <div className="asset-row" key={asset.currency}><div><strong>{asset.currency}</strong><small className="muted block">可用 {asset.available}</small></div><div><strong className="mono">{asset.equity}</strong><small className="muted block">冻结 {asset.frozen}</small></div></div>)}</div></section>}
    {account.state === "error" && <div className="market-overview-warning" role="alert"><Receipt /><span>{account.message}</span><button type="button" onClick={account.reload}>重试</button></div>}
    <div className="quick-actions"><Link href="/trade/btc-usdt"><Plus /><span>BTC 模拟交易</span></Link><Link href="/trade/eth-usdt"><Plus /><span>ETH 模拟交易</span></Link><Link href="/trade/sol-usdt"><Plus /><span>SOL 模拟交易</span></Link></div>
  </AppShell>;
}

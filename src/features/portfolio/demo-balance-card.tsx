"use client";

import { Eye, EyeSlash, Receipt } from "@phosphor-icons/react";
import { useState } from "react";

import type { useDemoAccount } from "@/components/trade/use-demo-account";

type DemoAccount = ReturnType<typeof useDemoAccount>;

export function DemoBalanceCard({ account }: { account: DemoAccount }) {
  const [visible, setVisible] = useState(true);
  const balance = account.balance;
  return (
    <section className="ledger-section" aria-labelledby="demo-ledger-title">
      <div className="ledger-heading">
        <div><span className="eyebrow">PAPER TRADING</span><h2 id="demo-ledger-title">OKX DEMO · VIRTUAL FUNDS</h2></div>
        <span className="ledger-source demo">DEMO</span>
      </div>
      <div className="balance-card">
        <div className="row between"><span>共享 OKX Demo 虚拟余额</span><button type="button" aria-label="切换余额可见性" className="icon-button" onClick={() => setVisible((value) => !value)}>{visible ? <Eye /> : <EyeSlash />}</button></div>
        <h3 className="mono">{account.state === "ready" && balance ? visible ? `${Number(balance.totalEquity).toLocaleString()} USDT` : "••••••••" : "—"}</h3>
        <span className="muted">不会代表当前钱包资产</span>
      </div>
      {account.state === "loading" && <div className="empty" role="status">正在同步虚拟余额…</div>}
      {account.state === "locked" && <div className="info-panel"><Receipt /><div><strong>受控演示访问</strong><span>请先从交易确认页输入演示访问码</span></div></div>}
      {account.state === "ready" && balance && <div className="asset-list compact">{balance.assets.filter((asset) => Number(asset.equity) !== 0).map((asset) => <div className="asset-row" key={asset.currency}><div><strong>{asset.currency}</strong><small className="muted block">可用 {asset.available}</small></div><div><strong className="mono">{asset.equity}</strong><small className="muted block">冻结 {asset.frozen}</small></div></div>)}</div>}
      {account.state === "error" && <div className="market-overview-warning" role="alert"><Receipt /><span>{account.message}</span><button type="button" onClick={account.reload}>重试</button></div>}
    </section>
  );
}

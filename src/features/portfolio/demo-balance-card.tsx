"use client";

import { Eye, EyeSlash, Receipt } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";

import type { useDemoAccount } from "@/components/trade/use-demo-account";
import { formatEquity, isNonZeroBalance } from "./asset-format";

type DemoAccount = ReturnType<typeof useDemoAccount>;

export function DemoBalanceCard({ account }: { account: DemoAccount }) {
  const [visible, setVisible] = useState(true);
  const balance = account.balance;
  return (
    <section className="ledger-section" aria-labelledby="demo-ledger-title">
      <div className="ledger-heading">
        <div><span className="eyebrow">OKX Demo</span><h2 id="demo-ledger-title">模拟资产</h2></div>
        <div className="ledger-heading-actions"><span className="ledger-source demo"><i /> PAPER</span><Link href="/trade/btc-usdt">去交易</Link></div>
      </div>
      {account.state === "ready" && balance && <div className="ledger-balance-summary">
        <div className="row between"><span>共享 OKX Demo 虚拟余额</span><button type="button" aria-label="切换余额可见性" className="icon-button" onClick={() => setVisible((value) => !value)}>{visible ? <Eye /> : <EyeSlash />}</button></div>
        <h3 className="mono">{visible ? `${formatEquity(balance.totalEquity)} USDT` : "••••••••"}</h3>
        <span className="muted">虚拟总权益 · 不代表钱包资产</span>
      </div>}
      {account.state === "loading" && <div className="empty" role="status">正在同步虚拟余额…</div>}
      {account.state === "locked" && <div className="ledger-locked"><Receipt /><div><strong>Demo 资产需要演示访问授权</strong><span>授权后可读取共享模拟账户余额</span></div><Link href="/trade/btc-usdt">去授权</Link></div>}
      {account.state === "ready" && balance && <div className="asset-list compact">{balance.assets.filter((asset) => isNonZeroBalance(asset.equity)).map((asset) => <div className="asset-row" key={asset.currency}><div><strong>{asset.currency}</strong><small className="muted block">可用 {asset.available}</small></div><div><strong className="mono">{asset.equity}</strong><small className="muted block">冻结 {asset.frozen}</small></div></div>)}</div>}
      {account.state === "error" && <div className="market-overview-warning" role="alert"><Receipt /><span>{account.message}</span><button type="button" onClick={account.reload}>重试</button></div>}
    </section>
  );
}

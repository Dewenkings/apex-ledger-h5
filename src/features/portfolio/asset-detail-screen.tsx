"use client";

import { PaperPlaneTilt, Plus, Swap, Wallet } from "@phosphor-icons/react";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { BrandHeader } from "@/components/layout/brand-header";
import { AssetMark, Change, Sparkline } from "@/components/ui";
import { markets } from "@/lib/data";

export function AssetDetailScreen() {
  return <AppShell><BrandHeader title="Bitcoin 详情" subtitle="ASSET DETAILS" back="/portfolio" /><section className="asset-balance"><AssetMark market={markets[0]} size={58} /><h2 className="mono">0.2964 BTC</h2><p className="mono">$20,258.34</p><Change value={4.18} /></section><section className="chart-card performance"><div className="section-title"><div><span className="muted">资产表现</span><h3 className="mono">+$812.42</h3></div><div className="time-tabs"><button>1D</button><button className="active">1W</button><button>1M</button></div></div><Sparkline points={[13, 18, 16, 25, 22, 31, 28, 39, 35, 47, 52, 49, 61]} large /><div className="chart-axis"><span>Mon</span><span>Wed</span><span>Fri</span><span>Sun</span></div></section><div className="quick-actions"><button><PaperPlaneTilt /><span>转出</span></button><button><Wallet /><span>接收</span></button><Link href="/trade/btc-usdt"><Swap /><span>交易</span></Link></div><section><div className="section-title"><h3>最近活动</h3><Link href="/orders">查看全部</Link></div><div className="activity-list">{[{ icon: <Plus />, name: "模拟买入", date: "今天 14:28", value: "+0.025 BTC", cls: "positive" }, { icon: <Swap />, name: "模拟兑换", date: "8月28日", value: "+0.041 BTC", cls: "positive" }, { icon: <PaperPlaneTilt />, name: "演示转出", date: "8月22日", value: "-0.010 BTC", cls: "negative" }].map((item) => <div className="activity-row" key={item.date}><span className="activity-icon">{item.icon}</span><div><strong>{item.name}</strong><small className="muted block">{item.date}</small></div><b className={`mono ${item.cls}`}>{item.value}</b></div>)}</div></section></AppShell>;
}

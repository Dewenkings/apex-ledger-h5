"use client";
/* eslint-disable @next/next/no-img-element -- Preserve the supplied Stitch wallet assets without proxying them. */

import Link from "next/link";
import { useState } from "react";
import {
  CaretDown, CaretRight, CheckCircle,
  Clock, Copy, DownloadSimple, Eye, EyeSlash, Gear, Info, Lock,
  PaperPlaneTilt, Plus, Receipt, ShieldCheck, SignOut, SlidersHorizontal,
  Swap, UserCircle, Wallet, X,
} from "@phosphor-icons/react";
import { AppShell } from "./app-shell";
import { BrandHeader } from "./brand-header";
import { AssetMark, Change, PaperBadge, Sparkline } from "./ui";
import { markets, walletProviders, type Market } from "@/lib/data";
export { TradeScreen } from "./trade/trade-screen";
export { ConfirmScreen } from "./trade/confirm-screen";

const money = (value: number, digits = 2) => `$${value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

const orderRows = [
  { side: "BUY", pair: "BTC/USDT", type: "Limit", amount: "0.025 BTC", price: "68,342.10", status: "Open", time: "今天 14:28" },
  { side: "SELL", pair: "ETH/USDT", type: "Market", amount: "1.20 ETH", price: "3,498.20", status: "Filled", time: "昨天 19:42" },
  { side: "BUY", pair: "SOL/USDT", type: "Limit", amount: "8.50 SOL", price: "174.80", status: "Cancelled", time: "8月28日" },
];

export function OrdersScreen() {
  const [tab, setTab] = useState("Open"); const rows = tab === "Open" ? orderRows.filter((x) => x.status === "Open") : tab === "History" ? orderRows : orderRows.filter((x) => x.status === "Filled");
  return <AppShell><BrandHeader title="订单管理" subtitle="ORDERS" /><div className="page-actions"><div className="tabs">{["Open", "History", "Fills"].map((x) => <button onClick={() => setTab(x)} className={tab === x ? "active" : ""} key={x}>{x === "Open" ? "当前委托" : x === "History" ? "历史订单" : "成交记录"}</button>)}</div><button className="icon-button"><DownloadSimple /></button></div><section className="orders-stack">{rows.map((order) => <article className="order-card" key={`${order.pair}${order.time}`}><div className="row between"><div className="row gap-10"><span className={`side-tag ${order.side === "BUY" ? "buy" : "sell"}`}>{order.side}</span><strong>{order.pair}</strong><span className="muted">{order.type}</span></div><span className={`status ${order.status.toLowerCase()}`}>{order.status}</span></div><div className="order-grid"><span><i>数量</i><b className="mono">{order.amount}</b></span><span><i>价格</i><b className="mono">{order.price}</b></span><span><i>时间</i><b>{order.time}</b></span></div>{order.status === "Open" && <button className="text-button danger">撤销模拟订单</button>}</article>)}</section><div className="info-panel"><Receipt /><div><strong>所有记录均为模拟数据</strong><span>用于展示订单生命周期，不对应任何真实交易所账户。</span></div></div></AppShell>;
}

export function PortfolioScreen() {
  const [visible, setVisible] = useState(true);
  return <AppShell><BrandHeader title="资产总览" subtitle="PORTFOLIO OVERVIEW" /><section className="balance-card"><div className="row between"><span>模拟净资产</span><button className="icon-button" onClick={() => setVisible((x) => !x)}>{visible ? <Eye /> : <EyeSlash />}</button></div><h2 className="mono">{visible ? "$48,291.64" : "••••••••"}</h2><Change value={3.42} /><span className="muted">今日收益 {visible ? "+$1,582.34" : "••••"}</span><Sparkline points={[18, 21, 20, 29, 27, 35, 39, 36, 48, 53]} large /></section><div className="quick-actions"><button><PaperPlaneTilt /><span>转出</span></button><button><Wallet /><span>接收</span></button><Link href="/trade/btc-usdt"><Plus /><span>模拟买入</span></Link></div><section><div className="section-title"><h3>资产配置</h3><Link href="/orders">历史记录</Link></div><div className="allocation-bar"><i style={{ width: "42%", background: "#f7931a" }} /><i style={{ width: "32%", background: "#627eea" }} /><i style={{ width: "16%", background: "#9d63ff" }} /><i style={{ width: "10%", background: "#44e092" }} /></div><div className="asset-list">{[...markets.slice(0, 3), { ...markets[3], symbol: "USDT", name: "Tether", icon: "₮", color: "#26a17b", price: 1, change: 0, spark: [] } as Market].map((m, i) => <Link href={m.symbol === "BTC" ? "/portfolio/btc" : "#"} className="asset-row" key={m.symbol}><div className="row gap-12"><AssetMark market={m} /><span><strong>{m.name}</strong><small className="muted block">{[0.2964, 4.38, 31.2, 4829][i]} {m.symbol}</small></span></div><div><strong className="mono">{money([20258, 15424, 7780, 4829][i])}</strong><small className={m.change >= 0 ? "positive block" : "negative block"}>{m.change >= 0 ? "+" : ""}{m.change.toFixed(2)}%</small></div></Link>)}</div></section></AppShell>;
}

export function AssetDetailScreen() {
  return <AppShell><BrandHeader title="Bitcoin 详情" subtitle="ASSET DETAILS" back="/portfolio" /><section className="asset-balance"><AssetMark market={markets[0]} size={58} /><h2 className="mono">0.2964 BTC</h2><p className="mono">$20,258.34</p><Change value={4.18} /></section><section className="chart-card performance"><div className="section-title"><div><span className="muted">资产表现</span><h3 className="mono">+$812.42</h3></div><div className="time-tabs"><button>1D</button><button className="active">1W</button><button>1M</button></div></div><Sparkline points={[13, 18, 16, 25, 22, 31, 28, 39, 35, 47, 52, 49, 61]} large /><div className="chart-axis"><span>Mon</span><span>Wed</span><span>Fri</span><span>Sun</span></div></section><div className="quick-actions"><button><PaperPlaneTilt /><span>转出</span></button><button><Wallet /><span>接收</span></button><Link href="/trade/btc-usdt"><Swap /><span>交易</span></Link></div><section><div className="section-title"><h3>最近活动</h3><Link href="/orders">查看全部</Link></div><div className="activity-list">{[{ icon: <Plus />, name: "模拟买入", date: "今天 14:28", value: "+0.025 BTC", cls: "positive" }, { icon: <Swap />, name: "模拟兑换", date: "8月28日", value: "+0.041 BTC", cls: "positive" }, { icon: <PaperPlaneTilt />, name: "演示转出", date: "8月22日", value: "-0.010 BTC", cls: "negative" }].map((x) => <div className="activity-row" key={x.date}><span className="activity-icon">{x.icon}</span><div><strong>{x.name}</strong><small className="muted block">{x.date}</small></div><b className={`mono ${x.cls}`}>{x.value}</b></div>)}</div></section></AppShell>;
}

export function ConnectWalletScreen() {
  const [selected, setSelected] = useState<string>();
  return <AppShell hideNav><div className="connect-backdrop"><div className="wallet-modal"><div className="row between"><div className="row gap-10"><div className="security-icon small"><Wallet /></div><div><h1>连接钱包</h1><span className="eyebrow">SIGN IN WITH ETHEREUM</span></div></div><Link href="/markets" className="icon-button"><X /></Link></div><p className="wallet-copy">钱包只用于证明你拥有该地址并创建登录会话。不会请求转账授权，也不会产生 Gas。</p><div className="wallet-options">{walletProviders.map((wallet) => <button key={wallet.name} onClick={() => setSelected(wallet.name)} className={selected === wallet.name ? "selected" : ""}><img src={wallet.src} alt={`${wallet.name} logo`} /><strong>{wallet.name}</strong>{selected === wallet.name ? <CheckCircle weight="fill" /> : <CaretRight />}</button>)}</div>{selected && <div className="warning-box success"><CheckCircle /><span><strong>{selected} 已选中</strong>下一阶段接入 SIWE 后才会弹出消息签名。</span></div>}<div className="siwe-note"><ShieldCheck /><div><strong>安全登录，不是支付</strong><span>你将签署一段可读登录消息，不是链上交易。</span></div></div><p className="legal">继续即表示你同意演示版服务条款与隐私说明。本项目不托管资产。</p><Link href="/markets" className="secondary-button">稍后再说</Link></div></div></AppShell>;
}

export function SettingsScreen() {
  const [currency, setCurrency] = useState("USD"); const [biometric, setBiometric] = useState(true);
  const settings = [
    { icon: <ShieldCheck />, title: "登录安全", detail: biometric ? "本机生物识别已开启" : "生物识别已关闭", action: <button className={`toggle ${biometric ? "on" : ""}`} onClick={() => setBiometric((x) => !x)}><i /></button> },
    { icon: <Lock />, title: "隐私模式", detail: "隐藏敏感资产信息", action: <CaretRight /> },
    { icon: <Clock />, title: "会话管理", detail: "1 个当前设备", action: <CaretRight /> },
  ];
  return <AppShell><BrandHeader title="个人设置" subtitle="PROFILE & SETTINGS" back="/portfolio" /><section className="profile-card"><div className="profile-avatar"><UserCircle weight="fill" /></div><div><h2>Demo Trader</h2><button className="address mono">0x71F3...9A2C <Copy /></button><span className="verified"><CheckCircle weight="fill" /> SIWE 演示账户</span></div><button className="icon-button"><Gear /></button></section><section className="settings-section"><h3>安全与隐私</h3>{settings.map((item) => <div className="setting-row" key={item.title}><span className="setting-icon">{item.icon}</span><div><strong>{item.title}</strong><small className="muted block">{item.detail}</small></div>{item.action}</div>)}</section><section className="settings-section"><h3>应用偏好</h3><div className="setting-row"><span className="setting-icon"><SlidersHorizontal /></span><div><strong>计价货币</strong><small className="muted block">资产估值显示单位</small></div><button onClick={() => setCurrency(currency === "USD" ? "CNY" : "USD")} className="select-button">{currency}<CaretDown /></button></div><div className="setting-row"><span className="setting-icon"><Info /></span><div><strong>交易环境</strong><small className="muted block">真实交易默认禁用</small></div><PaperBadge /></div></section><section className="settings-section"><h3>关于项目</h3><div className="setting-row"><span className="setting-icon"><Receipt /></span><div><strong>Apex Ledger H5</strong><small className="muted block">面试作品 · v0.1.0</small></div><CaretRight /></div></section><Link href="/connect-wallet" className="signout-button"><SignOut /> 断开演示会话</Link></AppShell>;
}

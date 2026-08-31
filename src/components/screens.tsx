"use client";
import Link from "next/link";
import { useState } from "react";
import {
  CaretDown, CaretRight, CheckCircle,
  Clock, Copy, Gear, Info, Lock,
  PaperPlaneTilt, Plus, Receipt, ShieldCheck, SignOut, SlidersHorizontal,
  Swap, UserCircle, Wallet,
} from "@phosphor-icons/react";
import { AppShell } from "./app-shell";
import { BrandHeader } from "./brand-header";
import { AssetMark, Change, PaperBadge, Sparkline } from "./ui";
import { markets } from "@/lib/data";
export { TradeScreen } from "./trade/trade-screen";
export { ConfirmScreen } from "./trade/confirm-screen";
export { OrdersScreen } from "./trade/orders-screen";
export { PortfolioScreen } from "@/features/portfolio/portfolio-screen";
export { ConnectWalletScreen } from "@/features/wallet/connect-wallet-screen";

export function AssetDetailScreen() {
  return <AppShell><BrandHeader title="Bitcoin 详情" subtitle="ASSET DETAILS" back="/portfolio" /><section className="asset-balance"><AssetMark market={markets[0]} size={58} /><h2 className="mono">0.2964 BTC</h2><p className="mono">$20,258.34</p><Change value={4.18} /></section><section className="chart-card performance"><div className="section-title"><div><span className="muted">资产表现</span><h3 className="mono">+$812.42</h3></div><div className="time-tabs"><button>1D</button><button className="active">1W</button><button>1M</button></div></div><Sparkline points={[13, 18, 16, 25, 22, 31, 28, 39, 35, 47, 52, 49, 61]} large /><div className="chart-axis"><span>Mon</span><span>Wed</span><span>Fri</span><span>Sun</span></div></section><div className="quick-actions"><button><PaperPlaneTilt /><span>转出</span></button><button><Wallet /><span>接收</span></button><Link href="/trade/btc-usdt"><Swap /><span>交易</span></Link></div><section><div className="section-title"><h3>最近活动</h3><Link href="/orders">查看全部</Link></div><div className="activity-list">{[{ icon: <Plus />, name: "模拟买入", date: "今天 14:28", value: "+0.025 BTC", cls: "positive" }, { icon: <Swap />, name: "模拟兑换", date: "8月28日", value: "+0.041 BTC", cls: "positive" }, { icon: <PaperPlaneTilt />, name: "演示转出", date: "8月22日", value: "-0.010 BTC", cls: "negative" }].map((x) => <div className="activity-row" key={x.date}><span className="activity-icon">{x.icon}</span><div><strong>{x.name}</strong><small className="muted block">{x.date}</small></div><b className={`mono ${x.cls}`}>{x.value}</b></div>)}</div></section></AppShell>;
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

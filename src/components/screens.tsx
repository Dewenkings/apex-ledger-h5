"use client";
/* eslint-disable @next/next/no-img-element -- Preserve the supplied Stitch wallet assets without proxying them. */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Bell, CaretDown, CaretRight, Check, CheckCircle,
  Clock, Copy, DownloadSimple, Eye, EyeSlash, Gear, Info, Lock, MagnifyingGlass,
  PaperPlaneTilt, Plus, Receipt, ShieldCheck, SignOut, SlidersHorizontal,
  Swap, UserCircle, Wallet, X,
} from "@phosphor-icons/react";
import { AppShell } from "./app-shell";
import { AssetMark, Change, FavoriteMarketCard, PaperBadge, Sparkline } from "./ui";
import { TradeMarketPanel } from "./trade/trade-market-panel";
import { markets, walletProviders } from "@/lib/data";
import { estimatePaperOrder, filterMarkets } from "@/lib/trading";

const money = (value: number, digits = 2) => `$${value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

function BrandHeader({ title, subtitle, back }: { title?: string; subtitle?: string; back?: string }) {
  return <header className="topbar">
    <div className="row gap-12">{back ? <Link href={back} className="icon-button" aria-label="Back"><ArrowLeft /></Link> : <div className="brand-mark">A</div>}<div>{title ? <h1>{title}</h1> : <strong className="brand-name">Apex Ledger</strong>}{subtitle && <span className="eyebrow block">{subtitle}</span>}</div></div>
    <PaperBadge />
  </header>;
}

export function MarketScreen() {
  const [query, setQuery] = useState(""); const [category, setCategory] = useState("All");
  const visible = useMemo(() => filterMarkets(markets, query).filter((m) => category === "All" || m.category === category), [query, category]);
  return <AppShell><BrandHeader title="行情概览" subtitle="MARKET OVERVIEW" />
    <section className="hero-intro"><div><span className="muted">全球加密市场</span><h2>发现你的下一个机会</h2></div><button className="icon-button"><Bell /></button></section>
    <label className="search"><MagnifyingGlass /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索资产或交易对" /></label>
    <section><div className="section-title"><h3>自选市场</h3><span className="muted">实时演示数据</span></div><div className="favorite-grid">{markets.slice(0, 3).map((m) => <Link href={m.symbol === "BTC" ? "/trade/btc-usdt" : "#"} key={m.symbol}><FavoriteMarketCard market={m} /></Link>)}</div></section>
    <section><div className="section-title"><h3>全部资产</h3><SlidersHorizontal className="muted" /></div><div className="chip-row">{["All", "Layer 1", "DeFi", "Payments"].map((item) => <button onClick={() => setCategory(item)} className={`chip ${category === item ? "active" : ""}`} key={item}>{item}</button>)}</div>
      <div className="market-list"><div className="table-head"><span>资产</span><span>价格 / 24H</span></div>{visible.map((market) => <Link href={market.symbol === "BTC" ? "/trade/btc-usdt" : "#"} className="market-row" key={market.symbol}><div className="row gap-12"><AssetMark market={market} /><div><strong>{market.symbol}</strong><span className="muted block">{market.name}</span></div></div><Sparkline points={market.spark} positive={market.change >= 0} /><div className="market-price"><strong className="mono">{money(market.price, market.price < 1 ? 4 : 2)}</strong><Change value={market.change} /></div></Link>)}</div>
      {visible.length === 0 && <div className="empty"><MagnifyingGlass /><strong>没有匹配的资产</strong><span>换个关键词试试看</span></div>}
    </section>
  </AppShell>;
}

export function TradeScreen() {
  const [side, setSide] = useState<"buy" | "sell">("buy"); const [type, setType] = useState<"limit" | "market">("limit"); const [amount, setAmount] = useState("0.025");
  const [marketPrice, setMarketPrice] = useState(68342.1);
  const numericAmount = Number(amount) || 0; const quote = estimatePaperOrder({ amount: numericAmount, price: marketPrice, feeRate: 0.001 });
  const formattedMarketPrice = marketPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <AppShell><BrandHeader title="BTC / USDT" subtitle="SPOT · PAPER TRADING" back="/markets" />
    <TradeMarketPanel onPriceChange={setMarketPrice} />
    <section className="trade-panel"><div className="segmented"><button onClick={() => setSide("buy")} className={side === "buy" ? "buy active" : ""}>买入 BTC</button><button onClick={() => setSide("sell")} className={side === "sell" ? "sell active" : ""}>卖出 BTC</button></div><div className="order-type">{(["limit", "market"] as const).map((t) => <button onClick={() => setType(t)} className={type === t ? "active" : ""} key={t}>{t === "limit" ? "限价" : "市价"}</button>)}</div>
      <label className="field"><span>{type === "limit" ? "限价" : "参考价格"}</span><div><input value={type === "limit" ? formattedMarketPrice : "Market"} readOnly /><b>USDT</b></div></label>
      <label className="field"><span>数量</span><div><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" /><b>BTC</b></div></label>
      <div className="percent-row">{[25, 50, 75, 100].map((p) => <button key={p} onClick={() => setAmount((0.1 * p / 100).toFixed(3))}>{p}%</button>)}</div>
      <div className="order-summary"><span>可用余额 <b className="mono">12,480.00 USDT</b></span><span>预计金额 <b className="mono">{money(quote.total)}</b></span></div>
      <Link href={`/trade/btc-usdt/confirm?side=${side}&amount=${numericAmount}`} className={`primary-button ${side === "sell" ? "danger-button" : ""}`}>{side === "buy" ? "预览买入订单" : "预览卖出订单"}<ArrowRight /></Link><p className="safety-note"><ShieldCheck /> 模拟环境，不会请求钱包交易签名或扣除真实资产</p>
    </section>
    <section><div className="section-title"><h3>订单簿</h3><span className="muted mono">0.10</span></div><div className="orderbook"><div><span>价格 (USDT)</span><span>数量 (BTC)</span><span>合计</span></div>{[[68391, .018, "sell"], [68376, .042, "sell"], [68361, .025, "sell"], [68342, .037, "buy"], [68328, .051, "buy"], [68311, .029, "buy"]].map(([p, a, s]) => <div key={`${p}`} className={s as string}><b>{Number(p).toLocaleString()}</b><span>{Number(a).toFixed(3)}</span><span>{money(Number(p) * Number(a), 0)}</span></div>)}</div></section>
  </AppShell>;
}

export function ConfirmScreen() {
  const [status, setStatus] = useState<"idle" | "done">("idle");
  const params = useSearchParams();
  const side = params.get("side") === "sell" ? "sell" : "buy";
  const amount = Math.max(Number(params.get("amount")) || .025, 0);
  const quote = estimatePaperOrder({ amount, price: 68342.1, feeRate: .001 });
  const sideLabel = side === "buy" ? "买入" : "卖出";
  if (status === "done") return <AppShell hideNav><div className="result-screen"><div className="success-orb"><Check /></div><PaperBadge /><h1>模拟订单已提交</h1><p>{sideLabel} {amount} BTC 的 Paper Order 已进入订单历史。</p><div className="receipt"><span>订单编号 <b className="mono">APX-0829-1842</b></span><span>成交环境 <b>PAPER LIVE</b></span><span>真实扣款 <b className="positive">¥0.00</b></span></div><Link href="/orders" className="primary-button">查看订单 <ArrowRight /></Link><Link href="/markets" className="secondary-button">返回行情</Link></div></AppShell>;
  return <AppShell hideNav><div className="modal-page"><BrandHeader title="确认模拟订单" subtitle="ORDER PREVIEW" back="/trade/btc-usdt" /><section className="confirm-hero"><div className="security-icon"><ShieldCheck /></div><h2>请核对订单信息</h2><p>这是一笔 Paper Trading 模拟订单，不会生成链上交易，也不会扣除钱包资产。</p></section><section className="confirm-card"><div className="row between"><span className="muted">订单方向</span><strong className={side === "buy" ? "positive" : "negative"}>{sideLabel} BTC</strong></div><div className="asset-swap"><div><AssetMark market={markets[0]} size={44} /><span><small>{side === "buy" ? "支付" : "卖出"}</small><strong className="mono">{side === "buy" ? `${money(quote.total)} USDT` : `${amount} BTC`}</strong></span></div><ArrowRight /><div><AssetMark market={markets[0]} size={44} /><span><small>预计{side === "buy" ? "获得" : "收入"}</small><strong className="mono">{side === "buy" ? `${amount} BTC` : `${money(quote.subtotal - quote.fee)} USDT`}</strong></span></div></div><div className="detail-list"><span>订单类型 <b>限价单</b></span><span>限价 <b className="mono">68,342.10 USDT</b></span><span>模拟手续费 <b className="mono">{money(quote.fee)}</b></span><span>环境 <PaperBadge /></span></div></section><div className="warning-box"><Info /><span><strong>不会触发钱包支付</strong>确认只会向本地 Paper Engine 写入模拟订单。</span></div><button onClick={() => setStatus("done")} className="primary-button">确认模拟下单 <CheckCircle /></button><Link href="/trade/btc-usdt" className="secondary-button">返回修改</Link></div></AppShell>;
}

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
  return <AppShell><BrandHeader title="资产总览" subtitle="PORTFOLIO OVERVIEW" /><section className="balance-card"><div className="row between"><span>模拟净资产</span><button className="icon-button" onClick={() => setVisible((x) => !x)}>{visible ? <Eye /> : <EyeSlash />}</button></div><h2 className="mono">{visible ? "$48,291.64" : "••••••••"}</h2><Change value={3.42} /><span className="muted">今日收益 {visible ? "+$1,582.34" : "••••"}</span><Sparkline points={[18, 21, 20, 29, 27, 35, 39, 36, 48, 53]} large /></section><div className="quick-actions"><button><PaperPlaneTilt /><span>转出</span></button><button><Wallet /><span>接收</span></button><Link href="/trade/btc-usdt"><Plus /><span>模拟买入</span></Link></div><section><div className="section-title"><h3>资产配置</h3><Link href="/orders">历史记录</Link></div><div className="allocation-bar"><i style={{ width: "42%", background: "#f7931a" }} /><i style={{ width: "32%", background: "#627eea" }} /><i style={{ width: "16%", background: "#9d63ff" }} /><i style={{ width: "10%", background: "#44e092" }} /></div><div className="asset-list">{markets.slice(0, 3).concat([{ ...markets[3], symbol: "USDT", name: "Tether", icon: "₮", color: "#26a17b", price: 1, change: 0, spark: [] }]).map((m, i) => <Link href={m.symbol === "BTC" ? "/portfolio/btc" : "#"} className="asset-row" key={m.symbol}><div className="row gap-12"><AssetMark market={m} /><span><strong>{m.name}</strong><small className="muted block">{[0.2964, 4.38, 31.2, 4829][i]} {m.symbol}</small></span></div><div><strong className="mono">{money([20258, 15424, 7780, 4829][i])}</strong><small className={m.change >= 0 ? "positive block" : "negative block"}>{m.change >= 0 ? "+" : ""}{m.change.toFixed(2)}%</small></div></Link>)}</div></section></AppShell>;
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

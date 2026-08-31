"use client";

import { Bell, Clock, MagnifyingGlass, SlidersHorizontal, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { BrandHeader } from "@/components/brand-header";
import { AssetMark, Change, FavoriteMarketCard, Sparkline } from "@/components/ui";
import { filterMarkets } from "@/lib/trading";
import { getPairBySymbol } from "@/lib/trading/pairs";
import { useMarketOverview, type OverviewDisplaySource, type OverviewMarket } from "./use-market-overview";

const sourceLabels: Record<OverviewDisplaySource, string> = {
  okx: "OKX LIVE",
  kraken: "KRAKEN LIVE",
  mixed: "MIXED LIVE",
  "mixed-data": "MIXED DATA",
  demo: "DEMO DATA",
};

const priceFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
const updateFormatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function MarketDestination({ market, children }: { market: OverviewMarket; children: ReactNode }) {
  const pair = getPairBySymbol(market.symbol);
  return pair ? <Link href={`/trade/${pair.pairSlug}`}>{children}</Link> : <>{children}</>;
}

function sourceShort(source: OverviewMarket["source"]): string {
  return source === "demo" ? "DEMO" : source.toUpperCase();
}

export function MarketScreen() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const overview = useMarketOverview();
  const visible = useMemo(
    () => filterMarkets(overview.markets, query)
      .filter((market) => category === "All" || market.category === category),
    [overview.markets, query, category],
  );

  return <AppShell>
    <BrandHeader title="行情概览" subtitle="MARKET OVERVIEW" />
    <section className="hero-intro">
      <div><span className="muted">全球加密市场</span><h2>发现你的下一个机会</h2></div>
      <button className="icon-button" aria-label="行情提醒"><Bell /></button>
    </section>

    {overview.isInitialLoading ? <MarketOverviewLoading /> : <>
      <div className="overview-meta">
        <span className={`market-source ${overview.source === "demo" || overview.source === "mixed-data" ? "fallback" : overview.source !== "okx" ? "backup" : ""}`}>
          {sourceLabels[overview.source]}
        </span>
        <span className="overview-updated"><Clock />{overview.updatedAt ? `更新于 ${updateFormatter.format(new Date(overview.updatedAt))}` : "演示快照"}</span>
        {overview.isRefreshing && <span className="overview-refreshing">更新中</span>}
      </div>

      {overview.hasError && <div className="market-overview-warning" role="alert">
        <WarningCircle />
        <span>{overview.source === "demo"
          ? "两个实时数据源暂时不可用，当前显示明确标注的演示数据。"
          : "行情刷新失败，继续展示上一次取得的实时数据。"}</span>
        <button type="button" aria-label="重试市场行情" onClick={overview.retry}>重试</button>
      </div>}

      <label className="search"><MagnifyingGlass /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索资产或交易对" /></label>

      <section>
        <div className="section-title"><h3>自选市场</h3><span className="muted">24H · USDT</span></div>
        <div className="favorite-grid">{overview.markets.slice(0, 3).map((market) => <MarketDestination market={market} key={market.symbol}>
          <div className="favorite-market-wrap">
            <FavoriteMarketCard market={market} />
            <span className={`row-source ${market.source === "demo" ? "demo" : ""}`}>{sourceShort(market.source)}</span>
          </div>
        </MarketDestination>)}</div>
      </section>

      <section>
        <div className="section-title"><h3>全部资产</h3><SlidersHorizontal className="muted" /></div>
        <div className="chip-row">{["All", "Layer 1", "DeFi", "Payments"].map((item) => <button type="button" onClick={() => setCategory(item)} className={`chip ${category === item ? "active" : ""}`} key={item}>{item}</button>)}</div>
        <div className="market-list">
          <div className="table-head"><span>资产</span><span>价格 / 24H</span></div>
          {visible.map((market) => <MarketDestination market={market} key={market.symbol}>
            <div className="market-row" data-testid={`market-row-${market.symbol}`}>
              <div className="row gap-12"><AssetMark market={market} /><div><strong>{market.symbol}</strong><span className="muted block">{market.name} · USDT</span><small className={`row-source ${market.source === "demo" ? "demo" : ""}`}>{sourceShort(market.source)}</small></div></div>
              <Sparkline points={market.spark} positive={market.change >= 0} />
              <div className="market-price"><strong className="mono">${priceFormatter.format(market.price)}</strong><Change value={market.change} /></div>
            </div>
          </MarketDestination>)}
        </div>
        {visible.length === 0 && <div className="empty"><MagnifyingGlass /><strong>没有匹配的资产</strong><span>换个关键词试试看</span></div>}
      </section>
    </>}
  </AppShell>;
}

function MarketOverviewLoading() {
  return <div className="market-overview-loading" role="status" aria-label="正在加载市场行情">
    <div className="market-skeleton overview-meta-skeleton" />
    <div className="market-skeleton overview-search-skeleton" />
    <div className="market-skeleton overview-card-skeleton" />
    <div className="market-skeleton overview-list-skeleton" />
  </div>;
}

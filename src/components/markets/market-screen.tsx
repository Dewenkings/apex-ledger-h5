"use client";

import { Bell, Clock, MagnifyingGlass, SlidersHorizontal, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { AssetMark, Change, FavoriteMarketCard, PaperBadge } from "@/components/ui";
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
    <header className="market-page-header">
      <div className="market-heading">
        <div className="brand-mark">A</div>
        <div><span className="market-kicker">APEX LEDGER</span><h1>行情概览</h1></div>
      </div>
      <div className="market-header-actions"><PaperBadge /><button className="icon-button" aria-label="行情提醒"><Bell /></button></div>
    </header>

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
          <FavoriteMarketCard market={market} sourceLabel={sourceShort(market.source)} sourceDemo={market.source === "demo"} />
        </MarketDestination>)}</div>
      </section>

      <section>
        <div className="section-title"><h3>全部资产</h3><SlidersHorizontal className="muted" /></div>
        <div className="chip-row">{["All", "Layer 1", "DeFi", "Payments"].map((item) => <button type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className={`chip ${category === item ? "active" : ""}`} key={item}>{item}</button>)}</div>
        <div className="market-list">
          <div className="table-head"><span>资产</span><span>价格</span><span>24H 涨跌</span></div>
          {visible.map((market) => <MarketDestination market={market} key={market.symbol}>
            <div className="market-row" data-testid={`market-row-${market.symbol}`}>
              <div className="row gap-12"><AssetMark market={market} /><div><div className="market-symbol-line"><strong>{market.symbol}</strong><small className={`row-source ${market.source === "demo" ? "demo" : ""}`}>{sourceShort(market.source)}</small></div><span className="muted block">{market.name} · USDT</span></div></div>
              <strong className="market-price mono">${priceFormatter.format(market.price)}</strong>
              <div className="market-change"><Change value={market.change} /></div>
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

"use client";

import { CalendarBlank, CheckCircle, Gauge, Ruler, WarningCircle } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { SpotInstrumentInfo } from "@/lib/market-data/types";
import type { TradingPairConfig } from "@/lib/trading/pairs";

type InformationState = "loading" | "ready" | "error";
type InformationSnapshot = { instrument: string; information: SpotInstrumentInfo | null; state: InformationState };

const listedFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function TradeInstrumentInfo({ pair }: { pair: TradingPairConfig }) {
  const [snapshot, setSnapshot] = useState<InformationSnapshot>({ instrument: pair.instrument, information: null, state: "loading" });
  const [retryKey, setRetryKey] = useState(0);
  const requestVersion = useRef(0);

  useEffect(() => {
    const version = ++requestVersion.current;
    const controller = new AbortController();
    fetch(`/api/market/instrument?instrument=${pair.instrument}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Instrument information request failed");
        return response.json() as Promise<{ data: SpotInstrumentInfo }>;
      })
      .then(({ data }) => {
        if (requestVersion.current !== version || controller.signal.aborted) return;
        setSnapshot({ instrument: pair.instrument, information: data, state: "ready" });
      })
      .catch((error: unknown) => {
        void error;
        if (requestVersion.current !== version || controller.signal.aborted) return;
        setSnapshot({ instrument: pair.instrument, information: null, state: "error" });
      });
    return () => controller.abort();
  }, [pair.instrument, retryKey]);

  const retry = useCallback(() => {
    setSnapshot({ instrument: pair.instrument, information: null, state: "loading" });
    setRetryKey((key) => key + 1);
  }, [pair.instrument]);
  const { information, state } = snapshot.instrument === pair.instrument
    ? snapshot
    : { information: null, state: "loading" as const };

  if (state === "loading") return <div className="instrument-info-loading" role="status" aria-label="正在加载交易资料">
    <div className="market-skeleton instrument-info-hero-skeleton" />
    <div className="market-skeleton instrument-info-grid-skeleton" />
  </div>;

  if (state === "error" || !information) return <div className="instrument-info-error" role="alert">
    <WarningCircle />
    <div><strong>交易资料暂时不可用</strong><span>实时行情不受影响，你可以稍后重试。</span></div>
    <button type="button" onClick={retry}>重试</button>
  </div>;

  return <section className="instrument-info-view" aria-label={`${pair.instrument} 交易资料`}>
    <div className="instrument-info-hero">
      <div><span className="trade-kicker">PUBLIC MARKET PROFILE</span><h2>{pair.baseSymbol} / {pair.quoteSymbol}</h2><p>公开现货交易规则与产品状态</p></div>
      <span className={`instrument-state ${information.state === "live" ? "live" : ""}`}><CheckCircle weight="fill" />{information.state === "live" ? "开放交易" : information.state}</span>
    </div>

    <div className="instrument-info-section">
      <div className="instrument-info-heading"><div><span className="trade-kicker">EXECUTION PARAMETERS</span><h3>交易规则</h3></div><Gauge /></div>
      <dl className="instrument-rule-grid">
        <div><dt>最小下单量</dt><dd>{information.minSize} {information.baseSymbol}</dd></div>
        <div><dt>价格步长</dt><dd>{information.tickSize} {information.quoteSymbol}</dd></div>
        <div><dt>数量步长</dt><dd>{information.lotSize} {information.baseSymbol}</dd></div>
        <div><dt>计价资产</dt><dd>{information.quoteSymbol}</dd></div>
      </dl>
    </div>

    <div className="instrument-info-section compact">
      <div className="instrument-fact"><CalendarBlank /><span>公开市场时间</span><strong>{information.listedAt ? listedFormatter.format(new Date(information.listedAt)) : "暂无记录"}</strong></div>
      <div className="instrument-fact"><Ruler /><span>交易对标识</span><strong className="mono">{information.instrument}</strong></div>
    </div>

    <p className="instrument-info-note">这里只展示公开市场可验证的数据。项目背景、团队和白皮书不属于交易所公共行情字段，因此不会用演示文案代替。</p>
  </section>;
}

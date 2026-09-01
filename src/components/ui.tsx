import { ArrowDownRight, ArrowUpRight, Star } from "@phosphor-icons/react/dist/ssr";
import type { Market } from "@/lib/data";

export function AssetMark({ market, size = 38 }: { market: Pick<Market, "icon" | "color" | "symbol">; size?: number }) {
  return <span className="asset-mark" style={{ "--asset-color": market.color, width: size, height: size } as React.CSSProperties} aria-label={`${market.symbol} logo`}>{market.icon}</span>;
}

export function Sparkline({ points, positive = true, large = false }: { points: number[]; positive?: boolean; large?: boolean }) {
  if (points.length < 2) return <span className={`no-spark ${large ? "large" : ""}`} role="img" aria-label="No price trend">—</span>;
  const max = Math.max(...points); const min = Math.min(...points); const width = large ? 350 : 96; const height = large ? 150 : 38;
  const coords = points.map((p, i) => `${(i / (points.length - 1)) * width},${height - ((p - min) / Math.max(max - min, 1)) * (height - 10) - 5}`).join(" ");
  return <svg className={`sparkline ${large ? "large" : ""}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${positive ? "Rising" : "Falling"} price trend`} preserveAspectRatio="none"><polyline points={coords} fill="none" stroke={positive ? "#44e092" : "#f84960"} strokeWidth={large ? 3 : 2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function Change({ value }: { value: number }) {
  const UpIcon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={`change ${value >= 0 ? "positive" : "negative"}`}><UpIcon weight="bold" />{Math.abs(value).toFixed(2)}%</span>;
}

export function FavoriteMarketCard({ market, sourceLabel, sourceDemo = false }: { market: Market; sourceLabel?: string; sourceDemo?: boolean }) {
  return <article className="favorite-card">
    <div className="favorite-identity row gap-10"><AssetMark market={market} size={34} /><div><strong>{market.symbol}</strong><span className="muted block">{market.name}</span>{sourceLabel && <small className={`row-source ${sourceDemo ? "demo" : ""}`}>{sourceLabel}</small>}</div></div>
    <div className="favorite-quote"><Change value={market.change} /><Star weight="fill" className="warning" /></div>
    <div className="favorite-price mono">${market.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
    <Sparkline points={market.spark} positive={market.change >= 0} />
  </article>;
}

export function PaperBadge() { return <span className="paper-badge"><i /> PAPER LIVE</span>; }

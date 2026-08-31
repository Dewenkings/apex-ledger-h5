"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  type CandlestickData,
  type UTCTimestamp,
} from "lightweight-charts";

import type { MarketCandle } from "@/lib/market-data/types";

export function CandlestickChart({ instrument, candles }: { instrument: string; candles: MarketCandle[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const chart = createChart(container, {
      width: Math.max(container.clientWidth, 1),
      height: Math.max(container.clientHeight, 320),
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8f9c95",
        fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "#20282a" },
        horzLines: { color: "#20282a" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#2a3036" },
      timeScale: { borderColor: "#2a3036", timeVisible: true, secondsVisible: false },
      handleScale: true,
      handleScroll: true,
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#44e092",
      downColor: "#f84960",
      borderUpColor: "#44e092",
      borderDownColor: "#f84960",
      wickUpColor: "#44e092",
      wickDownColor: "#f84960",
      priceLineColor: "#44e092",
    });
    const chartData: CandlestickData<UTCTimestamp>[] = candles.map((candle) => ({
      time: candle.time as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));
    series.setData(chartData);
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(([entry]) => {
      chart.applyOptions({
        width: Math.max(Math.round(entry.contentRect.width), 1),
        height: Math.max(Math.round(entry.contentRect.height), 320),
      });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [candles]);

  return <div ref={containerRef} className="candlestick-chart" aria-label={`${instrument} 蜡烛图`} />;
}

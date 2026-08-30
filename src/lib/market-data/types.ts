export const chartPeriods = ["1H", "4H", "1D", "1W"] as const;

export type ChartPeriod = (typeof chartPeriods)[number];

export type LiveMarketSource = "okx" | "kraken";

export type LiveMarketResponse<T> = {
  data: T;
  source: LiveMarketSource;
};

export type MarketTicker = {
  instrument: "BTC-USDT";
  last: number;
  open24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: number;
};

export type MarketCandle = {
  /** Unix timestamp in whole seconds, as expected by charting libraries. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  confirmed: boolean;
};

export function isChartPeriod(value: string | null): value is ChartPeriod {
  return chartPeriods.some((period) => period === value);
}

export const chartPeriods = ["1H", "4H", "1D", "1W"] as const;

export const marketSymbols = ["BTC", "ETH", "SOL", "BNB", "ADA", "AVAX", "DOT", "POL"] as const;

export type MarketSymbol = (typeof marketSymbols)[number];

export type MarketInstrument = `${MarketSymbol}-USDT`;

export function toMarketInstrument(symbol: MarketSymbol): MarketInstrument {
  return `${symbol}-USDT`;
}

export type ChartPeriod = (typeof chartPeriods)[number];

export type LiveMarketSource = "okx" | "kraken";

export type LiveMarketResponse<T> = {
  data: T;
  source: LiveMarketSource;
};

export type MarketOverviewItem = MarketTicker & {
  symbol: MarketSymbol;
  spark: number[];
  source: LiveMarketSource;
};

export type MarketOverviewResponse = {
  data: MarketOverviewItem[];
  source: LiveMarketSource | "mixed";
  updatedAt: number;
};

export type MarketTicker = {
  instrument: MarketInstrument;
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

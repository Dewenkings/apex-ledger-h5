import { KrakenMarketAdapter } from "./kraken";
import { OkxMarketAdapter } from "./okx";
import type { ChartPeriod, LiveMarketResponse, LiveMarketSource, MarketCandle, MarketTicker } from "./types";

export type MarketProvider = {
  source: LiveMarketSource;
  getTicker(): Promise<MarketTicker>;
  getCandles(period: ChartPeriod, limit?: number): Promise<MarketCandle[]>;
};

async function firstAvailable<T>(
  providers: MarketProvider[],
  load: (provider: MarketProvider) => Promise<T>,
): Promise<LiveMarketResponse<T>> {
  for (const provider of providers) {
    try {
      return { data: await load(provider), source: provider.source };
    } catch {
      // Try the next public live provider before allowing the UI to use demo data.
    }
  }
  throw new Error("All live market providers failed");
}

export function getTickerFromProviders(providers: MarketProvider[]): Promise<LiveMarketResponse<MarketTicker>> {
  return firstAvailable(providers, (provider) => provider.getTicker());
}

export function getCandlesFromProviders(
  period: ChartPeriod,
  providers: MarketProvider[],
  limit = 120,
): Promise<LiveMarketResponse<MarketCandle[]>> {
  return firstAvailable(providers, async (provider) => {
    const candles = await provider.getCandles(period, limit);
    if (candles.length === 0) throw new Error("Empty live candle response");
    return candles;
  });
}

export function createLiveMarketProviders(): MarketProvider[] {
  return [
    { source: "okx", ...bindProvider(new OkxMarketAdapter(fetch, 3500)) },
    { source: "kraken", ...bindProvider(new KrakenMarketAdapter(fetch, 3500)) },
  ];
}

function bindProvider(adapter: Pick<MarketProvider, "getTicker" | "getCandles">) {
  return {
    getTicker: adapter.getTicker.bind(adapter),
    getCandles: adapter.getCandles.bind(adapter),
  };
}

import { KrakenMarketAdapter } from "./kraken";
import { OkxMarketAdapter } from "./okx";
import type { ChartPeriod, LiveMarketResponse, LiveMarketSource, MarketCandle, MarketInstrument, MarketTicker } from "./types";

export type MarketProvider = {
  source: LiveMarketSource;
  getTickerForInstrument(instrument: MarketInstrument): Promise<MarketTicker>;
  getCandlesForInstrument(
    instrument: MarketInstrument,
    period: ChartPeriod,
    limit?: number,
  ): Promise<MarketCandle[]>;
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

export function getTickerFromProviders(
  instrument: MarketInstrument,
  providers: MarketProvider[],
): Promise<LiveMarketResponse<MarketTicker>> {
  return firstAvailable(providers, (provider) => provider.getTickerForInstrument(instrument));
}

export function getCandlesFromProviders(
  instrument: MarketInstrument,
  period: ChartPeriod,
  providers: MarketProvider[],
  limit = 120,
): Promise<LiveMarketResponse<MarketCandle[]>> {
  return firstAvailable(providers, async (provider) => {
    const candles = await provider.getCandlesForInstrument(instrument, period, limit);
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

function bindProvider(
  adapter: Pick<MarketProvider, "getTickerForInstrument" | "getCandlesForInstrument">,
) {
  return {
    getTickerForInstrument: adapter.getTickerForInstrument.bind(adapter),
    getCandlesForInstrument: adapter.getCandlesForInstrument.bind(adapter),
  };
}

import { KrakenMarketAdapter } from "./kraken";
import { OkxMarketAdapter } from "./okx";
import type {
  ChartPeriod,
  LiveMarketSource,
  MarketCandle,
  MarketInstrument,
  MarketOverviewItem,
  MarketOverviewResponse,
  MarketSymbol,
  MarketTicker,
} from "./types";

export type OverviewProvider = {
  source: LiveMarketSource;
  getTickers(instruments: MarketInstrument[]): Promise<MarketTicker[]>;
  getCandlesForInstrument(
    instrument: MarketInstrument,
    period: ChartPeriod,
    limit?: number,
  ): Promise<MarketCandle[]>;
};

type SelectedTicker = {
  provider: OverviewProvider;
  ticker: MarketTicker;
};

function isUsableTicker(ticker: MarketTicker, expected: MarketInstrument): boolean {
  return ticker.instrument === expected
    && [ticker.last, ticker.open24h, ticker.high24h, ticker.low24h, ticker.timestamp]
      .every((value) => Number.isFinite(value) && value > 0)
    && Number.isFinite(ticker.volume24h)
    && ticker.volume24h >= 0;
}

function symbolFromInstrument(instrument: MarketInstrument): MarketSymbol {
  return instrument.slice(0, -"-USDT".length) as MarketSymbol;
}

export async function getMarketOverview(
  providers: OverviewProvider[],
  instruments: MarketInstrument[],
): Promise<MarketOverviewResponse> {
  const selected = new Map<MarketInstrument, SelectedTicker>();

  for (const provider of providers) {
    const remaining = instruments.filter((instrument) => !selected.has(instrument));
    if (remaining.length === 0) break;

    try {
      const tickers = await provider.getTickers(remaining);
      for (const ticker of tickers) {
        if (remaining.includes(ticker.instrument) && isUsableTicker(ticker, ticker.instrument)) {
          selected.set(ticker.instrument, { provider, ticker });
        }
      }
    } catch {
      // A later public provider may still supply the missing rows.
    }
  }

  if (selected.size === 0) throw new Error("All live overview providers failed");

  const data = await Promise.all(instruments.flatMap((instrument) => {
    const item = selected.get(instrument);
    if (!item) return [];
    return [buildOverviewItem(item)];
  }));
  const sources = new Set(data.map(({ source }) => source));

  return {
    data,
    source: sources.size === 1 ? data[0].source : "mixed",
    updatedAt: Math.max(...data.map(({ timestamp }) => timestamp)),
  };
}

async function buildOverviewItem({ provider, ticker }: SelectedTicker): Promise<MarketOverviewItem> {
  let spark: number[] = [];
  try {
    const candles = await provider.getCandlesForInstrument(ticker.instrument, "1H", 24);
    spark = candles
      .map(({ close }) => close)
      .filter((close) => Number.isFinite(close) && close > 0);
  } catch {
    // A valid live ticker remains useful when historical candles are unavailable.
  }

  return {
    ...ticker,
    symbol: symbolFromInstrument(ticker.instrument),
    spark,
    source: provider.source,
  };
}

export function createOverviewProviders(): OverviewProvider[] {
  return [
    bindOverviewProvider("okx", new OkxMarketAdapter(fetch, 3500)),
    bindOverviewProvider("kraken", new KrakenMarketAdapter(fetch, 3500)),
  ];
}

function bindOverviewProvider(
  source: LiveMarketSource,
  adapter: Pick<OverviewProvider, "getTickers" | "getCandlesForInstrument">,
): OverviewProvider {
  return {
    source,
    getTickers: adapter.getTickers.bind(adapter),
    getCandlesForInstrument: adapter.getCandlesForInstrument.bind(adapter),
  };
}

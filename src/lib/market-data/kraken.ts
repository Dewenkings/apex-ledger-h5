import type { ChartPeriod, MarketCandle, MarketTicker } from "./types";

const KRAKEN_BASE_URL = "https://api.kraken.com";

type Fetcher = typeof fetch;
type KrakenEnvelope = { error?: unknown; result?: unknown };

const periodIntervals: Record<ChartPeriod, number> = {
  "1H": 60,
  "4H": 240,
  "1D": 1440,
  "1W": 10080,
};

export function toKrakenInterval(period: ChartPeriod): number {
  return periodIntervals[period];
}

function parseFiniteNumber(value: unknown, errorMessage: string): number {
  if (typeof value !== "string" && typeof value !== "number") throw new Error(errorMessage);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(errorMessage);
  return parsed;
}

function getResult(payload: unknown, errorMessage: string): Record<string, unknown> {
  if (!payload || typeof payload !== "object") throw new Error(errorMessage);
  const envelope = payload as KrakenEnvelope;
  if (!Array.isArray(envelope.error) || envelope.error.length > 0 || !envelope.result || typeof envelope.result !== "object") {
    throw new Error(errorMessage);
  }
  return envelope.result as Record<string, unknown>;
}

function getPairValue(result: Record<string, unknown>, errorMessage: string): unknown {
  const pairEntry = Object.entries(result).find(([key]) => key !== "last");
  if (!pairEntry) throw new Error(errorMessage);
  return pairEntry[1];
}

function arrayNumber(value: unknown, index: number, errorMessage: string): number {
  if (!Array.isArray(value) || value.length <= index) throw new Error(errorMessage);
  return parseFiniteNumber(value[index], errorMessage);
}

export function normalizeKrakenTicker(payload: unknown, timestamp = Date.now()): MarketTicker {
  const errorMessage = "Invalid Kraken ticker payload";
  const ticker = getPairValue(getResult(payload, errorMessage), errorMessage);
  if (!ticker || typeof ticker !== "object") throw new Error(errorMessage);
  const fields = ticker as Record<string, unknown>;

  return {
    instrument: "BTC-USDT",
    last: arrayNumber(fields.c, 0, errorMessage),
    open24h: parseFiniteNumber(fields.o, errorMessage),
    high24h: arrayNumber(fields.h, 1, errorMessage),
    low24h: arrayNumber(fields.l, 1, errorMessage),
    volume24h: arrayNumber(fields.v, 1, errorMessage),
    timestamp,
  };
}

export function normalizeKrakenCandles(payload: unknown): MarketCandle[] {
  const errorMessage = "Invalid Kraken candle payload";
  const rows = getPairValue(getResult(payload, errorMessage), errorMessage);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(errorMessage);

  const candles = rows.map((row): Omit<MarketCandle, "confirmed"> => {
    if (!Array.isArray(row) || row.length < 8) throw new Error(errorMessage);
    return {
      time: parseFiniteNumber(row[0], errorMessage),
      open: parseFiniteNumber(row[1], errorMessage),
      high: parseFiniteNumber(row[2], errorMessage),
      low: parseFiniteNumber(row[3], errorMessage),
      close: parseFiniteNumber(row[4], errorMessage),
      volume: parseFiniteNumber(row[6], errorMessage),
    };
  }).sort((left, right) => left.time - right.time);

  return candles.map((candle, index) => ({
    ...candle,
    confirmed: index < candles.length - 1,
  }));
}

export class KrakenMarketAdapter {
  constructor(
    private readonly fetcher: Fetcher = fetch,
    private readonly requestTimeoutMs = 3500,
    private readonly now: () => number = Date.now,
  ) {}

  async getTicker(): Promise<MarketTicker> {
    const url = new URL("/0/public/Ticker", KRAKEN_BASE_URL);
    url.searchParams.set("pair", "XBTUSDT");
    return normalizeKrakenTicker(await this.request(url), this.now());
  }

  async getCandles(period: ChartPeriod, limit = 120): Promise<MarketCandle[]> {
    const url = new URL("/0/public/OHLC", KRAKEN_BASE_URL);
    url.searchParams.set("pair", "XBTUSDT");
    url.searchParams.set("interval", String(toKrakenInterval(period)));
    return normalizeKrakenCandles(await this.request(url)).slice(-limit);
  }

  private async request(url: URL): Promise<unknown> {
    const response = await this.fetcher(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(this.requestTimeoutMs),
      next: { revalidate: 10 },
    });
    if (!response.ok) throw new Error(`Kraken request failed with ${response.status}`);
    return response.json();
  }
}

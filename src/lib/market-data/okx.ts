import type { ChartPeriod, MarketCandle, MarketInstrument, MarketTicker, OrderBookSnapshot } from "./types";
import { normalizeOkxOrderBook } from "./order-book";

export { OkxBooks5Client } from "./okx-books5-client";
export { normalizeOkxOrderBook } from "./order-book";

const DEFAULT_OKX_BASE_URL = "https://openapi.okx.com";

type Fetcher = typeof fetch;

type OkxEnvelope = {
  code?: unknown;
  msg?: unknown;
  data?: unknown;
};

const periodBars: Record<ChartPeriod, string> = {
  "1H": "1H",
  "4H": "4H",
  "1D": "1Dutc",
  "1W": "1Wutc",
};

export function toOkxBar(period: ChartPeriod): string {
  return periodBars[period];
}

function parseFiniteNumber(value: unknown, errorMessage: string): number {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(errorMessage);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(errorMessage);
  return parsed;
}

function getSuccessfulData(payload: unknown, errorMessage: string): unknown[] {
  if (!payload || typeof payload !== "object") throw new Error(errorMessage);
  const envelope = payload as OkxEnvelope;
  if (envelope.code !== "0" || !Array.isArray(envelope.data) || envelope.data.length === 0) {
    throw new Error(errorMessage);
  }
  return envelope.data;
}

function normalizeTickerRow(rawTicker: unknown, instrument: MarketInstrument): MarketTicker {
  if (!rawTicker || typeof rawTicker !== "object") {
    throw new Error("Invalid OKX ticker payload");
  }

  const ticker = rawTicker as Record<string, unknown>;
  if (ticker.instId !== instrument) throw new Error("Invalid OKX ticker payload");

  return {
    instrument,
    last: parseFiniteNumber(ticker.last, "Invalid OKX ticker payload"),
    open24h: parseFiniteNumber(ticker.open24h, "Invalid OKX ticker payload"),
    high24h: parseFiniteNumber(ticker.high24h, "Invalid OKX ticker payload"),
    low24h: parseFiniteNumber(ticker.low24h, "Invalid OKX ticker payload"),
    volume24h: parseFiniteNumber(ticker.vol24h, "Invalid OKX ticker payload"),
    timestamp: parseFiniteNumber(ticker.ts, "Invalid OKX ticker payload"),
  };
}

export function normalizeOkxTicker(payload: unknown, instrument: MarketInstrument = "BTC-USDT"): MarketTicker {
  const [rawTicker] = getSuccessfulData(payload, "Invalid OKX ticker payload");
  return normalizeTickerRow(rawTicker, instrument);
}

export function normalizeOkxTickers(payload: unknown, instruments: MarketInstrument[]): MarketTicker[] {
  const rows = getSuccessfulData(payload, "Invalid OKX ticker payload");
  const byInstrument = new Map(rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const instrument = (row as Record<string, unknown>).instId;
    return typeof instrument === "string" ? [[instrument, row] as const] : [];
  }));

  return instruments.flatMap((instrument) => {
    const row = byInstrument.get(instrument);
    return row ? [normalizeTickerRow(row, instrument)] : [];
  });
}

export function normalizeOkxCandles(payload: unknown): MarketCandle[] {
  const rows = getSuccessfulData(payload, "Invalid OKX candle payload");

  return rows.map((row): MarketCandle => {
    if (!Array.isArray(row) || row.length < 9) {
      throw new Error("Invalid OKX candle payload");
    }

    const timestampMs = parseFiniteNumber(row[0], "Invalid OKX candle payload");
    const confirmed = row[8];
    if (confirmed !== "0" && confirmed !== "1") {
      throw new Error("Invalid OKX candle payload");
    }

    return {
      time: Math.floor(timestampMs / 1000),
      open: parseFiniteNumber(row[1], "Invalid OKX candle payload"),
      high: parseFiniteNumber(row[2], "Invalid OKX candle payload"),
      low: parseFiniteNumber(row[3], "Invalid OKX candle payload"),
      close: parseFiniteNumber(row[4], "Invalid OKX candle payload"),
      volume: parseFiniteNumber(row[5], "Invalid OKX candle payload"),
      confirmed: confirmed === "1",
    };
  }).sort((left, right) => left.time - right.time);
}

export class OkxMarketAdapter {
  constructor(
    private readonly fetcher: Fetcher = fetch,
    private readonly requestTimeoutMs = 8000,
    private readonly baseUrl = process.env.OKX_API_BASE_URL ?? DEFAULT_OKX_BASE_URL,
  ) {}

  async getTicker(): Promise<MarketTicker> {
    return this.getTickerForInstrument("BTC-USDT");
  }

  async getTickerForInstrument(instrument: MarketInstrument): Promise<MarketTicker> {
    const url = new URL("/api/v5/market/ticker", this.baseUrl);
    url.searchParams.set("instId", instrument);
    const payload = await this.request(url);
    return normalizeOkxTicker(payload, instrument);
  }

  async getTickers(instruments: MarketInstrument[]): Promise<MarketTicker[]> {
    const url = new URL("/api/v5/market/tickers", this.baseUrl);
    url.searchParams.set("instType", "SPOT");
    return normalizeOkxTickers(await this.request(url), instruments);
  }

  async getCandles(period: ChartPeriod, limit = 120): Promise<MarketCandle[]> {
    return this.getCandlesForInstrument("BTC-USDT", period, limit);
  }

  async getCandlesForInstrument(
    instrument: MarketInstrument,
    period: ChartPeriod,
    limit = 120,
  ): Promise<MarketCandle[]> {
    const url = new URL("/api/v5/market/candles", this.baseUrl);
    url.searchParams.set("instId", instrument);
    url.searchParams.set("bar", toOkxBar(period));
    url.searchParams.set("limit", String(limit));
    const payload = await this.request(url);
    return normalizeOkxCandles(payload);
  }

  async getOrderBookForInstrument(instrument: MarketInstrument, depth = 5): Promise<OrderBookSnapshot> {
    const url = new URL("/api/v5/market/books", this.baseUrl);
    url.searchParams.set("instId", instrument);
    url.searchParams.set("sz", String(depth));
    const response = await this.fetcher(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    });
    if (!response.ok) throw new Error(`OKX request failed with ${response.status}`);
    return normalizeOkxOrderBook(await response.json(), instrument, depth);
  }

  private async request(url: URL): Promise<unknown> {
    const response = await this.fetcher(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 10 },
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    });
    if (!response.ok) throw new Error(`OKX request failed with ${response.status}`);
    return response.json();
  }
}

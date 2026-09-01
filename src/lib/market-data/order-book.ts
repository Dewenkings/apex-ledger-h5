import type { MarketInstrument, OrderBookLevel, OrderBookSnapshot } from "./types";

type OkxOrderBookEnvelope = {
  code?: unknown;
  data?: unknown;
  arg?: unknown;
};

function parseFiniteNumber(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error("Invalid OKX order book payload");
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Invalid OKX order book payload");
  return parsed;
}

function normalizeSide(rawSide: unknown, direction: "asks" | "bids", depth: number): OrderBookLevel[] {
  if (!Array.isArray(rawSide)) throw new Error("Invalid OKX order book payload");

  const levels = rawSide.map((row) => {
    if (!Array.isArray(row) || row.length < 4) throw new Error("Invalid OKX order book payload");
    const price = parseFiniteNumber(row[0]);
    const size = parseFiniteNumber(row[1]);
    const orderCount = parseFiniteNumber(row[3]);
    if (price <= 0 || size < 0 || orderCount < 0 || !Number.isInteger(orderCount)) {
      throw new Error("Invalid OKX order book payload");
    }
    return { price, size, orderCount };
  }).sort((left, right) => direction === "asks" ? left.price - right.price : right.price - left.price)
    .slice(0, depth);

  let totalQuote = 0;
  return levels.map((level) => {
    totalQuote += level.price * level.size;
    return { ...level, totalQuote };
  });
}

export function normalizeOkxOrderBook(
  payload: unknown,
  instrument: MarketInstrument = "BTC-USDT",
  depth = 5,
): OrderBookSnapshot {
  if (!Number.isInteger(depth) || depth < 1 || depth > 400) throw new Error("Invalid OKX order book depth");
  if (!payload || typeof payload !== "object") throw new Error("Invalid OKX order book payload");
  const envelope = payload as OkxOrderBookEnvelope;
  if (envelope.code !== undefined && envelope.code !== "0") throw new Error("Invalid OKX order book payload");
  if (envelope.arg && typeof envelope.arg === "object") {
    const arg = envelope.arg as Record<string, unknown>;
    if (arg.instId !== instrument || (arg.channel !== undefined && arg.channel !== "books5")) {
      throw new Error("Invalid OKX order book payload");
    }
  }
  if (!Array.isArray(envelope.data) || envelope.data.length === 0) {
    throw new Error("Invalid OKX order book payload");
  }
  const rawSnapshot = envelope.data[0];
  if (!rawSnapshot || typeof rawSnapshot !== "object") throw new Error("Invalid OKX order book payload");
  const snapshot = rawSnapshot as Record<string, unknown>;
  const timestamp = parseFiniteNumber(snapshot.ts);
  const sequenceId = snapshot.seqId === undefined ? undefined : parseFiniteNumber(snapshot.seqId);
  if (timestamp <= 0 || (sequenceId !== undefined && !Number.isInteger(sequenceId))) {
    throw new Error("Invalid OKX order book payload");
  }

  return {
    instrument,
    asks: normalizeSide(snapshot.asks, "asks", depth),
    bids: normalizeSide(snapshot.bids, "bids", depth),
    timestamp,
    ...(sequenceId === undefined ? {} : { sequenceId }),
  };
}

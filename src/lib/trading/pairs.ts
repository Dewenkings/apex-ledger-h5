import type { MarketSymbol } from "@/lib/market-data/types";

export const tradingPairs = [
  {
    instrument: "BTC-USDT",
    pairSlug: "btc-usdt",
    baseSymbol: "BTC",
    quoteSymbol: "USDT",
    priceDecimals: 2,
    amountDecimals: 8,
    demoAmount: "0.001",
    maxDemoNotionalUsdt: "250",
  },
  {
    instrument: "ETH-USDT",
    pairSlug: "eth-usdt",
    baseSymbol: "ETH",
    quoteSymbol: "USDT",
    priceDecimals: 2,
    amountDecimals: 8,
    demoAmount: "0.02",
    maxDemoNotionalUsdt: "250",
  },
  {
    instrument: "SOL-USDT",
    pairSlug: "sol-usdt",
    baseSymbol: "SOL",
    quoteSymbol: "USDT",
    priceDecimals: 2,
    amountDecimals: 6,
    demoAmount: "0.25",
    maxDemoNotionalUsdt: "250",
  },
] as const;

export type TradingPairConfig = (typeof tradingPairs)[number];
export type TradableInstrument = TradingPairConfig["instrument"];
export type TradableSymbol = TradingPairConfig["baseSymbol"];
export type TradingPairSlug = TradingPairConfig["pairSlug"];

export function parseTradableInstrument(value: string | null): TradableInstrument | null {
  return tradingPairs.find(({ instrument }) => instrument === value)?.instrument ?? null;
}

export function getPairBySlug(value: string): TradingPairConfig | null {
  return tradingPairs.find(({ pairSlug }) => pairSlug === value) ?? null;
}

export function getPairBySymbol(value: MarketSymbol): TradingPairConfig | null {
  return tradingPairs.find(({ baseSymbol }) => baseSymbol === value) ?? null;
}

export function getPairByInstrument(value: string): TradingPairConfig | null {
  return tradingPairs.find(({ instrument }) => instrument === value) ?? null;
}

export function formatPairAmount(pair: TradingPairConfig, value: string): string {
  const [whole = "0", fraction = ""] = value.trim().split(".");
  const trimmedFraction = fraction.slice(0, pair.amountDecimals).replace(/0+$/, "");
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

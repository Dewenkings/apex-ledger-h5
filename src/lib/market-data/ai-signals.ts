import type { ChartPeriod, MarketInstrument } from "./types";

export type AISignalBias = "bullish" | "bearish" | "neutral";

export type AISignal = {
  id: string;
  instrument: MarketInstrument;
  timeframe: ChartPeriod;
  marketBias: AISignalBias;
  dataQuality: "high" | "medium" | "low";
  price: number;
  timestamp: number;
  explanation: string;
  modelVersion: string;
};

export const AI_SIGNALS_ENABLED = false;

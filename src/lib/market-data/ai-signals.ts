import type { ChartPeriod, MarketInstrument } from "./types";

export type AISignalSide = "buy" | "sell" | "neutral";

export type AISignal = {
  id: string;
  instrument: MarketInstrument;
  timeframe: ChartPeriod;
  side: AISignalSide;
  confidence: number;
  price: number;
  timestamp: number;
  explanation: string;
  modelVersion: string;
};

export const AI_SIGNALS_ENABLED = false;

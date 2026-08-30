import { parseTradableInstrument, tradingPairs, type TradableInstrument } from "@/lib/trading/pairs";

export type DemoOrderInput = {
  instrument: TradableInstrument;
  side: "buy" | "sell";
  type: "limit" | "market";
  amount: string;
  price?: string;
  referencePrice?: string;
};

export type DemoOrderValidation =
  | { success: true; data: DemoOrderInput }
  | { success: false; error: string };

export function validateDemoOrderInput(input: unknown): DemoOrderValidation {
  if (!input || typeof input !== "object") return invalid("Invalid order payload");
  const raw = input as Record<string, unknown>;
  const instrument = parseTradableInstrument(typeof raw.instrument === "string" ? raw.instrument : null);
  if (!instrument) return invalid("Unsupported trading instrument");
  if (raw.side !== "buy" && raw.side !== "sell") return invalid("Unsupported order side");
  if (raw.type !== "limit" && raw.type !== "market") return invalid("Unsupported order type");
  if (typeof raw.amount !== "string") return invalid("Invalid amount");

  const pair = tradingPairs.find((candidate) => candidate.instrument === instrument);
  if (!pair) return invalid("Unsupported trading instrument");
  const amount = parsePositiveDecimal(raw.amount, pair.amountDecimals, "amount");
  if (!amount.success) return amount;

  if (raw.type === "limit") {
    if (typeof raw.price !== "string") return invalid("Limit price is required");
    const price = parsePositiveDecimal(raw.price, pair.priceDecimals, "price");
    if (!price.success) return price;
    if (exceedsNotional(amount.units, pair.amountDecimals, price.units, pair.priceDecimals, pair.maxDemoNotionalUsdt)) {
      return invalid(`Demo notional exceeds ${pair.maxDemoNotionalUsdt} USDT`);
    }
    return {
      success: true,
      data: { instrument, side: raw.side, type: "limit", amount: raw.amount, price: raw.price },
    };
  }

  if (raw.price !== undefined) return invalid("Market order cannot include a limit price");
  if (typeof raw.referencePrice !== "string") return invalid("Reference price is required");
  const referencePrice = parsePositiveDecimal(raw.referencePrice, pair.priceDecimals, "reference price");
  if (!referencePrice.success) return referencePrice;
  if (exceedsNotional(amount.units, pair.amountDecimals, referencePrice.units, pair.priceDecimals, pair.maxDemoNotionalUsdt)) {
    return invalid(`Demo notional exceeds ${pair.maxDemoNotionalUsdt} USDT`);
  }
  return {
    success: true,
    data: {
      instrument,
      side: raw.side,
      type: "market",
      amount: raw.amount,
      referencePrice: raw.referencePrice,
    },
  };
}

function parsePositiveDecimal(
  value: string,
  decimals: number,
  field: string,
): { success: true; units: bigint } | { success: false; error: string } {
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(value);
  if (!match) return invalid(`Invalid ${field}`);
  const fraction = match[2] ?? "";
  if (fraction.length > decimals) return invalid(`Invalid ${field} precision`);
  const units = BigInt(match[1]) * BigInt(10) ** BigInt(decimals)
    + BigInt(fraction.padEnd(decimals, "0") || "0");
  if (units <= BigInt(0)) return invalid(`${capitalize(field)} must be positive`);
  return { success: true, units };
}

function exceedsNotional(
  amountUnits: bigint,
  amountDecimals: number,
  priceUnits: bigint,
  priceDecimals: number,
  maxNotional: string,
): boolean {
  const maxUnits = BigInt(maxNotional) * BigInt(10) ** BigInt(amountDecimals + priceDecimals);
  return amountUnits * priceUnits > maxUnits;
}

function invalid(error: string): { success: false; error: string } {
  return { success: false, error };
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

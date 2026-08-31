import type { TradableInstrument } from "@/lib/trading/pairs";
import type { OwnerId } from "@/server/identity/owner";

export type DemoOrderStatus =
  | "live"
  | "partially_filled"
  | "filled"
  | "canceled"
  | "rejected";

export type DemoOrder = {
  instrument: TradableInstrument;
  ordId: string;
  clOrdId: string;
  side: "buy" | "sell";
  orderType: "limit" | "market";
  price: string;
  size: string;
  filledSize: string;
  averagePrice: string;
  status: DemoOrderStatus;
  createdAt: number;
  updatedAt: number;
};

export type DemoOrderSyncState = "pending" | "synced" | "stale";

export type DemoOrderSnapshot = DemoOrder & {
  visitorId: string;
  ownerId?: OwnerId;
  syncState: DemoOrderSyncState;
  lastSyncedAt: number | null;
};

export type DemoFill = {
  instrument: TradableInstrument;
  ordId: string;
  clOrdId: string;
  tradeId: string;
  side: "buy" | "sell";
  fillPrice: string;
  fillSize: string;
  fee: string;
  feeCurrency: string;
  timestamp: number;
};

export type DemoBalance = {
  totalEquity: string;
  updatedAt: number;
  assets: Array<{
    currency: string;
    available: string;
    balance: string;
    frozen: string;
    equity: string;
  }>;
  scope: "shared-okx-demo";
  virtual: true;
};

export type PlaceDemoOrderInput = {
  instId: TradableInstrument;
  tdMode: "cash";
  side: "buy" | "sell";
  ordType: "limit" | "market";
  sz: string;
  px?: string;
  clOrdId: string;
};

export type DemoOrderReceipt = { ordId: string; clOrdId: string; accepted: true };
export type DemoCancelReceipt = { ordId: string; clOrdId: string; canceled: true };

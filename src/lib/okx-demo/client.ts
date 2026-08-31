import type { OkxDemoConfig } from "./config";
import type {
  DemoBalance,
  DemoCancelReceipt,
  DemoFill,
  DemoOrder,
  DemoOrderReceipt,
  PlaceDemoOrderInput,
} from "./contracts";
import { signOkxRequest } from "./signing";
import { parseTradableInstrument, type TradableInstrument } from "@/lib/trading/pairs";

type Fetcher = typeof fetch;
type RequestMethod = "GET" | "POST";
type OkxDemoErrorCategory = "business_rejection" | "upstream_timeout" | "upstream_failure" | "malformed_response";

type OkxEnvelope = { code?: unknown; msg?: unknown; data?: unknown };

export class OkxDemoError extends Error {
  readonly name = "OkxDemoError";

  constructor(
    readonly category: OkxDemoErrorCategory,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

type ClientOptions = {
  fetcher?: Fetcher;
  now?: () => Date;
  timeoutMs?: number;
};

export class OkxDemoClient {
  private readonly fetcher: Fetcher;
  private readonly now: () => Date;
  private readonly timeoutMs: number;

  constructor(private readonly config: OkxDemoConfig, options: ClientOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.timeoutMs = options.timeoutMs ?? 8000;
  }

  async placeOrder(input: PlaceDemoOrderInput): Promise<DemoOrderReceipt> {
    const [row] = await this.request("POST", "/api/v5/trade/order", undefined, input);
    const submissionCode = optionalString(row, "sCode");
    if (submissionCode && submissionCode !== "0") {
      throw new OkxDemoError("business_rejection", optionalString(row, "sMsg") || "OKX Demo rejected the order", submissionCode);
    }
    return {
      ordId: requiredString(row, "ordId"),
      clOrdId: requiredString(row, "clOrdId"),
      accepted: true,
    };
  }

  async getOrder(input: { instrument: TradableInstrument; ordId?: string; clOrdId?: string }): Promise<DemoOrder> {
    const [row] = await this.request("GET", "/api/v5/trade/order", compactQuery({
      instId: input.instrument,
      ordId: input.ordId,
      clOrdId: input.clOrdId,
    }));
    return normalizeOrder(row);
  }

  async listPendingOrders(instrument?: TradableInstrument): Promise<DemoOrder[]> {
    const rows = await this.request("GET", "/api/v5/trade/orders-pending", compactQuery({
      instType: "SPOT",
      instId: instrument,
    }));
    return rows.map(normalizeOrder);
  }

  async listOrderHistory(instrument?: TradableInstrument): Promise<DemoOrder[]> {
    const rows = await this.request("GET", "/api/v5/trade/orders-history", compactQuery({
      instType: "SPOT",
      instId: instrument,
    }));
    return rows.map(normalizeOrder);
  }

  async listFills(input: { instrument?: TradableInstrument; ordId?: string } = {}): Promise<DemoFill[]> {
    const rows = await this.request("GET", "/api/v5/trade/fills", compactQuery({
      instType: "SPOT",
      instId: input.instrument,
      ordId: input.ordId,
    }));
    return rows.map(normalizeFill);
  }

  async cancelOrder(input: { instrument: TradableInstrument; ordId: string }): Promise<DemoCancelReceipt> {
    const [row] = await this.request("POST", "/api/v5/trade/cancel-order", undefined, {
      instId: input.instrument,
      ordId: input.ordId,
    });
    const submissionCode = optionalString(row, "sCode");
    if (submissionCode && submissionCode !== "0") {
      throw new OkxDemoError("business_rejection", optionalString(row, "sMsg") || "OKX Demo rejected cancellation", submissionCode);
    }
    return {
      ordId: requiredString(row, "ordId"),
      clOrdId: requiredString(row, "clOrdId"),
      canceled: true,
    };
  }

  async getBalance(): Promise<DemoBalance> {
    const [account] = await this.request("GET", "/api/v5/account/balance");
    const details = requiredRows(account, "details");
    return {
      totalEquity: requiredString(account, "totalEq"),
      updatedAt: requiredTimestamp(account, "uTime"),
      assets: details.map((row) => ({
        currency: requiredString(row, "ccy"),
        available: requiredString(row, "availBal"),
        balance: requiredString(row, "cashBal"),
        frozen: requiredString(row, "frozenBal"),
        equity: requiredString(row, "eq"),
      })),
      scope: "shared-okx-demo",
      virtual: true,
    };
  }

  private async request(
    method: RequestMethod,
    path: string,
    query?: URLSearchParams,
    bodyValue?: object,
  ): Promise<Record<string, unknown>[]> {
    const queryString = query?.toString();
    const requestPath = queryString ? `${path}?${queryString}` : path;
    const body = bodyValue ? JSON.stringify(bodyValue) : "";
    const timestamp = this.now().toISOString();
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "OK-ACCESS-KEY": this.config.apiKey,
      "OK-ACCESS-SIGN": signOkxRequest(this.config.secretKey, timestamp, method, requestPath, body),
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": this.config.passphrase,
      "x-simulated-trading": "1",
    };

    try {
      const response = await this.fetcher(new URL(requestPath, this.config.baseUrl), {
        method,
        headers,
        body: body || undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) {
        throw new OkxDemoError("upstream_failure", `OKX Demo request failed with HTTP ${response.status}`);
      }
      return normalizeEnvelope(await response.json());
    } catch (error) {
      if (error instanceof OkxDemoError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new OkxDemoError("upstream_timeout", "OKX Demo request timed out");
      }
      throw new OkxDemoError("upstream_failure", "OKX Demo request failed");
    }
  }
}

function normalizeEnvelope(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") {
    throw new OkxDemoError("malformed_response", "Invalid OKX Demo response");
  }
  const envelope = payload as OkxEnvelope;
  if (typeof envelope.code !== "string") {
    throw new OkxDemoError("malformed_response", "Invalid OKX Demo response");
  }
  if (envelope.code !== "0") {
    throw new OkxDemoError(
      "business_rejection",
      typeof envelope.msg === "string" && envelope.msg ? envelope.msg : "OKX Demo rejected the request",
      envelope.code,
    );
  }
  if (!Array.isArray(envelope.data) || envelope.data.some((row) => !row || typeof row !== "object")) {
    throw new OkxDemoError("malformed_response", "Invalid OKX Demo response");
  }
  return envelope.data as Record<string, unknown>[];
}

function normalizeOrder(row: Record<string, unknown>): DemoOrder {
  const instrument = parseTradableInstrument(requiredString(row, "instId"));
  if (!instrument) throw new OkxDemoError("malformed_response", "Unsupported order instrument from OKX Demo");
  const side = requiredEnum(row, "side", ["buy", "sell"] as const);
  const orderType = requiredEnum(row, "ordType", ["limit", "market"] as const);
  const status = requiredEnum(row, "state", ["live", "partially_filled", "filled", "canceled", "rejected"] as const);
  return {
    instrument,
    ordId: requiredString(row, "ordId"),
    clOrdId: requiredString(row, "clOrdId"),
    side,
    orderType,
    price: optionalString(row, "px"),
    size: requiredString(row, "sz"),
    filledSize: optionalString(row, "accFillSz") || "0",
    averagePrice: optionalString(row, "avgPx"),
    status,
    createdAt: requiredTimestamp(row, "cTime"),
    updatedAt: requiredTimestamp(row, "uTime"),
  };
}

function normalizeFill(row: Record<string, unknown>): DemoFill {
  const instrument = parseTradableInstrument(requiredString(row, "instId"));
  if (!instrument) throw new OkxDemoError("malformed_response", "Unsupported fill instrument from OKX Demo");
  return {
    instrument,
    ordId: requiredString(row, "ordId"),
    clOrdId: requiredString(row, "clOrdId"),
    tradeId: requiredString(row, "tradeId"),
    side: requiredEnum(row, "side", ["buy", "sell"] as const),
    fillPrice: requiredString(row, "fillPx"),
    fillSize: requiredString(row, "fillSz"),
    fee: requiredString(row, "fee"),
    feeCurrency: requiredString(row, "feeCcy"),
    timestamp: requiredTimestamp(row, "ts"),
  };
}

function compactQuery(input: Record<string, string | undefined>): URLSearchParams {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value) query.set(key, value);
  }
  return query;
}

function optionalString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function requiredString(row: Record<string, unknown>, key: string): string {
  const value = optionalString(row, key);
  if (!value) throw new OkxDemoError("malformed_response", `Invalid OKX Demo ${key}`);
  return value;
}

function requiredTimestamp(row: Record<string, unknown>, key: string): number {
  const value = Number(requiredString(row, key));
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new OkxDemoError("malformed_response", `Invalid OKX Demo ${key}`);
  }
  return value;
}

function requiredRows(row: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = row[key];
  if (!Array.isArray(value) || value.some((item) => !item || typeof item !== "object")) {
    throw new OkxDemoError("malformed_response", `Invalid OKX Demo ${key}`);
  }
  return value as Record<string, unknown>[];
}

function requiredEnum<const T extends readonly string[]>(
  row: Record<string, unknown>,
  key: string,
  choices: T,
): T[number] {
  const value = requiredString(row, key);
  if (!choices.includes(value)) {
    throw new OkxDemoError("malformed_response", `Invalid OKX Demo ${key}`);
  }
  return value as T[number];
}

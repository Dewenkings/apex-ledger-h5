# Multi-Market OKX Demo Trading Design

## Goal

Turn the BTC-only local paper flow into one validated trading flow for `BTC-USDT`, `ETH-USDT`, and `SOL-USDT`. Market data remains public and live; order writes go to OKX's official Demo Trading environment and return OKX order, fill, balance, and cancellation state. No production trading key, wallet transaction, deposit, withdrawal, or real asset transfer is allowed.

## Product Scope

- Make BTC, ETH, and SOL market rows navigate to dynamic trading pages.
- Support live quote, candlestick periods, buy/sell, market/limit order preview, OKX Demo submission, status, fills, history, balance, and cancellation.
- Keep BNB, ADA, AVAX, DOT, and POL as read-only market rows.
- Use OKX as the primary public market provider and Kraken as public market-data fallback.
- Use only OKX Demo Trading for order writes. Do not fall back to a local successful order when OKX rejects or times out.
- Label all write-side screens `OKX DEMO`; never call them live trading or real-money trading.
- Exclude authenticated OKX production APIs, Broker OAuth, user API-key collection, wallet swaps, deposits, withdrawals, WebSockets, MCP, and real payments.

## Why Official Demo Instead of Local Mock

OKX Demo Trading uses the same authenticated order API shape as production and returns platform order IDs and lifecycle state. Requests use a Demo Trading API key plus `x-simulated-trading: 1`; balances and fills are virtual. This proves third-party authentication, request signing, order submission, reconciliation, and error handling without exposing real funds.

It is still a simulation and must be described honestly. It is not a multi-tenant exchange sandbox: one Demo API key maps to one shared demo account. Public writes therefore require an application access boundary.

## Chosen Architecture

```text
/markets
  -> /trade/btc-usdt
  -> /trade/eth-usdt
  -> /trade/sol-usdt
       -> GET public ticker/candles
            -> OKX public market API
            -> Kraken public fallback
       -> POST /api/demo/orders
            -> access-session check
            -> durable Redis rate-limit / idempotency check
            -> schema / pair / precision / notional validation
            -> idempotency + session-owned clOrdId
            -> server-side OKX HMAC signature
            -> OKX Demo POST /api/v5/trade/order
       -> GET /api/demo/orders and /fills
            -> OKX Demo private APIs
            -> filter to the active application session
       -> POST /api/demo/orders/[id]/cancel
            -> verify session-owned clOrdId before cancellation
            -> OKX Demo cancel endpoint
       -> GET /api/demo/balance
            -> controlled shared-demo balance view
```

Public visitors can always read market data. Demo order writes require a signed, HTTP-only application session established through a server-side access code. The access code is intended for the owner and approved interview testers; it is not committed or exposed in the browser bundle.

## Trading Instrument Contract

```ts
const tradableInstruments = ["BTC-USDT", "ETH-USDT", "SOL-USDT"] as const;

type TradableInstrument = (typeof tradableInstruments)[number];

type TradingPairConfig = {
  instrument: TradableInstrument;
  pairSlug: "btc-usdt" | "eth-usdt" | "sol-usdt";
  baseSymbol: "BTC" | "ETH" | "SOL";
  quoteSymbol: "USDT";
  priceDecimals: number;
  amountDecimals: number;
  maxDemoNotionalUsdt: number;
};
```

Page params and API input pass through this allowlist. Unsupported pairs return a Next.js 404 or API 400. Order size and price are normalized with OKX public instrument rules before signing; browser-provided precision is never trusted.

## Server-Only OKX Demo Adapter

The adapter owns:

- UTC timestamp generation;
- HMAC-SHA256/Base64 signing;
- `OK-ACCESS-KEY`, `OK-ACCESS-SIGN`, `OK-ACCESS-TIMESTAMP`, and `OK-ACCESS-PASSPHRASE` headers;
- the mandatory `x-simulated-trading: 1` header on every private request;
- bounded timeouts and normalized OKX error envelopes;
- place, get, list pending/history, fills, cancel, and balance methods.

The adapter has no production-mode flag. Production credentials and withdrawal endpoints do not exist in this code path. All secrets use server-only environment variables:

```dotenv
TRADING_PROFILE=okx_demo
OKX_DEMO_API_KEY=
OKX_DEMO_SECRET_KEY=
OKX_DEMO_PASSPHRASE=
DEMO_ACCESS_CODE=
SESSION_SECRET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Startup validation rejects missing secrets when demo writes are enabled. Logs redact all credential headers, session tokens, and complete OKX payloads that may contain account information.

## Session Ownership and Abuse Controls

- Access-code exchange creates a signed, HTTP-only, `Secure`, `SameSite=Lax` cookie; the raw code is never stored client-side.
- Each session receives a random ID. `clOrdId` includes a non-reversible, bounded session prefix and a unique suffix.
- Place/cancel endpoints require the session and CSRF-safe same-origin requests.
- Order list and fills are filtered by session-owned client order IDs.
- Cancellation first retrieves/verifies ownership; knowing another OKX `ordId` is insufficient.
- Allow only BTC/ETH/SOL spot cash orders, bounded amounts, bounded price deviation, and a low maximum demo notional.
- Apply per-session and per-IP rate limits and a maximum number of open demo orders.
- Store rate-limit counters, idempotency records, and short-lived order ownership records in Upstash Redis so Vercel serverless instances share the same safety state.
- The OKX balance is a shared demo-account balance and must be labelled as shared, not as the visitor's personal assets.
- If credentials are absent, the deployed site remains read-only and presents a controlled sign-in/availability message rather than simulating success.

## Public Market-Data Flow

```http
GET /api/market/ticker?instrument=SOL-USDT
GET /api/market/candles?instrument=ETH-USDT&period=1D
```

The existing adapters become instrument-aware end to end. OKX is attempted first and Kraken is the public fallback. Instrument-specific deterministic fixtures remain allowed only for clearly labelled chart/quote degradation. They never create, fill, cancel, or mutate a demo order.

## Order Lifecycle

The application normalizes OKX state into:

```ts
type DemoOrderStatus =
  | "submitting"
  | "live"
  | "partially_filled"
  | "filled"
  | "canceling"
  | "canceled"
  | "rejected";
```

Submission uses an idempotent `clOrdId`. A timeout after sending is ambiguous, so the server queries by `clOrdId` before allowing a retry. UI success is shown only after OKX returns acceptance or reconciliation finds the order. Business rejection, insufficient demo funds, invalid precision, or upstream timeout remains a visible failure.

History and fills come from OKX Demo endpoints, not hardcoded arrays. The UI polls conservatively for active orders; WebSocket private channels are deferred.

## Dynamic UI Behaviour

- Header, pair, buttons, amount/volume units, chart accessible name, preview, confirmation, and result copy use the active instrument.
- Market rows link only for BTC, ETH, and SOL.
- The bottom Trade navigation continues to open BTC as the default.
- Before write access, the page explains that an approved Demo session is required.
- Confirmation shows `OKX DEMO`, the shared-demo nature of funds, order type, size, limit/reference price, estimated notional, and zero real deduction.
- Result screens show OKX `ordId`/`clOrdId`, normalized state, and retry/reconciliation guidance.
- The Orders page replaces hardcoded rows with session-filtered OKX Demo orders and fills. The Assets page labels and displays the shared OKX Demo account balance rather than claiming it is session-owned.

## Failure Rules

- Invalid page pair: Next.js not-found.
- Invalid API pair, side, type, amount, price, or period: HTTP 400.
- Missing/invalid application session: HTTP 401/403.
- Demo write disabled or credentials missing: HTTP 503 with a safe availability message.
- OKX business rejection: preserve its safe code/category without leaking credentials.
- Ambiguous timeout: reconcile by `clOrdId`; never immediately duplicate an order.
- OKX Demo unavailable: keep public market data available and disable writes; never report a local fake order as accepted.

## Testing

- Contract tests for pair parsing, pair config, amount/price precision, notional caps, and invalid input.
- Signing tests using fixed timestamp/secret vectors; assert the mandatory simulated-trading header and absence of credential logs.
- Adapter tests for place, reconcile, pending/history, fills, balance, cancel, OKX rejection, malformed responses, and timeout.
- Session tests for cookie security, invalid access code, order ownership, cross-session cancellation denial, and expiry.
- API tests for authentication, allowlists, rate limits, idempotency, shared-balance labels, and read-only degradation.
- Market hook/component tests for BTC/ETH/SOL URLs, dynamic units, quote/candle fallback, and unsupported routes.
- Browser QA at 390 px for access, place, status, fills/history, cancel, logout/read-only, K-line period changes, and no horizontal overflow.
- Final verification: full Vitest suite, TypeScript, ESLint, production build, secret scan, GitHub push, and Vercel production deployment.

## External Prerequisites

The project owner must create an OKX Demo Trading API key with only the required Read and Trade permissions from an eligible OKX account. An Upstash Redis database is required for durable rate limits, idempotency, and short-lived ownership records across Vercel serverless instances. Secrets are entered directly into local `.env.local` and Vercel encrypted environment variables, never sent in chat or committed. Demo asset reset and account mode selection remain owner operations in OKX.

## Success Criteria

1. BTC, ETH, and SOL pages request matching public ticker/candle instruments.
2. Authorized demo orders are accepted by OKX Demo and display real OKX identifiers and state.
3. Orders, fills, balance, and cancellation are read from OKX Demo rather than hardcoded fixtures.
4. Unauthorized or cross-session writes are rejected.
5. Credentials remain server-only and the adapter cannot switch to production trading.
6. Missing credentials or OKX failure degrades to read-only, never fake write success.
7. No request can withdraw, deposit, transfer real assets, sign a wallet transaction, or place a production order.

# Multi-Market Paper Trading Design

## Goal

Turn the BTC-only trading flow into one validated, reusable trading flow for `BTC-USDT`, `ETH-USDT`, and `SOL-USDT`. Prices and candles come from public exchange market-data APIs; every order remains a local PAPER LIVE simulation and can never trigger an exchange order, wallet signature, or real asset transfer.

## Product Scope

- Make BTC, ETH, and SOL rows on the market overview navigate to their own trading pages.
- Support the same quote, candlestick periods, buy/sell form, preview, confirmation, and success flow for all three instruments.
- Keep BNB, ADA, AVAX, DOT, and POL as readable market-data rows without navigation until their trading flows are intentionally enabled.
- Preserve OKX as the primary public provider, Kraken as the secondary provider, and an explicitly labelled deterministic demo fallback.
- Preserve the existing mobile layout and `PAPER LIVE` safety copy.
- Exclude authenticated OKX APIs, exchange account binding, real order placement, wallet transaction signatures, deposits, withdrawals, WebSockets, and MCP.

## Chosen Architecture

Use one dynamic Next.js route and one instrument-aware component tree:

```text
/markets
  -> /trade/btc-usdt
  -> /trade/eth-usdt
  -> /trade/sol-usdt
       -> /trade/[pair]
            -> TradeScreen(instrument)
                 -> useTradeMarket(instrument)
                      -> /api/market/ticker?instrument=ETH-USDT
                      -> /api/market/candles?instrument=ETH-USDT&period=4H
                           -> OKX
                           -> Kraken
                           -> explicit client demo fallback
            -> /trade/[pair]/confirm
                 -> PaperOrderPreview(instrument, side, amount)
```

This avoids three copied screens while keeping the allowed trading universe deliberately smaller than the eight-asset market catalogue.

### Alternatives Not Chosen

1. Duplicate one page per asset. This is quick for ETH and SOL but duplicates fetching, validation, labels, confirmation logic, and tests.
2. Enable all eight assets immediately. The data adapters can support most of them, but it expands precision rules, fallback fixtures, and product QA without adding much interview value beyond the first three instruments.
3. Connect authenticated OKX order APIs. This violates the current portfolio safety boundary and introduces secrets, permissions, exchange-region constraints, and real financial risk.

## Trading Instrument Contract

Define a separate allowlist for tradable instruments rather than treating every market-overview symbol as tradable:

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
  demoAmount: number;
};
```

All route parameters and API query parameters must pass through this contract. Unknown values such as `doge-usdt`, lowercase API instruments, or malformed periods receive a 400 response at the API boundary or a Next.js 404 at the page boundary.

## Market-Data Flow

The existing provider adapters already expose instrument-aware ticker and candle methods. The provider service and two single-market API routes will accept a validated `TradableInstrument` instead of defaulting internally to BTC.

```http
GET /api/market/ticker?instrument=SOL-USDT
GET /api/market/candles?instrument=ETH-USDT&period=1D
```

Response envelopes and cache boundaries remain unchanged. OKX is attempted first; Kraken fills provider failures only when it supports the pair. A client fallback is instrument-specific and always reports `DEMO DATA`.

Changing the selected K-line period aborts the previous candle request. Changing route instruments creates a fresh hook instance and prevents BTC data from briefly appearing on ETH or SOL pages.

## UI Behaviour

- The header, quote pair, buy/sell labels, amount unit, volume unit, chart accessible name, and confirmation copy use the active base symbol.
- Price formatting comes from pair configuration: BTC and ETH use two decimals; SOL uses an appropriate two-decimal display while the contract remains extensible.
- Amount formatting and default demo quantities are pair-specific.
- The bottom navigation's generic Trade entry may continue to open BTC as the default trading market.
- Market overview rows link only when `getTradingPairBySymbol(symbol)` returns a configured pair. No `#` links are introduced.
- Confirmation and success routes retain the selected pair in the URL and provide a correct back link.

## Paper Order Boundary

The order preview is calculated locally with the existing Paper Engine rules. It stores or displays at least:

- instrument;
- side;
- order type;
- base amount;
- reference or limit price;
- estimated quote amount;
- simulated fee;
- `PAPER LIVE` environment.

The confirmation action does not call OKX, Kraken, a wallet provider, or a blockchain RPC. Safety copy remains visible before and after confirmation: no wallet transaction signature, no exchange order, and no real deduction.

The order book remains presentation-only in this iteration. Its levels are deterministically derived around the active reference price and labelled as part of the paper-trading interface; connecting a live depth endpoint is a separate feature.

## Error Handling

- Invalid page pair: render the Next.js not-found boundary.
- Invalid API instrument or chart period: return HTTP 400 with a stable error message.
- Primary-provider failure: attempt the secondary provider.
- Total provider failure: show instrument-specific deterministic fallback data with `DEMO DATA` and retry.
- Empty or malformed ticker/candle payload: treat it as provider failure rather than rendering zeros as live data.
- Route transition or period change: abort stale requests so late responses cannot overwrite the current instrument.

## Testing

- Contract tests for slug parsing, instrument parsing, symbol lookup, and invalid values.
- Provider-service tests proving the requested instrument reaches OKX/Kraken instead of falling back to BTC.
- API route tests for ETH/SOL success, missing/invalid instrument, period validation, caching, and provider failure.
- Hook tests for instrument-specific URLs, route changes, fallback fixtures, retry, and aborted stale requests.
- Component tests proving dynamic header, units, K-line label, order preview URL, and source badges.
- Route tests proving the three supported slugs render and unsupported slugs return not-found.
- Confirmation tests proving ETH/SOL symbols and return URLs remain correct and no wallet/exchange request occurs.
- Browser QA at 390 px: market-to-trade navigation, 1D-to-4H candle switching, buy/sell preview, confirmation, success, back navigation, and no horizontal overflow.
- Final checks: full Vitest suite, TypeScript, ESLint, Next.js production build, Git status, GitHub push, and Vercel production deployment.

## Success Criteria

1. BTC, ETH, and SOL market rows open distinct dynamic trading URLs.
2. Each page requests and labels the matching instrument's ticker and candles.
3. Each order preview and result preserves the matching symbol and pair.
4. Unsupported pairs cannot reach provider adapters through page or API input.
5. All trading actions remain clearly simulated and produce zero real financial effects.
6. Existing market overview, BTC flow, responsive layout, and provider fallback behaviour do not regress.

# Live Market Overview Design

## Goal

Replace the market home page's static prices and decorative sparklines with a source-labelled, multi-asset live market overview. Keep the existing mobile-first Apex Ledger visual language and keep all trading actions in PAPER LIVE mode.

## Scope

- Cover eight USDT spot markets: `BTC`, `ETH`, `SOL`, `BNB`, `ADA`, `AVAX`, `DOT`, and `POL`.
- Replace the legacy `MATIC` display with `POL` in the market catalogue.
- Populate price, 24-hour change, 24-hour high/low, volume, update time, and sparkline data from public market APIs.
- Preserve search, category filters, favourites, mobile navigation, and the existing BTC trade-page link.
- Add loading, partial-data, all-live-failure, and retry states.
- Exclude WebSocket streaming, authenticated exchange APIs, real orders, wallet payments, and MCP.

## Data Sources

OKX remains the primary provider. The server requests `GET /api/v5/market/tickers?instType=SPOT` once, filters the eight configured `*-USDT` instruments, and normalizes numeric string fields. OKX's public Market Data endpoints do not require an API key.

Kraken remains the secondary provider. It fills assets missing from the OKX result using public ticker data and supplies candle history where a supported USDT pair exists. Provider-specific pair names remain inside adapters rather than UI components.

Local deterministic fixtures are the final degraded state only. A fixture row must carry `demo` as its source and must never be presented as live data.

## Application Contract

Add a stable market-overview contract:

```ts
type MarketOverviewItem = {
  instrument: string;
  symbol: MarketSymbol;
  last: number;
  open24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: number;
  spark: number[];
  source: "okx" | "kraken" | "demo";
};

type MarketOverviewResponse = {
  data: MarketOverviewItem[];
  source: "okx" | "kraken" | "mixed";
  updatedAt: number;
};
```

The server never inserts fixtures into a live response. If no provider returns usable ticker data, the route returns an upstream error and the client owns the explicit demo fallback. Partial live results are allowed: the client fills unavailable catalogue assets with individually labelled demo rows, and the page-level label becomes `MIXED DATA`.

## Request Flow

```text
MarketScreen
  -> useMarketOverview
  -> GET /api/market/overview
       -> OKX batch spot tickers
       -> missing rows: Kraken public tickers
       -> recent candles for supported live rows
       -> normalize, sort by catalogue order, cache
  -> render source and freshness honestly
```

Ticker retrieval is the critical path. Candle requests run in parallel with bounded timeouts. A candle failure does not discard a valid live ticker; the row renders without a sparkline instead. The route uses Next.js server caching so page refreshes do not multiply exchange traffic.

## UI Behaviour

- Replace `实时演示数据` with a compact source badge: `OKX LIVE`, `KRAKEN LIVE`, `MIXED LIVE`, or `DEMO DATA`.
- Show a last-updated time beside the source badge.
- Favourite cards use live price/change and recent normalized close values.
- The full market table uses live price/change. A missing sparkline becomes a restrained dash rather than a fabricated curve.
- BTC navigates to `/trade/btc-usdt`. Other assets remain readable rows without fake navigation until their trade pages exist.
- Initial loading uses skeletons. Refresh retains the last good response. Total failure shows deterministic fixtures, `DEMO DATA`, an explanatory warning, and a retry button.

## Error and Freshness Rules

- Reject malformed, non-finite, empty, or non-positive required numeric fields.
- Compute 24-hour percentage change from `last` and `open24h`; do not trust presentation strings from providers.
- A row's source describes the ticker price source. Candle source differences do not change the ticker badge.
- Stale cached data is preferable to replacing an already-live page with fixtures during a transient refresh failure.
- Client requests are aborted on unmount and retry creates a fresh request.

## Testing

- Adapter tests: OKX batch filtering/normalization, Kraken pair mapping, malformed rows, and partial provider responses.
- Service tests: catalogue ordering, missing-row fallback, mixed-source aggregation, and total failure.
- Route tests: stable response envelope, cache boundary, and upstream error status.
- Component tests: live source labels, loading, search/category filtering against live rows, partial sparkline data, demo fallback, and retry.
- Final verification: full Vitest suite, TypeScript, ESLint, production build, and a 390 px browser check.

## Security Boundary

All data sources are unauthenticated public market-data endpoints. No API key, exchange account, wallet signature, order placement, deposit, withdrawal, or MCP runtime is introduced. Live prices do not change the PAPER LIVE nature of the product.

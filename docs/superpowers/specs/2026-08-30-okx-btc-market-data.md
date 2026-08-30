# OKX BTC Market Data Design

## Goal

Replace the static BTC/USDT quote and sparkline on the trade page with public OKX spot-market data and an interactive candlestick chart, while keeping all order execution in the local PAPER LIVE environment.

## Scope

- Instrument: `BTC-USDT` spot only.
- Data: latest ticker and recent candles.
- Period controls: `1H`, `4H`, `1D`, `1W`.
- Chart interaction: candlesticks, crosshair, horizontal pan and zoom.
- States: initial loading, period-switch loading, upstream failure, retry, and clearly labelled fallback demo data.
- Explicitly excluded: MCP, authenticated OKX APIs, API keys, account data, real orders, deposits, withdrawals and wallet payment signatures.

## Architecture

The browser calls same-origin Next.js Route Handlers. The handlers use an `OkxMarketAdapter` to call OKX public REST endpoints, validate and normalize their string-based payloads, and return a stable application contract. The UI never imports an MCP client and never calls OKX directly.

```text
TradeScreen -> /api/market/ticker  -> OkxMarketAdapter -> OKX /api/v5/market/ticker
            -> /api/market/candles -> OkxMarketAdapter -> OKX /api/v5/market/candles
```

`lightweight-charts` renders the normalized candles in a client-only component. Existing local fixture values are retained only as an explicit degraded fallback and are never presented as live OKX data.

## Data contracts

```ts
type ChartPeriod = "1H" | "4H" | "1D" | "1W";

type MarketTicker = {
  instrument: "BTC-USDT";
  last: number;
  open24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: number;
};

type MarketCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  confirmed: boolean;
};
```

Period-to-OKX-bar mapping is `1H -> 1H`, `4H -> 4H`, `1D -> 1Dutc`, and `1W -> 1Wutc`. Each request asks for 120 candles and normalizes the OKX reverse-chronological response into ascending time order.

## UI behavior

- `1D` is the initial period.
- Selecting a period updates `aria-pressed`, requests that period and replaces chart data.
- The existing quote card is populated from the ticker response and shows the source label `OKX · PUBLIC DATA`.
- Initial loading uses an in-card skeleton; changing periods keeps the previous chart visible with a small loading indicator.
- Failed live requests show a retry action and use deterministic fallback candles labelled `演示回退数据`.
- Order estimates may use the current public last price, but the CTA and confirmation continue to state that the order is simulated and cannot debit a wallet.

## Operational and safety constraints

- Add no API secret or public environment variable; public market endpoints need no credentials.
- Route responses use short cache/revalidation headers; upstream errors become sanitized `502` JSON responses.
- Validate all numeric fields and reject malformed or empty OKX payloads.
- No WebSocket in this phase. Streaming prices, order book and multi-symbol support remain phase two.
- No MCP dependency, transport, server or tool invocation is added.

## Verification

- Unit tests cover period mapping and OKX payload normalization, including malformed values.
- Route tests cover successful responses, parameter validation and upstream failure mapping.
- Component tests cover initial load, period switching and retry/fallback labelling.
- Run unit tests, lint, typecheck and production build.
- Browser-check the BTC/USDT page at a mobile viewport for chart rendering, period interaction, loading/error copy and console errors.

# OKX BTC Market Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live public OKX BTC-USDT ticker data and a period-switchable interactive candlestick chart to the PAPER LIVE trade page.

**Architecture:** Same-origin Next.js Route Handlers call a typed OKX REST adapter and return normalized application contracts. A focused client hook owns request state, while a client-only Lightweight Charts component renders candles without changing the simulated trading boundary.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, lightweight-charts 5, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-30-okx-btc-market-data.md`

## Global Constraints

- Support only public `BTC-USDT` spot ticker and candles in this phase.
- Initial period is `1D`; supported UI periods are exactly `1H`, `4H`, `1D`, `1W`.
- Add no MCP integration, authenticated OKX API, API key, real order path or wallet payment signature.
- Failed live data must be visibly labelled fallback demo data.
- Keep all order submission behavior in the existing PAPER LIVE simulation.

---

### Task 1: Market data contracts and OKX normalization

**Files:**
- Create: `src/lib/market-data/types.ts`
- Create: `src/lib/market-data/okx.ts`
- Test: `src/lib/market-data/okx.test.ts`

**Interfaces:**
- Produces: `ChartPeriod`, `MarketTicker`, `MarketCandle`, `toOkxBar(period)`, `normalizeOkxTicker(payload)`, `normalizeOkxCandles(payload)` and `OkxMarketAdapter`.

- [x] Write tests asserting the four period mappings, ascending candle order and rejection of malformed numeric payloads.
- [x] Run `npm test -- src/lib/market-data/okx.test.ts` and verify failure because the module is missing.
- [x] Implement the contracts, strict parsers and public REST adapter with dependency-injected `fetch`.
- [x] Re-run the focused test and verify it passes.

### Task 2: Same-origin market Route Handlers

**Files:**
- Create: `src/app/api/market/ticker/route.ts`
- Create: `src/app/api/market/candles/route.ts`
- Test: `src/app/api/market/routes.test.ts`

**Interfaces:**
- Consumes: `OkxMarketAdapter`, `ChartPeriod`.
- Produces: `GET /api/market/ticker` and `GET /api/market/candles?period=1D` JSON endpoints.

- [x] Write route tests for successful normalized JSON, invalid period `400`, and sanitized upstream `502`.
- [x] Run `npm test -- src/app/api/market/routes.test.ts` and verify the missing routes fail.
- [x] Implement handlers with validated query parameters and `Cache-Control` headers.
- [x] Re-run route tests and verify they pass.

### Task 3: Interactive candlestick chart and request state

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `src/components/trade/candlestick-chart.tsx`
- Create: `src/components/trade/use-btc-market.ts`
- Create: `src/components/trade/trade-market-panel.tsx`
- Test: `src/components/trade/trade-market-panel.test.tsx`

**Interfaces:**
- Consumes: route contracts from Tasks 1-2.
- Produces: `TradeMarketPanel({ onPriceChange })` and client-only `CandlestickChart({ candles })`.

- [x] Install `lightweight-charts`.
- [x] Write component tests for `1D` initial state, `4H` selection/request, loading, retry and fallback label.
- [x] Run the focused component test and verify it fails because the panel is missing.
- [x] Implement the fetch hook with abort handling and deterministic fallback candles.
- [x] Implement the chart lifecycle in `useEffect`, including `ResizeObserver`, cleanup and `fitContent()`.
- [x] Implement the accessible period controls and loading/error states.
- [x] Re-run component tests and verify they pass.

### Task 4: Trade page integration and styling

**Files:**
- Modify: `src/components/screens.tsx`
- Modify: `src/app/globals.css`
- Test: `src/components/trade/trade-screen.test.tsx`

**Interfaces:**
- Consumes: `TradeMarketPanel({ onPriceChange })`.
- Produces: live quote/chart display and live-price paper-order estimates in `TradeScreen`.

- [x] Write a regression test showing the trade page exposes working period buttons and retains PAPER LIVE safety copy.
- [x] Run the focused test and verify it fails against the static Sparkline implementation.
- [x] Replace only the static quote/chart block with `TradeMarketPanel`; retain the existing order form and safety boundary.
- [x] Add responsive Tailwind component classes for chart height, source/fallback badges, skeleton and retry controls.
- [x] Re-run the focused component and integration test suites.

### Task 5: Documentation and end-to-end verification

**Files:**
- Modify: `README.md`
- Modify: `docs/technical-design.md`

**Interfaces:**
- Consumes: the complete phase-one implementation.
- Produces: setup, data-flow, endpoint and safety-boundary documentation.

- [x] Document the OKX public-data endpoints, adapter boundary, fallback semantics and explicit no-MCP constraint.
- [x] Run `npm test`, `npm run lint`, `npm run typecheck` and `npm run build` and inspect every exit code.
- [x] Run the local app, open `/trade/btc-usdt` at a mobile viewport, switch all four periods and inspect console/network failures.
- [x] Confirm the screen continues to state PAPER LIVE and never requests wallet payment or real-order credentials.

# Live Market Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the market home page's eight static asset rows with source-labelled live prices, 24-hour statistics, and recent trends from OKX with Kraken fallback.

**Architecture:** Extend the existing typed market adapters without breaking the BTC trade page, then add a dedicated overview aggregation service and same-origin `/api/market/overview` route. A focused client hook merges partial live results with explicitly labelled fixtures, while a new market-screen component owns loading, retry, filtering, freshness, and source presentation.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Vitest, Testing Library, OKX Public REST, Kraken Public REST.

**Spec:** `docs/superpowers/specs/2026-08-30-live-market-overview-design.md`

## Global Constraints

- Cover exactly `BTC`, `ETH`, `SOL`, `BNB`, `ADA`, `AVAX`, `DOT`, and `POL` as USDT spot markets.
- Replace legacy `MATIC` UI metadata with `POL`.
- Preserve the existing BTC trade-page API and `/trade/btc-usdt` behaviour.
- Source copy must be exactly `OKX LIVE`, `KRAKEN LIVE`, `MIXED LIVE`, `MIXED DATA`, or `DEMO DATA` as applicable.
- Never present a fixture value as live data.
- Keep orders in PAPER LIVE; add no API key, wallet payment, authenticated exchange call, real order, WebSocket, or MCP runtime.
- Use tests-first red/green/refactor for every production behaviour.

---

### Task 1: Multi-asset contracts and catalogue migration

**Files:**
- Modify: `src/lib/market-data/types.ts`
- Modify: `src/lib/data.ts`
- Create: `src/lib/market-data/types.test.ts`
- Modify: `src/lib/trading.test.ts`

**Interfaces:**
- Produces: `marketSymbols`, `MarketSymbol`, `MarketInstrument`, `toMarketInstrument(symbol)`, broadened `MarketTicker.instrument`.
- Produces: catalogue metadata containing `POL`, not `MATIC`.

- [ ] **Step 1: Write failing contract and catalogue tests**

```ts
import { describe, expect, it } from "vitest";
import { markets } from "@/lib/data";
import { marketSymbols, toMarketInstrument } from "./types";

describe("multi-asset market contracts", () => {
  it("defines the eight supported assets in product order", () => {
    expect(marketSymbols).toEqual(["BTC", "ETH", "SOL", "BNB", "ADA", "AVAX", "DOT", "POL"]);
    expect(markets.map(({ symbol }) => symbol)).toEqual(marketSymbols);
  });

  it("maps a supported symbol to its USDT spot instrument", () => {
    expect(toMarketInstrument("POL")).toBe("POL-USDT");
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/lib/market-data/types.test.ts`

Expected: FAIL because `marketSymbols` and `toMarketInstrument` do not exist and the catalogue still contains `MATIC`.

- [ ] **Step 3: Implement the contracts and migrate metadata**

```ts
export const marketSymbols = ["BTC", "ETH", "SOL", "BNB", "ADA", "AVAX", "DOT", "POL"] as const;
export type MarketSymbol = (typeof marketSymbols)[number];
export type MarketInstrument = `${MarketSymbol}-USDT`;
export const toMarketInstrument = (symbol: MarketSymbol): MarketInstrument => `${symbol}-USDT`;
```

Change `MarketTicker.instrument` to `MarketInstrument`, change `Market.symbol` to `MarketSymbol`, and replace the `MATIC` catalogue row with:

```ts
{ symbol: "POL", name: "Polygon", price: 0.714, change: -2.21, color: "#8247e5", icon: "P", category: "DeFi", spark: [33, 31, 29, 30, 26, 25, 22, 19] }
```

- [ ] **Step 4: Run focused and existing domain tests**

Run: `npm test -- src/lib/market-data/types.test.ts src/lib/trading.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/market-data/types.ts src/lib/market-data/types.test.ts src/lib/data.ts src/lib/trading.test.ts
git commit -m "feat: define multi-asset market catalogue"
```

---

### Task 2: OKX batch ticker and instrument-aware candles

**Files:**
- Modify: `src/lib/market-data/okx.ts`
- Modify: `src/lib/market-data/okx.test.ts`

**Interfaces:**
- Consumes: `MarketInstrument`, `MarketTicker`.
- Produces: `normalizeOkxTickers(payload, instruments)`.
- Produces: `OkxMarketAdapter.getTickers(instruments)` and `getCandlesForInstrument(instrument, period, limit)`.
- Preserves: `getTicker()` and `getCandles()` as BTC delegates for the trade page.

- [ ] **Step 1: Add failing normalization tests**

```ts
it("filters and normalizes requested USDT tickers in requested order", () => {
  const result = normalizeOkxTickers({ code: "0", data: [
    { instId: "ETH-USDT", last: "3521", open24h: "3500", high24h: "3600", low24h: "3400", vol24h: "90", ts: "2000" },
    { instId: "BTC-EUR", last: "1", open24h: "1", high24h: "1", low24h: "1", vol24h: "1", ts: "2000" },
    { instId: "BTC-USDT", last: "69000", open24h: "68000", high24h: "70000", low24h: "67000", vol24h: "120", ts: "2000" },
  ] }, ["BTC-USDT", "ETH-USDT"]);

  expect(result.map(({ instrument }) => instrument)).toEqual(["BTC-USDT", "ETH-USDT"]);
  expect(result[0].last).toBe(69000);
});
```

Add a request test asserting `getTickers()` calls `/api/v5/market/tickers?instType=SPOT`, and a candle test asserting `getCandlesForInstrument("ETH-USDT", "1H")` sends `instId=ETH-USDT`.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/lib/market-data/okx.test.ts`

Expected: FAIL because the batch normalizer and instrument-aware methods do not exist.

- [ ] **Step 3: Implement minimal OKX extensions**

Parse each row with the same finite-number validation used by `normalizeOkxTicker`. Reject invalid rows for requested instruments, ignore unrelated instruments, and return the requested catalogue order. Implement:

```ts
async getTickers(instruments: MarketInstrument[]): Promise<MarketTicker[]>;
async getCandlesForInstrument(instrument: MarketInstrument, period: ChartPeriod, limit?: number): Promise<MarketCandle[]>;
```

Make existing methods delegate:

```ts
getTicker() { return this.getTickerForInstrument("BTC-USDT"); }
getCandles(period, limit) { return this.getCandlesForInstrument("BTC-USDT", period, limit); }
```

- [ ] **Step 4: Run OKX and route regression tests**

Run: `npm test -- src/lib/market-data/okx.test.ts src/app/api/market/routes.test.ts`

Expected: PASS; existing BTC endpoints remain unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/lib/market-data/okx.ts src/lib/market-data/okx.test.ts
git commit -m "feat: add OKX multi-asset market data"
```

---

### Task 3: Kraken multi-asset fallback and overview aggregation

**Files:**
- Modify: `src/lib/market-data/kraken.ts`
- Modify: `src/lib/market-data/kraken.test.ts`
- Create: `src/lib/market-data/market-overview.ts`
- Create: `src/lib/market-data/market-overview.test.ts`

**Interfaces:**
- Produces: `getKrakenPair(instrument): string | undefined`.
- Produces: Kraken `getTickers(instruments)` and `getCandlesForInstrument(instrument, period, limit)`.
- Produces: `OverviewProvider`, `getMarketOverview(providers, instruments)`, `createOverviewProviders()`.

- [ ] **Step 1: Write failing Kraken mapping tests**

```ts
expect(getKrakenPair("BTC-USDT")).toBe("XBTUSDT");
expect(getKrakenPair("ETH-USDT")).toBe("ETHUSDT");
expect(getKrakenPair("BNB-USDT")).toBeUndefined();
```

Add a normalization test that passes `"ETH-USDT"` into `normalizeKrakenTicker` and expects that instrument in the result. Add a test that `getTickers(["BTC-USDT", "BNB-USDT"])` returns BTC only rather than fabricating BNB.

- [ ] **Step 2: Run Kraken tests and verify RED**

Run: `npm test -- src/lib/market-data/kraken.test.ts`

Expected: FAIL because pair mapping and multi-asset methods do not exist.

- [ ] **Step 3: Implement Kraken supported-pair behaviour**

Use an explicit partial map:

```ts
const krakenPairs: Partial<Record<MarketInstrument, string>> = {
  "BTC-USDT": "XBTUSDT",
  "ETH-USDT": "ETHUSDT",
  "SOL-USDT": "SOLUSDT",
  "ADA-USDT": "ADAUSDT",
  "AVAX-USDT": "AVAXUSDT",
  "DOT-USDT": "DOTUSDT",
  "POL-USDT": "POLUSDT",
};
```

Run supported requests in parallel with `Promise.allSettled`, returning successful rows only. Keep existing BTC methods as delegates.

- [ ] **Step 4: Write failing aggregation tests**

```ts
it("fills missing OKX rows from Kraken and preserves catalogue order", async () => {
  const result = await getMarketOverview([
    provider("okx", [ticker("BTC-USDT", 69000)]),
    provider("kraken", [ticker("ETH-USDT", 3500)]),
  ], ["BTC-USDT", "ETH-USDT"]);

  expect(result.source).toBe("mixed");
  expect(result.data.map(({ instrument, source }) => [instrument, source])).toEqual([
    ["BTC-USDT", "okx"],
    ["ETH-USDT", "kraken"],
  ]);
});
```

Also test: a single provider serving all rows reports its source; candle closes become `spark`; candle failure leaves `spark: []`; zero usable ticker rows throws `All live overview providers failed`.

- [ ] **Step 5: Run overview tests and verify RED**

Run: `npm test -- src/lib/market-data/market-overview.test.ts`

Expected: FAIL because the aggregation module does not exist.

- [ ] **Step 6: Implement the aggregation service**

```ts
export type OverviewProvider = {
  source: LiveMarketSource;
  getTickers(instruments: MarketInstrument[]): Promise<MarketTicker[]>;
  getCandlesForInstrument(instrument: MarketInstrument, period: ChartPeriod, limit?: number): Promise<MarketCandle[]>;
};

export async function getMarketOverview(
  providers: OverviewProvider[],
  instruments: MarketInstrument[],
): Promise<MarketOverviewResponse>;
```

Ask providers only for remaining instruments, keep the first valid ticker per instrument, preserve input order, request 24 `1H` candles in parallel, and aggregate `source` to `okx`, `kraken`, or `mixed`.

- [ ] **Step 7: Run focused tests and commit**

Run: `npm test -- src/lib/market-data/kraken.test.ts src/lib/market-data/market-overview.test.ts src/lib/market-data/market-service.test.ts`

Expected: PASS.

```bash
git add src/lib/market-data/kraken.ts src/lib/market-data/kraken.test.ts src/lib/market-data/market-overview.ts src/lib/market-data/market-overview.test.ts
git commit -m "feat: aggregate multi-provider market overview"
```

---

### Task 4: Same-origin overview API

**Files:**
- Create: `src/app/api/market/overview/route.ts`
- Modify: `src/app/api/market/routes.test.ts`

**Interfaces:**
- Consumes: `createOverviewProviders()`, `getMarketOverview()`, eight `MarketInstrument` values.
- Produces: `GET /api/market/overview` returning `MarketOverviewResponse`.

- [ ] **Step 1: Write failing route tests**

Add an OKX batch fixture and assert:

```ts
const response = await getOverview();
expect(response.status).toBe(200);
expect(response.headers.get("cache-control")).toBe("public, s-maxage=30, stale-while-revalidate=120");
expect(await response.json()).toMatchObject({
  source: "okx",
  data: [{ instrument: "BTC-USDT", source: "okx" }],
});
```

Add a total-upstream-failure test expecting status `502` and `{ error: "Market overview temporarily unavailable" }`.

- [ ] **Step 2: Run route tests and verify RED**

Run: `npm test -- src/app/api/market/routes.test.ts`

Expected: FAIL because the overview route cannot be imported.

- [ ] **Step 3: Implement the route**

Use the catalogue instruments and sanitized errors:

```ts
export async function GET() {
  try {
    const result = await getMarketOverview(createOverviewProviders(), marketSymbols.map(toMarketInstrument));
    return Response.json(result, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } });
  } catch {
    return Response.json({ error: "Market overview temporarily unavailable" }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run all market-domain tests and commit**

Run: `npm test -- src/lib/market-data src/app/api/market/routes.test.ts`

Expected: PASS.

```bash
git add src/app/api/market/overview/route.ts src/app/api/market/routes.test.ts
git commit -m "feat: expose live market overview API"
```

---

### Task 5: Live market hook and honest fallback semantics

**Files:**
- Create: `src/components/markets/use-market-overview.ts`
- Create: `src/components/markets/use-market-overview.test.tsx`

**Interfaces:**
- Consumes: `/api/market/overview`, catalogue fixtures, `MarketOverviewResponse`.
- Produces: `useMarketOverview()` with `markets`, `source`, `updatedAt`, `isInitialLoading`, `isRefreshing`, `hasError`, and `retry`.

- [ ] **Step 1: Write failing hook tests through a small probe component**

Cover these observable behaviours:

```ts
it("keeps live rows and labels missing catalogue rows as demo", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({
    source: "okx", updatedAt: 1788048000000,
    data: [{ instrument: "BTC-USDT", symbol: "BTC", last: 69000, open24h: 68000, high24h: 70000, low24h: 67000, volume24h: 100, timestamp: 1788048000000, spark: [68000, 69000], source: "okx" }],
  })));
  render(<OverviewProbe />);
  expect(await screen.findByText("MIXED DATA")).toBeInTheDocument();
  expect(screen.getByText("69000")).toBeInTheDocument();
});
```

Also test total 502 fallback reports `DEMO DATA`, retry replaces fixtures with live rows, and a refresh failure retains the last good live rows.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/components/markets/use-market-overview.test.tsx`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the hook**

Use `AbortController`, merge responses by `symbol`, calculate aggregate display source, and keep prior live state during refresh errors. Demo rows must use the catalogue's fixture price/change/spark and `source: "demo"`.

- [ ] **Step 4: Run hook tests and commit**

Run: `npm test -- src/components/markets/use-market-overview.test.tsx`

Expected: PASS.

```bash
git add src/components/markets/use-market-overview.ts src/components/markets/use-market-overview.test.tsx
git commit -m "feat: add resilient market overview state"
```

---

### Task 6: Market-screen UI, final QA, and deployment

**Files:**
- Create: `src/components/markets/market-screen.tsx`
- Create: `src/components/markets/market-screen.test.tsx`
- Modify: `src/app/markets/page.tsx`
- Modify: `src/components/screens.tsx`
- Modify: `src/components/ui.tsx`
- Modify: `src/app/globals.css`
- Modify: `README.md`
- Modify: `docs/technical-design.md`

**Interfaces:**
- Consumes: `useMarketOverview()`.
- Produces: the `/markets` page with live source/freshness, filters, loading, partial data, demo fallback, and retry.

- [ ] **Step 1: Write failing component tests**

Mock only the same-origin fetch boundary. Assert initial skeleton, eight rendered symbols, live values, `POL` replacing `MATIC`, `OKX LIVE`, formatted update time, category/search filtering, demo warning, retry, BTC link, and absence of fake links for unsupported trade pages.

```ts
expect(await screen.findByText("OKX LIVE")).toBeInTheDocument();
expect(screen.getByText("POL")).toBeInTheDocument();
expect(screen.queryByText("MATIC")).not.toBeInTheDocument();
expect(screen.getByRole("link", { name: /BTC/ })).toHaveAttribute("href", "/trade/btc-usdt");
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/components/markets/market-screen.test.tsx`

Expected: FAIL because the new screen does not exist.

- [ ] **Step 3: Implement the screen and shared presentation**

Move `MarketScreen` out of the large `screens.tsx`, point `src/app/markets/page.tsx` to the focused component, and prune unused imports. Update `FavoriteMarketCard` to accept the live view shape. Add compact source/freshness styles, skeleton cards/rows, a partial/demo warning, a retry button, and a no-spark placeholder. Preserve the industrial dark trading aesthetic and 390 px layout.

- [ ] **Step 4: Run component and full automated verification**

Run:

```bash
npm test -- src/components/markets/market-screen.test.tsx
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: all tests pass, TypeScript and ESLint emit no errors, and the Next.js production build includes `/api/market/overview`.

- [ ] **Step 5: Browser-check the production build at 390 px**

Start: `npm start -- -p 3100 -H 127.0.0.1`

Verify `/markets` renders eight rows, source/freshness copy, search, category filters, retry state, no horizontal overflow, and no console errors. Confirm `/trade/btc-usdt` still renders and its periods remain interactive.

- [ ] **Step 6: Update durable documentation**

Document `/api/market/overview`, eight supported assets, per-row source semantics, cache policy, and the unchanged PAPER LIVE boundary in `README.md` and `docs/technical-design.md`.

- [ ] **Step 7: Commit, push, and deploy**

```bash
git add src/components/markets src/app/markets/page.tsx src/components/screens.tsx src/components/ui.tsx src/app/globals.css README.md docs/technical-design.md
git commit -m "feat: launch live multi-asset market overview"
git push
vercel deploy --prod --yes
```

Verify Vercel reports `Ready`, then check:

```text
https://apex-ledger-h5.vercel.app/markets
https://apex-ledger-h5.vercel.app/api/market/overview
```

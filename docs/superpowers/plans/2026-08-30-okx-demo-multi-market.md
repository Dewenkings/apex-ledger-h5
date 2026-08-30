# OKX Demo Multi-Market Trading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the local BTC paper-order flow with a secure, dynamic BTC/ETH/SOL flow that reads public OKX/Kraken data and submits authenticated orders to OKX Demo Trading.

**Architecture:** A strict trading-pair contract drives dynamic Next.js routes, public market queries, formatting, and order validation. Server-only modules sign OKX Demo requests, while a signed application session and Upstash Redis enforce controlled access, idempotency, rate limits, and order ownership. Order-write failures degrade to read-only; they never produce a local fake success.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.7, Tailwind CSS 4, Vitest, Testing Library, Zod, `@upstash/redis`, Node `crypto`, OKX API v5 Demo Trading, Kraken public API, Vercel.

**Spec:** `docs/superpowers/specs/2026-08-30-multi-market-paper-trading-design.md`

## Global Constraints

- Tradable instruments are exactly `BTC-USDT`, `ETH-USDT`, and `SOL-USDT`.
- Private OKX requests always include `x-simulated-trading: 1`; the code exposes no production-trading switch.
- `OKX_DEMO_API_KEY`, `OKX_DEMO_SECRET_KEY`, `OKX_DEMO_PASSPHRASE`, `DEMO_ACCESS_CODE`, `SESSION_SECRET`, and Redis credentials remain server-only.
- Only OKX Demo may accept, fill, list, or cancel an order. Public-market fixture data may never create a successful order.
- Missing credentials, access, or upstream availability produces a read-only/failed state, not fake success.
- Demo writes require a signed HTTP-only session, pair/precision/notional validation, rate limiting, idempotency, and session ownership checks.
- Balance copy must say that the OKX Demo balance is shared and virtual.
- Use `Decimal`-safe string validation and integer-step arithmetic; do not use floating-point equality to validate order steps.
- Follow test-first RED → GREEN → REFACTOR for every production change.

---

### Task 1: Define the Tradable Pair Contract

**Files:**
- Create: `src/lib/trading/pairs.ts`
- Create: `src/lib/trading/pairs.test.ts`
- Modify: `src/lib/market-data/types.ts`

**Interfaces:**
- Produces: `tradableInstruments`, `TradableInstrument`, `TradingPairConfig`, `parseTradableInstrument(value)`, `getPairBySlug(slug)`, `getPairBySymbol(symbol)`, and `formatPairAmount(config, value)`.
- Consumed by: public market routes, OKX Demo order validation, dynamic trade pages, market links, and confirmation UI.

- [ ] **Step 1: Write failing contract tests**

```ts
expect(getPairBySlug("eth-usdt")).toMatchObject({
  instrument: "ETH-USDT", baseSymbol: "ETH", pairSlug: "eth-usdt",
});
expect(getPairBySymbol("SOL")?.instrument).toBe("SOL-USDT");
expect(parseTradableInstrument("DOGE-USDT")).toBeNull();
expect(parseTradableInstrument("eth-usdt")).toBeNull();
expect(formatPairAmount(getPairBySlug("btc-usdt")!, "0.02500000")).toBe("0.025");
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/lib/trading/pairs.test.ts`

Expected: FAIL because `src/lib/trading/pairs.ts` does not exist.

- [ ] **Step 3: Implement the minimal immutable pair catalogue**

```ts
export const tradingPairs = [
  { instrument: "BTC-USDT", pairSlug: "btc-usdt", baseSymbol: "BTC", quoteSymbol: "USDT", priceDecimals: 2, amountDecimals: 8, demoAmount: "0.001", maxDemoNotionalUsdt: "250" },
  { instrument: "ETH-USDT", pairSlug: "eth-usdt", baseSymbol: "ETH", quoteSymbol: "USDT", priceDecimals: 2, amountDecimals: 8, demoAmount: "0.02", maxDemoNotionalUsdt: "250" },
  { instrument: "SOL-USDT", pairSlug: "sol-usdt", baseSymbol: "SOL", quoteSymbol: "USDT", priceDecimals: 2, amountDecimals: 6, demoAmount: "0.25", maxDemoNotionalUsdt: "250" },
] as const;
```

Add exact parsers backed by this catalogue; never cast arbitrary strings to a tradable type.

- [ ] **Step 4: Run focused and existing market type tests**

Run: `npm test -- src/lib/trading/pairs.test.ts src/lib/market-data/types.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/trading/pairs.ts src/lib/trading/pairs.test.ts src/lib/market-data/types.ts
git commit -m "feat: define tradable market contract"
```

### Task 2: Make Public Single-Market APIs Instrument-Aware

**Files:**
- Modify: `src/lib/market-data/market-service.ts`
- Modify: `src/lib/market-data/market-service.test.ts`
- Modify: `src/app/api/market/ticker/route.ts`
- Modify: `src/app/api/market/candles/route.ts`
- Modify: `src/app/api/market/routes.test.ts`

**Interfaces:**
- Consumes: `TradableInstrument` and `parseTradableInstrument` from Task 1.
- Produces: `getTickerFromProviders(instrument, providers)`, `getCandlesFromProviders(instrument, period, providers, limit)`, and API queries requiring `instrument`.

- [ ] **Step 1: Write failing service tests**

```ts
await getTickerFromProviders("ETH-USDT", providers);
expect(okx.getTickerForInstrument).toHaveBeenCalledWith("ETH-USDT");

await getCandlesFromProviders("SOL-USDT", "4H", providers, 120);
expect(okx.getCandlesForInstrument).toHaveBeenCalledWith("SOL-USDT", "4H", 120);
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/lib/market-data/market-service.test.ts`

Expected: FAIL because the service still exposes BTC-only zero-argument provider methods.

- [ ] **Step 3: Change the provider contract**

```ts
export type MarketProvider = {
  source: LiveMarketSource;
  getTickerForInstrument(instrument: MarketInstrument): Promise<MarketTicker>;
  getCandlesForInstrument(instrument: MarketInstrument, period: ChartPeriod, limit?: number): Promise<MarketCandle[]>;
};
```

Bind the existing instrument-aware OKX and Kraken adapter methods and pass the requested instrument through fallback selection.

- [ ] **Step 4: Write failing route tests**

```ts
const eth = await getTicker(new Request("http://localhost/api/market/ticker?instrument=ETH-USDT"));
expect((await eth.json()).data.instrument).toBe("ETH-USDT");

const invalid = await getCandles(new Request("http://localhost/api/market/candles?instrument=DOGE-USDT&period=1D"));
expect(invalid.status).toBe(400);
```

- [ ] **Step 5: Add exact query validation and preserve cache headers**

Ticker and candle handlers must return `{ error: "Unsupported trading instrument" }` for missing or invalid instruments before calling providers. Candle handlers separately validate `period`.

- [ ] **Step 6: Run market service and route tests**

Run: `npm test -- src/lib/market-data/market-service.test.ts src/app/api/market/routes.test.ts`

Expected: PASS for BTC, ETH, SOL, provider fallback, invalid instrument, invalid period, and sanitized 502 cases.

- [ ] **Step 7: Commit**

```bash
git add src/lib/market-data/market-service.ts src/lib/market-data/market-service.test.ts src/app/api/market/ticker/route.ts src/app/api/market/candles/route.ts src/app/api/market/routes.test.ts
git commit -m "feat: query public data by trading instrument"
```

### Task 3: Add Server-Only OKX Demo Signing and Client

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/okx-demo/contracts.ts`
- Create: `src/lib/okx-demo/config.ts`
- Create: `src/lib/okx-demo/signing.ts`
- Create: `src/lib/okx-demo/signing.test.ts`
- Create: `src/lib/okx-demo/client.ts`
- Create: `src/lib/okx-demo/client.test.ts`

**Interfaces:**
- Produces: `OkxDemoConfig`, `readOkxDemoConfig(env)`, `signOkxRequest(secret, timestamp, method, requestPath, body)`, `OkxDemoClient`, normalized demo order/fill/balance contracts, and `OkxDemoError`.
- Consumed by: demo API routes and reconciliation service.

- [ ] **Step 1: Install validation and Redis dependencies**

Run: `npm install zod @upstash/redis`

Expected: lockfile updated without changing Next/React versions.

- [ ] **Step 2: Write fixed-vector signing and config tests**

```ts
expect(signOkxRequest("secret", "2026-08-30T00:00:00.000Z", "POST", "/api/v5/trade/order", '{"instId":"ETH-USDT"}'))
  .toBe("GRuEwSIdwGA5FDuF9/zQBz/pOmB5uFFaXXKher1qwTU=");

expect(() => readOkxDemoConfig({ TRADING_PROFILE: "live" })).toThrow(/okx_demo/);
```

Also assert config output contains only the demo base URL and never a mutable `simulated`/`production` flag.

- [ ] **Step 3: Verify RED**

Run: `npm test -- src/lib/okx-demo/signing.test.ts`

Expected: FAIL because signing/config modules do not exist.

- [ ] **Step 4: Implement signing and strict environment parsing**

Use `createHmac("sha256", secret).update(timestamp + method + requestPath + body).digest("base64")`. Validate `TRADING_PROFILE === "okx_demo"`; accept no live profile.

- [ ] **Step 5: Write failing HTTP client tests**

Assert every private request includes:

```ts
expect(headers).toMatchObject({
  "OK-ACCESS-KEY": "demo-key",
  "OK-ACCESS-PASSPHRASE": "demo-passphrase",
  "x-simulated-trading": "1",
});
```

Cover OKX `code !== "0"`, malformed envelopes, timeout abort, and sanitized `OkxDemoError`.

- [ ] **Step 6: Implement `OkxDemoClient.request` and typed endpoint methods**

Methods:

```ts
placeOrder(input): Promise<DemoOrderReceipt>
getOrder({ instrument, ordId?, clOrdId? }): Promise<DemoOrder>
listPendingOrders(instrument?): Promise<DemoOrder[]>
listOrderHistory(instrument?): Promise<DemoOrder[]>
listFills(instrument?): Promise<DemoFill[]>
cancelOrder({ instrument, ordId }): Promise<DemoCancelReceipt>
getBalance(): Promise<DemoBalance>
```

No transfer, deposit, withdrawal, API-key management, or production endpoint method is allowed.

- [ ] **Step 7: Run OKX Demo unit tests**

Run: `npm test -- src/lib/okx-demo/signing.test.ts src/lib/okx-demo/client.test.ts`

Expected: PASS with request-body signature, mandatory demo header, normalization, error, and timeout coverage.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/lib/okx-demo
git commit -m "feat: add server-only OKX demo client"
```

### Task 4: Build Controlled Demo Sessions and Durable Safety State

**Files:**
- Create: `src/lib/demo-access/session.ts`
- Create: `src/lib/demo-access/session.test.ts`
- Create: `src/lib/demo-access/store.ts`
- Create: `src/lib/demo-access/store.test.ts`
- Create: `src/lib/demo-access/rules.ts`
- Create: `src/lib/demo-access/rules.test.ts`
- Create: `src/app/api/demo/session/route.ts`
- Create: `src/app/api/demo/session/route.test.ts`

**Interfaces:**
- Produces: `createDemoSessionCookie`, `verifyDemoSessionCookie`, `DemoSafetyStore`, `RedisDemoSafetyStore`, `MemoryDemoSafetyStore`, `validateDemoOrderInput`, and POST/DELETE session handlers.
- Consumes: Task 1 pair config and Zod.
- Used by: all private demo order routes.

- [ ] **Step 1: Write failing session tests**

Cover timing-safe access-code comparison, signed/expiring cookie verification, tamper rejection, `HttpOnly`, `Secure` in production, `SameSite=Lax`, and logout deletion.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/lib/demo-access/session.test.ts src/app/api/demo/session/route.test.ts`

Expected: FAIL because session modules/routes do not exist.

- [ ] **Step 3: Implement signed sessions using Node crypto**

The cookie payload contains only `{ sessionId, expiresAt }`; sign the Base64URL payload with HMAC-SHA256 and verify with `timingSafeEqual`. Never put the access code or OKX secrets in the cookie.

- [ ] **Step 4: Write failing store/rules tests**

```ts
expect(await store.consumeRateLimit("session:a", 5, 60)).toEqual({ allowed: true, remaining: 4 });
expect(await store.claimIdempotency("idem:1", "hash", 300)).toEqual({ claimed: true });
expect(await store.claimIdempotency("idem:1", "different", 300)).toEqual({ claimed: false, conflict: true });
expect(validateDemoOrderInput({ instrument: "ETH-USDT", side: "buy", type: "limit", amount: "0.02", price: "3500" })).toMatchObject({ success: true });
```

Also reject amount step overflow, price step overflow, notional above `250 USDT`, unsupported pair/type, and market-order price fields.

- [ ] **Step 5: Implement store interface, Upstash adapter, memory test double, and exact string rules**

Use integer scaling based on configured decimals for step/notional checks. Do not validate money through floating-point equality.

- [ ] **Step 6: Run session, store, and rule tests**

Run: `npm test -- src/lib/demo-access`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/demo-access src/app/api/demo/session
git commit -m "feat: secure OKX demo write access"
```

### Task 5: Implement Order Ownership, Idempotency, and Reconciliation Service

**Files:**
- Create: `src/lib/okx-demo/order-service.ts`
- Create: `src/lib/okx-demo/order-service.test.ts`

**Interfaces:**
- Consumes: `OkxDemoClient`, `DemoSafetyStore`, verified `DemoSession`, Task 1 pair config, and validated order input.
- Produces: `OkxDemoOrderService.place`, `.listOrders`, `.listFills`, `.getSharedBalance`, and `.cancelOwnedOrder`.

- [ ] **Step 1: Write failing service tests**

Cover:

```ts
await service.place(session, input, "request-id");
expect(client.placeOrder).toHaveBeenCalledWith(expect.objectContaining({
  instId: "SOL-USDT",
  clOrdId: expect.stringMatching(/^apx[0-9a-z]+/),
}));
```

Also test same-key replay, different-body idempotency conflict, ambiguous timeout reconciled by `clOrdId`, rate-limit rejection, open-order cap, cross-session filtering, and cross-session cancellation denial.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/lib/okx-demo/order-service.test.ts`

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement the minimal orchestration service**

Generate bounded OKX-compatible `clOrdId` values from a one-way session prefix plus request suffix. Persist ownership before/after submission with a short TTL. On timeout, call `getOrder({ clOrdId })` before returning unknown/unavailable.

- [ ] **Step 4: Run the service test and refactor only while green**

Run: `npm test -- src/lib/okx-demo/order-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/okx-demo/order-service.ts src/lib/okx-demo/order-service.test.ts
git commit -m "feat: orchestrate safe demo orders"
```

### Task 6: Expose Authenticated Demo REST Routes

**Files:**
- Create: `src/app/api/demo/_shared.ts`
- Create: `src/app/api/demo/orders/route.ts`
- Create: `src/app/api/demo/orders/[orderId]/cancel/route.ts`
- Create: `src/app/api/demo/fills/route.ts`
- Create: `src/app/api/demo/balance/route.ts`
- Create: `src/app/api/demo/routes.test.ts`

**Interfaces:**
- Consumes: Task 3 client, Task 4 session/store/rules, Task 5 order service.
- Produces: stable JSON envelopes for demo order creation/listing, fills, shared balance, and cancellation.

- [ ] **Step 1: Write failing route tests with dependency injection seams**

Assert:

- 401 without a valid session;
- 400 for invalid instrument/amount/price;
- 409 for idempotency conflict;
- 429 for rate limit;
- 503 when credentials or Redis are missing;
- 201 with OKX `ordId`, `clOrdId`, and normalized state on acceptance;
- 403 when cancelling another session's order;
- `Cache-Control: no-store` on all private responses;
- balance response includes `scope: "shared-okx-demo"` and `virtual: true`.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/app/api/demo/routes.test.ts`

Expected: FAIL because handlers do not exist.

- [ ] **Step 3: Implement route composition and sanitized error mapping**

Parse cookies server-side, require same-origin mutation requests, set `no-store`, and map domain errors to the specified status without returning OKX secrets or raw upstream headers.

- [ ] **Step 4: Run all demo backend tests**

Run: `npm test -- src/lib/okx-demo src/lib/demo-access src/app/api/demo`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/demo
git commit -m "feat: expose controlled OKX demo routes"
```

### Task 7: Convert BTC UI to Dynamic BTC/ETH/SOL Trading

**Files:**
- Create: `src/app/trade/[pair]/page.tsx`
- Create: `src/app/trade/[pair]/confirm/page.tsx`
- Delete: `src/app/trade/btc-usdt/page.tsx`
- Delete: `src/app/trade/btc-usdt/confirm/page.tsx`
- Rename: `src/components/trade/use-btc-market.ts` → `src/components/trade/use-trade-market.ts`
- Create: `src/components/trade/trade-screen.tsx`
- Create: `src/components/trade/confirm-screen.tsx`
- Modify: `src/components/trade/trade-market-panel.tsx`
- Modify: `src/components/trade/candlestick-chart.tsx`
- Modify: `src/components/markets/market-screen.tsx`
- Modify: `src/components/screens.tsx`
- Modify: `src/components/app-shell.tsx`
- Test: `src/components/trade/use-trade-market.test.tsx`
- Test: `src/components/trade/trade-screen.test.tsx`
- Test: `src/components/trade/confirm-screen.test.tsx`
- Modify: `src/components/markets/market-screen.test.tsx`

**Interfaces:**
- Consumes: Task 1 pair config, instrument-aware public APIs, and Task 6 demo routes.
- Produces: dynamic trading and confirmation pages for exactly three pair slugs.

- [ ] **Step 1: Write failing hook and market-link tests**

Assert `useTradeMarket("ETH-USDT")` requests:

```text
/api/market/ticker?instrument=ETH-USDT
/api/market/candles?instrument=ETH-USDT&period=1D
```

Assert BTC, ETH, and SOL market rows link to their slugs while BNB/ADA/AVAX/DOT/POL remain non-links.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/components/trade/use-trade-market.test.tsx src/components/markets/market-screen.test.tsx`

Expected: FAIL because the hook and links are still BTC-only.

- [ ] **Step 3: Generalize the hook, fixtures, market panel, and chart label**

`TradeMarketPanel` receives `pair: TradingPairConfig`; source labels remain honest. Fallback ticker/candles are selected by instrument. `CandlestickChart` receives `instrument` for its accessible name.

- [ ] **Step 4: Write failing dynamic screen/route tests**

For ETH and SOL assert dynamic header, buttons, amount unit, volume unit, preview URL, and `OKX DEMO` safety copy. Assert unsupported `doge-usdt` invokes `notFound()`.

- [ ] **Step 5: Implement dynamic Next pages and extracted screens**

Next.js 16 page signature:

```ts
export default async function Page({ params }: { params: Promise<{ pair: string }> }) {
  const config = getPairBySlug((await params).pair);
  if (!config) notFound();
  return <TradeScreen pair={config} />;
}
```

The confirmation screen sends a new idempotency key once, shows submitting/rejected/accepted states, and only declares success from Task 6 response data.

- [ ] **Step 6: Run all trade and market component tests**

Run: `npm test -- src/components/trade src/components/markets/market-screen.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/trade src/components/trade src/components/markets/market-screen.tsx src/components/markets/market-screen.test.tsx src/components/screens.tsx src/components/app-shell.tsx
git commit -m "feat: add dynamic OKX demo trade flow"
```

### Task 8: Replace Hardcoded Orders and Assets with OKX Demo State

**Files:**
- Create: `src/components/demo/use-demo-session.ts`
- Create: `src/components/demo/demo-access-card.tsx`
- Create: `src/components/demo/use-demo-account.ts`
- Create: `src/components/demo/demo-hooks.test.tsx`
- Create: `src/components/orders/orders-screen.tsx`
- Create: `src/components/orders/orders-screen.test.tsx`
- Create: `src/components/portfolio/portfolio-screen.tsx`
- Create: `src/components/portfolio/portfolio-screen.test.tsx`
- Modify: `src/app/orders/page.tsx`
- Modify: `src/app/portfolio/page.tsx`
- Modify: `src/components/screens.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: Task 6 session/orders/fills/balance APIs.
- Produces: controlled demo access UI, session-filtered order/fill views, cancellation, and explicitly shared virtual balance UI.

- [ ] **Step 1: Write failing access/account hook tests**

Cover access-code login without persisting the code, 401 logged-out state, orders/fills fetch after login, logout cleanup, retry, and 503 read-only state.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/components/demo/demo-hooks.test.tsx`

Expected: FAIL because demo hooks do not exist.

- [ ] **Step 3: Implement minimal hooks and access card**

Use credentialed same-origin fetch, never LocalStorage for secrets, and generic failure copy that does not expose whether an access code or server secret was wrong.

- [ ] **Step 4: Write failing Orders and Portfolio screen tests**

Assert orders show OKX identifiers/status/filled size, only owned cancel buttons, empty/loading/error states, and no hardcoded APX order rows. Assert Portfolio says `共享 OKX Demo 虚拟余额` and never implies the balance belongs to the visitor.

- [ ] **Step 5: Implement the two screens and responsive styles**

Cancel buttons call Task 6, disable during submission, and refresh orders. Public logged-out mode keeps read-only explanatory UI.

- [ ] **Step 6: Run screen tests and full component suite**

Run: `npm test -- src/components/demo src/components/orders src/components/portfolio src/components/trade src/components/markets`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/demo src/components/orders src/components/portfolio src/app/orders/page.tsx src/app/portfolio/page.tsx src/components/screens.tsx src/app/globals.css
git commit -m "feat: show OKX demo account state"
```

### Task 9: Document Secrets, Validate Safety, and Deploy Read-Only First

**Files:**
- Create: `.env.example`
- Create: `SECURITY.md`
- Modify: `.gitignore`
- Modify: `README.md`
- Modify: `docs/technical-design.md`
- Modify: `next.config.ts` only if the final server-origin configuration requires it.

**Interfaces:**
- Documents: owner setup, OKX Demo key permissions, Upstash, access code, Vercel variables, read-only fallback, key rotation, and incident response.

- [ ] **Step 1: Add a failing secret-safety test**

Create `src/config/demo-env.test.ts` that imports public/client modules and asserts serialized client configuration contains none of the private environment variable names or values. Add a repository scan command for key-like strings.

- [ ] **Step 2: Verify RED or missing documentation/config**

Run: `npm test -- src/config/demo-env.test.ts`

Expected: FAIL until the server/client environment boundary is explicit.

- [ ] **Step 3: Add safe environment/documentation files**

`.env.example` contains empty placeholders only. README setup must instruct the owner to paste secrets locally/Vercel, never chat or Git. `SECURITY.md` documents immediate key revocation and read-only shutdown.

- [ ] **Step 4: Run full automated verification**

Run separately and require exit code 0:

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Secret scan:

```bash
git grep -n -E '(OK-ACCESS-KEY|OKX_DEMO_SECRET_KEY=.{8,}|BEGIN (RSA |EC )?PRIVATE KEY)' -- ':!docs/**' ':!.env.example'
```

Expected: no committed credential value.

- [ ] **Step 5: Browser QA on local production build**

At 390 × 844 verify:

1. BTC, ETH, SOL links and unsupported-row behaviour.
2. Correct pair quote and 1D → 4H chart request.
3. Logged-out/read-only state without secrets.
4. Controlled Demo access with fake injected route fixtures when credentials are absent.
5. Order accepted/rejected/cancel states, order ownership, shared balance copy, and no horizontal overflow.
6. No hydration, React-state, or console errors.

- [ ] **Step 6: Commit implementation documentation**

```bash
git add .env.example .gitignore SECURITY.md README.md docs/technical-design.md src/config/demo-env.test.ts
git commit -m "docs: secure OKX demo deployment"
```

- [ ] **Step 7: Deploy the code in read-only mode and verify READY**

Push the integrated branch after the finishing workflow. Deploy before secrets are installed; verify public markets remain available and private write routes return safe 503/401 states.

- [ ] **Step 8: Owner installs external secrets without sharing them in chat**

Required owner actions:

1. Create OKX Demo Trading API key with Read + Trade only.
2. Create Upstash Redis and copy REST URL/token.
3. Create strong `DEMO_ACCESS_CODE` and `SESSION_SECRET`.
4. Add all values directly in Vercel production environment settings.
5. Redeploy.

- [ ] **Step 9: Run credentialed smoke test**

With owner authorization and credentials installed, submit a minimum-size BTC/ETH/SOL demo order, verify OKX `ordId`, query it in Orders, inspect fills if applicable, cancel a live order, confirm the shared virtual balance label, and remove any open smoke-test orders.

# Visitor Order Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every accepted OKX Demo order immediately visible to its originating anonymous visitor and recoverable in the same browser for 30 days, even when OKX account-wide list endpoints return empty.

**Architecture:** Split the four-hour access gate from a signed 30-day visitor identity. Persist a visitor-scoped Redis order snapshot and sorted index before returning a successful placement response, then refresh each known order through OKX `GET /trade/order` by `instId + ordId`; return the last snapshot with an explicit stale state when synchronization fails.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.7, Vitest, Testing Library, `@upstash/redis`, Node `crypto`, OKX V5 Demo REST API.

**Spec:** `docs/superpowers/specs/2026-08-31-visitor-order-ledger-design.md`

## Global Constraints

- Keep OKX API Key, Secret Key and Passphrase server-only; no credential may enter client JavaScript, responses or logs.
- `apx_demo_session` remains a four-hour access gate.
- `apx_visitor` is a signed, `HttpOnly`, `Secure` in production, `SameSite=Lax`, 30-day cookie.
- Redis order snapshots and visitor indexes expire after 30 days and list at most the newest 50 orders.
- Different visitors must never list, inspect fills for, or cancel one another's orders.
- OKX is authoritative when reachable; Redis is the visitor index, immediate display snapshot and outage fallback.
- Keep the existing 250 USDT per-order limit, visitor/IP rate limits and five-open-order limit.
- Add a global UTC-day cap of 100 accepted attempts and 10,000 USDT notional; exceeding either returns `429 global_demo_limit` without calling OKX.
- Do not add an account system, cross-device recovery, WebSocket private channels, production trading, deposits or withdrawals.
- Every behavior change follows a witnessed RED → GREEN test cycle and ends with a focused commit.

## File Structure

- `src/lib/demo-access/session.ts`: sign, serialize and verify both access-session and visitor cookies; bind `DemoSession` to `visitorId`.
- `src/app/api/demo/session/handlers.ts`: create/reuse a visitor identity when access is granted and preserve it when the access gate is cleared.
- `src/app/api/demo/session/route.test.ts`: API-level visitor creation, reuse, expiry and cookie-binding tests.
- `src/app/api/demo/_shared.ts`: require matching access and visitor cookies for every private Demo API call.
- `src/lib/okx-demo/contracts.ts`: define public sync metadata and the Redis snapshot contract.
- `src/lib/demo-access/store.ts`: own visitor order snapshots/indexes, open-order counting and the global daily budget in memory and Upstash Redis.
- `src/lib/demo-access/store.test.ts`: storage isolation, TTL/index and daily-budget contract tests.
- `src/lib/okx-demo/client.ts`: allow fills to be queried by `ordId` while retaining signed OKX REST requests.
- `src/lib/okx-demo/client.test.ts`: verify exact fill query signing and normalization.
- `src/lib/okx-demo/order-service.ts`: write-through placement, per-order reconciliation, visitor-scoped fills and snapshot-authorized cancellation.
- `src/lib/okx-demo/order-service.test.ts`: reproduce the production empty-list failure and cover sync/fallback/isolation/cancellation.
- `src/app/api/demo/_handlers.ts`: stop trusting a client-supplied instrument for cancellation and expose visitor ledger results.
- `src/app/api/demo/routes.test.ts`: verify route-to-service visitor identity propagation and instrument-independent cancellation.
- `src/components/trade/orders-screen.tsx`: render `pending`, `synced` and `stale` states plus corrected visitor-workspace copy.
- `src/components/trade/demo-account-screens.test.tsx`: UI regression tests for sync labels and empty visitor state.

---

### Task 1: Persistent Visitor Identity Bound to the Access Gate

**Files:**
- Modify: `src/lib/demo-access/session.ts`
- Modify: `src/lib/demo-access/session.test.ts`
- Modify: `src/app/api/demo/session/handlers.ts`
- Modify: `src/app/api/demo/session/route.test.ts`
- Modify: `src/app/api/demo/_shared.ts`
- Modify: `src/app/api/demo/routes.test.ts`

**Interfaces:**
- Produces: `DEMO_VISITOR_COOKIE`, `DemoVisitor`, `createDemoVisitorCookie(visitor, secret, options)`, `verifyDemoVisitorCookie(value, secret, now)`.
- Changes: `DemoSession` becomes `{ sessionId: string; visitorId: string; expiresAt: number }`.
- Produces: `DemoApiDependencies.getSession(request)` returns a session only when both signed cookies are valid and contain the same `visitorId`.

- [ ] **Step 1: Write failing cookie and route tests**

Add tests that define the desired identity boundary:

```ts
const visitor = { visitorId: "visitor-12345678", expiresAt: now + 30 * 24 * 60 * 60 * 1000 };
const encoded = createDemoVisitorCookie(visitor, "secret", { secure: true, now });
expect(encoded).toContain("apx_visitor=");
expect(encoded).toContain("HttpOnly");
expect(verifyDemoVisitorCookie(cookieValue(encoded), "secret", now)).toEqual(visitor);
expect(verifyDemoVisitorCookie(`${cookieValue(encoded)}tampered`, "secret", now)).toBeNull();
```

In `route.test.ts`, assert that the first successful POST emits both cookies, a later POST with the existing visitor cookie reuses its `visitorId`, DELETE clears only `apx_demo_session`, and a session cookie paired with a different visitor cookie is rejected by `getSession`.

- [ ] **Step 2: Run tests and witness RED**

Run:

```bash
npm test -- src/lib/demo-access/session.test.ts src/app/api/demo/session/route.test.ts src/app/api/demo/routes.test.ts
```

Expected: FAIL because visitor-cookie exports do not exist and `DemoSession` has no `visitorId`.

- [ ] **Step 3: Implement visitor signing and session binding**

Use the same HMAC envelope as the session cookie but serialize cookie names explicitly:

```ts
export const DEMO_VISITOR_COOKIE = "apx_visitor";
export type DemoVisitor = { visitorId: string; expiresAt: number };
export type DemoSession = { sessionId: string; visitorId: string; expiresAt: number };

export function createDemoVisitorCookie(visitor: DemoVisitor, secret: string, options: CookieOptions) {
  return createSignedCookie(DEMO_VISITOR_COOKIE, visitor, secret, options);
}
```

In session POST, verify the incoming visitor cookie or create `{ visitorId: randomUUID(), expiresAt: now + VISITOR_DURATION_MS }`, put the same ID into the new four-hour session, and append two `Set-Cookie` values through a `Headers` instance. GET and `_shared.ts` must verify both cookies and compare IDs. DELETE must not clear `apx_visitor`.

- [ ] **Step 4: Run focused tests and witness GREEN**

Run the command from Step 2.

Expected: all selected tests PASS; tampered, expired or mismatched visitor cookies return unauthenticated responses.

- [ ] **Step 5: Commit**

```bash
git add src/lib/demo-access/session.ts src/lib/demo-access/session.test.ts src/app/api/demo/session/handlers.ts src/app/api/demo/session/route.test.ts src/app/api/demo/_shared.ts src/app/api/demo/routes.test.ts
git commit -m "feat: persist demo visitor identity"
```

### Task 2: Visitor Order Ledger Storage Contract

**Files:**
- Modify: `src/lib/okx-demo/contracts.ts`
- Modify: `src/lib/demo-access/store.ts`
- Modify: `src/lib/demo-access/store.test.ts`

**Interfaces:**
- Produces: `DemoOrderSyncState = "pending" | "synced" | "stale"`.
- Produces: `DemoOrderSnapshot = DemoOrder & { visitorId: string; syncState: DemoOrderSyncState; lastSyncedAt: number | null }`.
- Produces store methods:

```ts
saveVisitorOrder(snapshot: DemoOrderSnapshot, ttlSeconds: number): Promise<void>;
getVisitorOrder(ordId: string): Promise<DemoOrderSnapshot | null>;
listVisitorOrders(visitorId: string, limit: number): Promise<DemoOrderSnapshot[]>;
removeVisitorOrder(visitorId: string, ordId: string): Promise<void>;
countVisitorOpenOrders(visitorId: string): Promise<number>;
consumeGlobalDailyBudget(day: string, notionalCents: number, limits: { orders: number; notionalCents: number }, ttlSeconds: number): Promise<{ allowed: boolean }>;
```

- [ ] **Step 1: Write failing in-memory store tests**

Cover ordered retrieval, visitor isolation, replacement of a snapshot with a newer sync state, removal of a dirty index entry, open-order counting and both daily cap dimensions:

```ts
await store.saveVisitorOrder({ ...snapshot, visitorId: "visitor-a", updatedAt: 20 }, 300);
await store.saveVisitorOrder({ ...older, visitorId: "visitor-a", updatedAt: 10 }, 300);
await expect(store.listVisitorOrders("visitor-a", 50)).resolves.toEqual([snapshot, older]);
await expect(store.listVisitorOrders("visitor-b", 50)).resolves.toEqual([]);
```

Daily budget assertions must allow the first reservation, reject the 101st order, and independently reject a reservation that would exceed 1,000,000 cents.

- [ ] **Step 2: Run store tests and witness RED**

Run:

```bash
npm test -- src/lib/demo-access/store.test.ts
```

Expected: FAIL because visitor ledger methods and snapshot types do not exist.

- [ ] **Step 3: Implement memory and Redis ledgers**

Use `apx:order:{ordId}` for JSON snapshots and `apx:visitor-orders:{visitorId}` as a sorted set scored by `createdAt`. `listVisitorOrders` reads newest IDs with `zrange(..., { rev: true })`, loads snapshots, filters exact `visitorId`, and removes missing/mismatched members.

Use one Redis Lua script for the daily budget so order count and notional move atomically and rejected reservations do not mutate either counter:

```lua
local orders=tonumber(redis.call('GET',KEYS[1]) or '0')
local notional=tonumber(redis.call('GET',KEYS[2]) or '0')
if orders + 1 > tonumber(ARGV[1]) or notional + tonumber(ARGV[3]) > tonumber(ARGV[2]) then return 0 end
redis.call('INCR',KEYS[1]); redis.call('INCRBY',KEYS[2],ARGV[3])
redis.call('EXPIRE',KEYS[1],ARGV[4]); redis.call('EXPIRE',KEYS[2],ARGV[4])
return 1
```

Keep legacy owner methods temporarily so existing tests and a rollback remain possible; new service code stops writing them in Task 3.

- [ ] **Step 4: Run store tests and witness GREEN**

Run the command from Step 2.

Expected: all storage contract tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/okx-demo/contracts.ts src/lib/demo-access/store.ts src/lib/demo-access/store.test.ts
git commit -m "feat: add visitor order ledger store"
```

### Task 3: Write-Through Placement and Per-Order Reconciliation

**Files:**
- Modify: `src/lib/okx-demo/order-service.ts`
- Modify: `src/lib/okx-demo/order-service.test.ts`

**Interfaces:**
- Changes: `place(session, ...)` uses `session.visitorId` for idempotency, limits and snapshots.
- Changes: `listOrders(session): Promise<DemoOrderSnapshot[]>` reads Redis snapshots and calls `getOrder({ instrument, ordId })` for each.
- Produces: `global_demo_limit` in `ServiceErrorCategory`.
- Constructor gains injectable `now?: () => number` for deterministic snapshot and UTC-day tests.

- [ ] **Step 1: Write the production-regression test and witness RED**

The key test must reproduce the observed production state: account-level list methods return `[]`, but a placed order remains visible because the ledger contains it.

```ts
const placed = await service.place(sessionWithVisitor, input, "request-123", "ip-hash");
expect(client.listPendingOrders).not.toHaveBeenCalled();
expect(client.listOrderHistory).not.toHaveBeenCalled();
await expect(service.listOrders(sessionWithVisitor)).resolves.toEqual([
  expect.objectContaining({ ordId: placed.ordId, visitorId: sessionWithVisitor.visitorId, syncState: "synced" }),
]);
expect(client.getOrder).toHaveBeenCalledWith({ instrument: "ETH-USDT", ordId: placed.ordId });
```

Run:

```bash
npm test -- src/lib/okx-demo/order-service.test.ts -t "keeps an accepted order visible when account lists are empty"
```

Expected: FAIL because placement writes only a short session owner and listOrders depends on account-wide lists.

- [ ] **Step 2: Implement the minimal write-through ledger path**

After OKX accepts the order, build a `pending` snapshot from validated input and the receipt, save it before the `201` can be returned, then make a best-effort exact `getOrder`. Save a `synced` snapshot when it succeeds; retain `pending` if the immediate sync fails.

`listOrders` must load at most 50 visitor snapshots and reconcile each with bounded concurrency of five. A successful response with matching `clOrdId` becomes `synced`; an OKX error returns the saved snapshot as `stale`. A mismatched `clOrdId` is excluded and its visitor index member is removed.

- [ ] **Step 3: Run the regression test and witness GREEN**

Run the Step 1 command.

Expected: PASS, with no call to either account-wide list endpoint.

- [ ] **Step 4: Add failing tests for isolation, fallback and caps**

Add separate tests asserting:

- visitor B receives no snapshots owned by visitor A;
- an exact OKX timeout returns the snapshot with `syncState: "stale"` and unchanged `lastSyncedAt`;
- a successful exact sync updates status, filled amount and `lastSyncedAt`;
- five live snapshots block a sixth order for that visitor only;
- a rejected global budget reservation throws `{ category: "global_demo_limit" }` before `placeOrder` is called;
- idempotent replay remains scoped to the stable visitor across two different four-hour session IDs.

- [ ] **Step 5: Run new tests and witness RED**

```bash
npm test -- src/lib/okx-demo/order-service.test.ts
```

Expected: the newly added fallback, visitor and global-cap assertions FAIL until the complete service behavior exists.

- [ ] **Step 6: Complete service behavior and witness GREEN**

Use `visitorId` in rate keys and idempotency keys. Calculate notional cents from `amount * (limit price or trusted market reference price)` using validated decimal strings and reserve against constants `100` and `1_000_000`. Map the error in `_shared.ts` to HTTP 429 in Task 5.

Run the command from Step 5.

Expected: all order-service tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/okx-demo/order-service.ts src/lib/okx-demo/order-service.test.ts
git commit -m "feat: reconcile visitor orders by order id"
```

### Task 4: Visitor-Scoped Fills and Snapshot-Authorized Cancellation

**Files:**
- Modify: `src/lib/okx-demo/client.ts`
- Modify: `src/lib/okx-demo/client.test.ts`
- Modify: `src/lib/okx-demo/order-service.ts`
- Modify: `src/lib/okx-demo/order-service.test.ts`

**Interfaces:**
- Changes gateway method to `listFills(input?: { instrument?: TradableInstrument; ordId?: string }): Promise<DemoFill[]>`.
- Changes service method to `cancelOwnedOrder(session: DemoSession, ordId: string): Promise<DemoCancelReceipt>`.

- [ ] **Step 1: Write failing client and service tests**

Assert that `listFills({ instrument: "ETH-USDT", ordId: "271828" })` signs and requests:

```text
/api/v5/trade/fills?instType=SPOT&instId=ETH-USDT&ordId=271828
```

Service tests must create one visitor snapshot and assert only its fills are returned. Cancellation tests must prove another visitor is rejected, the stored `instrument` is passed to `getOrder` and `cancelOrder`, and no client-supplied instrument participates in authorization.

- [ ] **Step 2: Run tests and witness RED**

```bash
npm test -- src/lib/okx-demo/client.test.ts src/lib/okx-demo/order-service.test.ts
```

Expected: FAIL because the client cannot filter fills by order ID and cancellation requires an instrument argument.

- [ ] **Step 3: Implement exact fill queries and snapshot authorization**

For `filled` and `partially_filled` visitor snapshots, query fills with the stored instrument and order ID, then retain only rows whose `ordId` and `clOrdId` match the snapshot. Deduplicate by `tradeId` and sort descending.

For cancellation, load the snapshot by `ordId`, verify `snapshot.visitorId === session.visitorId`, confirm the exact OKX order still matches `clOrdId`, cancel using `snapshot.instrument`, then save an updated canceled/synced snapshot.

- [ ] **Step 4: Run tests and witness GREEN**

Run the Step 2 command.

Expected: all selected tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/okx-demo/client.ts src/lib/okx-demo/client.test.ts src/lib/okx-demo/order-service.ts src/lib/okx-demo/order-service.test.ts
git commit -m "feat: isolate demo fills and cancellation"
```

### Task 5: Demo API Integration and Safe Error Mapping

**Files:**
- Modify: `src/app/api/demo/_shared.ts`
- Modify: `src/app/api/demo/_handlers.ts`
- Modify: `src/app/api/demo/routes.test.ts`

**Interfaces:**
- `DemoTradingService.listOrders` returns `DemoOrderSnapshot[]`.
- `DemoTradingService.cancelOwnedOrder` accepts `(session, ordId)` only.
- `global_demo_limit` maps to HTTP `429` and `{ code: "global_demo_limit" }`.

- [ ] **Step 1: Write failing route tests**

Add tests that pass a valid visitor-bound session through GET/POST, assert a service `global_demo_limit` becomes 429, and assert cancel calls:

```ts
expect(service.cancelOwnedOrder).toHaveBeenCalledWith(session, "271828");
```

The request body may contain a forged `instrument`; the handler must ignore it because the server snapshot is authoritative.

- [ ] **Step 2: Run tests and witness RED**

```bash
npm test -- src/app/api/demo/routes.test.ts
```

Expected: FAIL because route types and cancellation still require the parsed client instrument.

- [ ] **Step 3: Update handlers and safe error mapping**

Remove cancellation-body parsing, retain same-origin and order-ID validation, call `cancelOwnedOrder(session, orderId)`, update service types to snapshots, and map `global_demo_limit` to 429 without adding sensitive diagnostic values.

- [ ] **Step 4: Run tests and witness GREEN**

Run the Step 2 command.

Expected: all Demo API route tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/demo/_shared.ts src/app/api/demo/_handlers.ts src/app/api/demo/routes.test.ts
git commit -m "feat: expose visitor demo ledger api"
```

### Task 6: Order Sync States and Visitor Workspace UI

**Files:**
- Modify: `src/components/trade/use-demo-account.ts`
- Modify: `src/components/trade/orders-screen.tsx`
- Modify: `src/components/trade/demo-account-screens.test.tsx`

**Interfaces:**
- The orders API returns `DemoOrderSnapshot[]` with `syncState` and `lastSyncedAt`.
- Existing reload and cancel callbacks remain user-facing interfaces.

- [ ] **Step 1: Write failing UI tests**

Render three snapshots and assert the corresponding copy:

```ts
expect(screen.getByText("正在同步 OKX")).toBeInTheDocument();
expect(screen.getByText(/上次同步于/)).toBeInTheDocument();
expect(screen.getByText("当前访客工作区")).toBeInTheDocument();
```

Add an authenticated empty response test asserting “尚无个人模拟订单” plus a link/button to the market page. Keep the existing controlled-access and shared-balance tests.

- [ ] **Step 2: Run UI tests and witness RED**

```bash
npm test -- src/components/trade/demo-account-screens.test.tsx
```

Expected: FAIL because sync metadata and visitor-workspace copy are not rendered.

- [ ] **Step 3: Implement sync labels and empty state**

Add a compact sync label inside each order card:

- `pending`: “正在同步 OKX”
- `stale`: “上次同步于 HH:mm” and a “刷新状态” button using `account.reload`
- `synced`: no warning label

Change the footer copy to “底层使用共享 OKX Demo 虚拟账户，订单仅展示在当前访客工作区。” Add the personal empty state only after the API has returned `ready`.

- [ ] **Step 4: Run UI tests and witness GREEN**

Run the Step 2 command.

Expected: all selected component tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/trade/use-demo-account.ts src/components/trade/orders-screen.tsx src/components/trade/demo-account-screens.test.tsx
git commit -m "feat: show demo order sync state"
```

### Task 7: Full Verification, Production Rollout and Evidence Cleanup

**Files:**
- Modify: `src/lib/okx-demo/order-service.ts` only if the temporary `Demo order visibility` account-list diagnostic remains.
- Modify: `README.md` to describe the visitor workspace, 30-day browser persistence, shared virtual balance and no-real-funds guarantee.

**Interfaces:**
- No new runtime interface; this task verifies the complete feature and removes obsolete diagnostics.

- [ ] **Step 1: Remove obsolete account-list diagnostics and update README**

Delete the temporary `Demo order visibility` log because account-wide list endpoints are no longer the main path. Document that visitors share one server-side OKX Demo credential but receive isolated application workspaces; clarify that clearing cookies creates a new workspace and that no real assets, deposits or withdrawals are involved.

- [ ] **Step 2: Run the full verification gate**

```bash
npm test
npm run lint
npm run typecheck
npm run build
git diff --check
```

Expected: all Vitest files pass with zero failures; ESLint and TypeScript exit 0; Next production build completes; diff check prints nothing. Restore any generated-only `next-env.d.ts` path change before committing.

- [ ] **Step 3: Commit documentation and cleanup**

```bash
git add README.md src/lib/okx-demo/order-service.ts
git commit -m "docs: explain visitor demo workspaces"
```

- [ ] **Step 4: Push and deploy production**

```bash
git push origin main
vercel deploy --prod --yes
```

Expected: Vercel returns `readyState: READY` and aliases the deployment to `https://apex-ledger-h5.vercel.app`.

- [ ] **Step 5: Verify the production acceptance path**

Using the existing browser session:

1. Enter the access code if required.
2. Place one small BTC-USDT limit order.
3. Confirm the receipt page shows an OKX order ID.
4. Open `/orders` and verify the order appears even if the account-list diagnostics would previously have been empty.
5. Refresh `/orders` and verify the same order remains.
6. Clear only the access session through the app, re-enter the code, and verify the order remains because `apx_visitor` was preserved.
7. Open an incognito browser and verify it cannot see or cancel the first visitor's order.

Do not paste Cookie, API keys, Redis tokens, access codes or full curl commands into logs or chat. Report only HTTP status, safe error code and visible UI outcome.

- [ ] **Step 6: Record rollout evidence**

Capture the production deployment ID, commit SHA, test totals and the four acceptance outcomes: immediate visibility, refresh persistence, re-authentication persistence and cross-visitor isolation. If any outcome fails, stop and return to systematic debugging before claiming completion.

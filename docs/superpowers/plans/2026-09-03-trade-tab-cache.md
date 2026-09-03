# Trade Tab Cache and Keep-Alive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate visible reloads when switching trade tabs while retaining controlled background freshness.

**Architecture:** Retain mounted tab panels for UI state and WebSocket continuity. Move finite REST and AI insight requests to TanStack Query with instrument/timeframe cache keys and explicit freshness policies.

**Tech Stack:** React 19, Next.js 16, TypeScript, TanStack Query v5, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/2026-09-03-trade-tab-cache-design.md`

## Global Constraints

- Market and order-book components must not remount during tab changes.
- AI requests remain disabled until the AI tab is first selected.
- WebSocket order-book data remains outside TanStack Query.
- Cached values render immediately while stale data revalidates in the background.
- No new state-management dependency is introduced.

---

### Task 1: Retain Trade Tab Panels

**Files:**
- Modify: `src/components/trade/trade-screen.tsx`
- Test: `src/components/trade/trade-screen.test.tsx`

**Interfaces:**
- Consumes: existing `TradeMarketPanel`, `OrderBookCard`, `TradeInstrumentInfo`, `AICopilotPanel`
- Produces: lazily mounted, retained `tabpanel` elements selected by `activeTab`

- [ ] Write a test that captures the market panel DOM node, switches to AI and back, and proves the same node remains mounted without additional market or order-book requests.
- [ ] Run the focused trade-screen test and verify it fails because the market panel is currently removed.
- [ ] Replace conditional panel destruction with retained panels; lazily mount information and AI after their first selection.
- [ ] Run the focused test and verify it passes.

### Task 2: Cache Ticker and Candle REST Data

**Files:**
- Modify: `src/components/trade/use-trade-market.ts`
- Modify: `src/components/trade/trade-market-panel.test.tsx`
- Modify: `src/components/trade/trade-screen.test.tsx`

**Interfaces:**
- Consumes: `QueryClientProvider`, market route response contracts and `ChartPeriod`
- Produces: `useTradeMarket(pair)` with the existing return shape backed by `useQuery`

- [ ] Add a test wrapper with a real `QueryClient` and a test that remounts the panel within the freshness window without repeating ticker/candle fetches.
- [ ] Run the focused market-panel test and verify the new cache test fails.
- [ ] Implement ticker and candle queries with the cache policy in the spec, `placeholderData`, explicit retry and fallback derivation.
- [ ] Preserve the existing `retry`, loading, refreshing, source and error interface.
- [ ] Run market and trade component tests and verify they pass.

### Task 3: Cache Lazy AI Insight

**Files:**
- Modify: `src/features/ai/use-trading-copilot.ts`
- Modify: `src/features/ai/use-trading-copilot.test.tsx`

**Interfaces:**
- Consumes: `requestInsight`, `instrument`, `timeframe`, `enabled`
- Produces: the existing copilot return shape with query-cached automatic insight and locally controlled chat

- [ ] Add a real QueryClient wrapper test that disables and re-enables a fresh insight query and proves only one insight request occurs.
- [ ] Run the focused hook test and verify it fails under the current effect-based implementation.
- [ ] Replace automatic insight effect state with `useQuery` using the AI cache policy; preserve AbortSignal forwarding and current chat cancellation logic.
- [ ] Run the focused AI and trade tests and verify they pass.

### Task 4: Verify and Deliver

**Files:**
- Modify only files required by failures found during verification.

**Interfaces:**
- Consumes: completed Tasks 1–3
- Produces: verified production build and deployed `main`

- [ ] Run `npm test` and require all tests to pass.
- [ ] Run `npm run lint`, `npm run typecheck`, and `npm run build`.
- [ ] Verify the 390px mobile flow by switching 行情 → AI 洞察 → 行情 and checking that no loading skeleton returns.
- [ ] Review the diff for unrelated files and whitespace errors.
- [ ] Commit the scoped files, push `main`, deploy a clean Git archive to Vercel Production, and confirm `READY`.

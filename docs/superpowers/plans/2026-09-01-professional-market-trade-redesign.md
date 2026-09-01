# Professional Market And Trade Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign both market overview and spot trade detail into a cohesive professional mobile terminal without changing the live-data and paper-trading behavior.

**Architecture:** Keep provider hooks and high-frequency order-book state untouched. Reshape presentation in focused market/trade components, add a standalone AI signal type contract, and express the selected reference hierarchy through the existing Tailwind component layer.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Phosphor Icons, Lightweight Charts, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-01-professional-market-trade-redesign.md`

## Global Constraints

- Preserve live ticker, candle, market overview, and OKX `books5` order-book data paths.
- Main UI uses neutral `LIVE`/`DEMO` states and does not expose upstream provider branding.
- Spot instruments do not display mark price or open interest.
- AI signals are not fabricated; the entry is explicitly disabled and labelled `即将上线`.
- Do not add dependencies or new network requests.

---

### Task 1: Trade Detail Information Architecture

**Files:**
- Modify: `src/components/trade/trade-market-panel.test.tsx`
- Modify: `src/components/trade/trade-screen.test.tsx`
- Modify: `src/components/trade/trade-market-panel.tsx`
- Modify: `src/components/trade/trade-screen.tsx`
- Create: `src/lib/market-data/ai-signals.ts`

**Interfaces:**
- Consumes: `TradingPairConfig`, `MarketTicker`, existing `useTradeMarket` and `useLiveOrderBook` APIs.
- Produces: `AISignal`, instrument navigation, disabled AI tab, asymmetric spot quote summary, unchanged price callback.

- [ ] **Step 1: Write the failing component tests**

Assert that the trade screen exposes an instrument heading, `现货`, disabled `AI 信号`, favourite action, neutral `实时行情`, four spot metrics, and no provider/derivatives labels.

- [ ] **Step 2: Run focused tests to verify RED**

Run: `npm test -- src/components/trade/trade-market-panel.test.tsx src/components/trade/trade-screen.test.tsx`

Expected: FAIL because the instrument header, AI state, and neutral presentation do not exist.

- [ ] **Step 3: Implement the minimum semantic structure**

Add the AI contract, move pair identity into the screen header, create the page tab navigation, and reshape quote metrics without modifying data hooks.

- [ ] **Step 4: Run focused tests to verify GREEN**

Run: `npm test -- src/components/trade/trade-market-panel.test.tsx src/components/trade/trade-screen.test.tsx`

Expected: PASS.

### Task 2: Compact Market Overview

**Files:**
- Modify: `src/components/markets/market-screen.test.tsx`
- Modify: `src/components/markets/market-screen.tsx`
- Modify: `src/components/ui.tsx`

**Interfaces:**
- Consumes: `OverviewMarket[]`, existing filter/category state and `MarketDestination` link boundary.
- Produces: active market-mode tabs, a compact mover rail, neutral freshness status, and dense asset rows.

- [ ] **Step 1: Write the failing market behavior tests**

Assert that `自选` is selected, `现货` and `涨幅榜` exist, the mover rail has three items, and upstream provider names are absent after a live response.

- [ ] **Step 2: Run focused test to verify RED**

Run: `npm test -- src/components/markets/market-screen.test.tsx`

Expected: FAIL because the market-mode tabs and neutral labels do not exist.

- [ ] **Step 3: Implement the compact overview**

Add mode tabs, replace source copy, restructure the mover cards, and remove row-level provider badges while preserving query/category behavior.

- [ ] **Step 4: Run focused test to verify GREEN**

Run: `npm test -- src/components/markets/market-screen.test.tsx`

Expected: PASS.

### Task 3: Responsive Visual System

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/trade/candlestick-chart.tsx`

**Interfaces:**
- Consumes: semantic class names introduced by Tasks 1 and 2.
- Produces: compact 390px mobile layout, shorter chart canvas, horizontal mover rail, and responsive metrics.

- [ ] **Step 1: Add a failing chart-height behavior test**

Assert through the chart-library boundary that resizing respects the actual compact container height rather than forcing 320px.

- [ ] **Step 2: Run the test to verify RED**

Run: `npm test -- src/components/trade/trade-market-panel.test.tsx`

Expected: FAIL under the existing 320px minimum behavior.

- [ ] **Step 3: Apply measured styles and chart sizing**

Use existing design tokens, 44px minimum touch targets for primary controls, a 214–236px candle viewport, aligned metric columns, and overflow-safe tabs.

- [ ] **Step 4: Run focused tests to verify GREEN**

Run: `npm test -- src/components/trade/trade-market-panel.test.tsx src/components/markets/market-screen.test.tsx`

Expected: PASS.

### Task 4: Full Verification And Visual QA

**Files:**
- Modify: `design-qa.md`
- Create: `trade-professional-390x844.png`
- Create: `market-professional-390x844.png`

**Interfaces:**
- Consumes: completed UI and selected user screenshots.
- Produces: reproducible verification evidence and a passing design QA report.

- [ ] **Step 1: Run automated verification**

Run: `npm test && npm run typecheck && npm run lint && npm run build`

Expected: all commands exit 0 with no test failures or lint errors.

- [ ] **Step 2: Capture both routes at 390x844**

Open `/markets` and `/trade/btc-usdt`, exercise tabs and filtering, inspect console output, and save screenshots.

- [ ] **Step 3: Compare source and implementation**

Open the provided references and captured screens together; record alignment, hierarchy, spacing, typography, interaction, and accessibility findings in `design-qa.md`.

- [ ] **Step 4: Fix blocking QA issues and repeat**

Fix every P0/P1/P2 finding, recapture both screens, and set `final result: passed` only after the same-state comparison succeeds.

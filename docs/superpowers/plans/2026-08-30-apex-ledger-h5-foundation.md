# Apex Ledger H5 Foundation Implementation Plan

> **For Codex:** Execute in small verified steps; keep all financial actions in simulation mode.

**Goal:** Turn the eight supplied Google Stitch screens into a coherent, responsive Next.js interview demo with working navigation and a safe paper-trading confirmation flow.

**Architecture:** Use Next.js App Router with a thin shared mobile shell and route-level screens. Keep display data in typed local fixtures and calculations in pure functions. User-visible trading actions produce only paper-order state; wallet connection is an authentication placeholder and never requests a transaction.

**Tech Stack:** Next.js, React, TypeScript, CSS custom properties, Phosphor Icons, Vitest, Testing Library.

---

### Task 1: Repository and quality baseline

**Files:** `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `src/test-setup.ts`

1. Add scripts for dev, build, test, lint, and typecheck.
2. Install only the minimum UI and test dependencies.
3. Run the test command once and confirm the missing implementation fails.

### Task 2: Trading domain helpers

**Files:** `src/lib/trading.test.ts`, `src/lib/trading.ts`, `src/lib/data.ts`

1. Test case-insensitive market filtering.
2. Test deterministic paper-order totals and fee rounding.
3. Test nested-route navigation resolution.
4. Implement the smallest typed helpers that pass.

### Task 3: Shared visual system and navigation

**Files:** `src/app/globals.css`, `src/app/layout.tsx`, `src/components/app-shell.tsx`, `src/components/ui.tsx`

1. Encode Stitch colors, spacing, typography, radii and state colors as CSS variables.
2. Build the sticky application header, PAPER LIVE status badge and four-item bottom navigation.
3. Provide reusable cards, asset marks, pills, tabs and compact chart primitives.

### Task 4: Core discovery and trade route

**Files:** `src/app/markets/page.tsx`, `src/app/trade/btc-usdt/page.tsx`, `src/components/market-screen.tsx`, `src/components/trade-screen.tsx`

1. Implement working market search and category filters with realistic fixture data.
2. Implement Buy/Sell and Limit/Market selectors, amount controls and order preview.
3. Open the safe paper-order confirmation route from the main CTA.

### Task 5: Confirmation, orders and portfolio

**Files:** `src/app/trade/btc-usdt/confirm/page.tsx`, `src/app/orders/page.tsx`, `src/app/portfolio/page.tsx`, `src/app/portfolio/btc/page.tsx`

1. Replace Stitch's mainnet signature screen with an explicit paper-order confirmation.
2. Implement Open/History/Fills tabs and responsive order cards.
3. Implement portfolio overview, balance masking and BTC detail route.

### Task 6: Identity and settings

**Files:** `src/app/connect-wallet/page.tsx`, `src/app/settings/page.tsx`

1. Show SIWE-only language and wallet-provider choices with mock connection feedback.
2. Normalize branding to Apex Ledger.
3. Exclude KYC, withdrawals, API keys and any promise of real custody in this phase.

### Task 7: Documentation and verification

**Files:** `README.md`, `docs/design-handoff.md`, `docs/technical-design.md`

1. Document routes, semantic corrections, adapters and phase-two integration seams.
2. Run tests, typecheck, lint and production build.
3. Start the local app and visually compare every route against its Stitch reference at a matching mobile viewport.
4. Fix visible layout or interaction defects and repeat verification.

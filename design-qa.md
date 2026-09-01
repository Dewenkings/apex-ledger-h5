# Trade Order Book And Order Sheet — Design QA

## Evidence

- Source visual truth: `/var/folders/2m/y3t58xpj3td5m5fcv39dfk8w0000gn/T/codex-clipboard-f4f9a60c-e1d1-4f20-a14a-e347d2cb839a.jpg`
- Implementation default state: `/Users/devinding/Documents/apex-ledger-h5/trade-orderbook-mobile-final-375x815.png`
- Implementation focused order-book state: `/Users/devinding/Documents/apex-ledger-h5/trade-orderbook-focused-final-375x815.png`
- Implementation buy-sheet state: `/Users/devinding/Documents/apex-ledger-h5/trade-order-sheet-buy-final-375x815.png`
- Full-view comparison: `/Users/devinding/Documents/apex-ledger-h5/trade-design-qa-full-comparison.png`
- Focused comparison: `/Users/devinding/Documents/apex-ledger-h5/trade-design-qa-orderbook-comparison.png`
- Browser route: `http://localhost:4173/trade/btc-usdt`
- Browser viewport: 375 × 815 CSS px, device scale factor 1
- Source pixels: 1206 × 2622; normalized to 375 × 815 for full-view comparison
- Implementation pixels: 375 × 815
- State: dark theme, BTC-USDT market tab, live public five-level order book, paper-order action dock

The source is a layout reference rather than a brand or pixel-fidelity target. Its light palette, exchange navigation, typography, and exchange-specific controls are intentionally not copied. The accepted product direction preserves Apex Ledger's dark palette and paper-trading boundary while borrowing the two-sided book hierarchy and persistent trade action.

## Full-View Comparison

The normalized side-by-side image confirms the intended information sequence: market/chart context, order-book region, then a persistent trade action. Apex Ledger uses less navigation chrome and a compact chart card, while the source includes several product tabs and indicators that are outside this task.

## Focused Region Comparison

The focused comparison confirms the four-column bid/ask scan pattern, visible-depth ratio, green/red semantic split, and compact row rhythm. The implementation intentionally uses five paired rows because the validated OKX `books5` snapshot supplies five levels per side. It adds one midpoint/spread summary and one sequence identifier without repeating midpoint blocks.

## Required Fidelity Surfaces

- Fonts and typography: existing Inter/system sans and JetBrains Mono stacks are preserved. Prices use the mono stack at readable 9–13px sizes; headings and action labels retain the app's established hierarchy.
- Spacing and layout rhythm: the book fits in one compact card; five 28px rows avoid the previous multi-screen depth list. The 66px action dock sits above the 82px app navigation, and the trade screen reserves matching bottom clearance.
- Colors and visual tokens: existing `primary`, `danger`, `surface-raised`, `line`, and `muted` tokens are used. Depth fills stay at 6% opacity so numbers remain primary.
- Image quality and asset fidelity: the target region has no raster assets. Existing Phosphor icons are retained; no placeholder or handcrafted asset replaces a reference image.
- Copy and content: user-facing copy is concise and exchange-neutral. The source name is not exposed; the product displays “订单簿”, “实时同步”, and a single paper-trading disclosure.

## Primary Interactions Tested

- Buy trigger opens a modal dialog labelled “买入 BTC”.
- Sell trigger opens a side-specific dialog and produces a `side=sell` confirmation URL.
- Limit/market switching updates price editability and confirmation parameters.
- Quantity input updates the confirmation URL.
- Escape closes the sheet and returns focus to the originating action.
- Dialog focus cycles within the sheet.
- Live book renders five paired bid/ask rows and updates its sequence.
- Browser console error log: empty.

## Comparison History

### Iteration 1

- [P2] Persistent action dock could obscure the final disclosure/book content at maximum scroll.
  - Fix: added 66px trade-screen bottom clearance in addition to the app shell navigation clearance.
  - Post-fix evidence: `trade-orderbook-focused-final-375x815.png` shows the full card, disclosure, action dock, and navigation without inaccessible content.
- [P2] Browser-default blue focus outline drifted from the product's green interaction token.
  - Fix: added a consistent primary-color `:focus-visible` outline for icon, trade, and submit actions.
  - Post-fix evidence: `trade-order-sheet-buy-final-375x815.png`.

### Iteration 2

No actionable P0/P1/P2 differences remain. Remaining differences from the source—dark theme, five levels, application navigation, and absence of exchange-specific controls—are intentional product constraints.

## Follow-up Polish

- [P3] A future order-book package could expose an optional 10-level incremental `books` adapter behind the same presentation component.
- [P3] When a recent-trades module exists, “订单簿 / 成交” can become a functional tab pair; it should not be added as inactive chrome now.

final result: passed

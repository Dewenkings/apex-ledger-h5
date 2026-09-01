# Market Screen Design QA

- Source visual truth:
  - Current implementation baseline: `/var/folders/2m/y3t58xpj3td5m5fcv39dfk8w0000gn/T/codex-clipboard-c55c2beb-9167-430d-872b-7f79720f812d.png`
  - Density and hierarchy reference: `/var/folders/2m/y3t58xpj3td5m5fcv39dfk8w0000gn/T/codex-clipboard-a5f56e6a-b899-47fa-b16e-36312e05877d.png`
- Implementation screenshot: `/Users/devinding/Documents/apex-ledger-h5/market-implementation-390x844.png`
- Combined comparison: `/Users/devinding/Documents/apex-ledger-h5/market-design-comparison.png`
- Viewport: 390 × 844 CSS px, device scale factor 1
- Source pixels: baseline 748 × 3468 (top viewport normalized to 390 × 844); reference 296 × 800 (normalized by height to 312 × 844)
- Implementation pixels: 390 × 844
- State: dark theme, mobile market overview, demo-data fallback visible, All category selected

## Full-view comparison

The combined comparison shows the original implementation, compact reference, and revised implementation in one image. The revised screen keeps the product's Chinese copy, brand, data-source disclosure, favorite links, filtering, and fixed bottom navigation while adopting the reference's compact hierarchy and three-column asset table.

## Required fidelity surfaces

- Fonts and typography: Existing project font tokens are preserved. The revised hierarchy has one 20px page heading, readable 13px asset labels, 12px prices, and 9–10px metadata. Unlike the reference, the title is not clipped and core UI copy is not reduced below a readable mobile size.
- Spacing and layout rhythm: Page padding remains 16px. Favorite cards measure 94px high, asset rows measure 64px high, and the 390px viewport has no horizontal overflow. Cards and the asset table use consistent 12–14px radii and 8–18px section rhythm.
- Colors and visual tokens: Existing charcoal surfaces, low-contrast borders, green positive state, red negative state, amber warning state, and muted supporting copy are preserved. Contrast is consistent with the rest of Apex Ledger.
- Image quality and asset fidelity: No new raster assets were needed. Existing asset marks and Phosphor icons are reused; sparklines remain crisp SVG data visualizations already owned by the codebase.
- Copy and content: Repeated marketing copy was removed. `行情概览`, live/demo source labels, update state, search, favorites, categories, prices, and 24H change remain accurate and visible.

## Focused-region comparison

A separate crop was not required because the favorite-card and asset-table regions are legible at original size in the 1092 × 844 combined comparison. Browser measurements were used to verify the exact card and row heights.

## Comparison history

1. Initial revised capture: favorite cards reached the 94px target, but asset rows measured 81px because the source label occupied a third text line.
2. Fix: moved the source label beside the asset symbol while retaining its semantic demo/live disclosure.
3. Post-fix evidence: the final 390 × 844 capture shows 64px asset rows, 94px favorite cards, a 390px document width, working category selection, and no console errors.

## Findings

No actionable P0, P1, or P2 differences remain. The visible Next.js development indicator is development-only browser chrome and is not part of the production build.

## Follow-up polish

- P3: When live market data is available, capture a second screenshot without the demo fallback warning to document the denser normal state.

final result: passed

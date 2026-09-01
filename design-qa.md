# Professional Market And Trade Redesign QA

## Evidence

- Trade source visual truth: `/var/folders/2m/y3t58xpj3td5m5fcv39dfk8w0000gn/T/codex-clipboard-da4fbaca-3db0-4cad-a498-c3a358313228.jpg`
- Market source visual truth: `/var/folders/2m/y3t58xpj3td5m5fcv39dfk8w0000gn/T/codex-clipboard-a5f56e6a-b899-47fa-b16e-36312e05877d.png`
- Trade implementation capture: `/Users/devinding/Documents/apex-ledger-h5/trade-professional-430x844.png`
- Market implementation capture: `/Users/devinding/Documents/apex-ledger-h5/market-professional-430x844.png`
- Trade combined comparison: `/Users/devinding/Documents/apex-ledger-h5/trade-professional-comparison.png`
- Market combined comparison: `/Users/devinding/Documents/apex-ledger-h5/market-professional-comparison.png`
- Browser: Codex in-app browser at `http://127.0.0.1:3000`
- State: dark theme; BTC/USDT spot; 4H selected; AI signals disabled as `即将上线`; live public `books5` depth; ticker/candles and market overview in clearly labelled demo fallback state because the REST providers were unavailable during capture.

## Viewport And Normalization

- Browser content: 1280 × 720 CSS px at device scale factor 2. The existing app shell renders a 430 CSS-px mobile surface centered in the desktop browser.
- Browser viewport override was requested at 390 × 844 but the in-app browser retained its 1280 × 720 surface. QA therefore used the application's existing 430px mobile shell, verified its full `clientWidth`/`scrollWidth` as 428/428, and found no horizontal overflow.
- Full-page captures were 1280 × 1179 px for markets and 1280 × 1776 px for trade. The centered app surface was captured at half-density, cropped to 216 × 422 px, then normalized to 430 × 844 px with Lanczos scaling for equal-size comparison.
- Trade source was scaled proportionally to 430px width and top-cropped to 430 × 844. Market source was normalized from 296 × 800 to 430 × 844.

## Full-View Comparison

- Trade: the reference's instrument-first hierarchy is preserved—back navigation, pair identity, product tabs, asymmetric price/metrics summary, period controls, primary chart, and indicator rail. The implementation intentionally uses the existing dark terminal tokens and a shorter chart requested by the user.
- Markets: the reference's compact overview rhythm is preserved—search, favourites/movers, category chips, and dense asset table. The implementation adds a product-mode tab row and retains the Apex Ledger paper-trading boundary.

## Focused Region Comparison

The 860 × 844 combined images keep each 430px source and implementation side by side at readable scale. Separate focused crops were not needed: the trade header/quote/chart and market header/mover/table regions are all legible in the combined comparisons.

## Required Fidelity Surfaces

- Fonts and typography: instrument and latest-price hierarchy are materially stronger than the previous four-cell card; monospaced numerals remain aligned; small metadata does not wrap or clip. Existing project fonts were retained to preserve system consistency.
- Spacing and layout rhythm: the trade quote uses a balanced 1.05/0.95 split, chart height is 214–236px, market movers fit in one three-column rail, and asset rows are reduced to 58px. Browser inspection found no horizontal overflow.
- Colors and tokens: the charcoal surface hierarchy, green buy/live state, red sell state, and amber fallback state remain consistent. Provider-neutral live/demo badges avoid introducing a new visual language.
- Image and icon quality: the screens contain no reference-specific raster assets. Existing Phosphor icons and chart-library canvas rendering remain sharp; no placeholder image assets or handcrafted SVG replacements were introduced.
- Copy and content: upstream provider branding is absent from primary quote, market, and depth UI. Spot-only metrics exclude mark price and open interest. AI is explicitly labelled `即将上线`, so the screen does not imply fabricated signals.

## Interaction And Runtime Evidence

- `涨幅榜` changed to `aria-selected="true"`.
- Search for `Polygon` reduced the visible market rows to one and kept POL visible.
- The 4H period control changed to `aria-pressed="true"`.
- Both the header AI action and AI tab returned `enabled: false`.
- The market/trade page shell reported equal client and scroll widths and `horizontalOverflow: false`.
- The browser console contained zero errors. It contained only the expected third-party Lit development-mode warning from the development build.

## Findings

No actionable P0, P1, or P2 differences remain after the first rendered comparison.

## Comparison History

- Initial rendered pass: no P0/P1/P2 issues. The intended differences from the source are the dark theme, shorter K-line, spot-only metrics, neutral data-provider presentation, and explicit paper-trading boundary; these are product requirements rather than drift.
- No visual fix iteration was required after the combined comparisons.

## Follow-up Polish

- P3: capture a second market screenshot when every REST provider is reachable so the demo fallback warning is absent and more rows appear above the fold.
- P3: connect the existing `MA/EMA/BOLL/VOL` presentation controls to real indicator series in a dedicated follow-up rather than implying partial indicator computation now.

final result: passed

# Mobile Trading Density — Design QA

## Evidence

- Market source visual: `/var/folders/2m/y3t58xpj3td5m5fcv39dfk8w0000gn/T/codex-clipboard-992cd3cd-ea9a-41ed-a2e2-aa8fdb52ea0f.png`
- Trade action source visual: `/var/folders/2m/y3t58xpj3td5m5fcv39dfk8w0000gn/T/codex-clipboard-60cebd7f-b775-4fa7-b0d7-9abc2c53da4c.png`
- Order-sheet source visual: `/var/folders/2m/y3t58xpj3td5m5fcv39dfk8w0000gn/T/codex-clipboard-8a9f3d2e-fb4b-4b64-82ac-8478fd55abc8.png`
- Market collapsed implementation: `/Users/devinding/Documents/apex-ledger-h5/market-search-collapsed-375x815.png`
- Market expanded implementation: `/Users/devinding/Documents/apex-ledger-h5/market-search-expanded-375x815.png`
- Trade action implementation: `/Users/devinding/Documents/apex-ledger-h5/trade-actions-compact-375x815.png`
- Buy-sheet implementation: `/Users/devinding/Documents/apex-ledger-h5/trade-buy-sheet-compact-375x815.png`
- Full market comparison: `/Users/devinding/Documents/apex-ledger-h5/market-search-design-comparison.png`
- Full trade-action comparison: `/Users/devinding/Documents/apex-ledger-h5/trade-actions-design-comparison.png`
- Focused order-sheet comparison: `/Users/devinding/Documents/apex-ledger-h5/trade-sheet-design-comparison.png`
- Browser routes: `http://localhost:4173/markets` and `http://localhost:4173/trade/btc-usdt`
- Browser viewport: 375 × 815 CSS px, device scale factor 1
- Source pixels: market 754 × 1122, action 850 × 1412, sheet 802 × 970, each supplied at 144 dpi
- Implementation pixels: 375 × 815 for each browser capture
- Focused normalization: source sheet resized to 375 × 454; implementation sheet crop (375 × 416) normalized to 375 × 454 for a same-width comparison
- States: dark theme; market search collapsed and expanded; BTC-USDT market view; buy and sell paper-order sheets

The supplied visuals describe the oversized regions to improve rather than a different brand target. The accepted direction keeps Apex Ledger's existing dark terminal language and data flow while reducing persistent UI weight.

## Full-View Comparison

The market comparison confirms that moving search into the header returns the entire former search block to market content. The collapsed header retains the product title, status, and a clear search affordance; the expanded state uses the full 343px content width without crowding the title.

The trade comparison confirms that the persistent action remains easy to find while no longer reading as a large promotional CTA. The dock is 351 × 58px with two 162.5 × 44px actions, preserving mobile tap targets while reducing its frame, padding, radius, and shadow.

## Focused Region Comparison

The focused sheet comparison confirms a denser vertical rhythm without changing order semantics. The implementation sheet is 375 × 416px; its two inputs are 40px high and its confirmation action is 44px high. Limit/market controls, amount presets, order summary, and the paper-trading disclosure remain visible in one viewport.

## Required Fidelity Surfaces

- Fonts and typography: the existing UI and mono stacks are preserved. Header search uses 12px input copy; dock actions use 11px bold labels; sheet hierarchy steps from 16px title to 11px numeric input and 8–10px support copy without wrapping.
- Spacing and layout rhythm: search no longer consumes a permanent 46px block plus margin. The trade dock drops from 66px to 58px, and the sheet uses tighter 6–10px vertical intervals while retaining clear grouping.
- Colors and visual tokens: existing primary, danger, surface, line, muted, and focus tokens remain unchanged. Reduced shadows keep semantic green/red color dominant without creating oversized glow fields.
- Image quality and asset fidelity: these regions contain no raster product assets. Existing Phosphor search and close icons are retained; no custom-drawn replacements or placeholders were introduced.
- Copy and content: current exchange-neutral labels and the explicit `PAPER LIVE` boundary remain. Search results still come from the existing public spot-market route; no data behavior was replaced with demo-only UI.

## Primary Interactions Tested

- Search icon opens the full-width header search and moves focus to the input.
- Escape closes search, clears the query, and restores focus to the search trigger.
- Search input still drives immediate local filtering and debounced public-market results.
- Buy and sell actions each open the correct side-specific modal dialog.
- Escape and the close action dismiss the order sheet and preserve focus behavior.
- Limit/market controls, amount presets, inputs, summary, and confirmation route remain available.
- Browser console errors: none. Two expected local-development warnings were observed (Lit development mode and the WalletConnect metadata URL using the normal port rather than the QA port).

## Comparison History

### Iteration 1

- [P2] The market search permanently consumed a large content block above the market movers.
  - Fix: replaced it with a 36px header trigger and a 40px full-width expanded search state.
  - Post-fix evidence: `market-search-collapsed-375x815.png` and `market-search-expanded-375x815.png`.
- [P2] The persistent buy/sell region had excessive height, width emphasis, radius, and shadow for an H5 trading tool.
  - Fix: reduced the dock to 58px, inset it 12px, and retained 44px actions with quieter styling.
  - Post-fix evidence: `trade-actions-compact-375x815.png`.
- [P2] The order sheet used near-full-screen vertical space and oversized field/action spacing.
  - Fix: compressed its header, tabs, fields, presets, summary, safety note, and confirmation action while preserving all order controls.
  - Post-fix evidence: `trade-buy-sheet-compact-375x815.png`.

### Iteration 2

No actionable P0/P1/P2 findings remain. A visible focus ring on keyboard-focused controls is intentional accessibility behavior rather than visual drift.

## Follow-up Polish

- [P3] If a native-style motion system is added later, the header search can use a short shared-axis expansion and the sheet can use a spring transition. Motion is omitted now to avoid adding a new runtime dependency for a density-only pass.

final result: passed

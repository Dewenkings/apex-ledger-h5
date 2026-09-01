# Professional Market And Trade Redesign

## Goal

Turn the market overview and spot trade detail into a cohesive, portfolio-grade mobile trading terminal while preserving the existing real market data, chart, paper-order, and OKX `books5` depth behavior.

## Visual Direction

Use a restrained, dark, data-dense terminal aesthetic. Borrow the reference application's information hierarchy, not its white theme, branding, derivatives-only fields, or unrelated product tabs.

## Market Overview

- Keep a compact Apex Ledger header and paper-trading boundary.
- Remove provider branding from the primary page chrome; expose only neutral live/demo freshness labels.
- Add product tabs: `自选`, `现货`, `涨幅榜`.
- Replace the three large stacked favourite cards with a single horizontal mover rail of three compact cards.
- Keep search and category filtering.
- Keep the full market table, but make rows denser and remove provider badges from every row.
- Preserve links for supported paper-trading pairs and non-link behavior for unsupported assets.

## Trade Detail

- Replace the generic centered brand header with an instrument header: back, pair name, `现货`, future AI entry, favourite, and paper boundary.
- Add page tabs: `行情`, disabled `AI 信号 · 即将上线`, and `信息`.
- Replace the 2x2 quote card with an asymmetric summary: large latest price/change on the left and 24H high, low, volume, and turnover on the right.
- Do not show derivatives-only mark price or open interest on spot instruments.
- Do not show the upstream provider name in primary quote UI.
- Keep the existing candle-period interaction and live chart, with a shorter chart viewport.
- Add an indicator rail (`MA`, `EMA`, `BOLL`, `VOL`) as a presentational, future-ready control; only `MA` is selected in this iteration.
- Preserve the real `books5` order book and paper-order form.

## AI Extension Contract

Define a UI-facing signal contract without fabricating signals:

```ts
type AISignal = {
  id: string;
  instrument: MarketInstrument;
  timeframe: ChartPeriod;
  side: "buy" | "sell" | "neutral";
  confidence: number;
  price: number;
  timestamp: number;
  explanation: string;
  modelVersion: string;
};
```

The current UI exposes the disabled `AI 信号` tab with an explicit `即将上线` status. Future work can use the contract for a signal-detail tab and chart markers without changing the market-data hooks.

## Accessibility And Performance

- Maintain semantic headings, navigation, tabs, buttons, disabled state, and existing loading/error announcements.
- Do not communicate positive/negative changes by color alone; retain direction icons and numeric signs/context.
- Keep live chart creation isolated from quote re-renders.
- Keep filtered market rows memoized and avoid adding new dependencies or network requests.
- Preserve the order-book request cadence and avoid moving high-frequency depth state into the whole trade screen.

## Verification

- Component tests cover the neutral source presentation, professional header, AI disabled state, metrics, market tabs, and compact mover rail.
- Existing market filtering, pair links, candle switching, order entry, and order-book tests remain green.
- Typecheck, lint, full tests, and production build pass.
- Mobile screenshots at 390x844 are compared against the provided references and recorded in `design-qa.md`.

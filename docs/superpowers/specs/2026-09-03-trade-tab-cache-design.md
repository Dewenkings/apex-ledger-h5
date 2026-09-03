# Trade Tab Cache and Keep-Alive Design

## Goal

Make switching between 行情、信息 and AI 洞察 immediate without destroying the chart, reconnecting the order-book WebSocket, or repeating fresh REST/AI requests unnecessarily.

## Architecture

- Keep the market panel mounted for the lifetime of the trade route. Mount information and AI panels lazily on first visit, then retain them and switch visibility with `hidden`.
- Use TanStack Query for request/response data: ticker, candles and AI insight. Keep the order book on its existing WebSocket lifecycle because it is a continuous stream rather than a cacheable REST resource.
- Preserve the last successful query data while revalidating in the background. Cache keys must include instrument and, where relevant, candle timeframe.

## Cache Policy

| Data | Query key | staleTime | gcTime |
|---|---|---:|---:|
| Ticker | `market,ticker,instrument` | 10 seconds | 10 minutes |
| Candles | `market,candles,instrument,period` | 30 seconds | 15 minutes |
| AI insight | `ai,insight,instrument,timeframe` | 60 seconds | 10 minutes |

All three disable focus refetch. Candles retain prior data while the next period loads. Explicit retry calls `refetch` and keeps the existing fallback behavior when all upstream sources fail.

## Behavioral Requirements

- Switching tabs must not remount the market panel or order book.
- Returning to a fresh cached query must not issue another request.
- AI remains lazy: no insight request before the first AI tab visit.
- AI chat response remains isolated by instrument and timeframe and is not treated as an automatic cache query.
- Leaving the trade route still unmounts the panels and closes the WebSocket.
- Hidden tab panels remain correctly associated with their tabs through ARIA attributes.

## Verification

- Component test proves market DOM identity survives tab changes and network call counts do not increase.
- Hook tests prove ticker/candle and AI cache freshness behavior.
- Full Vitest, ESLint, TypeScript and Next.js production build must pass.
- Mobile browser check verifies instant tab return without a loading skeleton.

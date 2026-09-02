# Apex Ledger AI Trading Copilot Design

## Goal

Add a TypeScript-only, context-aware AI market copilot to Apex Ledger. It must reuse the existing Nexus MCP market tools, expose evidence-backed market insights and conversational analysis, and keep model output completely separated from Demo Trading execution.

## Product scope

The trade page gains two connected experiences:

1. **AI market insight** — a compact, structured summary for the active instrument and timeframe.
2. **Ask AI** — a bottom-sheet conversation seeded with the active page context and suggested questions.

The first release supports market explanation, technical-risk explanation, pair comparison, and read-only order-impact education. It does not fetch news, claim causal news drivers, provide financial advice, or allow the model to submit/cancel orders.

## Architecture

```text
Trade page
  -> Next.js /api/ai/insight or /api/ai/chat
  -> LangGraph.js workflow
  -> MCP client over Streamable HTTP
  -> Nexus MCP server
  -> OKX public market APIs

LangGraph.js
  -> deterministic market metrics
  -> DeepSeek-compatible model adapter
  -> Zod validated response
  -> evidence, timestamp, data-quality, and disclaimer
```

All LLM and MCP calls execute server-side. `DEEPSEEK_API_KEY` and MCP credentials are never exposed through `NEXT_PUBLIC_*` variables.

## Workflow

The workflow uses explicit nodes rather than an unrestricted tool loop:

1. `validateContext` validates supported pair, timeframe, and input length.
2. `classifyIntent` selects `market_summary`, `risk_analysis`, `pair_comparison`, or `order_impact`.
3. `collectEvidence` invokes the minimum MCP tools required for that intent.
4. `calculateMetrics` derives deterministic trend, range position, realized volatility, volume ratio, and order-book imbalance.
5. `composeAnswer` asks the model to explain only supplied evidence.
6. `validateAnswer` parses Zod structured output and rejects unsupported claims.
7. `fallbackAnswer` returns deterministic metrics if MCP or model generation fails.

## MCP additions

Nexus keeps its existing five tools and adds:

- `get_market_context`: one bounded response combining ticker, recent candles, and order book.
- `get_technical_snapshot`: deterministic technical metrics computed from public OKX data.

Every new tool returns a versioned envelope containing `source`, `instrument`, `asOf`, `dataQuality`, `metrics`, and `warnings`. Inputs are normalized and restricted to spot `*-USDT` instruments and supported candle periods.

## Output contract

```ts
type AIInsight = {
  marketBias: "bullish" | "bearish" | "neutral";
  title: string;
  summary: string;
  keyFactors: string[];
  risks: string[];
  dataQuality: "high" | "medium" | "low";
  sources: Array<{ tool: string; source: "OKX"; asOf: string }>;
  disclaimer: string;
};
```

The UI uses `marketBias`; it must not label generated output as a buy/sell recommendation or display fabricated probability-style confidence.

## Safety and reliability

- MCP tools used by the Agent are read-only.
- Demo Trading credentials stay in the existing server-side order service.
- Agent output cannot call order submission or cancellation routes.
- Request timeout, abort propagation, one bounded retry, input-size limits, and per-session rate limiting apply.
- Model responses are schema-validated; invalid responses degrade to deterministic output.
- Every answer includes source tool names, data timestamp, and an informational-use disclaimer.
- No news or on-chain catalyst is mentioned unless a future evidence tool supplies it.

## UI behavior

The market tab renders an insight card below the order book and above the order ticket. Initial loading is user-visible and never blocks chart/order interactions. “Ask AI” opens a mobile bottom sheet with four contextual prompts and free-form input. The answer displays factors, risks, source tools, data time, and fallback status.

## Configuration

Required for live AI generation:

- `DEEPSEEK_API_KEY` — secret
- `DEEPSEEK_BASE_URL` — config, default `https://api.deepseek.com`
- `DEEPSEEK_MODEL` — config
- `NEXUS_MCP_URL` — config
- `NEXUS_MCP_TOKEN` — secret when remote MCP authentication is enabled

Without `DEEPSEEK_API_KEY`, deterministic insight remains available and the UI clearly labels AI explanation as unavailable.

## Verification

- Nexus unit tests cover normalization, metric calculations, envelope output, insufficient candles, and upstream errors.
- Apex unit tests cover intent routing, MCP mapping, schema validation, fallback behavior, rate limiting, and API validation.
- Component tests cover insight loading/success/fallback and opening/submitting the chat sheet.
- Full `test`, `typecheck`, `lint`, and production builds must pass in both repositories.

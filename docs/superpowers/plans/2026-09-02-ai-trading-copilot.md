# Apex Ledger AI Trading Copilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript LangGraph.js trading copilot backed by the existing Nexus MCP server, with structured insights, conversational questions, evidence display, and strict read-only safety boundaries.

**Architecture:** Nexus adds deterministic aggregate market tools. Apex connects to Nexus through a server-only MCP client, runs an explicit LangGraph.js workflow, validates model output with Zod, and renders insight/chat UI with deterministic fallback.

**Tech Stack:** Next.js 16, TypeScript, React 19, LangGraph.js, MCP TypeScript SDK v1, Zod, DeepSeek-compatible chat API, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-02-ai-trading-copilot-design.md`

## Global Constraints

- Keep all model and MCP credentials server-only; never introduce a `NEXT_PUBLIC_*` secret.
- Agent tools remain read-only and cannot call Demo Trading submit/cancel routes.
- Technical metrics are deterministic; the LLM explains supplied values only.
- All outputs include source, timestamp, data quality, fallback status, and disclaimer.
- Preserve existing untracked design artifacts in the Apex working tree.

---

### Task 1: Nexus test baseline and technical metric domain

**Files:**
- Modify: `/Users/devinding/Documents/nexus-mcp-server/package.json`
- Create: `/Users/devinding/Documents/nexus-mcp-server/src/analysis.ts`
- Test: `/Users/devinding/Documents/nexus-mcp-server/src/analysis.test.ts`

**Interfaces:**
- Produces: `calculateTechnicalSnapshot(input): TechnicalSnapshot` and Vitest test command.

- [ ] Add Vitest and a `test` script.
- [ ] Write failing tests for trend, range position, volatility, volume ratio, order-book imbalance, and insufficient data.
- [ ] Run the focused test and confirm failure because `analysis.ts` is missing.
- [ ] Implement pure, finite-number-safe metric functions.
- [ ] Run focused and full Nexus tests, then typecheck.

### Task 2: Nexus aggregate MCP tools

**Files:**
- Modify: `/Users/devinding/Documents/nexus-mcp-server/src/server.ts`
- Modify: `/Users/devinding/Documents/nexus-mcp-server/src/okx.ts`
- Modify: `/Users/devinding/Documents/nexus-mcp-server/src/types.ts`
- Test: `/Users/devinding/Documents/nexus-mcp-server/src/server.test.ts`
- Modify: `/Users/devinding/Documents/nexus-mcp-server/README.md`

**Interfaces:**
- Produces: `get_market_context` and `get_technical_snapshot` tool contracts.

- [ ] Write failing tests for valid aggregate responses, input normalization, unsupported instruments, warnings, and upstream failure mapping.
- [ ] Run tests and confirm missing-tool failures.
- [ ] Extract tool registration dependencies so tests inject a fake OKX client without network calls.
- [ ] Implement bounded parallel ticker/candle/book loading and versioned result envelopes.
- [ ] Register read-only tool annotations and update README examples.
- [ ] Run Nexus tests and typecheck.

### Task 3: Apex Agent contracts and deterministic fallback

**Files:**
- Create: `src/server/ai/contracts.ts`
- Create: `src/server/ai/technical-fallback.ts`
- Test: `src/server/ai/technical-fallback.test.ts`
- Modify: `src/lib/market-data/ai-signals.ts`

**Interfaces:**
- Produces: `AIInsightSchema`, `AgentRequestSchema`, `createDeterministicInsight()`.

- [ ] Write failing tests for schema validation, bullish/bearish/neutral mapping, low-quality input, and disclaimer/source preservation.
- [ ] Run tests and confirm missing module failures.
- [ ] Implement Zod contracts and deterministic fallback.
- [ ] Replace buy/sell signal vocabulary with non-advisory market bias semantics.
- [ ] Run focused tests and typecheck.

### Task 4: Server-only MCP client and model provider

**Files:**
- Create: `src/server/ai/mcp-client.ts`
- Create: `src/server/ai/model-provider.ts`
- Create: `src/server/ai/config.ts`
- Test: `src/server/ai/mcp-client.test.ts`
- Test: `src/server/ai/model-provider.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `MarketToolsClient`, `createMcpMarketToolsClient()`, `generateStructuredInsight()`.

- [ ] Write failing tests for MCP tool mapping, bearer authentication, timeout/abort, missing model key, valid structured output, and invalid model output.
- [ ] Run tests and confirm missing module failures.
- [ ] Implement MCP Streamable HTTP client with injected transport/fetch boundaries.
- [ ] Implement DeepSeek-compatible server-only provider with one bounded retry and Zod parsing.
- [ ] Document config versus secret environment variables.
- [ ] Run focused tests and typecheck.

### Task 5: LangGraph.js workflow

**Files:**
- Create: `src/server/ai/graph.ts`
- Create: `src/server/ai/intent.ts`
- Test: `src/server/ai/graph.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `runTradingCopilot(request, dependencies): Promise<AgentResponse>`.

- [ ] Install LangGraph.js and MCP client dependencies.
- [ ] Write failing tests for summary, risk, comparison, unsupported intent, tool failure, model failure, and no-trading-tool enforcement.
- [ ] Run tests and confirm graph behavior is missing.
- [ ] Implement explicit validation, intent, evidence, metrics, generation, validation, and fallback nodes.
- [ ] Assert an allowlist of read-only MCP tool names before every tool call.
- [ ] Run focused tests and full Apex tests.

### Task 6: AI HTTP routes and abuse controls

**Files:**
- Create: `src/app/api/ai/insight/route.ts`
- Create: `src/app/api/ai/chat/route.ts`
- Create: `src/server/ai/rate-limit.ts`
- Test: `src/app/api/ai/routes.test.ts`

**Interfaces:**
- Produces: `POST /api/ai/insight` and `POST /api/ai/chat`.

- [ ] Write failing route tests for malformed payload, supported response, rate limit, timeout, deterministic fallback, and absence of credential leakage.
- [ ] Run route tests and confirm 404/missing-handler failures.
- [ ] Implement same-origin validation, request limits, per-session rate limiting, abort timeout, and safe error envelopes.
- [ ] Run route and existing security tests.

### Task 7: Trade-page insight and chat UI

**Files:**
- Create: `src/features/ai/ai-insight-card.tsx`
- Create: `src/features/ai/ai-chat-sheet.tsx`
- Create: `src/features/ai/use-trading-copilot.ts`
- Test: `src/features/ai/ai-insight-card.test.tsx`
- Test: `src/features/ai/ai-chat-sheet.test.tsx`
- Modify: `src/components/trade/trade-screen.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: AI route contracts.
- Produces: non-blocking insight card and accessible mobile chat bottom sheet.

- [ ] Write failing component tests for loading, success, fallback, evidence disclosure, suggested question, submit, close, and focus behavior.
- [ ] Run tests and confirm missing component failures.
- [ ] Implement the hook, insight card, chat sheet, and contextual prompts.
- [ ] Integrate below the order book without changing chart/order interaction behavior.
- [ ] Run component, trade-screen, and accessibility-adjacent tests.

### Task 8: Documentation and full verification

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `docs/technical-design.md`

**Interfaces:**
- Produces: setup instructions, architecture explanation, safety boundary, and interview-ready technical narrative.

- [ ] Document local Nexus startup, Apex environment variables, deterministic fallback, and production deployment topology.
- [ ] Document why MCP is used instead of private function calls and why Agent execution cannot submit orders.
- [ ] Run Nexus `npm test` and `npm run typecheck`.
- [ ] Run Apex `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- [ ] Inspect the mobile trade page and verify no browser console errors.
- [ ] Record final limitations: no news causality, no financial advice, no autonomous execution.

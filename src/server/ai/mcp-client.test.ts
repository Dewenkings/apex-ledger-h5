import { describe, expect, it, vi } from "vitest";

import { createMcpMarketToolsClient, type McpToolCaller } from "./mcp-client";

const payload = {
  version: "1.0", source: "OKX", instrument: "BTC-USDT", bar: "1H",
  asOf: "2026-09-02T08:00:00.000Z", dataQuality: "high", warnings: [],
  ticker: { last: 100, open24h: 99, high24h: 105, low24h: 95, change24hPct: 1.01, volume24h: 1000 },
  candles: [], orderBook: { asks: [], bids: [] },
  technical: {
    version: "1.0", source: "OKX", instrument: "BTC-USDT", asOf: "2026-09-02T08:00:00.000Z",
    marketBias: "neutral", priceRangePosition: 50, realizedVolatilityPct: 1, volumeRatio: 1,
    orderBookImbalance: 0, dataQuality: "high", warnings: [],
    metrics: { priceRangePosition: 50, realizedVolatilityPct: 1, volumeRatio: 1, orderBookImbalance: 0 },
  },
};

describe("MCP market client", () => {
  it("maps an allowed aggregate tool response into the domain contract", async () => {
    const caller: McpToolCaller = {
      callTool: vi.fn().mockResolvedValue({ content: [{ type: "text", text: JSON.stringify(payload) }] }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const client = createMcpMarketToolsClient({ caller });

    const result = await client.getMarketContext("BTC-USDT", "1H");

    expect(result.instrument).toBe("BTC-USDT");
    expect(caller.callTool).toHaveBeenCalledWith("get_market_context", { instrument: "BTC-USDT", bar: "1H", limit: 60, depth: 20 });
    expect(caller.close).toHaveBeenCalledOnce();
  });

  it("rejects tool errors and malformed evidence", async () => {
    const errorCaller: McpToolCaller = {
      callTool: vi.fn().mockResolvedValue({ isError: true, content: [{ type: "text", text: "upstream unavailable" }] }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    await expect(createMcpMarketToolsClient({ caller: errorCaller }).getMarketContext("BTC-USDT", "1H"))
      .rejects.toThrow("upstream unavailable");

    const malformedCaller: McpToolCaller = {
      callTool: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "{}" }] }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    await expect(createMcpMarketToolsClient({ caller: malformedCaller }).getMarketContext("BTC-USDT", "1H"))
      .rejects.toThrow();
  });
});

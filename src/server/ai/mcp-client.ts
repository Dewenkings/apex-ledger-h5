import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { MarketContextSchema, type MarketContext } from "@/lib/ai/contracts";

export type McpToolResult = { isError?: boolean; content: unknown };

export interface McpToolCaller {
  callTool(name: string, arguments_: Record<string, unknown>): Promise<McpToolResult>;
  close(): Promise<void>;
}

type ClientOptions = {
  caller?: McpToolCaller;
  url?: string;
  token?: string;
};

class SdkToolCaller implements McpToolCaller {
  private constructor(private readonly client: Client) {}

  static async connect(url: string, token?: string): Promise<SdkToolCaller> {
    const client = new Client({ name: "apex-ledger-agent", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(url), {
      requestInit: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    });
    await client.connect(transport);
    return new SdkToolCaller(client);
  }

  async callTool(name: string, arguments_: Record<string, unknown>): Promise<McpToolResult> {
    const result = await this.client.callTool({ name, arguments: arguments_ });
    return { isError: Boolean(result.isError), content: result.content };
  }

  close(): Promise<void> {
    return this.client.close();
  }
}

function toolText(result: McpToolResult): string {
  const parts = Array.isArray(result.content) ? result.content : [];
  const text = parts.find((part): part is { type: "text"; text: string } => {
    if (!part || typeof part !== "object") return false;
    const value = part as Record<string, unknown>;
    return value.type === "text" && typeof value.text === "string";
  });
  if (!text) throw new Error("MCP tool returned no text evidence");
  if (result.isError) throw new Error(text.text);
  return text.text;
}

export function createMcpMarketToolsClient(options: ClientOptions = {}) {
  return {
    async getMarketContext(instrument: string, timeframe: string): Promise<MarketContext> {
      const caller = options.caller ?? await SdkToolCaller.connect(
        options.url ?? process.env.NEXUS_MCP_URL ?? "http://127.0.0.1:3001/mcp",
        options.token ?? process.env.NEXUS_MCP_TOKEN,
      );
      try {
        const result = await caller.callTool("get_market_context", {
          instrument,
          bar: timeframe,
          limit: 60,
          depth: 20,
        });
        return MarketContextSchema.parse(JSON.parse(toolText(result)));
      } finally {
        await caller.close();
      }
    },
  };
}

export type MarketToolsClient = ReturnType<typeof createMcpMarketToolsClient>;

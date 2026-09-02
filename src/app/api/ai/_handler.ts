import { createHash } from "node:crypto";

import { AgentRequestSchema } from "@/lib/ai/contracts";
import { MemoryDemoSafetyStore, createRedisDemoSafetyStore } from "@/lib/demo-access/store";
import { runTradingCopilot, type CopilotResponse } from "@/server/ai/graph";
import { createMcpMarketToolsClient } from "@/server/ai/mcp-client";
import { createDeepSeekInsightProvider } from "@/server/ai/model-provider";

type Dependencies = {
  run(input: unknown): Promise<CopilotResponse>;
  consume(key: string): Promise<boolean>;
};

const noStore = { "Cache-Control": "no-store" };
const memoryRateStore = new MemoryDemoSafetyStore();

function safeJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: noStore });
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const value = forwarded || request.headers.get("x-real-ip") || "local";
  return createHash("sha256").update(value.slice(0, 128)).digest("hex");
}

function isTrustedOrigin(request: Request): boolean {
  const provided = request.headers.get("origin");
  if (!provided) return true;
  const actual = new URL(provided);
  const expected = new URL(request.url);
  if (actual.origin === expected.origin) return true;
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  return process.env.NODE_ENV !== "production"
    && loopbackHosts.has(actual.hostname)
    && loopbackHosts.has(expected.hostname)
    && actual.protocol === expected.protocol
    && actual.port === expected.port;
}

function defaultDependencies(): Dependencies {
  const store = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? createRedisDemoSafetyStore()
    : memoryRateStore;
  return {
    run: (input) => runTradingCopilot(input, {
      marketTools: createMcpMarketToolsClient(),
      provider: createDeepSeekInsightProvider(),
    }),
    async consume(key) {
      return (await store.consumeRateLimit(`ai:${key}`, 12, 60)).allowed;
    },
  };
}

export function createAIHandler(dependencies: Dependencies = defaultDependencies()) {
  return async function POST(request: Request): Promise<Response> {
    if (!isTrustedOrigin(request)) {
      return safeJson({ error: "Cross-origin AI requests are not allowed", code: "origin_forbidden" }, 403);
    }

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return safeJson({ error: "Invalid AI request", code: "invalid_request" }, 400);
    }
    const parsed = AgentRequestSchema.safeParse(input);
    if (!parsed.success) {
      return safeJson({ error: "Invalid AI request", code: "invalid_request" }, 400);
    }

    if (!await dependencies.consume(clientKey(request))) {
      return safeJson({ error: "Too many AI requests", code: "rate_limited" }, 429);
    }

    try {
      return safeJson(await dependencies.run(parsed.data));
    } catch (error) {
      console.error("AI market analysis failed", {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message.slice(0, 200) : "Non-Error value",
      });
      return safeJson({ error: "AI market analysis is temporarily unavailable", code: "ai_unavailable" }, 503);
    }
  };
}

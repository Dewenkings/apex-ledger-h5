import { parseTradableInstrument } from "@/lib/trading/pairs";
import {
  createDefaultDemoApiDependencies,
  demoErrorResponse,
  noStoreJson,
  readJsonObject,
  requireDemoSession,
  requireSameOrigin,
  type DemoApiDependencies,
} from "../_shared";

export function createOrdersHandlers(
  dependencies: DemoApiDependencies = createDefaultDemoApiDependencies(),
) {
  return {
    async GET(request: Request): Promise<Response> {
      const session = await requireDemoSession(request, dependencies);
      if (session instanceof Response) return session;
      try {
        return noStoreJson({ orders: await dependencies.getService().listOrders(session) });
      } catch (error) {
        return demoErrorResponse(error);
      }
    },

    async POST(request: Request): Promise<Response> {
      const originError = requireSameOrigin(request);
      if (originError) return originError;
      const session = await requireDemoSession(request, dependencies);
      if (session instanceof Response) return session;
      const requestId = request.headers.get("idempotency-key")?.trim();
      if (!requestId) return noStoreJson({ error: "Idempotency-Key is required", code: "invalid_order" }, 400);
      const body = await readJsonObject(request);
      if (!body) return noStoreJson({ error: "Invalid order payload", code: "invalid_order" }, 400);

      try {
        const trustedBody = await withTrustedMarketReference(body, dependencies);
        const receipt = await dependencies.getService().place(
          session,
          trustedBody,
          requestId,
          dependencies.hashClientIp(request),
        );
        return noStoreJson(receipt, 201);
      } catch (error) {
        return demoErrorResponse(error);
      }
    },
  };
}

async function withTrustedMarketReference(
  body: Record<string, unknown>,
  dependencies: DemoApiDependencies,
): Promise<Record<string, unknown>> {
  const order = { ...body };
  delete order.referencePrice;
  if (order.type !== "market") return order;
  const instrument = parseTradableInstrument(typeof order.instrument === "string" ? order.instrument : null);
  if (!instrument) return order;
  return { ...order, referencePrice: await dependencies.getReferencePrice(instrument) };
}

const handlers = createOrdersHandlers();
export const GET = handlers.GET;
export const POST = handlers.POST;

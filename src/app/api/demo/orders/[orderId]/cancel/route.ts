import { parseTradableInstrument } from "@/lib/trading/pairs";
import {
  createDefaultDemoApiDependencies,
  demoErrorResponse,
  noStoreJson,
  readJsonObject,
  requireDemoSession,
  requireSameOrigin,
  type DemoApiDependencies,
} from "../../../_shared";

type CancelContext = { params: Promise<{ orderId: string }> };

export function createCancelOrderHandlers(
  dependencies: DemoApiDependencies = createDefaultDemoApiDependencies(),
) {
  return {
    async POST(request: Request, context: CancelContext): Promise<Response> {
      const originError = requireSameOrigin(request);
      if (originError) return originError;
      const session = await requireDemoSession(request, dependencies);
      if (session instanceof Response) return session;
      const body = await readJsonObject(request);
      const instrument = parseTradableInstrument(
        body && typeof body.instrument === "string" ? body.instrument : null,
      );
      if (!instrument) {
        return noStoreJson({ error: "Unsupported trading instrument", code: "invalid_order" }, 400);
      }
      const { orderId } = await context.params;
      if (!orderId || orderId.length > 64) {
        return noStoreJson({ error: "Invalid order ID", code: "invalid_order" }, 400);
      }
      try {
        const receipt = await dependencies.getService().cancelOwnedOrder(session, orderId, instrument);
        return noStoreJson(receipt);
      } catch (error) {
        return demoErrorResponse(error);
      }
    },
  };
}

const handlers = createCancelOrderHandlers();
export const POST = handlers.POST;

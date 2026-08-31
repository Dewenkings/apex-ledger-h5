import { parseTradableInstrument } from "@/lib/trading/pairs";
import { createDefaultDemoApiDependencies, demoErrorResponse, noStoreJson, readJsonObject, requireDemoActor, requireSameOrigin, type DemoApiDependencies } from "./_shared";

export function createOrdersHandlers(dependencies: DemoApiDependencies = createDefaultDemoApiDependencies()) {
  return {
    async GET(request: Request) {
      const session = await requireDemoActor(request, dependencies);
      if (session instanceof Response) return session;
      try { return noStoreJson({ orders: await dependencies.getService().listOrders(session) }); } catch (error) { return demoErrorResponse(error); }
    },
    async POST(request: Request) {
      const originError = requireSameOrigin(request);
      if (originError) return originError;
      const session = await requireDemoActor(request, dependencies);
      if (session instanceof Response) return session;
      const requestId = request.headers.get("idempotency-key")?.trim();
      if (!requestId) return noStoreJson({ error: "Idempotency-Key is required", code: "invalid_order" }, 400);
      const body = await readJsonObject(request);
      if (!body) return noStoreJson({ error: "Invalid order payload", code: "invalid_order" }, 400);
      try {
        const order = { ...body };
        delete order.referencePrice;
        const instrument = parseTradableInstrument(typeof order.instrument === "string" ? order.instrument : null);
        const trustedOrder = order.type === "market" && instrument ? { ...order, referencePrice: await dependencies.getReferencePrice(instrument) } : order;
        return noStoreJson(await dependencies.getService().place(session, trustedOrder, requestId, dependencies.hashClientIp(request)), 201);
      } catch (error) { return demoErrorResponse(error); }
    },
  };
}

export function createFillsHandlers(dependencies: DemoApiDependencies = createDefaultDemoApiDependencies()) {
  return { async GET(request: Request) { const session = await requireDemoActor(request, dependencies); if (session instanceof Response) return session; try { return noStoreJson({ fills: await dependencies.getService().listFills(session) }); } catch (error) { return demoErrorResponse(error); } } };
}

export function createBalanceHandlers(dependencies: DemoApiDependencies = createDefaultDemoApiDependencies()) {
  return { async GET(request: Request) { const session = await requireDemoActor(request, dependencies); if (session instanceof Response) return session; try { return noStoreJson({ balance: await dependencies.getService().getSharedBalance() }); } catch (error) { return demoErrorResponse(error); } } };
}

type CancelContext = { params: Promise<{ orderId: string }> };
export function createCancelOrderHandlers(dependencies: DemoApiDependencies = createDefaultDemoApiDependencies()) {
  return { async POST(request: Request, context: CancelContext) {
    const originError = requireSameOrigin(request); if (originError) return originError;
    const session = await requireDemoActor(request, dependencies); if (session instanceof Response) return session;
    const { orderId } = await context.params;
    if (!orderId || orderId.length > 64) return noStoreJson({ error: "Invalid order ID", code: "invalid_order" }, 400);
    try { return noStoreJson(await dependencies.getService().cancelOwnedOrder(session, orderId)); } catch (error) { return demoErrorResponse(error); }
  } };
}

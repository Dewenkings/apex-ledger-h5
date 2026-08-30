import {
  createDefaultDemoApiDependencies,
  demoErrorResponse,
  noStoreJson,
  requireDemoSession,
  type DemoApiDependencies,
} from "../_shared";

export function createFillsHandlers(
  dependencies: DemoApiDependencies = createDefaultDemoApiDependencies(),
) {
  return {
    async GET(request: Request): Promise<Response> {
      const session = await requireDemoSession(request, dependencies);
      if (session instanceof Response) return session;
      try {
        return noStoreJson({ fills: await dependencies.getService().listFills(session) });
      } catch (error) {
        return demoErrorResponse(error);
      }
    },
  };
}

const handlers = createFillsHandlers();
export const GET = handlers.GET;

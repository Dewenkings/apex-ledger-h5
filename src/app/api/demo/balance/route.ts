import {
  createDefaultDemoApiDependencies,
  demoErrorResponse,
  noStoreJson,
  requireDemoSession,
  type DemoApiDependencies,
} from "../_shared";

export function createBalanceHandlers(
  dependencies: DemoApiDependencies = createDefaultDemoApiDependencies(),
) {
  return {
    async GET(request: Request): Promise<Response> {
      const session = await requireDemoSession(request, dependencies);
      if (session instanceof Response) return session;
      try {
        return noStoreJson({ balance: await dependencies.getService().getSharedBalance() });
      } catch (error) {
        return demoErrorResponse(error);
      }
    },
  };
}

const handlers = createBalanceHandlers();
export const GET = handlers.GET;

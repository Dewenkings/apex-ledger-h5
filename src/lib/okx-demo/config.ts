import { z } from "zod";

const demoEnvironmentSchema = z.object({
  TRADING_PROFILE: z.literal("okx_demo", {
    error: "TRADING_PROFILE must be okx_demo",
  }),
  OKX_DEMO_API_KEY: z.string().min(1),
  OKX_DEMO_SECRET_KEY: z.string().min(1),
  OKX_DEMO_PASSPHRASE: z.string().min(1),
});

export type OkxDemoConfig = {
  apiKey: string;
  secretKey: string;
  passphrase: string;
  baseUrl: "https://openapi.okx.com";
};

export function readOkxDemoConfig(environment: Record<string, string | undefined>): OkxDemoConfig {
  const result = demoEnvironmentSchema.safeParse(environment);
  if (!result.success) {
    if (environment.TRADING_PROFILE !== "okx_demo") {
      throw new Error("TRADING_PROFILE must be okx_demo");
    }
    throw new Error("OKX Demo credentials are incomplete");
  }

  return {
    apiKey: result.data.OKX_DEMO_API_KEY,
    secretKey: result.data.OKX_DEMO_SECRET_KEY,
    passphrase: result.data.OKX_DEMO_PASSPHRASE,
    baseUrl: "https://openapi.okx.com",
  };
}

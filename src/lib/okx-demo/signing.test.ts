// @vitest-environment node

import { describe, expect, it } from "vitest";

import { readOkxDemoConfig } from "./config";
import { signOkxRequest } from "./signing";

describe("OKX Demo request security", () => {
  it("matches an independently calculated HMAC-SHA256 signature vector", () => {
    expect(signOkxRequest(
      "secret",
      "2026-08-30T00:00:00.000Z",
      "POST",
      "/api/v5/trade/order",
      '{"instId":"ETH-USDT"}',
    )).toBe("GRuEwSIdwGA5FDuF9/zQBz/pOmB5uFFaXXKher1qwTU=");
  });

  it("accepts only a complete server-side OKX Demo profile", () => {
    expect(readOkxDemoConfig({
      TRADING_PROFILE: "okx_demo",
      OKX_DEMO_API_KEY: "demo-key",
      OKX_DEMO_SECRET_KEY: "demo-secret",
      OKX_DEMO_PASSPHRASE: "demo-passphrase",
    })).toEqual({
      apiKey: "demo-key",
      secretKey: "demo-secret",
      passphrase: "demo-passphrase",
      baseUrl: "https://openapi.okx.com",
    });
  });

  it("rejects live profiles and incomplete demo credentials", () => {
    expect(() => readOkxDemoConfig({
      TRADING_PROFILE: "live",
      OKX_DEMO_API_KEY: "key",
      OKX_DEMO_SECRET_KEY: "secret",
      OKX_DEMO_PASSPHRASE: "passphrase",
    })).toThrow(/okx_demo/);
    expect(() => readOkxDemoConfig({ TRADING_PROFILE: "okx_demo" })).toThrow(/OKX Demo credentials/);
  });
});

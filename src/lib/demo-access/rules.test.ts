// @vitest-environment node

import { describe, expect, it } from "vitest";

import { validateDemoOrderInput } from "./rules";

describe("OKX Demo order rules", () => {
  it("accepts a bounded spot cash limit order as normalized strings", () => {
    expect(validateDemoOrderInput({
      instrument: "ETH-USDT",
      side: "buy",
      type: "limit",
      amount: "0.02",
      price: "3500",
    })).toEqual({
      success: true,
      data: {
        instrument: "ETH-USDT",
        side: "buy",
        type: "limit",
        amount: "0.02",
        price: "3500",
      },
    });
  });

  it("rejects unsupported products, excess precision, zero, and excessive notional", () => {
    expect(validateDemoOrderInput({ instrument: "DOGE-USDT", side: "buy", type: "limit", amount: "1", price: "1" })).toMatchObject({ success: false });
    expect(validateDemoOrderInput({ instrument: "SOL-USDT", side: "buy", type: "limit", amount: "1.2345678", price: "100" })).toMatchObject({ success: false, error: "Invalid amount precision" });
    expect(validateDemoOrderInput({ instrument: "BTC-USDT", side: "buy", type: "limit", amount: "0", price: "68000" })).toMatchObject({ success: false, error: "Amount must be positive" });
    expect(validateDemoOrderInput({ instrument: "ETH-USDT", side: "buy", type: "limit", amount: "0.1", price: "3000" })).toMatchObject({ success: false, error: "Demo notional exceeds 250 USDT" });
  });

  it("requires exactly one trusted price path for limit and market orders", () => {
    expect(validateDemoOrderInput({ instrument: "ETH-USDT", side: "buy", type: "limit", amount: "0.02" })).toMatchObject({ success: false, error: "Limit price is required" });
    expect(validateDemoOrderInput({ instrument: "ETH-USDT", side: "buy", type: "market", amount: "0.02", price: "3500", referencePrice: "3500" })).toMatchObject({ success: false, error: "Market order cannot include a limit price" });
    expect(validateDemoOrderInput({ instrument: "ETH-USDT", side: "buy", type: "market", amount: "0.02" })).toMatchObject({ success: false, error: "Reference price is required" });
    expect(validateDemoOrderInput({ instrument: "ETH-USDT", side: "buy", type: "market", amount: "0.02", referencePrice: "3500" })).toMatchObject({
      success: true,
      data: { instrument: "ETH-USDT", side: "buy", type: "market", amount: "0.02", referencePrice: "3500" },
    });
  });
});

// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { OkxDemoClient } from "./client";
import type { OkxDemoConfig } from "./config";

const config: OkxDemoConfig = {
  apiKey: "demo-key",
  secretKey: "demo-secret",
  passphrase: "demo-passphrase",
  baseUrl: "https://openapi.okx.com",
};

const orderRow = {
  instId: "ETH-USDT",
  ordId: "271828",
  clOrdId: "apxabc123",
  side: "buy",
  ordType: "limit",
  px: "3500",
  sz: "0.02",
  accFillSz: "0.01",
  avgPx: "3498.5",
  state: "partially_filled",
  cTime: "1788048000000",
  uTime: "1788048001000",
};

describe("OkxDemoClient", () => {
  it("signs a place-order request and always marks it as simulated trading", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({
      code: "0",
      msg: "",
      data: [{ ordId: "271828", clOrdId: "apxabc123", sCode: "0", sMsg: "" }],
    }));
    const client = new OkxDemoClient(config, {
      fetcher,
      now: () => new Date("2026-08-30T00:00:00.000Z"),
    });

    const result = await client.placeOrder({
      instId: "ETH-USDT",
      tdMode: "cash",
      side: "buy",
      ordType: "limit",
      sz: "0.02",
      px: "3500",
      clOrdId: "apxabc123",
    });

    expect(result).toEqual({ ordId: "271828", clOrdId: "apxabc123", accepted: true });
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toBe("https://openapi.okx.com/api/v5/trade/order");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe('{"instId":"ETH-USDT","tdMode":"cash","side":"buy","ordType":"limit","sz":"0.02","px":"3500","clOrdId":"apxabc123"}');
    expect(init?.headers).toMatchObject({
      "OK-ACCESS-KEY": "demo-key",
      "OK-ACCESS-PASSPHRASE": "demo-passphrase",
      "OK-ACCESS-TIMESTAMP": "2026-08-30T00:00:00.000Z",
      "OK-ACCESS-SIGN": "IPcZk4gtPdIy4nhCkQ/Gnw21DRdwCGGPxmB7jFjCVaU=",
      "x-simulated-trading": "1",
    });
  });

  it("normalizes orders, fills, cancellation, and shared virtual balance", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/trade/order") && init?.method === "GET") {
        return Response.json({ code: "0", msg: "", data: [orderRow] });
      }
      if (url.pathname.endsWith("/trade/orders-pending")) {
        return Response.json({ code: "0", msg: "", data: [orderRow] });
      }
      if (url.pathname.endsWith("/trade/orders-history")) {
        return Response.json({ code: "0", msg: "", data: [{ ...orderRow, state: "filled", accFillSz: "0.02" }] });
      }
      if (url.pathname.endsWith("/trade/fills")) {
        return Response.json({ code: "0", msg: "", data: [{
          instId: "ETH-USDT", ordId: "271828", clOrdId: "apxabc123", tradeId: "314159",
          side: "buy", fillPx: "3498.5", fillSz: "0.01", fee: "-0.00002", feeCcy: "ETH",
          ts: "1788048001000",
        }] });
      }
      if (url.pathname.endsWith("/account/balance")) {
        return Response.json({ code: "0", msg: "", data: [{
          totalEq: "50000.25",
          uTime: "1788048001000",
          details: [{ ccy: "USDT", availBal: "12500", cashBal: "13000", frozenBal: "500", eq: "13000" }],
        }] });
      }
      if (url.pathname.endsWith("/trade/cancel-order")) {
        return Response.json({ code: "0", msg: "", data: [{ ordId: "271828", clOrdId: "apxabc123", sCode: "0", sMsg: "" }] });
      }
      return new Response("not found", { status: 404 });
    });
    const client = new OkxDemoClient(config, { fetcher });

    await expect(client.getOrder({ instrument: "ETH-USDT", ordId: "271828" })).resolves.toMatchObject({
      instrument: "ETH-USDT", status: "partially_filled", filledSize: "0.01",
    });
    await expect(client.listPendingOrders("ETH-USDT")).resolves.toHaveLength(1);
    await expect(client.listOrderHistory("ETH-USDT")).resolves.toEqual([
      expect.objectContaining({ status: "filled", filledSize: "0.02" }),
    ]);
    await expect(client.listFills({ instrument: "ETH-USDT", ordId: "271828" })).resolves.toEqual([
      expect.objectContaining({ tradeId: "314159", fillPrice: "3498.5", feeCurrency: "ETH" }),
    ]);
    expect(fetcher.mock.calls.some(([input]) => String(input) === "https://openapi.okx.com/api/v5/trade/fills?instType=SPOT&instId=ETH-USDT&ordId=271828")).toBe(true);
    await expect(client.getBalance()).resolves.toEqual({
      totalEquity: "50000.25",
      updatedAt: 1788048001000,
      assets: [{ currency: "USDT", available: "12500", balance: "13000", frozen: "500", equity: "13000" }],
      scope: "shared-okx-demo",
      virtual: true,
    });
    await expect(client.cancelOrder({ instrument: "ETH-USDT", ordId: "271828" })).resolves.toEqual({
      ordId: "271828", clOrdId: "apxabc123", canceled: true,
    });
  });

  it("maps OKX business errors and request timeouts without leaking credentials", async () => {
    const rejected = new OkxDemoClient(config, {
      fetcher: async () => Response.json({ code: "51008", msg: "Insufficient demo balance", data: [] }),
    });
    const timedOut = new OkxDemoClient(config, {
      fetcher: async () => { throw new DOMException("aborted", "AbortError"); },
    });

    await expect(rejected.getBalance()).rejects.toMatchObject({
      name: "OkxDemoError", category: "business_rejection", code: "51008",
    });
    await expect(timedOut.getBalance()).rejects.toMatchObject({
      name: "OkxDemoError", category: "upstream_timeout",
    });
    expect(String(await rejected.getBalance().catch((error: unknown) => error))).not.toContain("demo-secret");
  });
});

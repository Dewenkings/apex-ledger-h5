import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmScreen } from "@/components/screens";
import { tradingPairs } from "@/lib/trading/pairs";

vi.mock("next/navigation", () => ({
  usePathname: () => "/trade/eth-usdt/confirm",
  useSearchParams: () => new URLSearchParams("side=buy&type=limit&amount=0.02&price=3500"),
}));

afterEach(() => vi.unstubAllGlobals());

describe("ConfirmScreen OKX Demo submission", () => {
  it("unlocks a controlled session, submits with idempotency, and shows the OKX order ID", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/demo/session") && (!init?.method || init.method === "GET")) {
        return Response.json({ authenticated: false }, { status: 200 });
      }
      if (url.endsWith("/api/demo/session") && init?.method === "POST") {
        return Response.json({ authenticated: true, expiresAt: 1788051600000 });
      }
      if (url.endsWith("/api/demo/orders") && init?.method === "POST") {
        return Response.json({ ordId: "271828", clOrdId: "apx-owned", accepted: true }, { status: 201 });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetcher);

    render(<ConfirmScreen pair={tradingPairs[1]} />);

    const summary = screen.getByRole("region", { name: "订单摘要" });
    expect(summary).toHaveClass("confirm-ticket", "buy");
    expect(within(summary).getByText("ETH/USDT")).toBeInTheDocument();
    expect(within(summary).getByText("3500 USDT")).toBeInTheDocument();
    expect(screen.getAllByText("PAPER LIVE")).toHaveLength(1);
    expect(await screen.findByText("需要演示访问码")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("演示访问码"), { target: { value: "demo-access-code" } });
    fireEvent.click(screen.getByRole("button", { name: "进入 OKX 模拟盘" }));
    expect(await screen.findByRole("button", { name: "提交到 OKX Demo Trading" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "提交到 OKX Demo Trading" }));

    expect(await screen.findByRole("heading", { name: "模拟订单已受理" })).toBeInTheDocument();
    expect(await screen.findByText("271828")).toBeInTheDocument();
    const orderCall = fetcher.mock.calls.find(([url, init]) => String(url).endsWith("/api/demo/orders") && init?.method === "POST");
    expect(orderCall?.[1]?.headers).toEqual(expect.objectContaining({ "Idempotency-Key": expect.any(String) }));
    expect(JSON.parse(String(orderCall?.[1]?.body))).toEqual({
      instrument: "ETH-USDT",
      side: "buy",
      type: "limit",
      amount: "0.02",
      price: "3500",
    });
  });

  it("shows a safe API rejection without claiming the order succeeded", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/api/demo/session")) return Response.json({ authenticated: true });
      if (init?.method === "POST") return Response.json({ error: "Demo notional exceeds 250 USDT" }, { status: 400 });
      return new Response("not found", { status: 404 });
    }));

    render(<ConfirmScreen pair={tradingPairs[1]} />);
    fireEvent.click(await screen.findByRole("button", { name: "提交到 OKX Demo Trading" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Demo notional exceeds 250 USDT");
    await waitFor(() => expect(screen.queryByText("OKX 模拟订单已受理")).not.toBeInTheDocument());
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OrdersScreen, PortfolioScreen } from "@/components/screens";

vi.mock("next/navigation", () => ({ usePathname: () => "/orders" }));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined, chainId: undefined, isConnected: false }),
  useBalance: () => ({ data: undefined, isLoading: false, isFetching: false, isError: false, dataUpdatedAt: 0 }),
  useReadContracts: () => ({ data: undefined, isLoading: false, isFetching: false, isError: false, dataUpdatedAt: 0 }),
}));

const order = { instrument: "ETH-USDT", ordId: "271828", clOrdId: "apx-owned", side: "buy", orderType: "limit", price: "3500", size: "0.02", filledSize: "0", averagePrice: "", status: "live", createdAt: 1788048000000, updatedAt: 1788048000000 };
const fill = { instrument: "ETH-USDT", ordId: "271828", clOrdId: "apx-owned", tradeId: "314", side: "buy", fillPrice: "3500", fillSize: "0.01", fee: "-0.02", feeCurrency: "USDT", timestamp: 1788048000000 };
const balance = { totalEquity: "50000", updatedAt: 1788048000000, assets: [{ currency: "USDT", available: "49000", balance: "50000", frozen: "1000", equity: "50000" }], scope: "shared-okx-demo", virtual: true };

function fetcher(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  if (url.endsWith("/api/demo/session")) return Promise.resolve(Response.json({ authenticated: true }));
  if (url.endsWith("/api/demo/orders/271828/cancel") && init?.method === "POST") return Promise.resolve(Response.json({ ordId: "271828", canceled: true }));
  if (url.endsWith("/api/demo/orders")) return Promise.resolve(Response.json({ orders: [order] }));
  if (url.endsWith("/api/demo/fills")) return Promise.resolve(Response.json({ fills: [fill] }));
  if (url.endsWith("/api/demo/balance")) return Promise.resolve(Response.json({ balance }));
  return Promise.resolve(new Response("not found", { status: 404 }));
}

afterEach(() => vi.unstubAllGlobals());

describe("OKX Demo account screens", () => {
  it("renders only the session API orders/fills and can request an owned cancel", async () => {
    const mockFetch = vi.fn(fetcher);
    vi.stubGlobal("fetch", mockFetch);
    render(<OrdersScreen />);

    expect(await screen.findByText("271828")).toBeInTheDocument();
    expect(screen.getByText("ETH/USDT")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "撤销模拟订单" }));
    expect(await screen.findByText("撤单请求已发送")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith("/api/demo/orders/271828/cancel", expect.objectContaining({ method: "POST" }));

    fireEvent.click(screen.getByRole("button", { name: "成交记录" }));
    expect(await screen.findByText("314")).toBeInTheDocument();
  });

  it("labels OKX balance as shared virtual funds rather than wallet funds", async () => {
    vi.stubGlobal("fetch", vi.fn(fetcher));
    render(<PortfolioScreen />);

    expect(await screen.findByText("50,000 USDT")).toBeInTheDocument();
    expect(screen.getByText("共享 OKX Demo 虚拟余额")).toBeInTheDocument();
    expect(screen.getByText("不会代表当前钱包资产")).toBeInTheDocument();
  });

  it("shows a controlled-access state without leaking private data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ authenticated: false })));
    render(<OrdersScreen />);

    expect(await screen.findByText("请先从交易确认页输入演示访问码")).toBeInTheDocument();
    expect(screen.queryByText("271828")).not.toBeInTheDocument();
  });

  it("shows pending and stale OKX synchronization states in the visitor workspace", async () => {
    const pending = { ...order, syncState: "pending", lastSyncedAt: null };
    const stale = { ...order, ordId: "161803", status: "filled", syncState: "stale", lastSyncedAt: 1788047000000 };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/demo/session")) return Response.json({ authenticated: true });
      if (url.endsWith("/api/demo/orders")) return Response.json({ orders: [pending, stale] });
      if (url.endsWith("/api/demo/fills")) return Response.json({ fills: [] });
      if (url.endsWith("/api/demo/balance")) return Response.json({ balance });
      return new Response("not found", { status: 404 });
    }));

    render(<OrdersScreen />);

    expect(await screen.findByText("正在同步 OKX")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "历史订单" }));
    expect(screen.getByText(/上次同步于/)).toBeInTheDocument();
    expect(screen.getByText("当前访客工作区")).toBeInTheDocument();
  });

  it("shows a personal empty state after an authenticated ledger response", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/demo/session")) return Response.json({ authenticated: true });
      if (url.endsWith("/api/demo/orders")) return Response.json({ orders: [] });
      if (url.endsWith("/api/demo/fills")) return Response.json({ fills: [] });
      if (url.endsWith("/api/demo/balance")) return Response.json({ balance });
      return new Response("not found", { status: 404 });
    }));

    render(<OrdersScreen />);

    expect(await screen.findByText("尚无个人模拟订单")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "前往市场" })).toHaveAttribute("href", "/markets");
  });
});

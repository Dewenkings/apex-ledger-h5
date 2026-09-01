import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { tradingPairs } from "@/lib/trading/pairs";

const restSnapshot = {
  instrument: "BTC-USDT",
  asks: [{ price: 68342.2, size: 0.18, orderCount: 2, totalQuote: 12301.596 }],
  bids: [{ price: 68342, size: 0.21, orderCount: 3, totalQuote: 14351.82 }],
  timestamp: 1788048000000,
  sequenceId: 41,
};

class FakeSocket {
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  send(message: string) { this.sent.push(message); }
  close() { this.readyState = 3; }
  open() { this.readyState = 1; this.onopen?.(); }
  message(data: unknown) { this.onmessage?.({ data }); }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("OrderBookCard", () => {
  it("hydrates from REST and upgrades to live books5 snapshots", async () => {
    const componentPath = "./order-book-card";
    const componentModule = await import(/* @vite-ignore */ componentPath).catch(() => null);
    expect(componentModule).not.toBeNull();
    if (!componentModule) return;

    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ source: "okx", data: restSnapshot })));
    const sockets: FakeSocket[] = [];
    vi.stubGlobal("WebSocket", vi.fn(function WebSocket() {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    }));

    render(<componentModule.OrderBookCard pair={tradingPairs[0]} />);

    expect(await screen.findByText("68,342.20")).toBeInTheDocument();
    expect(screen.getByText("REST SNAPSHOT")).toBeInTheDocument();
    await waitFor(() => expect(sockets).toHaveLength(1));
    sockets[0].open();
    expect(JSON.parse(sockets[0].sent[0])).toEqual({
      op: "subscribe",
      args: [{ channel: "books5", instId: "BTC-USDT" }],
    });

    sockets[0].message(JSON.stringify({
      arg: { channel: "books5", instId: "BTC-USDT" },
      data: [{
        asks: [["68350.0", "0.4", "0", "4"]],
        bids: [["68349.5", "0.3", "0", "3"]],
        ts: "1788048000100",
        seqId: 42,
      }],
    }));

    expect(await screen.findByText("68,350.00")).toBeInTheDocument();
    expect(screen.getByText("实时同步")).toBeInTheDocument();
    expect(screen.queryByText(/OKX/)).not.toBeInTheDocument();
    expect(screen.getByText("0.50 USDT")).toBeInTheDocument();
  });

  it("shows a recoverable connection state instead of fabricated depth", async () => {
    const componentPath = "./order-book-card";
    const componentModule = await import(/* @vite-ignore */ componentPath).catch(() => null);
    expect(componentModule).not.toBeNull();
    if (!componentModule) return;

    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 502 })));
    vi.stubGlobal("WebSocket", vi.fn(() => { throw new Error("offline"); }));

    render(<componentModule.OrderBookCard pair={tradingPairs[0]} />);

    expect(await screen.findByText("正在连接实时深度…")).toBeInTheDocument();
    expect(screen.queryByText("68,342.00")).not.toBeInTheDocument();
  });
});

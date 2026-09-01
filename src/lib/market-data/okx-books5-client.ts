import type { MarketInstrument, OrderBookSnapshot } from "./types";
import { normalizeOkxOrderBook } from "./order-book";

export type OrderBookConnectionStatus = "connecting" | "live" | "reconnecting" | "stopped";

export type WebSocketLike = {
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  send(message: string): void;
  close(code?: number, reason?: string): void;
};

type Books5ClientOptions = {
  instrument: MarketInstrument;
  onSnapshot(snapshot: OrderBookSnapshot): void;
  onStatus(status: OrderBookConnectionStatus): void;
  createSocket?: (url: string) => WebSocketLike;
  url?: string;
  depth?: number;
  heartbeatMs?: number;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
  random?: () => number;
  now?: () => number;
};

const DEFAULT_WS_URL = process.env.NEXT_PUBLIC_OKX_WS_URL ?? "wss://ws.okx.com:8443/ws/v5/public";

export class OkxBooks5Client {
  private readonly instrument: MarketInstrument;
  private readonly onSnapshot: (snapshot: OrderBookSnapshot) => void;
  private readonly onStatus: (status: OrderBookConnectionStatus) => void;
  private readonly createSocket: (url: string) => WebSocketLike;
  private readonly url: string;
  private readonly depth: number;
  private readonly heartbeatMs: number;
  private readonly reconnectBaseDelayMs: number;
  private readonly reconnectMaxDelayMs: number;
  private readonly random: () => number;
  private readonly now: () => number;
  private socket: WebSocketLike | null = null;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private lastMessageAt = 0;
  private stopped = true;

  constructor(options: Books5ClientOptions) {
    this.instrument = options.instrument;
    this.onSnapshot = options.onSnapshot;
    this.onStatus = options.onStatus;
    this.createSocket = options.createSocket ?? ((url) => new WebSocket(url) as unknown as WebSocketLike);
    this.url = options.url ?? DEFAULT_WS_URL;
    this.depth = options.depth ?? 5;
    this.heartbeatMs = options.heartbeatMs ?? 20_000;
    this.reconnectBaseDelayMs = options.reconnectBaseDelayMs ?? 500;
    this.reconnectMaxDelayMs = options.reconnectMaxDelayMs ?? 10_000;
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.reconnectAttempt = 0;
    this.onStatus("connecting");
    this.connect();
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.clearTimers();
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close(1000, "client stopped");
    }
    this.onStatus("stopped");
  }

  private connect(): void {
    if (this.stopped) return;
    let socket: WebSocketLike;
    try {
      socket = this.createSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      if (this.stopped || this.socket !== socket) return;
      this.lastMessageAt = this.now();
      socket.send(JSON.stringify({
        op: "subscribe",
        args: [{ channel: "books5", instId: this.instrument }],
      }));
      this.scheduleHeartbeat();
    };
    socket.onmessage = (event) => {
      if (this.stopped || this.socket !== socket || typeof event.data !== "string") return;
      this.lastMessageAt = this.now();
      if (event.data === "pong") return;
      try {
        const payload = JSON.parse(event.data) as unknown;
        if (!payload || typeof payload !== "object" || !("data" in payload)) return;
        const snapshot = normalizeOkxOrderBook(payload, this.instrument, this.depth);
        this.reconnectAttempt = 0;
        this.onSnapshot(snapshot);
        this.onStatus("live");
      } catch {
        // Ignore malformed or unrelated frames while preserving the last valid book.
      }
    };
    socket.onerror = () => {
      if (!this.stopped && this.socket === socket) socket.close(4001, "socket error");
    };
    socket.onclose = () => {
      if (this.stopped || this.socket !== socket) return;
      this.socket = null;
      this.scheduleReconnect();
    };
  }

  private scheduleHeartbeat(): void {
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = setTimeout(() => {
      this.heartbeatTimer = null;
      const socket = this.socket;
      if (this.stopped || !socket || socket.readyState !== 1) return;
      const idleFor = this.now() - this.lastMessageAt;
      if (idleFor >= this.heartbeatMs * 2) {
        socket.close(4000, "heartbeat timeout");
        return;
      }
      if (idleFor >= this.heartbeatMs) socket.send("ping");
      this.scheduleHeartbeat();
    }, this.heartbeatMs);
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.onStatus("reconnecting");
    const exponential = Math.min(
      this.reconnectMaxDelayMs,
      this.reconnectBaseDelayMs * (2 ** this.reconnectAttempt),
    );
    const delay = Math.round(exponential * (0.8 + this.random() * 0.4));
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
  }
}

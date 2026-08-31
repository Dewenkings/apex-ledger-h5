import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  account: {
    state: "ready",
    balance: { totalEquity: "50000", updatedAt: 1, assets: [{ currency: "USDT", available: "49000", balance: "50000", frozen: "1000", equity: "50000" }], scope: "shared-okx-demo", virtual: true },
    message: "",
    reload: vi.fn(),
  },
  wallet: {
    state: "ready",
    assets: [{ source: "onchain", chainId: 1, symbol: "ETH", balance: "2.5", decimals: 18, usdValue: null, updatedAt: 1 }],
  },
  wagmi: { address: "0x0000000000000000000000000000000000000001", chainId: 1, isConnected: true },
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/portfolio" }));
vi.mock("wagmi", () => ({ useAccount: () => mocks.wagmi }));
vi.mock("@/components/trade/use-demo-account", () => ({ useDemoAccount: () => mocks.account }));
vi.mock("@/features/wallet/use-wallet-assets", () => ({
  useWalletAssets: () => mocks.wallet,
  getWalletChainName: () => "Ethereum",
}));

import { PortfolioScreen } from "./portfolio-screen";

describe("PortfolioScreen", () => {
  beforeEach(() => {
    mocks.account.state = "ready";
    mocks.wallet.state = "ready";
    mocks.wagmi.isConnected = true;
  });

  it("shows the Demo and on-chain ledgers as separate sources", () => {
    render(<PortfolioScreen />);
    expect(screen.getByText("OKX DEMO · VIRTUAL FUNDS")).toBeInTheDocument();
    expect(screen.getByText("ON-CHAIN · READ ONLY")).toBeInTheDocument();
    expect(screen.getByText("两类资产不会合并计算")).toBeInTheDocument();
    expect(screen.getByText("50,000 USDT")).toBeInTheDocument();
    expect(screen.getByText("2.5 ETH")).toBeInTheDocument();
    expect(screen.queryByText("52,500 USDT")).not.toBeInTheDocument();
  });

  it("keeps the Demo balance visible when the wallet RPC fails", () => {
    mocks.wallet.state = "error";
    render(<PortfolioScreen />);
    expect(screen.getByText("50,000 USDT")).toBeInTheDocument();
    expect(screen.getByText("链上余额暂时不可用")).toBeInTheDocument();
  });

  it("offers wallet connection without hiding Demo virtual funds", () => {
    mocks.wagmi.isConnected = false;
    render(<PortfolioScreen />);
    expect(screen.getByText("50,000 USDT")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "连接钱包读取链上余额" })).toHaveAttribute("href", "/connect-wallet");
  });
});

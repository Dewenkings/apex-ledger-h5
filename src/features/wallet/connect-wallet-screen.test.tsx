import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  disconnect: vi.fn(),
  signIn: vi.fn(),
  logout: vi.fn().mockResolvedValue(true),
  session: {
    status: "disconnected",
    address: undefined as `0x${string}` | undefined,
    chainId: undefined as number | undefined,
    error: null as string | null,
    unsupportedNetwork: false,
    sessionLoading: false,
  },
}));

vi.mock("@reown/appkit/react", () => ({ useAppKit: () => ({ open: mocks.open }) }));
vi.mock("wagmi", () => ({ useDisconnect: () => ({ disconnect: mocks.disconnect }) }));
vi.mock("@/components/layout/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/features/auth/use-siwe-session", () => ({
  useSiweSession: () => ({ ...mocks.session, signIn: mocks.signIn, logout: mocks.logout }),
}));

import { ConnectWalletScreen } from "./connect-wallet-screen";

describe("ConnectWalletScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logout.mockResolvedValue(true);
    Object.assign(mocks.session, {
      status: "disconnected",
      address: undefined,
      chainId: undefined,
      error: null,
      unsupportedNetwork: false,
      sessionLoading: false,
    });
  });

  it("opens AppKit from the disconnected state", () => {
    render(<ConnectWalletScreen />);
    fireEvent.click(screen.getByRole("button", { name: "连接钱包" }));
    expect(mocks.open).toHaveBeenCalledWith({ view: "Connect" });
    expect(screen.getByText(/不授权转账/)).toBeInTheDocument();
  });

  it("explains that connecting is not authentication and starts SIWE", () => {
    Object.assign(mocks.session, { status: "connected", address: "0x0000000000000000000000000000000000000001", chainId: 1 });
    render(<ConnectWalletScreen />);
    expect(screen.getByText("连接不等于登录")).toBeInTheDocument();
    expect(screen.getByText("签名仅用于登录，不授权转账，不产生 Gas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "签名并登录" }));
    expect(mocks.signIn).toHaveBeenCalledTimes(1);
  });

  it("labels BNB Smart Chain when that network is connected", () => {
    Object.assign(mocks.session, { status: "connected", address: "0x0000000000000000000000000000000000000001", chainId: 56 });
    render(<ConnectWalletScreen />);
    expect(screen.getByText("BNB Smart Chain")).toBeInTheDocument();
    expect(screen.getByText(/支持 Ethereum、Base、Arbitrum 与 BNB Smart Chain/)).toBeInTheDocument();
  });

  it("renders signing and authenticated states", () => {
    Object.assign(mocks.session, { status: "signing", address: "0x0000000000000000000000000000000000000001", chainId: 1 });
    const { rerender } = render(<ConnectWalletScreen />);
    expect(screen.getByRole("button", { name: "等待钱包签名…" })).toBeDisabled();

    Object.assign(mocks.session, { status: "authenticated" });
    rerender(<ConnectWalletScreen />);
    expect(screen.getByText("钱包身份已验证")).toBeInTheDocument();
  });

  it("offers a network switch path and safe disconnect", async () => {
    Object.assign(mocks.session, {
      status: "error",
      address: "0x0000000000000000000000000000000000000001",
      chainId: 137,
      unsupportedNetwork: true,
      error: "请切换至 Ethereum、Base、Arbitrum 或 BNB Smart Chain 网络",
    });
    render(<ConnectWalletScreen />);
    fireEvent.click(screen.getByRole("button", { name: "切换网络" }));
    expect(mocks.open).toHaveBeenCalledWith({ view: "Networks" });

    fireEvent.click(screen.getByRole("button", { name: "断开钱包" }));
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mocks.disconnect).toHaveBeenCalledTimes(1));
  });

  it("prevents duplicate disconnect requests while logout is pending", async () => {
    Object.assign(mocks.session, { status: "authenticated", address: "0x0000000000000000000000000000000000000001", chainId: 1 });
    let finishLogout: (value: boolean) => void = () => undefined;
    mocks.logout.mockReturnValue(new Promise<boolean>((resolve) => { finishLogout = resolve; }));
    render(<ConnectWalletScreen />);
    const button = screen.getByRole("button", { name: "断开钱包" });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "正在断开…" })).toBeDisabled();
    finishLogout(true);
    await waitFor(() => expect(mocks.disconnect).toHaveBeenCalledTimes(1));
  });
});

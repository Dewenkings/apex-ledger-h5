import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  disconnect: vi.fn(),
  signIn: vi.fn(),
  logout: vi.fn().mockResolvedValue(true),
  session: {
    status: "disconnected" as "disconnected" | "connected" | "signing" | "authenticated" | "error",
    address: undefined as string | undefined,
    chainId: undefined as number | undefined,
    error: null as string | null,
    unsupportedNetwork: false,
    sessionLoading: false,
  },
}));

vi.mock("@reown/appkit/react", () => ({ useAppKit: () => ({ open: mocks.open }) }));
vi.mock("wagmi", () => ({ useDisconnect: () => ({ disconnect: mocks.disconnect }) }));
vi.mock("@/features/auth/use-siwe-session", () => ({
  useSiweSession: () => ({ ...mocks.session, signIn: mocks.signIn, logout: mocks.logout }),
}));

import { WalletAccountControl } from "./wallet-account-control";

describe("WalletAccountControl", () => {
  beforeEach(() => {
    mocks.open.mockReset();
    mocks.disconnect.mockReset();
    mocks.signIn.mockReset();
    mocks.logout.mockReset().mockResolvedValue(true);
    Object.assign(mocks.session, {
      status: "disconnected",
      address: undefined,
      chainId: undefined,
      error: null,
      unsupportedNetwork: false,
      sessionLoading: false,
    });
  });

  it("opens the wallet picker from a clear disconnected action", () => {
    render(<WalletAccountControl />);
    fireEvent.click(screen.getByRole("button", { name: "连接钱包" }));
    expect(mocks.open).toHaveBeenCalledWith({ view: "Connect" });
  });

  it("shows a connected but unverified account and offers explicit SIWE login", () => {
    Object.assign(mocks.session, {
      status: "connected",
      address: "0xC75200000000000000000000000000000000eD36",
      chainId: 1,
    });
    render(<WalletAccountControl />);

    fireEvent.click(screen.getByRole("button", { name: /钱包账户 0xC752/ }));

    expect(screen.getByRole("dialog", { name: "钱包账户" })).toBeInTheDocument();
    expect(screen.getByText("已连接 · 待验证")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "签名登录" }));
    expect(mocks.signIn).toHaveBeenCalledTimes(1);
  });

  it("keeps logout and full wallet disconnect as separate authenticated actions", async () => {
    Object.assign(mocks.session, {
      status: "authenticated",
      address: "0xC75200000000000000000000000000000000eD36",
      chainId: 8453,
    });
    render(<WalletAccountControl />);

    fireEvent.click(screen.getByRole("button", { name: /钱包账户 0xC752/ }));
    expect(screen.getByText("已登录")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(mocks.disconnect).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "退出登录" })).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: "断开钱包" }));
    await waitFor(() => expect(mocks.disconnect).toHaveBeenCalledTimes(1));
    expect(mocks.logout).toHaveBeenCalledTimes(2);
  });

  it("locks background scrolling and restores focus when the account sheet closes", async () => {
    Object.assign(mocks.session, {
      status: "connected",
      address: "0xC75200000000000000000000000000000000eD36",
      chainId: 1,
    });
    render(<WalletAccountControl />);
    const trigger = screen.getByRole("button", { name: /钱包账户 0xC752/ });

    fireEvent.click(trigger);
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "钱包账户" })).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe("");
    expect(trigger).toHaveFocus();
  });

  it("keeps the connector attached when server-side logout fails", async () => {
    Object.assign(mocks.session, {
      status: "authenticated",
      address: "0xC75200000000000000000000000000000000eD36",
      chainId: 1,
    });
    mocks.logout.mockResolvedValue(false);
    render(<WalletAccountControl />);

    fireEvent.click(screen.getByRole("button", { name: /钱包账户 0xC752/ }));
    fireEvent.click(screen.getByRole("button", { name: "断开钱包" }));

    await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1));
    expect(mocks.disconnect).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "钱包账户" })).toBeInTheDocument();
  });

  it("prevents duplicate disconnect requests while logout is pending", async () => {
    Object.assign(mocks.session, {
      status: "authenticated",
      address: "0xC75200000000000000000000000000000000eD36",
      chainId: 1,
    });
    let finishLogout: (value: boolean) => void = () => undefined;
    mocks.logout.mockReturnValue(new Promise<boolean>((resolve) => { finishLogout = resolve; }));
    render(<WalletAccountControl />);

    fireEvent.click(screen.getByRole("button", { name: /钱包账户 0xC752/ }));
    const disconnectButton = screen.getByRole("button", { name: "断开钱包" });
    fireEvent.click(disconnectButton);
    fireEvent.click(disconnectButton);

    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "断开中…" })).toBeDisabled();
    finishLogout(true);
    await waitFor(() => expect(mocks.disconnect).toHaveBeenCalledTimes(1));
  });
});

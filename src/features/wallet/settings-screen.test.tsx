import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  disconnect: vi.fn(),
  logout: vi.fn().mockResolvedValue(true),
  clipboard: vi.fn(),
  session: {
    status: "authenticated",
    address: "0x0000000000000000000000000000000000000001" as `0x${string}`,
    chainId: 1,
    error: null,
    unsupportedNetwork: false,
    sessionLoading: false,
  },
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/settings" }));
vi.mock("@reown/appkit/react", () => ({ useAppKit: () => ({ open: mocks.open }) }));
vi.mock("wagmi", () => ({ useDisconnect: () => ({ disconnect: mocks.disconnect }) }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: { authenticated: true }, isLoading: false, isError: false }) }));
vi.mock("@/features/auth/use-siwe-session", () => ({ useSiweSession: () => ({ ...mocks.session, logout: mocks.logout }) }));

import { SettingsScreen } from "./settings-screen";

describe("SettingsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logout.mockResolvedValue(true);
    Object.assign(mocks.session, { status: "authenticated", chainId: 1, unsupportedNetwork: false });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: mocks.clipboard.mockResolvedValue(undefined) } });
  });

  it("shows wallet identity, SIWE, and Demo authorization as separate states", () => {
    render(<SettingsScreen />);
    expect(screen.getByText("钱包身份")).toBeInTheDocument();
    expect(screen.getByText("SIWE 登录")).toBeInTheDocument();
    expect(screen.getByText("模拟交易权限")).toBeInTheDocument();
    expect(screen.getByText("已验证")).toBeInTheDocument();
    expect(screen.getByText("已授权")).toBeInTheDocument();
  });

  it("keeps SIWE-only logout separate while full disconnect also clears the session", async () => {
    render(<SettingsScreen />);
    fireEvent.click(screen.getByRole("button", { name: "退出钱包登录" }));
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(mocks.disconnect).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "断开钱包连接" })).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: "断开钱包连接" }));
    await waitFor(() => expect(mocks.disconnect).toHaveBeenCalledTimes(1));
    expect(mocks.logout).toHaveBeenCalledTimes(2);
  });

  it("copies the full address only after an explicit action", async () => {
    render(<SettingsScreen />);
    expect(screen.getByText("0x0000...0001")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "复制完整钱包地址" }));
    expect(mocks.clipboard).toHaveBeenCalledWith(mocks.session.address);
    await waitFor(() => expect(screen.getByText("已复制")).toBeInTheDocument());
  });

  it("opens AppKit network selection", () => {
    render(<SettingsScreen />);
    fireEvent.click(screen.getByRole("button", { name: "切换钱包网络" }));
    expect(mocks.open).toHaveBeenCalledWith({ view: "Networks" });
  });

  it("prevents duplicate disconnect requests", async () => {
    let finishLogout: (value: boolean) => void = () => undefined;
    mocks.logout.mockReturnValue(new Promise<boolean>((resolve) => { finishLogout = resolve; }));
    render(<SettingsScreen />);
    const button = screen.getByRole("button", { name: "断开钱包连接" });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "正在断开钱包" })).toBeDisabled();
    finishLogout(true);
    await waitFor(() => expect(mocks.disconnect).toHaveBeenCalledTimes(1));
  });
});

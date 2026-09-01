import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  account: { address: undefined as `0x${string}` | undefined, chainId: undefined as number | undefined, isConnected: false },
  signMessageAsync: vi.fn(),
  getChallenge: vi.fn(),
  verifySiwe: vi.fn(),
  getSiweSession: vi.fn(),
  logoutSiwe: vi.fn(),
}));

vi.mock("wagmi", () => ({
  useAccount: () => mocks.account,
  useSignMessage: () => ({ signMessageAsync: mocks.signMessageAsync }),
}));

vi.mock("./auth-client", () => ({
  AuthClientError: class AuthClientError extends Error {
    constructor(readonly code: string, message: string) { super(message); }
  },
  getChallenge: mocks.getChallenge,
  verifySiwe: mocks.verifySiwe,
  getSiweSession: mocks.getSiweSession,
  logoutSiwe: mocks.logoutSiwe,
}));

import { AuthClientError } from "./auth-client";
import { useSiweSession } from "./use-siwe-session";

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

describe("useSiweSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.account.address = undefined;
    mocks.account.chainId = undefined;
    mocks.account.isConnected = false;
    mocks.getSiweSession.mockResolvedValue({ authenticated: false });
    mocks.getChallenge.mockResolvedValue({
      nonce: "12345678",
      issuedAt: "2026-08-31T00:00:00.000Z",
      expirationTime: "2026-08-31T00:05:00.000Z",
      statement: "Sign in to Apex Ledger. This does not authorize transfers or trading.",
    });
    mocks.signMessageAsync.mockResolvedValue("0xsigned");
    mocks.verifySiwe.mockResolvedValue({ authenticated: true, address: "0x0000000000000000000000000000000000000001", chainId: 1, expiresAt: 1 });
    mocks.logoutSiwe.mockResolvedValue({ authenticated: false });
  });

  it("is disconnected until a wallet is connected", async () => {
    const { result } = renderHook(() => useSiweSession(), { wrapper });
    await waitFor(() => expect(result.current.sessionLoading).toBe(false));
    expect(result.current.status).toBe("disconnected");
  });

  it("signs the canonical challenge and becomes authenticated", async () => {
    mocks.account.address = "0x0000000000000000000000000000000000000001";
    mocks.account.chainId = 1;
    mocks.account.isConnected = true;
    const { result } = renderHook(() => useSiweSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("connected"));

    await act(() => result.current.signIn());

    expect(mocks.signMessageAsync).toHaveBeenCalledTimes(1);
    expect(mocks.signMessageAsync.mock.calls[0][0].message).toContain("Apex Ledger");
    expect(mocks.verifySiwe).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("authenticated");
  });

  it("allows a BNB Smart Chain wallet to sign in", async () => {
    mocks.account.address = "0x0000000000000000000000000000000000000001";
    mocks.account.chainId = 56;
    mocks.account.isConnected = true;
    mocks.verifySiwe.mockResolvedValue({ authenticated: true, address: mocks.account.address, chainId: 56, expiresAt: 1 });
    const { result } = renderHook(() => useSiweSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("connected"));

    await act(() => result.current.signIn());

    expect(result.current.unsupportedNetwork).toBe(false);
    expect(mocks.signMessageAsync).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("authenticated");
  });

  it("blocks unsupported networks before requesting a signature", async () => {
    mocks.account.address = "0x0000000000000000000000000000000000000001";
    mocks.account.chainId = 137;
    mocks.account.isConnected = true;
    const { result } = renderHook(() => useSiweSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("connected"));
    expect(result.current.unsupportedNetwork).toBe(true);

    await act(() => result.current.signIn());

    expect(result.current.status).toBe("error");
    expect(result.current.error).toMatch(/Ethereum、Base、Arbitrum 或 BNB Smart Chain/);
    expect(mocks.signMessageAsync).not.toHaveBeenCalled();
  });

  it("surfaces a rejected wallet signature without calling verify", async () => {
    mocks.account.address = "0x0000000000000000000000000000000000000001";
    mocks.account.chainId = 1;
    mocks.account.isConnected = true;
    mocks.signMessageAsync.mockRejectedValue(new Error("User rejected the request"));
    const { result } = renderHook(() => useSiweSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("connected"));

    await act(() => result.current.signIn());

    expect(result.current.status).toBe("error");
    expect(result.current.error).toMatch(/取消/);
    expect(mocks.verifySiwe).not.toHaveBeenCalled();
  });

  it("reissues and resigns once when the nonce expires", async () => {
    mocks.account.address = "0x0000000000000000000000000000000000000001";
    mocks.account.chainId = 1;
    mocks.account.isConnected = true;
    mocks.verifySiwe
      .mockRejectedValueOnce(new AuthClientError("nonce_expired", "expired"))
      .mockResolvedValueOnce({ authenticated: true, address: mocks.account.address, chainId: 1, expiresAt: 2 });
    const { result } = renderHook(() => useSiweSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("connected"));

    await act(() => result.current.signIn());

    expect(mocks.getChallenge).toHaveBeenCalledTimes(2);
    expect(mocks.signMessageAsync).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("authenticated");
  });

  it("clears the authenticated session on logout", async () => {
    mocks.account.address = "0x0000000000000000000000000000000000000001";
    mocks.account.chainId = 1;
    mocks.account.isConnected = true;
    mocks.getSiweSession.mockResolvedValue({ authenticated: true, address: mocks.account.address, chainId: 1, expiresAt: 2 });
    const { result } = renderHook(() => useSiweSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    let loggedOut = false;
    await act(async () => { loggedOut = await result.current.logout(); });

    expect(mocks.logoutSiwe).toHaveBeenCalledTimes(1);
    expect(loggedOut).toBe(true);
    expect(result.current.status).toBe("connected");
  });

  it("reports logout failure so callers keep the connector attached", async () => {
    mocks.account.address = "0x0000000000000000000000000000000000000001";
    mocks.account.chainId = 1;
    mocks.account.isConnected = true;
    mocks.logoutSiwe.mockRejectedValue(new Error("network unavailable"));
    const { result } = renderHook(() => useSiweSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("connected"));

    let loggedOut = true;
    await act(async () => { loggedOut = await result.current.logout(); });

    expect(loggedOut).toBe(false);
    expect(result.current.error).toMatch(/未完成/);
  });
});

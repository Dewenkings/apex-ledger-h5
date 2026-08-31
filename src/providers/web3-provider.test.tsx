import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieToInitialState: vi.fn(() => ({ chainId: 1 })),
  wagmiConfig: { id: "test-config" },
}));

vi.mock("@/lib/web3/appkit", () => ({ wagmiConfig: mocks.wagmiConfig }));
vi.mock("wagmi", () => ({
  cookieToInitialState: mocks.cookieToInitialState,
  WagmiProvider: ({ children, initialState }: { children: ReactNode; initialState: unknown }) => (
    <div data-testid="wagmi" data-state={JSON.stringify(initialState)}>{children}</div>
  ),
}));
vi.mock("@tanstack/react-query", () => ({
  QueryClient: class QueryClient {},
  QueryClientProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import { Web3Provider } from "./web3-provider";

describe("Web3Provider", () => {
  it("hydrates wagmi from request cookies and renders children", () => {
    render(<Web3Provider cookies="wagmi.store=value"><span>child</span></Web3Provider>);
    expect(screen.getByText("child")).toBeInTheDocument();
    expect(screen.getByTestId("wagmi")).toHaveAttribute("data-state", JSON.stringify({ chainId: 1 }));
    expect(mocks.cookieToInitialState).toHaveBeenCalledWith(mocks.wagmiConfig, "wagmi.store=value");
  });
});

import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMarketSearch } from "./use-market-search";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function SearchProbe({ query }: { query: string }) {
  const search = useMarketSearch(query);
  return <span>{search.state}:{search.results.map(({ baseSymbol }) => baseSymbol).join(",")}</span>;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useMarketSearch", () => {
  it("ignores a stale response that resolves after the current query", async () => {
    vi.useFakeTimers();
    const btc = deferred<Response>();
    const eth = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => String(input).includes("btc") ? btc.promise : eth.promise));
    const view = render(<SearchProbe query="btc" />);
    await act(async () => { vi.advanceTimersByTime(280); });
    view.rerender(<SearchProbe query="eth" />);
    await act(async () => { vi.advanceTimersByTime(280); });

    await act(async () => { eth.resolve(Response.json({ data: [{ baseSymbol: "ETH" }] })); await Promise.resolve(); });
    expect(screen.getByText("ready:ETH")).toBeInTheDocument();

    await act(async () => { btc.resolve(Response.json({ data: [{ baseSymbol: "BTC" }] })); await Promise.resolve(); });
    expect(screen.getByText("ready:ETH")).toBeInTheDocument();
  });
});

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { cookieToInitialState, WagmiProvider } from "wagmi";

import { wagmiConfig } from "@/lib/web3/appkit";

export function Web3Provider({ children, cookies }: { children: ReactNode; cookies: string | null }) {
  const [queryClient] = useState(() => new QueryClient());
  const initialState = useMemo(() => cookieToInitialState(wagmiConfig, cookies), [cookies]);

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState} reconnectOnMount>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

"use client";

import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { arbitrum, base, mainnet } from "@reown/appkit/networks";
import { cookieStorage, createStorage } from "wagmi";

import { readReownProjectId } from "./chains";

export const appKitNetworks: [typeof mainnet, typeof base, typeof arbitrum] = [mainnet, base, arbitrum];
export const reownProjectId = readReownProjectId({
  NEXT_PUBLIC_REOWN_PROJECT_ID: process.env.NEXT_PUBLIC_REOWN_PROJECT_ID,
});

export const wagmiAdapter = new WagmiAdapter({
  networks: appKitNetworks,
  projectId: reownProjectId,
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

createAppKit({
  adapters: [wagmiAdapter],
  networks: appKitNetworks,
  defaultNetwork: mainnet,
  projectId: reownProjectId,
  metadata: {
    name: "Apex Ledger",
    description: "Read-only EVM identity and OKX Demo paper trading portfolio.",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "https://apex-ledger-h5.vercel.app",
    icons: ["https://apex-ledger-h5.vercel.app/icon.png"],
  },
  features: { analytics: false },
});

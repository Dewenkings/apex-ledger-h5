"use client";

import { ShieldCheck } from "@phosphor-icons/react";
import { useAccount } from "wagmi";

import { AppShell } from "@/components/layout/app-shell";
import { BrandHeader } from "@/components/layout/brand-header";
import { useDemoAccount } from "@/components/trade/use-demo-account";
import { useWalletAssets } from "@/features/wallet/use-wallet-assets";
import { DemoBalanceCard } from "./demo-balance-card";
import { OnchainWalletCard } from "./onchain-wallet-card";

export function PortfolioScreen() {
  const demoAccount = useDemoAccount();
  const wallet = useAccount();
  const walletAssets = useWalletAssets(wallet.address, wallet.chainId);
  return (
    <AppShell>
      <BrandHeader title="资产总览" subtitle="DUAL LEDGER PORTFOLIO" />
      <div className="ledger-separation-note"><ShieldCheck /><div><strong>模拟账户与链上钱包分别计算</strong><span>交易所虚拟资金与钱包公开余额保持独立，不进行资产合并。</span></div></div>
      <DemoBalanceCard account={demoAccount} />
      <OnchainWalletCard connected={wallet.isConnected} address={wallet.address} chainId={wallet.chainId} state={walletAssets.state} assets={walletAssets.assets} />
    </AppShell>
  );
}

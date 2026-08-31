"use client";

import { Plus, ShieldCheck } from "@phosphor-icons/react";
import Link from "next/link";
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
      <div className="ledger-separation-note"><ShieldCheck /><div><strong>两类资产不会合并计算</strong><span>Demo 是交易所模拟资金；On-chain 是钱包公开只读余额。</span></div></div>
      <DemoBalanceCard account={demoAccount} />
      <div className="ledger-divider"><span>SEPARATE DATA SOURCE</span></div>
      <OnchainWalletCard connected={wallet.isConnected} address={wallet.address} chainId={wallet.chainId} state={walletAssets.state} assets={walletAssets.assets} />
      <div className="quick-actions"><Link href="/trade/btc-usdt"><Plus /><span>BTC 模拟交易</span></Link><Link href="/trade/eth-usdt"><Plus /><span>ETH 模拟交易</span></Link><Link href="/trade/sol-usdt"><Plus /><span>SOL 模拟交易</span></Link></div>
    </AppShell>
  );
}

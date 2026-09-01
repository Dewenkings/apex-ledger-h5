import { ArrowRight, LinkSimple, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";

import { getWalletChainName, type WalletAssetsState, type WalletAsset } from "@/features/wallet/use-wallet-assets";
import { formatTokenBalance } from "./asset-format";

export function OnchainWalletCard({
  connected,
  address,
  chainId,
  state,
  assets,
}: {
  connected: boolean;
  address?: string;
  chainId?: number;
  state: WalletAssetsState;
  assets: WalletAsset[];
}) {
  return (
    <section className="ledger-section onchain" aria-labelledby="onchain-ledger-title">
      <div className="ledger-heading">
        <div><span className="eyebrow">PUBLIC RPC · READ ONLY</span><h2 id="onchain-ledger-title">链上钱包</h2></div>
        <span className="ledger-source wallet"><i /> WALLET</span>
      </div>
      {!connected ? (
        <Link className="wallet-connect-card" href="/connect-wallet" aria-label="连接钱包读取链上余额"><LinkSimple /><div><strong>连接钱包读取链上余额</strong><span>仅访问公开地址与白名单 Token</span></div><ArrowRight /></Link>
      ) : state === "unsupported" ? (
        <div className="wallet-chain-state unsupported"><WarningCircle /><div><strong>当前网络暂不支持</strong><span>请选择 Ethereum、Base、Arbitrum 或 BNB Smart Chain</span></div><Link href="/settings" aria-label="切换网络">切换网络</Link></div>
      ) : state === "loading" ? (
        <div className="wallet-chain-state" role="status"><SpinnerGap className="wallet-spinner" />正在读取链上余额…</div>
      ) : state === "error" ? (
        <div className="wallet-chain-state error" role="alert"><WarningCircle />链上余额暂时不可用</div>
      ) : (
        <>
          <div className="wallet-chain-meta"><div><span>{getWalletChainName(chainId)}</span><strong className="mono">{shortAddress(address)}</strong></div><small>{state === "stale" ? "正在刷新 · 显示上次结果" : "RPC 已同步"}</small></div>
          <div className="asset-list compact">
            {assets.length ? assets.map((asset) => <div className="asset-row" key={`${asset.chainId}:${asset.symbol}`}><div><strong>{asset.symbol}</strong><small className="muted block">链上公开余额</small></div><strong className="mono">{formatTokenBalance(asset.balance)} {asset.symbol}</strong></div>) : <div className="empty">当前白名单资产余额为 0</div>}
          </div>
        </>
      )}
    </section>
  );
}

function shortAddress(address?: string): string {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "—";
}

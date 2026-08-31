"use client";

import { useQuery } from "@tanstack/react-query";
import { useAppKit } from "@reown/appkit/react";
import { CheckCircle, Copy, Database, LinkSimple, SignOut, Swap, UserCircle, Wallet, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import { useDisconnect } from "wagmi";

import { AppShell } from "@/components/layout/app-shell";
import { BrandHeader } from "@/components/layout/brand-header";
import { useSiweSession } from "@/features/auth/use-siwe-session";
import { getWalletChainName } from "./use-wallet-assets";

export function SettingsScreen() {
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const session = useSiweSession();
  const [copied, setCopied] = useState(false);
  const demoAuthorization = useQuery({
    queryKey: ["demo", "authorization"],
    queryFn: getDemoAuthorization,
    staleTime: 30_000,
    retry: false,
  });
  const connected = session.status !== "disconnected";
  const authenticated = session.status === "authenticated";

  async function copyAddress() {
    if (!session.address) return;
    try {
      await navigator.clipboard.writeText(session.address);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <AppShell>
      <BrandHeader title="个人设置" subtitle="IDENTITY & ENVIRONMENT" back="/portfolio" />
      <section className="identity-card">
        <div className="profile-avatar">{connected ? <Wallet weight="fill" /> : <UserCircle weight="fill" />}</div>
        <div><span className="eyebrow">CURRENT IDENTITY</span><h2>{connected ? "EVM Wallet" : "Anonymous Visitor"}</h2><span className="identity-safety">只读身份 · 不托管资产</span></div>
      </section>

      <section className="settings-section">
        <h3>身份与授权</h3>
        <StatusRow icon={<Wallet />} title="钱包身份" detail={connected ? `${shortAddress(session.address)} · ${getWalletChainName(session.chainId)}` : "尚未连接钱包"} state={connected ? "已连接" : "未连接"} tone={connected ? "positive" : "muted"} />
        <StatusRow icon={<CheckCircle />} title="SIWE 登录" detail="签名证明地址所有权，不授予转账权限" state={authenticated ? "已验证" : "未验证"} tone={authenticated ? "positive" : "muted"} />
        <StatusRow icon={<Database />} title="模拟交易权限" detail="OKX Demo 访问门禁，与钱包状态独立" state={demoAuthorization.isLoading ? "检查中" : demoAuthorization.data?.authenticated ? "已授权" : "未授权"} tone={demoAuthorization.data?.authenticated ? "positive" : "muted"} />
      </section>

      {connected && <section className="settings-section"><h3>钱包操作</h3><div className="setting-row"><span className="setting-icon"><Copy /></span><div><strong>完整钱包地址</strong><small className="muted block mono">{shortAddress(session.address)}</small></div><button type="button" className="settings-action" aria-label="复制完整钱包地址" onClick={() => void copyAddress()}>{copied ? "已复制" : "复制"}</button></div><div className="setting-row"><span className="setting-icon"><Swap /></span><div><strong>当前网络</strong><small className="muted block">{getWalletChainName(session.chainId)}</small></div><button type="button" className="settings-action" aria-label="切换钱包网络" onClick={() => open({ view: "Networks" })}>切换</button></div></section>}

      <section className="identity-boundary"><WarningCircle /><div><strong>操作边界</strong><span>退出 SIWE 或断开钱包都不会删除 Demo 订单；Demo 门禁也不会获得钱包权限。</span></div></section>
      <div className="settings-buttons">
        <button type="button" disabled={!authenticated} onClick={() => void session.logout()}><SignOut />退出钱包登录</button>
        <button type="button" disabled={!connected} onClick={() => disconnect()}><LinkSimple />断开钱包连接</button>
      </div>
    </AppShell>
  );
}

function StatusRow({ icon, title, detail, state, tone }: { icon: React.ReactNode; title: string; detail: string; state: string; tone: "positive" | "muted" }) {
  return <div className="setting-row"><span className="setting-icon">{icon}</span><div><strong>{title}</strong><small className="muted block">{detail}</small></div><span className={`settings-state ${tone}`}>{state}</span></div>;
}

async function getDemoAuthorization(): Promise<{ authenticated: boolean }> {
  const response = await fetch("/api/demo/session", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error("Demo authorization unavailable");
  return response.json();
}

function shortAddress(address?: string): string {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "—";
}

"use client";

import { useAppKit } from "@reown/appkit/react";
import { ArrowRight, CheckCircle, ShieldCheck, SpinnerGap, Wallet, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useDisconnect } from "wagmi";

import { AppShell } from "@/components/app-shell";
import { useSiweSession } from "@/features/auth/use-siwe-session";

const CHAIN_NAMES: Record<number, string> = { 1: "Ethereum", 8453: "Base", 42161: "Arbitrum" };

export function ConnectWalletScreen() {
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const session = useSiweSession();
  const connected = session.status !== "disconnected";

  function disconnectSafely() {
    void session.logout();
    disconnect();
  }

  return (
    <AppShell hideNav>
      <div className="connect-backdrop">
        <section className="wallet-modal" aria-labelledby="wallet-title">
          <header className="row between">
            <div className="row gap-10">
              <div className="security-icon small"><Wallet weight="fill" /></div>
              <div>
                <h1 id="wallet-title">连接钱包</h1>
                <span className="eyebrow">SIGN IN WITH ETHEREUM</span>
              </div>
            </div>
            <Link href="/markets" className="icon-button" aria-label="关闭"><X /></Link>
          </header>

          {!connected ? (
            <>
              <div className="wallet-intro">
                <span className="wallet-step">01 · CONNECT</span>
                <h2>用钱包证明你的链上身份</h2>
                <p className="wallet-copy">连接只读取公开地址。签名仅用于登录，不授权转账，不产生 Gas。</p>
              </div>
              <button className="primary-button" onClick={() => open({ view: "Connect" })}>
                <Wallet weight="fill" />连接钱包<ArrowRight />
              </button>
            </>
          ) : (
            <>
              <div className="wallet-identity">
                <div className="wallet-identicon" aria-hidden="true" />
                <div>
                  <span className="wallet-step">CONNECTED ADDRESS</span>
                  <strong className="mono">{shortAddress(session.address)}</strong>
                  <small>{session.chainId ? (CHAIN_NAMES[session.chainId] ?? `Chain ${session.chainId}`) : "读取网络中"}</small>
                </div>
                <CheckCircle weight="fill" />
              </div>

              {session.status === "authenticated" ? (
                <div className="wallet-authenticated" role="status">
                  <CheckCircle weight="fill" />
                  <div><strong>钱包身份已验证</strong><span>已建立安全登录会话，可继续访问你的演示工作区。</span></div>
                </div>
              ) : (
                <div className="wallet-login-stage">
                  <span className="wallet-step">02 · VERIFY</span>
                  <h2>连接不等于登录</h2>
                  <p>签名仅用于登录，不授权转账，不产生 Gas</p>
                  {session.error && <div className="warning-box" role="alert"><ShieldCheck /><span>{session.error}</span></div>}
                  {session.unsupportedNetwork ? (
                    <button className="primary-button" onClick={() => open({ view: "Networks" })}>切换网络</button>
                  ) : (
                    <button className="primary-button" disabled={session.status === "signing" || session.sessionLoading} onClick={() => void session.signIn()}>
                      {session.status === "signing" ? <><SpinnerGap className="wallet-spinner" />等待钱包签名…</> : <><ShieldCheck />签名并登录</>}
                    </button>
                  )}
                </div>
              )}

              <button className="wallet-disconnect" onClick={disconnectSafely}>断开钱包</button>
            </>
          )}

          <div className="siwe-note"><ShieldCheck /><div><strong>安全登录，不是支付</strong><span>没有私钥上传、没有链上交易，也不会读取或合并 OKX Demo 虚拟资金。</span></div></div>
          <p className="legal">本项目不托管资产。支持 Ethereum、Base 与 Arbitrum。</p>
          <Link href="/markets" className="secondary-button">稍后再说</Link>
        </section>
      </div>
    </AppShell>
  );
}

function shortAddress(address?: string): string {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "读取地址中";
}

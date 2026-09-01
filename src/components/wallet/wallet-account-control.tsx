"use client";

import { useAppKit } from "@reown/appkit/react";
import { ArrowRight, CheckCircle, Copy, LinkSimple, SignOut, SpinnerGap, Swap, Wallet, WarningCircle, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useDisconnect } from "wagmi";

import { useSiweSession } from "@/features/auth/use-siwe-session";
import { getWalletChainName } from "@/features/wallet/use-wallet-assets";

export function WalletAccountControl({ compact = false }: { compact?: boolean }) {
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const session = useSiweSession();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busyAction, setBusyAction] = useState<"logout" | "disconnect" | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const connected = session.status !== "disconnected";
  const authenticated = session.status === "authenticated";
  const short = shortAddress(session.address);

  useEffect(() => {
    if (!sheetOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSheet();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [sheetOpen]);

  function closeSheet() {
    setCopied(false);
    setSheetOpen(false);
    triggerRef.current?.focus();
  }

  function trapFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const controls = sheetRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!controls?.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function copyAddress() {
    if (!session.address) return;
    try {
      await navigator.clipboard.writeText(session.address);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function disconnectSafely() {
    if (busyAction) return;
    setBusyAction("disconnect");
    const loggedOut = await session.logout();
    if (loggedOut) {
      disconnect();
      closeSheet();
    }
    setBusyAction(null);
  }

  async function logoutOnly() {
    if (busyAction) return;
    setBusyAction("logout");
    await session.logout();
    setBusyAction(null);
  }

  if (!connected) {
    return <button type="button" className={`wallet-account-trigger disconnected ${compact ? "compact" : ""}`} aria-label="连接钱包" onClick={() => open({ view: "Connect" })}>
      <Wallet weight="fill" />
      <span>连接</span>
    </button>;
  }

  const accessibleStatus = authenticated ? "已登录" : session.unsupportedNetwork ? "网络异常" : "待验证";

  return <>
    <button ref={triggerRef} type="button" className={`wallet-account-trigger connected ${authenticated ? "authenticated" : "pending"} ${compact ? "compact" : ""}`} aria-label={`钱包账户 ${short}，${accessibleStatus}`} aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)}>
      <span className="wallet-account-avatar"><Wallet weight="fill" /></span>
      {!compact && <span className="wallet-account-address mono">{short}</span>}
      <i aria-hidden="true" />
    </button>

    {sheetOpen && <div className="wallet-sheet-layer">
      <button type="button" className="wallet-sheet-backdrop" aria-label="关闭钱包账户" onClick={closeSheet} />
      <section ref={sheetRef} className="wallet-account-sheet" role="dialog" aria-modal="true" aria-labelledby="wallet-account-title" onKeyDown={trapFocus}>
        <div className="wallet-sheet-handle" aria-hidden="true" />
        <header className="wallet-sheet-header">
          <div><span className="eyebrow">WALLET IDENTITY</span><h2 id="wallet-account-title">钱包账户</h2></div>
          <button type="button" className="icon-button" aria-label="关闭" autoFocus onClick={closeSheet}><X /></button>
        </header>

        <div className="wallet-account-summary">
          <span className="wallet-sheet-avatar"><Wallet weight="fill" /></span>
          <div><strong className="mono">{short}</strong><span>{getWalletChainName(session.chainId)}</span></div>
          <span className={`wallet-auth-state ${authenticated ? "verified" : session.unsupportedNetwork ? "warning" : "pending"}`}>
            {authenticated ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}
            {authenticated ? "已登录" : session.unsupportedNetwork ? "网络异常" : "已连接 · 待验证"}
          </span>
        </div>

        {session.error && <div className="wallet-sheet-warning" role="alert"><WarningCircle />{session.error}</div>}

        {!authenticated && <button type="button" className="wallet-sheet-primary" disabled={session.status === "signing" || session.sessionLoading} onClick={() => session.unsupportedNetwork ? open({ view: "Networks" }) : void session.signIn()}>
          {session.status === "signing" ? <><SpinnerGap className="wallet-spinner" />等待钱包签名…</> : session.unsupportedNetwork ? <><Swap />切换网络</> : <><CheckCircle />签名登录</>}
        </button>}

        <div className="wallet-sheet-actions">
          <button type="button" onClick={() => void copyAddress()}><Copy /><span><b>{copied ? "已复制" : "复制地址"}</b><small>复制完整钱包地址</small></span><ArrowRight /></button>
          <button type="button" onClick={() => open({ view: "Networks" })}><Swap /><span><b>切换网络</b><small>{getWalletChainName(session.chainId)}</small></span><ArrowRight /></button>
          <Link href="/settings" onClick={closeSheet}><Wallet /><span><b>账户与安全设置</b><small>查看身份与授权边界</small></span><ArrowRight /></Link>
        </div>

        <div className="wallet-sheet-danger">
          <button type="button" disabled={!authenticated || busyAction !== null} onClick={() => void logoutOnly()}><SignOut />{busyAction === "logout" ? "退出中…" : "退出登录"}</button>
          <button type="button" disabled={busyAction !== null} onClick={() => void disconnectSafely()}><LinkSimple />{busyAction === "disconnect" ? "断开中…" : "断开钱包"}</button>
        </div>
        <p>连接只读取公开地址；签名登录不会授权转账或产生 Gas。</p>
      </section>
    </div>}
  </>;
}

function shortAddress(address?: string): string {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "读取中";
}

"use client";

import { ChartLineUp, ListBullets, Swap, Wallet } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { getActiveNav } from "@/lib/trading";

const nav = [
  { key: "markets", label: "市场", href: "/markets", Icon: ChartLineUp },
  { key: "trade", label: "交易", href: "/trade/btc-usdt", Icon: Swap },
  { key: "orders", label: "订单", href: "/orders", Icon: ListBullets },
  { key: "portfolio", label: "资产", href: "/portfolio", Icon: Wallet },
] as const;

export function AppShell({ children, hideNav = false }: { children: React.ReactNode; hideNav?: boolean }) {
  const active = getActiveNav(usePathname());

  return (
    <div className="min-h-dvh bg-[#090b0d] min-[700px]:py-7">
      <div className="relative min-h-dvh w-full overflow-hidden bg-base min-[700px]:mx-auto min-[700px]:flex min-[700px]:h-[calc(100dvh-56px)] min-[700px]:min-h-0 min-[700px]:w-[430px] min-[700px]:flex-col min-[700px]:overflow-y-auto min-[700px]:rounded-[28px] min-[700px]:border min-[700px]:border-line min-[700px]:shadow-[0_30px_100px_#000]">
        <main
          className={`min-h-dvh px-4 pt-0 min-[700px]:min-h-0 min-[700px]:flex-1 min-[700px]:overflow-y-auto ${
            hideNav ? "pb-7" : "pb-[104px] min-[700px]:pb-6"
          }`}
        >
          {children}
        </main>
        {!hideNav && (
          <nav
            className="fixed inset-x-0 bottom-0 z-30 grid h-[82px] grid-cols-4 border-t border-line bg-[#101417ef] px-3 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-lg min-[700px]:sticky min-[700px]:inset-x-auto min-[700px]:bottom-0 min-[700px]:w-full min-[700px]:shrink-0 min-[700px]:translate-x-0 min-[700px]:rounded-b-[28px]"
            aria-label="Primary navigation"
          >
            {nav.map(({ key, label, href, Icon }) => (
              <Link
                key={key}
                href={href}
                className={`flex flex-col items-center justify-center gap-1 text-[10px] ${
                  active === key ? "text-primary" : "text-[#718078]"
                }`}
              >
                <Icon className="size-[23px]" weight={active === key ? "fill" : "regular"} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}

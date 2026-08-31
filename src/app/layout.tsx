import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";

import { Web3Provider } from "@/providers/web3-provider";
import "./globals.css";

export const metadata: Metadata = { title: "Apex Ledger — Paper Trading", description: "A mobile-first crypto paper-trading portfolio project." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b0e11" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieHeader = (await headers()).get("cookie");
  return <html lang="zh-CN"><body><Web3Provider cookies={cookieHeader}>{children}</Web3Provider></body></html>;
}

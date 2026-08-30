import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Apex Ledger — Paper Trading", description: "A mobile-first crypto paper-trading portfolio project." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b0e11" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}

import type { MarketSymbol } from "./market-data/types";

export type Market = {
  symbol: MarketSymbol | "USDT";
  name: string;
  price: number;
  change: number;
  color: string;
  icon: string;
  category: "Layer 1" | "DeFi" | "Payments";
  spark: number[];
};

export type MarketCatalogueItem = Market & { symbol: MarketSymbol };

export const markets: MarketCatalogueItem[] = [
  { symbol: "BTC", name: "Bitcoin", price: 68342.1, change: 2.84, color: "#f7931a", icon: "₿", category: "Payments", spark: [16, 20, 18, 26, 23, 31, 29, 38] },
  { symbol: "ETH", name: "Ethereum", price: 3521.64, change: -1.12, color: "#627eea", icon: "◆", category: "Layer 1", spark: [34, 32, 35, 28, 29, 24, 26, 22] },
  { symbol: "SOL", name: "Solana", price: 178.24, change: 4.67, color: "#9d63ff", icon: "S", category: "Layer 1", spark: [12, 15, 18, 16, 23, 26, 25, 34] },
  { symbol: "BNB", name: "BNB", price: 596.87, change: 1.18, color: "#f3ba2f", icon: "B", category: "Layer 1", spark: [17, 18, 21, 20, 24, 27, 26, 30] },
  { symbol: "ADA", name: "Cardano", price: 0.4521, change: -0.62, color: "#3468d4", icon: "A", category: "Layer 1", spark: [31, 29, 30, 26, 28, 24, 25, 21] },
  { symbol: "AVAX", name: "Avalanche", price: 36.92, change: 3.26, color: "#e84142", icon: "A", category: "Layer 1", spark: [13, 17, 16, 20, 23, 21, 27, 32] },
  { symbol: "DOT", name: "Polkadot", price: 7.14, change: 0.08, color: "#e6007a", icon: "●", category: "Layer 1", spark: [22, 23, 22, 24, 23, 24, 23, 24] },
  { symbol: "POL", name: "Polygon", price: 0.714, change: -2.21, color: "#8247e5", icon: "P", category: "DeFi", spark: [33, 31, 29, 30, 26, 25, 22, 19] },
];

export const walletProviders = [
  { name: "MetaMask", short: "M", color: "#f6851b", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuDyHwlmkQOSTcAKs-_Sz9sIOaSkak22U9FtRyCOhhpiwEtwFbh-QiWbMphn-ZV8Edr2LpUMP_2ieCPdVFYPkeU_5TXzHFmPOG-16pRYnlSxTnJO03Sy9wZLa8jrBvj6J-GyF1AmMedx25HQ4Uu9UcG4mEROkjzxebw5bJOh3LuaKtbl2FbyFQyuQqxVptacmV48JbWyvuC87eBJMAB--89DMjZGKDN7ovnPu-2Of5c7Jdw_5JTqEqyWKffCrCa0naDSzLeeWfgUeAo" },
  { name: "Coinbase Wallet", short: "C", color: "#1652f0", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuBtOXwQSNqy7-RQBtu4Vd_yctm0JAkgb5_79TYVZK4r0scPg9z9CqmugdqTb1cELBuIwkZ3sY539BU3Ugx877b8_HMMgg1TVWBQcixbHGtuSPoK2jD_7VMWDO1hjJ_wopQ9sF-0bmNFALtw6ge30dE5SyRPkrlw651NGHnMFAsDG-qy_fOoluhednGdXLnro_bsMk53q-idQlBPnxbPbLDPDjeFPqFwVmdxzhYVM12msk_VpJtii9VdxVRGEwIlyA0MMkIJtfagyVg" },
  { name: "WalletConnect", short: "W", color: "#3b99fc", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuBcpiKKTXr5Kmlk5O4xccq1gHBSez9L1AyUn691opH1LZDAcuL7rdDmRbHynsf7rNp4Zmqo5qn7uq7sSLQx5kTD84AJF5RYKPyKEOCnAVJjDOehkH-STlCmWhatc9REFYKia4pWIfsbgCRqkGM30i46Tc_3PmRAW9C-65ZhAOv6GqnxRfsYLTOmzmi1l5KdWDFTJSXEzLgFpXywWcE9YZxExwfgJ9kAqiTULGy13L0riURBatOusYMuir3IAlzyWVZ21X6nUxziVC8" },
  { name: "Trust Wallet", short: "T", color: "#3375bb", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuDY_G51Z-ruYP4_ynxUxFrH3e1CQGWHky-bI5c6eZwYCZ6P4tTs3NlS_ghvrFo0TWBUAPC8S_2k0ziUb2NHX81wqT-DFj564Vs7MatXFsPoMsHnoVRxZT0kmXC8zfTZq_EgR-W12bi0pBLgsM0IDq6_7QJxl50mWy3T5jFGRCV5SlYEPGY_8s9LpWh8kocqtc8ojllKdbgDJmeidBLkr3J-2E7oHMDodBeoy3rCbt_GJHoIWGeePde-XGSoMKV4rnSWk-r6_fqjers" },
];

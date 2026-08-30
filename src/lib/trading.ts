export type MarketLike = { symbol: string; name: string };

export function filterMarkets<T extends MarketLike>(markets: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return markets;
  return markets.filter(({ symbol, name }) =>
    `${symbol} ${name}`.toLowerCase().includes(needle),
  );
}

export function estimatePaperOrder(input: { amount: number; price: number; feeRate: number }) {
  const subtotal = roundMoney(input.amount * input.price);
  const fee = roundMoney(subtotal * input.feeRate);
  return { subtotal, fee, total: roundMoney(subtotal + fee) };
}

export type NavKey = "markets" | "trade" | "orders" | "portfolio";

export function getActiveNav(pathname: string): NavKey {
  if (pathname.startsWith("/trade")) return "trade";
  if (pathname.startsWith("/orders")) return "orders";
  if (pathname.startsWith("/portfolio") || pathname.startsWith("/settings")) return "portfolio";
  return "markets";
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

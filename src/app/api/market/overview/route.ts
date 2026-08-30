import { createOverviewProviders, getMarketOverview } from "@/lib/market-data/market-overview";
import { marketSymbols, toMarketInstrument } from "@/lib/market-data/types";

const CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=120";

export async function GET() {
  try {
    const instruments = marketSymbols.map((symbol) => toMarketInstrument(symbol));
    const result = await getMarketOverview(createOverviewProviders(), instruments);
    return Response.json(result, {
      headers: { "Cache-Control": CACHE_CONTROL },
    });
  } catch {
    return Response.json(
      { error: "Market overview temporarily unavailable" },
      { status: 502 },
    );
  }
}

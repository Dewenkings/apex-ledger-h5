import { createLiveMarketProviders, getTickerFromProviders } from "@/lib/market-data/market-service";

const successHeaders = {
  "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15",
};

export async function GET(): Promise<Response> {
  try {
    const result = await getTickerFromProviders(createLiveMarketProviders());
    return Response.json(result, { headers: successHeaders });
  } catch {
    return Response.json(
      { error: "Market data temporarily unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

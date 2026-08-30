import { createLiveMarketProviders, getTickerFromProviders } from "@/lib/market-data/market-service";
import { parseTradableInstrument } from "@/lib/trading/pairs";

const successHeaders = {
  "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15",
};

export async function GET(request: Request): Promise<Response> {
  const instrument = parseTradableInstrument(new URL(request.url).searchParams.get("instrument"));
  if (!instrument) {
    return Response.json({ error: "Unsupported trading instrument" }, { status: 400 });
  }

  try {
    const result = await getTickerFromProviders(instrument, createLiveMarketProviders());
    return Response.json(result, { headers: successHeaders });
  } catch {
    return Response.json(
      { error: "Market data temporarily unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

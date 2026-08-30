import { createLiveMarketProviders, getCandlesFromProviders } from "@/lib/market-data/market-service";
import { isChartPeriod } from "@/lib/market-data/types";
import { parseTradableInstrument } from "@/lib/trading/pairs";

const successHeaders = {
  "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
};

export async function GET(request: Request): Promise<Response> {
  const searchParams = new URL(request.url).searchParams;
  const instrument = parseTradableInstrument(searchParams.get("instrument"));
  const period = searchParams.get("period");
  if (!instrument) {
    return Response.json({ error: "Unsupported trading instrument" }, { status: 400 });
  }
  if (!isChartPeriod(period)) {
    return Response.json({ error: "Unsupported chart period" }, { status: 400 });
  }

  try {
    const result = await getCandlesFromProviders(instrument, period, createLiveMarketProviders(), 120);
    return Response.json(result, { headers: successHeaders });
  } catch {
    return Response.json(
      { error: "Market data temporarily unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

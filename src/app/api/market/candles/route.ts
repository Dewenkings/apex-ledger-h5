import { createLiveMarketProviders, getCandlesFromProviders } from "@/lib/market-data/market-service";
import { isChartPeriod } from "@/lib/market-data/types";

const successHeaders = {
  "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
};

export async function GET(request: Request): Promise<Response> {
  const period = new URL(request.url).searchParams.get("period");
  if (!isChartPeriod(period)) {
    return Response.json({ error: "Unsupported chart period" }, { status: 400 });
  }

  try {
    const result = await getCandlesFromProviders(period, createLiveMarketProviders(), 120);
    return Response.json(result, { headers: successHeaders });
  } catch {
    return Response.json(
      { error: "Market data temporarily unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

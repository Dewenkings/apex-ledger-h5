import { OkxMarketAdapter } from "@/lib/market-data/okx";
import { parseTradableInstrument } from "@/lib/trading/pairs";

const cacheHeaders = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" };

export async function GET(request: Request): Promise<Response> {
  const instrument = parseTradableInstrument(new URL(request.url).searchParams.get("instrument"));
  if (!instrument) return Response.json({ error: "Unsupported trading instrument" }, { status: 400 });

  try {
    const data = await new OkxMarketAdapter(fetch, 5_000).getSpotInstrument(instrument);
    return Response.json({ data }, { headers: cacheHeaders });
  } catch {
    return Response.json({ error: "Instrument information temporarily unavailable" }, { status: 502 });
  }
}

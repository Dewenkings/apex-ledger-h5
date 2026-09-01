import { OkxMarketAdapter } from "@/lib/market-data/okx";

const cacheHeaders = { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" };
const queryPattern = /^[A-Z0-9-]{2,20}$/;

export async function GET(request: Request): Promise<Response> {
  const query = (new URL(request.url).searchParams.get("q") ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s*\/\s*/g, "-");
  if (!queryPattern.test(query)) {
    return Response.json({ error: "Invalid market search query" }, { status: 400 });
  }

  try {
    const data = await new OkxMarketAdapter(fetch, 5_000).searchSpotMarkets(query, 20);
    return Response.json({ data }, { headers: cacheHeaders });
  } catch {
    return Response.json({ error: "Market search temporarily unavailable" }, { status: 502 });
  }
}

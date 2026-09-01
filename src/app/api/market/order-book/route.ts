import { OkxMarketAdapter } from "@/lib/market-data/okx";
import { parseTradableInstrument } from "@/lib/trading/pairs";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  const instrument = parseTradableInstrument(new URL(request.url).searchParams.get("instrument"));
  if (!instrument) {
    return Response.json({ error: "Unsupported trading instrument" }, { status: 400, headers: noStoreHeaders });
  }

  try {
    const data = await new OkxMarketAdapter(fetch, 3_500).getOrderBookForInstrument(instrument, 5);
    return Response.json({ source: "okx", data }, { headers: noStoreHeaders });
  } catch {
    return Response.json(
      { error: "Order book temporarily unavailable" },
      { status: 502, headers: noStoreHeaders },
    );
  }
}

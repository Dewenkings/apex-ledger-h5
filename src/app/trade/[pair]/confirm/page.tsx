import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ConfirmScreen } from "@/components/screens";
import { getPairBySlug } from "@/lib/trading/pairs";

export default async function Page({ params }: { params: Promise<{ pair: string }> }) {
  const pair = getPairBySlug((await params).pair);
  if (!pair) notFound();
  return <Suspense fallback={null}><ConfirmScreen pair={pair} /></Suspense>;
}

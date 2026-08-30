import { Suspense } from "react";
import { ConfirmScreen } from "@/components/screens";
export default function Page() { return <Suspense fallback={null}><ConfirmScreen /></Suspense>; }

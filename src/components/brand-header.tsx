import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { PaperBadge } from "./ui";

export function BrandHeader({ title, subtitle, back }: { title?: string; subtitle?: string; back?: string }) {
  return <header className="topbar">
    <div className="row gap-12">
      {back
        ? <Link href={back} className="icon-button" aria-label="Back"><ArrowLeft /></Link>
        : <div className="brand-mark">A</div>}
      <div>
        {title ? <h1>{title}</h1> : <strong className="brand-name">Apex Ledger</strong>}
        {subtitle && <span className="eyebrow block">{subtitle}</span>}
      </div>
    </div>
    <PaperBadge />
  </header>;
}

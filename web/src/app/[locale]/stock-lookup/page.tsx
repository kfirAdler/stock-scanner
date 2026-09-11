import { Suspense } from "react";
import { StockLookupClient } from "@/components/lookup/StockLookupClient";
import { CandlestickLoader } from "@/components/ui/CandlestickLoader";

export default function StockLookupPage() {
  return (
    <Suspense fallback={<div className="page-shell flex min-h-[64vh] items-center justify-center"><CandlestickLoader /></div>}>
      <StockLookupClient />
    </Suspense>
  );
}

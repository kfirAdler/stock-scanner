import { Suspense } from "react";
import { StockLookupClient } from "@/components/lookup/StockLookupClient";

export default function StockLookupPage() {
  return (
    <Suspense fallback={null}>
      <StockLookupClient />
    </Suspense>
  );
}

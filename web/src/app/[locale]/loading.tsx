import { CandlestickLoader } from "@/components/ui/CandlestickLoader";

export default function LocaleLoading() {
  return (
    <div className="page-shell flex min-h-[64vh] items-center justify-center">
      <CandlestickLoader />
    </div>
  );
}

import type { ScreenerPayload, ScreenerResultRow, ScreenerRule, ScreenerTimeframe, SnapshotRow } from "@/lib/screener-types";

export type AccessGate = null | "login" | "subscribe";

export type Suggestion = {
  ticker: string;
  market?: string | null;
  close: number;
  last_trade_date: string;
};

export type CoverageEntry = {
  id: string;
  supported: boolean;
  reasonKey?: string;
  reasonParams?: Record<string, string | number>;
};

export type FilterCoverageRow = CoverageEntry & {
  filterKey: string;
};

export type RecentBar = {
  trade_date: string;
  close: number;
};

export type LookupMetadata = {
  company_name?: string | null;
  sector?: string | null;
  industry?: string | null;
  market_cap?: number | null;
};

export type LookupCoveragePayload = {
  ticker: string;
  market: string;
  barCount: number;
  snapshot: { close: number; last_trade_date: string };
  dailySnapshot: SnapshotRow;
  timeframeSnapshots: Partial<Record<ScreenerTimeframe, SnapshotRow | null>>;
  recentBars: RecentBar[];
  metadata: LookupMetadata | null;
  indicators: CoverageEntry[];
  screenerFilters: FilterCoverageRow[];
};

export type ConditionStatus = "match" | "near" | "fail";

export type LookupCondition = {
  id: string;
  label: string;
  timeframe: ScreenerTimeframe;
  status: ConditionStatus;
  note?: string | null;
  rule?: ScreenerRule;
};

export type SimilarVariant = "exact" | "stronger" | "earlier" | "lowerAtr" | "higherMomentum";

export type SimilarVariantOption = {
  id: SimilarVariant;
  label: string;
  payload: ScreenerPayload;
};

export type SimilarSetupRow = {
  row: ScreenerResultRow;
  score: number;
  note: string;
};

export type TrendTone = "bullish" | "bearish" | "neutral";

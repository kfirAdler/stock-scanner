import type { ScreenerPayload, ScreenerResultRow, ScreenerRule, ScreenerTimeframe, SnapshotRow } from "@/lib/screener-types";
import type { PatternMatch } from "@/lib/patterns/types";

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
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type LookupPatternPeer = {
  ticker: string;
  companyName: string | null;
  confidence: number;
  asOf: string | null;
};

export type LookupMetadata = {
  company_name?: string | null;
  sector?: string | null;
  industry?: string | null;
  market_cap?: number | null;
  listing_exchange?: string | null;
  return_on_equity?: number | null;
  debt_to_equity?: number | null;
};

export type LookupCoveragePayload = {
  ticker: string;
  market: string;
  barCount: number;
  snapshot: { close: number; last_trade_date: string };
  dailySnapshot: SnapshotRow;
  timeframeSnapshots: Partial<Record<ScreenerTimeframe, SnapshotRow | null>>;
  recentBars: RecentBar[];
  patterns: { asOf: string | null; matches: PatternMatch[]; peers: LookupPatternPeer[] };
  metadata: LookupMetadata | null;
  indicators: CoverageEntry[];
  screenerFilters: FilterCoverageRow[];
};

export type ConditionStatus = "match" | "near" | "fail";

export type LookupCondition = {
  id: string;
  label: string;
  timeframe: ScreenerTimeframe;
  timeframeLabel?: string;
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

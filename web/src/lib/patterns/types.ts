export type PatternKind = 'ascending_triangle' | 'channel' | 'cup_and_handle';
export type ChannelDirection = 'rising' | 'falling' | 'sideways';
export type PatternFilter = 'all' | 'ascending_triangle' | 'channel_rising' | 'channel_falling' | 'channel_sideways' | 'cup_and_handle';
export type PatternLine = { x1: number; y1: number; x2: number; y2: number; style: string; label?: string };
export type PatternChange = 'new' | 'strengthened' | 'weakened' | 'stable';
export type PatternMatch = { pattern: PatternKind; patternLabel: string; channelDirection?: ChannelDirection; confidence: number; previousConfidence?: number; change?: PatternChange; lines: PatternLine[]; breakoutLevel: number; invalidationLevel: number; notes: string; stage?: 'developing'; development?: Omit<DevelopingSetup, 'match'> };
export type PatternCandle = { date: string; open: number; high: number; low: number; close: number };
export type ChannelRejection = 'short_history' | 'few_pivots' | 'short_pivot_span' | 'poor_line_fit' | 'flat_channel' | 'nonparallel_slopes' | 'opposite_slopes' | 'price_outside' | 'upper_breach' | 'lower_breach';
export type CandlePreview = { offset: number; candles: [number, number, number, number][] };
export type DevelopingSetup = { match: PatternMatch; reason: ChannelRejection | 'relaxed_thresholds'; breachCount?: number; maxBreachPercent?: number; breachIndices?: number[]; tolerance: number };
export type ChannelDiagnostics = { pattern: 'channel'; rejected: Partial<Record<ChannelRejection, number>>; strictMatches: number; developingSetups: number };
export type PatternSnapshot = { ticker: string; market: 'US' | 'TA'; company_name: string | null; as_of: string | null; updated_at: string; status: 'scanned' | 'stale' | 'insufficient_history'; bars_count: number; close: number | null; matches: PatternMatch[]; candles?: PatternCandle[]; preview?: CandlePreview | null; developing?: DevelopingSetup[]; rejectionReason?: ChannelRejection | null };
export type PatternPayload = { lastAttempt?: { startedAt: string; status: string } | null; rows: PatternSnapshot[]; coverage: { total: number; scanned: number; stale: number; insufficient: number }; updatedAt: string | null; diagnostics?: ChannelDiagnostics; durationSeconds?: number };

export function channelDirectionOf(match: PatternMatch): ChannelDirection | null {
  if (match.pattern !== 'channel') return null;
  if (match.channelDirection) return match.channelDirection;
  const label = match.patternLabel.toLowerCase();
  if (label.startsWith('rising')) return 'rising';
  if (label.startsWith('falling')) return 'falling';
  return 'sideways';
}

export function patternFilterMatches(match: PatternMatch, filter?: PatternFilter): boolean {
  if (!filter || filter === 'all') return true;
  if (!filter.startsWith('channel_')) return match.pattern === filter;
  return channelDirectionOf(match) === filter.slice('channel_'.length);
}

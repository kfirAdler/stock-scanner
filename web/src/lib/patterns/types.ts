export type PatternKind = 'ascending_triangle' | 'channel' | 'cup_and_handle';
export type PatternLine = { x1: number; y1: number; x2: number; y2: number; style: string; label?: string };
export type PatternMatch = { pattern: PatternKind; patternLabel: string; confidence: number; lines: PatternLine[]; breakoutLevel: number; invalidationLevel: number; notes: string };
export type PatternCandle = { date: string; open: number; high: number; low: number; close: number };
export type PatternSnapshot = { ticker: string; market: 'US' | 'TA'; company_name: string | null; as_of: string | null; updated_at: string; status: 'scanned' | 'stale' | 'insufficient_history'; bars_count: number; close: number | null; matches: PatternMatch[]; candles?: PatternCandle[] };
export type PatternPayload = { rows: PatternSnapshot[]; coverage: { total: number; scanned: number; stale: number; insufficient: number }; updatedAt: string | null };

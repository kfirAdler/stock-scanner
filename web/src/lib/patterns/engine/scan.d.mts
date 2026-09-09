import type { PatternCandle, PatternKind, PatternSnapshot } from '../types';
export type PatternSeries = { ticker: string; company_name?: string | null; candles: PatternCandle[] };
export function scanSeries(series: PatternSeries[], now?: Date, pattern?: PatternKind): PatternSnapshot[];

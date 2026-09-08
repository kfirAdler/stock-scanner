import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import type { PatternSnapshot } from './types';

// Bounded cache with concurrent request coalescing. Auth is checked outside it.
// Each server instance may make its own cold read; failures are never cached.
const cache = new Map<string, { expires: number; value: Promise<PatternSnapshot[]> }>();
export function loadPatterns(market: 'US' | 'TA', ticker?: string) {
  const key = market + ':' + (ticker ?? '*');
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.value;
  if (cache.size >= 128) cache.delete(cache.keys().next().value!);
  const value = (async () => {
    const db = await createServiceClient();
    const rows: PatternSnapshot[] = [];
    for (let offset = 0; ; offset += 500) {
      let query = db.from('symbol_pattern_snapshot').select(ticker ? '*' : 'ticker,market,company_name,as_of,updated_at,status,bars_count,close,matches').eq('market', market).order('ticker');
      if (ticker) query = query.eq('ticker', ticker);
      const { data, error } = await query.range(offset, offset + 499);
      if (error) throw new Error('Pattern snapshot read failed', { cause: error });
      rows.push(...(data as unknown as PatternSnapshot[]));
      if (!data || data.length < 500) return rows;
    }
  })();
  cache.set(key, { expires: Date.now() + 300_000, value });
  void value.catch(() => { if (cache.get(key)?.value === value) cache.delete(key); });
  return value;
}

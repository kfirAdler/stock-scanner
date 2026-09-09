import { runAllDetectors, detectAscendingTriangle, detectChannel, detectCupAndHandle } from './detectors.mjs';

import { analyzeChannel, candlePreview } from './channel-diagnostics.mjs';

const detectors = { ascending_triangle: detectAscendingTriangle, channel: detectChannel, cup_and_handle: detectCupAndHandle };

export function scanSeries(series, now = new Date(), pattern) {
  if (pattern !== undefined && !Object.hasOwn(detectors, pattern)) throw new Error('Invalid pattern');
  return series.map(({ ticker, candles: input, company_name = null }) => {
    const byDate = new Map();
    for (const c of input) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date) || !Number.isFinite(Date.parse(c.date))) continue;
      if (![c.open,c.high,c.low,c.close].every(v => Number.isFinite(v) && v > 0)) continue;
      if (c.high < Math.max(c.open,c.close,c.low) || c.low > Math.min(c.open,c.close)) continue;
      byDate.set(c.date, c);
    }
    const candles = [...byDate.values()].sort((a,b) => a.date.localeCompare(b.date)).slice(-160);
    const latest = candles.at(-1);
    const status = candles.length < 60 ? 'insufficient_history'
      : (now.getTime() - Date.parse(latest.date)) / 86400000 > 7 ? 'stale' : 'scanned';
    const analysis = status === 'scanned' && pattern === 'channel' ? analyzeChannel(candles) : null;
    const matches = status !== 'scanned' ? [] : analysis
      ? [analysis.match].filter(Boolean) : pattern === undefined
        ? runAllDetectors(candles) : [detectors[pattern](candles)].filter(Boolean);
    const developing = analysis?.developing ? [analysis.developing] : [];
    const hasSetup = matches.length > 0 || developing.length > 0;
    return { ticker, market: ticker.endsWith('.TA') ? 'TA' : 'US', company_name,
      as_of: latest?.date ?? null, updated_at: now.toISOString(), status,
      bars_count: candles.length, close: latest?.close ?? null, matches,
      candles: hasSetup ? candles : [], detector_version: 1,
      // Enrichment belongs to JSON request results. Scheduled table rows retain
      // their existing schema and strict-only behavior.
      ...(pattern !== undefined ? {
        preview: hasSetup ? candlePreview(candles) : null,
        developing,
        ...(analysis ? { rejectionReason: analysis.reason } : {}),
      } : {}),
    };
  });
}


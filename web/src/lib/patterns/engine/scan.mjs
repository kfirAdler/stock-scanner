import { runAllDetectors, detectAscendingTriangle, detectChannel, detectCupAndHandle } from './detectors.mjs';

import { analyzeChannel, candlePreview } from './channel-diagnostics.mjs';

const detectors = { ascending_triangle: detectAscendingTriangle, channel: detectChannel, cup_and_handle: detectCupAndHandle };

function developingSetups(candles, strictMatches, requestedPattern) {
  const strictKinds = new Set(strictMatches.map(match => match.pattern));
  const requested = requestedPattern === undefined
    ? Object.keys(detectors) : [requestedPattern];
  const setups = [];
  for (const kind of requested) {
    if (strictKinds.has(kind)) continue;
    if (kind === 'channel') {
      const candidate = analyzeChannel(candles).developing;
      if (candidate) setups.push(candidate);
      continue;
    }
    const relaxed = kind === 'ascending_triangle'
      ? detectAscendingTriangle(candles, 90, { flatTolerance: 0.05, breachTolerance: 0.02 })
      : detectCupAndHandle(candles, 160, { rimTolerance: 0.06, maxHandleDepthRatio: 0.45 });
    if (relaxed) setups.push({
      match: { ...relaxed, confidence: Math.round(relaxed.confidence * 85) / 100 },
      reason: 'relaxed_thresholds', tolerance: kind === 'ascending_triangle' ? 0.05 : 0.06,
    });
  }
  return setups;
}

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
    const matches = status !== 'scanned' ? [] : pattern === undefined
      ? runAllDetectors(candles) : [detectors[pattern](candles)].filter(Boolean);
    const developing = status === 'scanned'
      ? developingSetups(candles, matches, pattern) : [];
    const hasSetup = matches.length > 0 || developing.length > 0;
    const storedMatches = pattern === undefined
      ? [...matches, ...developing.map(({ match, ...development }) => ({
          ...match, stage: 'developing', development,
        }))]
      : matches;
    return { ticker, market: ticker.endsWith('.TA') ? 'TA' : 'US', company_name,
      as_of: latest?.date ?? null, updated_at: now.toISOString(), status,
      bars_count: candles.length, close: latest?.close ?? null, matches: storedMatches,
      candles: hasSetup ? candles : [], detector_version: 3,
      ...(pattern !== undefined ? {
        preview: hasSetup ? candlePreview(candles) : null,
        developing,
        ...(pattern === 'channel' && status === 'scanned'
          ? { rejectionReason: analyzeChannel(candles).reason } : {}),
      } : {}),
    };
  });
}

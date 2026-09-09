import { inspectChannel } from './detectors.mjs';

// Only boundary tolerance is relaxed for developing setups. Geometry, pivot
// coverage, parallelism, and current price containment stay identical.
export function analyzeChannel(candles) {
  const strict = inspectChannel(candles);
  if (strict.match) return { match: strict.match, reason: null, developing: null };
  if (!['upper_breach', 'lower_breach'].includes(strict.reason)) {
    return { match: null, reason: strict.reason, developing: null };
  }
  const relaxed = inspectChannel(candles, 120, { breachTolerance: 0.04 });
  if (!relaxed.match) return { match: null, reason: strict.reason, developing: null };
  const indices = new Set();
  let maxBreachPercent = 0;
  for (const line of relaxed.match.lines) {
    for (let i = line.x1; i <= line.x2; i++) {
      const projected = line.y1 + (line.y2-line.y1) * (i-line.x1) / (line.x2-line.x1);
      const breach = line.style === 'resistance'
        ? (candles[i].high-projected)/projected
        : (projected-candles[i].low)/projected;
      if (breach > 0.01) {
        indices.add(i);
        maxBreachPercent = Math.max(maxBreachPercent, breach*100);
      }
    }
  }
  return { match: null, reason: strict.reason, developing: {
    match: relaxed.match, reason: strict.reason, breachCount: indices.size,
    maxBreachPercent: Math.round(maxBreachPercent*100)/100,
    breachIndices: [...indices].sort((a,b)=>a-b), tolerance: 0.04,
  } };
}

// Forty-eight original daily candles, never synthetic or resampled bars.
// Offset preserves the coordinates used by the detector's full history.
export function candlePreview(candles) {
  return { offset: Math.max(0, candles.length-48),
    candles: candles.slice(-48).map(c=>[c.open,c.high,c.low,c.close]) };
}

// lib/patterns/pivots.ts
// Local extrema (pivot highs / pivot lows) — the building blocks of every
// geometric pattern. A bar is a pivot high if its high is the maximum within
// a +/- `window` neighborhood (and symmetrically for pivot lows).
export function findPivots(candles, window = 3) {
    const pivots = [];
    for (let i = window; i < candles.length - window; i++) {
        let isHigh = true;
        let isLow = true;
        for (let j = i - window; j <= i + window; j++) {
            if (j === i)
                continue;
            if (candles[j].high >= candles[i].high)
                isHigh = false;
            if (candles[j].low <= candles[i].low)
                isLow = false;
            if (!isHigh && !isLow)
                break;
        }
        if (isHigh)
            pivots.push({ index: i, price: candles[i].high, kind: "high" });
        if (isLow)
            pivots.push({ index: i, price: candles[i].low, kind: "low" });
    }
    return pivots;
}
// Ordinary least squares over (index, price) points.
// Returns slope per bar, intercept, and R^2 fit quality.
export function linearFit(points) {
    const n = points.length;
    if (n < 2)
        return { slope: 0, intercept: points[0]?.price ?? 0, r2: 0 };
    const meanX = points.reduce((s, p) => s + p.index, 0) / n;
    const meanY = points.reduce((s, p) => s + p.price, 0) / n;
    let ssXY = 0;
    let ssXX = 0;
    let ssYY = 0;
    for (const p of points) {
        ssXY += (p.index - meanX) * (p.price - meanY);
        ssXX += (p.index - meanX) ** 2;
        ssYY += (p.price - meanY) ** 2;
    }
    const slope = ssXX === 0 ? 0 : ssXY / ssXX;
    const intercept = meanY - slope * meanX;
    const r2 = ssXX === 0 || ssYY === 0 ? 0 : (ssXY * ssXY) / (ssXX * ssYY);
    return { slope, intercept, r2 };
}

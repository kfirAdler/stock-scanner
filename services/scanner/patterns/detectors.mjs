// lib/patterns/detectors.ts
// Geometric pattern detectors. Each detector inspects the last `lookback`
// candles and, on a match, returns the overlay lines to draw on the chart
// plus the key trade levels (breakout / invalidation).
//
// Tuning philosophy: every threshold is a named constant at the top of its
// detector. Expect to iterate on these by eye — that's 80% of the work.
import { findPivots, linearFit } from "./pivots.mjs";
const pct = (a, b) => Math.abs(a - b) / ((a + b) / 2);
// ---------------------------------------------------------------------------
// 1) Ascending triangle: flat resistance across pivot highs + rising support
//    across pivot lows, with price still coiled under the resistance.
// ---------------------------------------------------------------------------
export function detectAscendingTriangle(candles, lookback = 90, opts = {}) {
    const FLAT_TOLERANCE = opts.flatTolerance ?? 0.02; // pivot highs within 2% of each other
    const MIN_TOUCHES = 2; // per line
    const MIN_RISE_R2 = opts.minRiseR2 ?? 0.72; // lows must fit a rising line reasonably well
    const MAX_DIST_FROM_RESISTANCE = 0.06; // last close within 6% below resistance
    const window = candles.slice(-lookback);
    if (window.length < 40)
        return null;
    const pivots = findPivots(window, 3);
    const highs = pivots.filter((p) => p.kind === "high");
    const lows = pivots.filter((p) => p.kind === "low");
    if (highs.length < MIN_TOUCHES || lows.length < MIN_TOUCHES)
        return null;
    // Flat resistance: cluster the top pivot highs and check tightness.
    const sortedHighs = [...highs].sort((a, b) => b.price - a.price);
    if (sortedHighs.length < 3)
        return null;
    const top = sortedHighs.slice(0, 3);
    const resistance = top.reduce((s, p) => s + p.price, 0) / top.length;
    const flatEnough = top.every((p) => pct(p.price, resistance) <= FLAT_TOLERANCE);
    if (!flatEnough)
        return null;
    // Structure requirement: the touches must be spread out in time, not one
    // random cluster — this alone cuts most random-walk false positives.
    const touchIdx = top.map((p) => p.index);
    if (Math.max(...touchIdx) - Math.min(...touchIdx) < 20)
        return null;
    // Rising support: linear fit through recent pivot lows.
    const recentLows = lows.slice(-4);
    const fit = linearFit(recentLows);
    if (fit.slope <= 0 || fit.r2 < MIN_RISE_R2)
        return null;
    const lastIdx = window.length - 1;
    // The fit only touches 4 pivot lows, then gets extrapolated all the way to
    // the last bar for drawing — if price actually dipped below that
    // projection in between, it isn't a support line the market is still
    // respecting, and drawing it would slice through those candles.
    const SUPPORT_BREACH_TOLERANCE = opts.breachTolerance ?? 0.01; // wiggle room for wicks
    for (let i = recentLows[0].index; i <= lastIdx; i++) {
        const projected = fit.slope * i + fit.intercept;
        if (window[i].low < projected * (1 - SUPPORT_BREACH_TOLERANCE))
            return null;
    }
    const lastClose = window[window.length - 1].close;
    if (lastClose > resistance)
        return null; // already broken out
    if ((resistance - lastClose) / resistance > MAX_DIST_FROM_RESISTANCE)
        return null; // too far from the apex to be actionable
    const firstIdx = Math.min(top[top.length - 1].index, recentLows[0].index);
    const offset = candles.length - window.length; // map back to full-series idx
    const confidence = 0.5 * fit.r2 +
        0.5 * (1 - Math.max(...top.map((p) => pct(p.price, resistance))) / FLAT_TOLERANCE);
    return {
        pattern: "ascending_triangle",
        patternLabel: "Ascending triangle",
        confidence: Math.round(confidence * 100) / 100,
        lines: [
            {
                x1: firstIdx + offset,
                y1: resistance,
                x2: lastIdx + offset,
                y2: resistance,
                label: `Resistance ${resistance.toFixed(2)}`,
                style: "resistance",
            },
            {
                x1: recentLows[0].index + offset,
                y1: fit.slope * recentLows[0].index + fit.intercept,
                x2: lastIdx + offset,
                y2: fit.slope * lastIdx + fit.intercept,
                label: "Rising support",
                style: "support",
            },
        ],
        breakoutLevel: resistance,
        invalidationLevel: fit.slope * lastIdx + fit.intercept,
        notes: `Flat resistance near ${resistance.toFixed(2)} with rising lows (R²=${fit.r2.toFixed(2)}). Watch a close above resistance.`,
    };
}
// ---------------------------------------------------------------------------
// 2) Channel: pivot highs and pivot lows each fit a line, the two lines are
//    roughly parallel, and price is currently inside the channel.
// ---------------------------------------------------------------------------
export function detectChannel(candles, lookback = 120, opts = {}) {
    const MIN_R2 = opts.minR2 ?? 0.78;
    const MAX_SLOPE_DIVERGENCE = 0.35; // relative difference between the slopes
    const window = candles.slice(-lookback);
    if (window.length < 50)
        return null;
    const pivots = findPivots(window, 3);
    const highs = pivots.filter((p) => p.kind === "high").slice(-5);
    const lows = pivots.filter((p) => p.kind === "low").slice(-5);
    if (highs.length < 3 || lows.length < 3)
        return null;
    // Structure requirement: the pivots must span a meaningful stretch of the
    // window, otherwise a short random wiggle can fit two "parallel" lines.
    const span = Math.max(...highs.map((p) => p.index), ...lows.map((p) => p.index)) -
        Math.min(...highs.map((p) => p.index), ...lows.map((p) => p.index));
    if (span < 45)
        return null;
    const upFit = linearFit(highs);
    const loFit = linearFit(lows);
    if (upFit.r2 < MIN_R2 || loFit.r2 < MIN_R2)
        return null;
    const avgAbsSlope = (Math.abs(upFit.slope) + Math.abs(loFit.slope)) / 2;
    if (avgAbsSlope === 0)
        return null;
    if (Math.abs(upFit.slope - loFit.slope) / avgAbsSlope > MAX_SLOPE_DIVERGENCE)
        return null;
    if (upFit.slope * loFit.slope < 0)
        return null; // opposite directions => triangle/wedge, not channel
    const lastIdx = window.length - 1;
    const upper = upFit.slope * lastIdx + upFit.intercept;
    const lower = loFit.slope * lastIdx + loFit.intercept;
    const lastClose = window[lastIdx].close;
    if (lastClose > upper || lastClose < lower)
        return null;
    const startIdx = Math.min(highs[0].index, lows[0].index);
    // Each line only touches its own handful of pivots, then gets extrapolated
    // across the whole channel span for drawing — reject if any candle in
    // between actually broke through that projection, since the channel
    // isn't intact if the market already violated it.
    const CHANNEL_BREACH_TOLERANCE = opts.breachTolerance ?? 0.01; // wiggle room for wicks
    for (let i = startIdx; i <= lastIdx; i++) {
        const projUpper = upFit.slope * i + upFit.intercept;
        const projLower = loFit.slope * i + loFit.intercept;
        if (window[i].high > projUpper * (1 + CHANNEL_BREACH_TOLERANCE))
            return null;
        if (window[i].low < projLower * (1 - CHANNEL_BREACH_TOLERANCE))
            return null;
    }
    const offset = candles.length - window.length;
    const direction = upFit.slope > 0 ? "Rising" : "Falling";
    return {
        pattern: "channel",
        patternLabel: `${direction} channel`,
        confidence: Math.round(((upFit.r2 + loFit.r2) / 2) * 100) / 100,
        lines: [
            {
                x1: startIdx + offset,
                y1: upFit.slope * startIdx + upFit.intercept,
                x2: lastIdx + offset,
                y2: upper,
                label: "Channel top",
                style: "resistance",
            },
            {
                x1: startIdx + offset,
                y1: loFit.slope * startIdx + loFit.intercept,
                x2: lastIdx + offset,
                y2: lower,
                label: "Channel bottom",
                style: "support",
            },
        ],
        breakoutLevel: upper,
        invalidationLevel: lower,
        notes: `${direction} channel (fit R² ${upFit.r2.toFixed(2)}/${loFit.r2.toFixed(2)}). Price at ${(((lastClose - lower) / (upper - lower)) * 100).toFixed(0)}% of channel height.`,
    };
}
// ---------------------------------------------------------------------------
// 3) Cup and handle (simplified): left rim -> rounded trough (>= MIN_DEPTH
//    below rim) -> recovery near the rim -> shallow, short handle pullback.
// ---------------------------------------------------------------------------
export function detectCupAndHandle(candles, lookback = 160, opts = {}) {
    const MIN_CUP_DEPTH = 0.12; // trough at least 12% under the rim
    const MAX_CUP_DEPTH = 0.45;
    const RIM_TOLERANCE = opts.rimTolerance ?? 0.04; // right rim within 4% of left rim
    const MAX_HANDLE_DEPTH_RATIO = opts.maxHandleDepthRatio ?? 0.35; // handle retraces at most 35% of cup depth
    const MIN_HANDLE_BARS = 4;
    const MAX_HANDLE_BARS = 30;
    const window = candles.slice(-lookback);
    if (window.length < 60)
        return null;
    const pivots = findPivots(window, 4);
    const highs = pivots.filter((p) => p.kind === "high");
    if (highs.length < 2)
        return null;
    // Try each pivot high as the left rim, latest-first.
    for (let li = highs.length - 2; li >= 0; li--) {
        const leftRim = highs[li];
        // Trough: lowest low strictly after the left rim.
        let troughIdx = -1;
        let troughPrice = Infinity;
        for (let i = leftRim.index + 1; i < window.length; i++) {
            if (window[i].low < troughPrice) {
                troughPrice = window[i].low;
                troughIdx = i;
            }
        }
        if (troughIdx < 0)
            continue;
        const depth = (leftRim.price - troughPrice) / leftRim.price;
        if (depth < MIN_CUP_DEPTH || depth > MAX_CUP_DEPTH)
            continue;
        // Right rim: first pivot high after the trough that recovers near the left rim.
        const rightRim = highs.find((p) => p.index > troughIdx && pct(p.price, leftRim.price) <= RIM_TOLERANCE);
        if (!rightRim)
            continue;
        // Handle: from the right rim to now — a shallow pullback, not a new leg down.
        const handleBars = window.length - 1 - rightRim.index;
        if (handleBars < MIN_HANDLE_BARS || handleBars > MAX_HANDLE_BARS)
            continue;
        let handleLow = Infinity;
        for (let i = rightRim.index; i < window.length; i++) {
            if (window[i].low < handleLow)
                handleLow = window[i].low;
        }
        const cupDepthAbs = leftRim.price - troughPrice;
        const handleDepthRatio = (rightRim.price - handleLow) / cupDepthAbs;
        if (handleDepthRatio > MAX_HANDLE_DEPTH_RATIO)
            continue;
        const lastClose = window[window.length - 1].close;
        const rimLevel = Math.max(leftRim.price, rightRim.price);
        if (lastClose > rimLevel * 1.02)
            continue; // breakout already gone
        const offset = candles.length - window.length;
        const confidence = 0.6 * (1 - pct(leftRim.price, rightRim.price) / RIM_TOLERANCE) +
            0.4 * (1 - handleDepthRatio / MAX_HANDLE_DEPTH_RATIO);
        return {
            pattern: "cup_and_handle",
            patternLabel: "Cup and handle",
            confidence: Math.round(confidence * 100) / 100,
            lines: [
                {
                    x1: leftRim.index + offset,
                    y1: rimLevel,
                    x2: window.length - 1 + offset,
                    y2: rimLevel,
                    label: `Rim ${rimLevel.toFixed(2)}`,
                    style: "neckline",
                },
                {
                    x1: leftRim.index + offset,
                    y1: leftRim.price,
                    x2: troughIdx + offset,
                    y2: troughPrice,
                    style: "guide",
                },
                {
                    x1: troughIdx + offset,
                    y1: troughPrice,
                    x2: rightRim.index + offset,
                    y2: rightRim.price,
                    style: "guide",
                },
                {
                    x1: rightRim.index + offset,
                    y1: rightRim.price,
                    x2: window.length - 1 + offset,
                    y2: handleLow,
                    label: "Handle",
                    style: "guide",
                },
            ],
            breakoutLevel: rimLevel,
            invalidationLevel: handleLow,
            notes: `Cup depth ${(depth * 100).toFixed(0)}%, handle retraced ${(handleDepthRatio * 100).toFixed(0)}% of the cup. Watch a close above the rim.`,
        };
    }
    return null;
}
// ---------------------------------------------------------------------------
export function runAllDetectors(candles, opts = {}) {
    const out = [];
    const t = detectAscendingTriangle(candles, undefined, opts);
    if (t)
        out.push(t);
    const c = detectCupAndHandle(candles, undefined, opts);
    if (c)
        out.push(c);
    // Only report a channel when no tighter setup was found — otherwise the
    // channel line-fit tends to double-report the same structure.
    if (out.length === 0) {
        const ch = detectChannel(candles, undefined, opts);
        if (ch)
            out.push(ch);
    }
    return out;
}

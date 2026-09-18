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
// 1) Ascending triangle: a near-flat fitted edge across pivot highs + rising
//    support across pivot lows, with price still coiled between converging lines.
// ---------------------------------------------------------------------------
export function detectAscendingTriangle(candles, lookback = 90, opts = {}) {
    const FLAT_TOLERANCE = opts.flatTolerance ?? 0.035;
    const SUPPORT_TOUCH_TOLERANCE = 0.035;
    const SUPPORT_BREACH_TOLERANCE = opts.breachTolerance ?? 0.01;
    const MAX_DIST_FROM_RESISTANCE = 0.06; // last close within 6% below resistance
    const window = candles.slice(-lookback);
    if (window.length < 40)
        return null;
    const pivots = findPivots(window, 3);
    const highs = pivots.filter((p) => p.kind === "high");
    const lows = pivots.filter((p) => p.kind === "low");
    if (highs.length < 3 || lows.length < 3)
        return null;
    // Cluster the top pivot highs to preserve the ascending-triangle rule, then
    // fit their actual edge. A perfectly horizontal average hides the wedge
    // visible in the price action when those highs slope slightly.
    const sortedHighs = [...highs].sort((a, b) => b.price - a.price);
    if (sortedHighs.length < 3)
        return null;
    const top = sortedHighs.slice(0, 3);
    const resistance = top.reduce((s, p) => s + p.price, 0) / top.length;
    const flatEnough = top.every((p) => pct(p.price, resistance) <= FLAT_TOLERANCE);
    if (!flatEnough)
        return null;
    const resistanceFit = linearFit(top);
    // Structure requirement: the touches must be spread out in time, not one
    // random cluster — this alone cuts most random-walk false positives.
    const touchIdx = top.map((p) => p.index);
    if (Math.max(...touchIdx) - Math.min(...touchIdx) < 20)
        return null;
    const lastIdx = window.length - 1;
    const resistanceAtLast = resistanceFit.slope * lastIdx + resistanceFit.intercept;
    const lastClose = window[window.length - 1].close;
    if (lastClose > resistanceAtLast)
        return null; // already broken out
    if ((resistanceAtLast - lastClose) / resistanceAtLast > MAX_DIST_FROM_RESISTANCE)
        return null; // too far from the apex to be actionable
    const firstHighIdx = Math.min(...touchIdx);
    // A least-squares fit to the last four lows can be pulled through the
    // candles by one high swing low. Find a rising lower envelope instead:
    // at least three pivot touches, spread over time, and no later wick below it.
    let support = null;
    for (let a = 0; a < lows.length; a++) {
        const first = lows[a];
        if (first.index < firstHighIdx) continue;
        for (let b = a + 1; b < lows.length; b++) {
            const second = lows[b];
            const span = second.index - first.index;
            if (span < 20 || second.index < lastIdx - 25) continue;
            const slope = (second.price - first.price) / span;
            if (slope <= 0 || slope <= resistanceFit.slope) continue;
            const projected = (index) => first.price + slope * (index - first.index);
            if (projected(lastIdx) >= resistanceAtLast * 0.98) continue;
            if (projected(first.index) >= resistanceFit.slope * first.index + resistanceFit.intercept) continue;
            let breached = false;
            for (let i = first.index; i <= lastIdx; i++) {
                if (window[i].low < projected(i) * (1 - SUPPORT_BREACH_TOLERANCE)) {
                    breached = true;
                    break;
                }
            }
            if (breached) continue;
            const touches = lows.filter((pivot) => pivot.index >= first.index &&
                Math.abs(pivot.price - projected(pivot.index)) / projected(pivot.index) <= SUPPORT_TOUCH_TOLERANCE).length;
            if (touches < 3) continue;
            const flatQuality = 1 - Math.max(...top.map((p) => pct(p.price, resistance))) / FLAT_TOLERANCE;
            const proximity = 1 - (resistanceAtLast - lastClose) / (resistanceAtLast * MAX_DIST_FROM_RESISTANCE);
            const confidence = Math.min(0.99, 0.4 + 0.18 * flatQuality +
                0.2 * Math.min(1, touches / 4) + 0.12 * proximity +
                0.1 * Math.min(1, span / 40));
            if (!support || confidence > support.confidence)
                support = { first, slope, projected, touches, confidence };
        }
    }
    if (!support)
        return null;
    const offset = candles.length - window.length; // map back to full-series idx
    return {
        pattern: "ascending_triangle",
        patternLabel: "Ascending triangle",
        confidence: Math.round(support.confidence * 100) / 100,
        lines: [
            {
                x1: firstHighIdx + offset,
                y1: resistanceFit.slope * firstHighIdx + resistanceFit.intercept,
                x2: lastIdx + offset,
                y2: resistanceAtLast,
                label: `Resistance ${resistanceAtLast.toFixed(2)}`,
                style: "resistance",
            },
            {
                x1: support.first.index + offset,
                y1: support.first.price,
                x2: lastIdx + offset,
                y2: support.projected(lastIdx),
                label: "Rising support",
                style: "support",
            },
        ],
        breakoutLevel: resistanceAtLast,
        invalidationLevel: support.projected(lastIdx),
        notes: `Resistance near ${resistanceAtLast.toFixed(2)} with ${support.touches} rising support touches. Watch a close above resistance.`,
    };
}
// ---------------------------------------------------------------------------
// 2) Channel: pivot highs and pivot lows each fit a line, the two lines are
//    roughly parallel, and price is currently inside the channel.
// ---------------------------------------------------------------------------
export function detectChannel(candles, lookback = 120, opts = {}) {
    return inspectChannel(candles, lookback, opts).match;
}
export function inspectChannel(candles, lookback = 120, opts = {}) {
    const MAX_PIVOTS_PER_EDGE = 6;
    const MIN_PIVOT_SPAN = 30;
    const MIN_EDGE_SWITCHES = 4;
    const MAX_FIT_ERROR_RATIO = opts.maxFitErrorRatio ?? 0.16;
    const MAX_SLOPE_DIVERGENCE = opts.maxSlopeDivergence ?? 0.35;
    const MIN_CHANNEL_WIDTH_RATIO = 0.025;
    const MAX_CHANNEL_WIDTH_RATIO = 0.30;
    const CLOSE_BREACH_TOLERANCE = 0.01;
    const WICK_BREACH_TOLERANCE = opts.breachTolerance ?? 0.015;
    const MAX_WICK_BREACHES = opts.maxWickBreaches ?? 0;
    const window = candles.slice(-lookback);
    if (window.length < 50)
        return { match: null, reason: "short_history" };
    const pivots = findPivots(window, 3);
    const highs = pivots.filter((p) => p.kind === "high").slice(-MAX_PIVOTS_PER_EDGE);
    const lows = pivots.filter((p) => p.kind === "low").slice(-MAX_PIVOTS_PER_EDGE);
    if (highs.length < 3 || lows.length < 3)
        return { match: null, reason: "few_pivots" };
    const orderedPivots = [...highs, ...lows].sort((a, b) => a.index - b.index);
    const edgeSwitches = orderedPivots.slice(1).reduce((count, pivot, index) =>
        count + Number(pivot.kind !== orderedPivots[index].kind), 0);
    if (edgeSwitches < MIN_EDGE_SWITCHES)
        return { match: null, reason: "poor_line_fit" };
    const pivotSpan = orderedPivots.at(-1).index - orderedPivots[0].index;
    if (pivotSpan < MIN_PIVOT_SPAN)
        return { match: null, reason: "short_pivot_span" };

    const rawUpperFit = linearFit(highs);
    const rawLowerFit = linearFit(lows);
    const fitError = (points, fit) => Math.sqrt(points.reduce((sum, point) => {
        const residual = point.price - (fit.slope * point.index + fit.intercept);
        return sum + residual ** 2;
    }, 0) / points.length);
    const upperFitError = fitError(highs, rawUpperFit);
    const lowerFitError = fitError(lows, rawLowerFit);

    // Move each regression outward to the nearest containing edge. Regression
    // through the middle of the pivots makes normal touches look like breaches.
    const upFit = {
        ...rawUpperFit,
        intercept: rawUpperFit.intercept + Math.max(...highs.map((point) =>
            point.price - (rawUpperFit.slope * point.index + rawUpperFit.intercept))),
    };
    const loFit = {
        ...rawLowerFit,
        intercept: rawLowerFit.intercept + Math.min(...lows.map((point) =>
            point.price - (rawLowerFit.slope * point.index + rawLowerFit.intercept))),
    };

    const lastIdx = window.length - 1;
    const startIdx = orderedPivots[0].index;
    const upper = upFit.slope * lastIdx + upFit.intercept;
    const lower = loFit.slope * lastIdx + loFit.intercept;
    const upperAtStart = upFit.slope * startIdx + upFit.intercept;
    const lowerAtStart = loFit.slope * startIdx + loFit.intercept;
    const channelWidth = ((upperAtStart - lowerAtStart) + (upper - lower)) / 2;
    const channelMidpoint = ((upperAtStart + lowerAtStart) + (upper + lower)) / 4;
    const channelWidthRatio = channelWidth / channelMidpoint;
    if (upperAtStart <= lowerAtStart || upper <= lower ||
        channelWidthRatio < MIN_CHANNEL_WIDTH_RATIO || channelWidthRatio > MAX_CHANNEL_WIDTH_RATIO)
        return { match: null, reason: "poor_line_fit" };
    if (Math.max(upperFitError, lowerFitError) / channelWidth > MAX_FIT_ERROR_RATIO)
        return { match: null, reason: "poor_line_fit" };
    const slopeDivergence = Math.abs((upFit.slope - loFit.slope) * (lastIdx - startIdx)) / channelWidth;
    if (slopeDivergence > MAX_SLOPE_DIVERGENCE)
        return { match: null, reason: "nonparallel_slopes" };

    const lastClose = window[lastIdx].close;
    if (lastClose > upper * 1.005 || lastClose < lower * 0.995)
        return { match: null, reason: "price_outside" };

    // Small touches are absorbed by the tolerance; a wick beyond it becomes a
    // developing setup, while a closing-price break invalidates the structure.
    let upperWickBreaches = 0;
    let lowerWickBreaches = 0;
    for (let i = startIdx; i <= lastIdx; i++) {
        const projUpper = upFit.slope * i + upFit.intercept;
        const projLower = loFit.slope * i + loFit.intercept;
        if (window[i].close > projUpper * (1 + CLOSE_BREACH_TOLERANCE))
            return { match: null, reason: "upper_breach" };
        if (window[i].close < projLower * (1 - CLOSE_BREACH_TOLERANCE))
            return { match: null, reason: "lower_breach" };
        if (window[i].high > projUpper * (1 + WICK_BREACH_TOLERANCE))
            upperWickBreaches += 1;
        if (window[i].low < projLower * (1 - WICK_BREACH_TOLERANCE))
            lowerWickBreaches += 1;
    }
    if (upperWickBreaches + lowerWickBreaches > MAX_WICK_BREACHES)
        return { match: null, reason: upperWickBreaches >= lowerWickBreaches ? "upper_breach" : "lower_breach" };

    const offset = candles.length - window.length;
    const averageSlope = (upFit.slope + loFit.slope) / 2;
    const totalDriftRatio = Math.abs(averageSlope * (lastIdx - startIdx)) / channelMidpoint;
    const channelDirection = totalDriftRatio <= 0.03 ? "sideways" : averageSlope > 0 ? "rising" : "falling";
    const direction = channelDirection[0].toUpperCase() + channelDirection.slice(1);
    const fitQuality = 1 - Math.min(1, Math.max(upperFitError, lowerFitError) / channelWidth / MAX_FIT_ERROR_RATIO);
    const parallelQuality = 1 - Math.min(1, slopeDivergence / MAX_SLOPE_DIVERGENCE);
    const confidence = 0.55 + 0.25 * fitQuality + 0.2 * parallelQuality;
    return { reason: null, match: {
        pattern: "channel",
        patternLabel: `${direction} channel`,
        channelDirection,
        confidence: Math.round(confidence * 100) / 100,
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
        notes: `${direction} channel with ${highs.length} upper and ${lows.length} lower pivots. Price at ${(((lastClose - lower) / (upper - lower)) * 100).toFixed(0)}% of channel height.`,
    } };
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
    const ch = detectChannel(candles, undefined, opts);
    if (ch)
        out.push(ch);
    return out;
}

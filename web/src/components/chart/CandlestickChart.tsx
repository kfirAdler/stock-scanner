"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import {
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesMarkersPluginApi,
  ColorType,
  CrosshairMode,
  type CandlestickData,
  type LineData,
  type SeriesMarker,
  type Time,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
} from "lightweight-charts";

interface BarData {
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartProps {
  bars: BarData[];
  height?: number;
  /** SMA lengths to plot (default 20 and 50). */
  smaPeriods?: number[];
  /** YYYY-MM-DD of the bar to annotate (usually snapshot last_trade_date). */
  signalBarDate?: string | null;
  strongBuy?: boolean;
  strongSell?: boolean;
  buySignal?: boolean;
  sellSignal?: boolean;
  atr14?: number | null;
}

const LIGHT_THEME = {
  background: "#ffffff",
  text: "#64748b",
  grid: "#f1f5f9",
  border: "#e2e8f0",
  crosshair: "#94a3b8",
  upColor: "#22c55e",
  downColor: "#ef4444",
  upWick: "#16a34a",
  downWick: "#dc2626",
};

const SMA_LINE_COLORS = ["#3b82f6", "#22c55e", "#ef4444", "#eab308"];

const DARK_THEME = {
  background: "#0b1120",
  text: "#64748b",
  grid: "#1e293b",
  border: "#1e293b",
  crosshair: "#475569",
  upColor: "#4ade80",
  downColor: "#f87171",
  upWick: "#22c55e",
  downWick: "#ef4444",
};

export function CandlestickChart({
  bars,
  height = 420,
  smaPeriods = [20, 50],
  signalBarDate,
  strongBuy,
  strongSell,
  buySignal,
  sellSignal,
  atr14,
}: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!containerRef.current || bars.length === 0) return;

    const isDark = resolvedTheme === "dark";
    const colors = isDark ? DARK_THEME : LIGHT_THEME;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
        fontFamily: "Assistant, sans-serif",
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: colors.crosshair, labelBackgroundColor: colors.crosshair },
        horzLine: { color: colors.crosshair, labelBackgroundColor: colors.crosshair },
      },
      rightPriceScale: {
        borderColor: colors.border,
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: colors.border,
        timeVisible: false,
        rightOffset: 5,
      },
      handleScale: { axisPressedMouseMove: true },
      handleScroll: { vertTouchDrag: false },
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: colors.upColor,
      downColor: colors.downColor,
      wickUpColor: colors.upWick,
      wickDownColor: colors.downWick,
      borderVisible: false,
    });

    const candleData: CandlestickData<Time>[] = bars.map((b) => ({
      time: b.trade_date as Time,
      open: Number(b.open),
      high: Number(b.high),
      low: Number(b.low),
      close: Number(b.close),
    }));

    candleSeries.setData(candleData);

    const signalMarkers = buildSignalMarkers(bars, {
      signalBarDate: signalBarDate ?? null,
      strongBuy: !!strongBuy,
      strongSell: !!strongSell,
      buySignal: !!buySignal,
      sellSignal: !!sellSignal,
      atr14: atr14 ?? null,
      isDark,
    });
    let markersApi: ISeriesMarkersPluginApi<Time> | null = null;
    if (signalMarkers.length > 0) {
      markersApi = createSeriesMarkers(candleSeries, signalMarkers);
    }

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    volumeSeries.setData(
      bars.map((b) => ({
        time: b.trade_date as Time,
        value: Number(b.volume),
        color: Number(b.close) >= Number(b.open)
          ? isDark ? "rgba(74, 222, 128, 0.25)" : "rgba(34, 197, 94, 0.3)"
          : isDark ? "rgba(248, 113, 113, 0.25)" : "rgba(239, 68, 68, 0.3)",
      }))
    );

    const uniquePeriods = [...new Set(smaPeriods)].filter((p) => p > 0).sort((a, b) => a - b);
    uniquePeriods.forEach((period, idx) => {
      if (bars.length < period) return;
      const smaData = computeSMA(bars, period);
      if (smaData.length === 0) return;
      const color = SMA_LINE_COLORS[idx % SMA_LINE_COLORS.length];
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        title: `SMA ${period}`,
        crosshairMarkerVisible: false,
      });
      series.setData(smaData);
    });

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      markersApi?.detach();
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [
    bars,
    resolvedTheme,
    height,
    smaPeriods,
    signalBarDate,
    strongBuy,
    strongSell,
    buySignal,
    sellSignal,
    atr14,
  ]);

  if (bars.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border bg-surface-alt" style={{ height }}>
        <p className="text-sm text-text-muted">No chart data available</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="rounded-2xl border border-border overflow-hidden"
      style={{ height }}
    />
  );
}

function buildSignalMarkers(
  bars: BarData[],
  opts: {
    signalBarDate: string | null;
    strongBuy: boolean;
    strongSell: boolean;
    buySignal: boolean;
    sellSignal: boolean;
    atr14: number | null;
    isDark: boolean;
  }
): SeriesMarker<Time>[] {
  if (!opts.signalBarDate) return [];
  const bar =
    bars.find((b) => b.trade_date === opts.signalBarDate) ??
    bars[bars.length - 1];
  if (!bar) return [];

  const t = bar.trade_date as Time;
  const hi = Number(bar.high);
  const lo = Number(bar.low);
  const range = Math.max(hi - lo, Math.abs(hi) * 0.001);
  const pad =
    opts.atr14 !== null && opts.atr14 > 0
      ? opts.atr14 * 0.12
      : range * 0.15;

  const green = opts.isDark ? "#4ade80" : "#16a34a";
  const red = opts.isDark ? "#f87171" : "#dc2626";
  const markers: SeriesMarker<Time>[] = [];

  if (opts.strongBuy) {
    markers.push(
      {
        time: t,
        position: "atPriceTop",
        shape: "arrowUp",
        color: green,
        price: hi + pad,
        size: 2,
      },
      {
        time: t,
        position: "atPriceBottom",
        shape: "arrowUp",
        color: green,
        price: lo - pad,
        size: 2,
      }
    );
  } else if (opts.buySignal) {
    markers.push({
      time: t,
      position: "belowBar",
      shape: "arrowUp",
      color: green,
      size: 1,
    });
  }

  if (opts.strongSell) {
    markers.push(
      {
        time: t,
        position: "atPriceTop",
        shape: "arrowDown",
        color: red,
        price: hi + pad,
        size: 2,
      },
      {
        time: t,
        position: "atPriceTop",
        shape: "arrowDown",
        color: red,
        price: hi + pad * 2.7,
        size: 2,
      }
    );
  } else if (opts.sellSignal) {
    markers.push({
      time: t,
      position: "aboveBar",
      shape: "arrowDown",
      color: red,
      size: 1,
    });
  }

  return markers;
}

function computeSMA(bars: BarData[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  const closes = bars.map((b) => Number(b.close));

  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += closes[j];
    }
    result.push({
      time: bars[i].trade_date as Time,
      value: sum / period,
    });
  }

  return result;
}

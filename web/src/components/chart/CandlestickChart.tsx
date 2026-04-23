"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import {
  createChart,
  type IChartApi,
  ColorType,
  CrosshairMode,
  type CandlestickData,
  type LineData,
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

export function CandlestickChart({ bars, height = 420 }: ChartProps) {
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

    if (bars.length >= 20) {
      const sma20Data = computeSMA(bars, 20);
      if (sma20Data.length > 0) {
        const sma20Series = chart.addSeries(LineSeries, {
          color: "#3b82f6",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        sma20Series.setData(sma20Data);
      }
    }

    if (bars.length >= 50) {
      const sma50Data = computeSMA(bars, 50);
      if (sma50Data.length > 0) {
        const sma50Series = chart.addSeries(LineSeries, {
          color: "#22c55e",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        sma50Series.setData(sma50Data);
      }
    }

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [bars, resolvedTheme, height]);

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

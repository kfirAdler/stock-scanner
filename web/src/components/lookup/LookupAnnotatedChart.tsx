"use client";

import { useCallback, useMemo, useState } from "react";
import { CandlestickChart, type ChartDrawing, type ChartPoint } from "@/components/chart/CandlestickChart";
import type { PatternMatch } from "@/lib/patterns/types";
import type { RecentBar } from "./types";

type DrawingMode = "ray" | "horizontal" | "trend" | null;
const NO_SMA: number[] = [];

export function LookupAnnotatedChart({
  bars,
  match,
  t,
}: {
  bars: RecentBar[];
  match: PatternMatch | null;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const [mode, setMode] = useState<DrawingMode>(null);
  const [firstPoint, setFirstPoint] = useState<ChartPoint | null>(null);
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);
  const orderedBars = useMemo(() => [...bars].sort((a, b) => a.trade_date.localeCompare(b.trade_date)), [bars]);

  const onChartPoint = useCallback((point: ChartPoint) => {
    if (!mode) return;
    if (mode === "horizontal") {
      setDrawings((previous) => [...previous, { id: crypto.randomUUID(), kind: mode, price: point.price }]);
      setMode(null);
      return;
    }
    if (!firstPoint) {
      setFirstPoint(point);
      return;
    }
    if (firstPoint.index === point.index) return;
    const [from, to] = firstPoint.index < point.index ? [firstPoint, point] : [point, firstPoint];
    setDrawings((previous) => [...previous, { id: crypto.randomUUID(), kind: mode, from, to }]);
    setFirstPoint(null);
    setMode(null);
  }, [mode, firstPoint]);

  const buttons: { id: Exclude<DrawingMode, null>; label: string }[] = [
    { id: "ray", label: t("workspace.drawRay") },
    { id: "horizontal", label: t("workspace.drawHorizontal") },
    { id: "trend", label: t("workspace.drawTrend") },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {buttons.map((button) => (
          <button key={button.id} type="button" aria-pressed={mode === button.id}
            onClick={() => { setMode(mode === button.id ? null : button.id); setFirstPoint(null); }}
            className={`rounded-xl px-3 py-2 text-xs font-semibold ring-1 transition-colors ${mode === button.id
              ? "bg-primary text-white ring-primary" : "bg-surface-elevated text-text-secondary ring-border hover:text-text"}`}>
            {button.label}
          </button>
        ))}
        {drawings.length > 0 && (
          <button type="button" onClick={() => setDrawings((previous) => previous.slice(0, -1))}
            className="rounded-xl px-3 py-2 text-xs font-semibold text-text-secondary ring-1 ring-border hover:text-text">
            {t("workspace.undoDrawing")}
          </button>
        )}
      </div>
      <p className="text-xs text-text-muted" role="status">
        {mode === "horizontal" ? t("workspace.drawOnePoint") : mode
          ? t(firstPoint ? "workspace.drawSecondPoint" : "workspace.drawFirstPoint")
          : match ? t("workspace.patternOverlayHint") : t("workspace.drawingHint")}
      </p>
      <CandlestickChart bars={orderedBars} height={430} smaPeriods={NO_SMA}
        patternLines={match?.lines} manualDrawings={drawings} onChartPoint={onChartPoint} />
    </div>
  );
}

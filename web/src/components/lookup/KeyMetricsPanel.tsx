"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import type { LookupCoveragePayload } from "./types";

type KeyMetricsPanelProps = {
  coverage: LookupCoveragePayload;
  formatCurrency: (value: number | null | undefined) => string;
  formatPercent: (value: number | null | undefined) => string;
  t: (key: string, values?: Record<string, string | number>) => string;
};

function signedPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function distanceToneClass(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "text-text-muted";
  if (value > 0.05) return "text-success";
  if (value < -0.05) return "text-danger";
  return "text-text-secondary";
}

function MetricRow({
  label,
  value,
  hint,
  valueClass,
}: {
  label: string;
  value: string;
  hint?: string | null;
  valueClass?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-divider-soft py-1.5 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-[12px] text-text-secondary">{label}</p>
        {hint ? <p className="text-[10px] text-text-muted">{hint}</p> : null}
      </div>
      <p className={clsx("shrink-0 text-sm font-semibold tabular-nums", valueClass ?? "text-text")}>
        {value}
      </p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="ui-panel-subtle rounded-2xl px-4 py-3.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function KeyMetricsPanel({
  coverage,
  formatCurrency,
  formatPercent,
  t,
}: KeyMetricsPanelProps) {
  const daily = coverage.dailySnapshot;
  const close = Number(daily.close);

  const maRows = (
    [
      { period: 20, value: daily.sma_20, above: daily.is_above_sma20 },
      { period: 50, value: daily.sma_50, above: daily.is_above_sma50 },
      { period: 150, value: daily.sma_150, above: daily.is_above_sma150 },
      { period: 200, value: daily.sma_200, above: daily.is_above_sma200 },
    ] as const
  ).map((entry) => {
    const dist =
      entry.value != null && entry.value !== 0 && Number.isFinite(close)
        ? ((close - entry.value) / entry.value) * 100
        : null;
    const relation =
      dist == null ? null : dist >= 0 ? t("keyMetrics.above") : t("keyMetrics.below");
    return {
      period: entry.period,
      value: entry.value,
      dist,
      relation,
    };
  });

  // 60-bar close range position.
  const closes = coverage.recentBars
    .map((bar) => Number(bar.close))
    .filter((value) => Number.isFinite(value));
  const rangeHigh = closes.length ? Math.max(...closes) : null;
  const rangeLow = closes.length ? Math.min(...closes) : null;
  const rangeSpan =
    rangeHigh != null && rangeLow != null ? Math.max(rangeHigh - rangeLow, 1e-9) : null;
  const rangePosition =
    rangeSpan != null && rangeLow != null ? ((close - rangeLow) / rangeSpan) * 100 : null;
  const fromHigh =
    rangeHigh != null && rangeHigh !== 0 ? ((close - rangeHigh) / rangeHigh) * 100 : null;
  const fromLow =
    rangeLow != null && rangeLow !== 0 ? ((close - rangeLow) / rangeLow) * 100 : null;

  const rangeLabel =
    rangePosition == null
      ? null
      : rangePosition >= 80
        ? t("keyMetrics.atRangeHigh")
        : rangePosition <= 20
          ? t("keyMetrics.atRangeLow")
          : t("keyMetrics.midRange");

  const atrPct = daily.atr_percent;
  const volLabel =
    atrPct == null
      ? null
      : atrPct >= 5
        ? t("keyMetrics.volHigh")
        : atrPct >= 3
          ? t("keyMetrics.volElevated")
          : t("keyMetrics.volCalm");

  const toUpper = daily.pct_to_bb_upper;
  const toLower = daily.pct_to_bb_lower;
  const bandLabel =
    toUpper == null && toLower == null
      ? null
      : (toUpper ?? Number.POSITIVE_INFINITY) <= 3
        ? t("keyMetrics.nearUpper")
        : (toLower ?? Number.POSITIVE_INFINITY) <= 3
          ? t("keyMetrics.nearLower")
          : t("keyMetrics.midBands");

  const strongBuyBarsAgo = daily.strong_buy_signal_bars_ago;
  const strongSellBarsAgo = daily.strong_sell_signal_bars_ago;
  const barsAgoLabel = (value: number | null | undefined): string => {
    if (value == null || Number.isNaN(value)) return t("keyMetrics.none");
    if (value <= 0) return t("keyMetrics.today");
    return t("keyMetrics.barsAgo", { count: value });
  };

  return (
    <section className="ui-panel rounded-[22px] px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-text-muted">
          {t("keyMetrics.title")}
        </h2>
        <p className="text-[12px] text-text-secondary">{t("keyMetrics.subtitle")}</p>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Card title={t("keyMetrics.trendStructure")}>
          {maRows.map((row) => (
            <MetricRow
              key={row.period}
              label={`SMA ${row.period}`}
              hint={row.value != null ? formatCurrency(row.value) : null}
              value={row.dist == null ? "—" : `${signedPercent(row.dist)} ${row.relation ?? ""}`.trim()}
              valueClass={distanceToneClass(row.dist)}
            />
          ))}
        </Card>

        <Card title={t("keyMetrics.rangeVolatility")}>
          <MetricRow
            label={t("keyMetrics.rangePosition")}
            hint={rangeLabel}
            value={rangePosition == null ? "—" : `${Math.round(rangePosition)}%`}
          />
          <div className="my-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
            <div
              className="h-full rounded-full bg-[color:var(--color-neon)]"
              style={{ width: `${Math.min(100, Math.max(0, rangePosition ?? 0))}%` }}
            />
          </div>
          <MetricRow
            label={t("keyMetrics.fromHigh")}
            value={signedPercent(fromHigh)}
            valueClass={distanceToneClass(fromHigh)}
          />
          <MetricRow
            label={t("keyMetrics.fromLow")}
            value={signedPercent(fromLow)}
            valueClass={distanceToneClass(fromLow)}
          />
          <MetricRow
            label={t("keyMetrics.atr")}
            hint={volLabel}
            value={formatPercent(atrPct)}
          />
        </Card>

        <Card title={t("keyMetrics.bandsMomentum")}>
          <MetricRow
            label={t("keyMetrics.toBbUpper")}
            hint={bandLabel}
            value={toUpper == null ? "—" : `${toUpper.toFixed(2)}%`}
          />
          <MetricRow
            label={t("keyMetrics.toBbLower")}
            value={toLower == null ? "—" : `${toLower.toFixed(2)}%`}
          />
          <MetricRow
            label={t("keyMetrics.upSequence")}
            value={String(daily.up_sequence_count ?? 0)}
            valueClass={daily.up_sequence_count ? "text-success" : "text-text"}
          />
          <MetricRow
            label={t("keyMetrics.downSequence")}
            value={String(daily.down_sequence_count ?? 0)}
            valueClass={daily.down_sequence_count ? "text-danger" : "text-text"}
          />
          <MetricRow
            label={
              (strongBuyBarsAgo ?? Number.POSITIVE_INFINITY) <=
              (strongSellBarsAgo ?? Number.POSITIVE_INFINITY)
                ? t("keyMetrics.lastStrongBuy")
                : t("keyMetrics.lastStrongSell")
            }
            value={barsAgoLabel(
              (strongBuyBarsAgo ?? Number.POSITIVE_INFINITY) <=
                (strongSellBarsAgo ?? Number.POSITIVE_INFINITY)
                ? strongBuyBarsAgo
                : strongSellBarsAgo
            )}
          />
        </Card>
      </div>
    </section>
  );
}

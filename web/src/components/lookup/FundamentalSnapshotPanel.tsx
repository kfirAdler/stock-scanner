import { clsx } from "clsx";
import type { LookupCoveragePayload } from "./types";

function metricTone(kind: "positive" | "warning" | "neutral") {
  if (kind === "positive") return "text-success";
  if (kind === "warning") return "text-warning";
  return "text-text";
}

export function FundamentalSnapshotPanel({
  coverage,
  formatMarketCap,
  t,
}: {
  coverage: LookupCoveragePayload;
  formatMarketCap: (value: number | null | undefined) => string;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const meta = coverage.metadata;
  const roe = meta?.return_on_equity;
  const debt = meta?.debt_to_equity;
  const rows = [
    {
      label: t("fundamentals.marketCap"),
      value: formatMarketCap(meta?.market_cap),
      note: t("fundamentals.companySize"),
      tone: "neutral" as const,
    },
    {
      label: t("fundamentals.roe"),
      value: roe == null ? "—" : `${roe.toFixed(1)}%`,
      note: roe == null
        ? t("fundamentals.unavailable")
        : roe >= 20
          ? t("fundamentals.roeStrong")
          : roe > 0
            ? t("fundamentals.roePositive")
            : t("fundamentals.roeWeak"),
      tone: roe == null ? "neutral" as const : roe > 0 ? "positive" as const : "warning" as const,
    },
    {
      label: t("fundamentals.debtEquity"),
      value: debt == null ? "—" : debt.toFixed(2),
      note: debt == null
        ? t("fundamentals.unavailable")
        : debt < 1
          ? t("fundamentals.debtLow")
          : debt < 1.5
            ? t("fundamentals.debtBalanced")
            : t("fundamentals.debtHigh"),
      tone: debt == null ? "neutral" as const : debt < 1.5 ? "positive" as const : "warning" as const,
    },
    {
      label: t("fundamentals.classification"),
      value: meta?.sector || "—",
      note: meta?.industry || t("fundamentals.unavailable"),
      tone: "neutral" as const,
    },
  ];

  return (
    <section className="ui-panel rounded-[24px] px-5 py-5 md:px-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neon">{t("fundamentals.kicker")}</p>
        <h2 className="mt-1 text-xl font-bold text-text">{t("fundamentals.title")}</h2>
        <p className="mt-1 text-sm text-text-secondary">{t("fundamentals.subtitle")}</p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((row) => (
          <div key={row.label} className="ui-panel-subtle rounded-2xl px-4 py-4">
            <p className="text-[11px] font-bold text-text-muted">{row.label}</p>
            <p className={clsx("mt-2 truncate text-xl font-bold tabular-nums", metricTone(row.tone))}>{row.value}</p>
            <p className="mt-1 text-xs leading-5 text-text-secondary">{row.note}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-text-muted">{t("fundamentals.disclaimer")}</p>
    </section>
  );
}

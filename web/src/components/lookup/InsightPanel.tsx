"use client";

type InsightPanelProps = {
  insights: string[];
  t: (key: string, values?: Record<string, string | number>) => string;
};

export function InsightPanel({ insights, t }: InsightPanelProps) {
  return (
    <section className="rounded-[22px] bg-surface-raised px-4 py-4 ring-1 ring-border shadow-[0_10px_30px_rgba(15,23,42,0.05)] dark:ring-[#183241]">
      <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.insights")}</h2>
      <div className="mt-3 space-y-2">
        {insights.map((insight) => (
          <div key={insight} className="rounded-2xl bg-surface-alt/70 px-3 py-3 text-sm text-text-secondary ring-1 ring-border">
            {insight}
          </div>
        ))}
      </div>
    </section>
  );
}

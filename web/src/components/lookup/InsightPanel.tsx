"use client";

type InsightPanelProps = {
  insights: string[];
  t: (key: string, values?: Record<string, string | number>) => string;
};

export function InsightPanel({ insights, t }: InsightPanelProps) {
  return (
    <section className="ui-panel rounded-[22px] px-4 py-4">
      <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.insights")}</h2>
      <div className="mt-3 space-y-2">
        {insights.map((insight) => (
          <div key={insight} className="ui-panel-subtle rounded-2xl px-3 py-3 text-sm text-text-secondary">
            {insight}
          </div>
        ))}
      </div>
    </section>
  );
}

"use client";

import { Button } from "@/components/ui/Button";
import { ConditionChip } from "./ConditionChip";
import type { LookupCondition } from "./types";

type MatchedConditionsPanelProps = {
  matched: LookupCondition[];
  near: LookupCondition[];
  failed: LookupCondition[];
  selectedCondition: LookupCondition | null;
  onSelectCondition: (condition: LookupCondition) => void;
  onOpenConditionScan: (condition: LookupCondition) => void;
  onCombineConditionScan: (condition: LookupCondition) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
};

function ConditionGroup({
  title,
  items,
  selectedCondition,
  onSelectCondition,
}: {
  title: string;
  items: LookupCondition[];
  selectedCondition: LookupCondition | null;
  onSelectCondition: (condition: LookupCondition) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">{title}</h3>
        <span className="text-[11px] text-text-muted">{items.length}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((condition) => (
          <ConditionChip
            key={condition.id}
            condition={condition}
            active={selectedCondition?.id === condition.id}
            onClick={() => onSelectCondition(condition)}
          />
        ))}
      </div>
    </div>
  );
}

export function MatchedConditionsPanel({
  matched,
  near,
  failed,
  selectedCondition,
  onSelectCondition,
  onOpenConditionScan,
  onCombineConditionScan,
  t,
}: MatchedConditionsPanelProps) {
  return (
    <section className="ui-panel rounded-[22px] px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.currentMatches")}</h2>
          <p className="mt-1 text-sm text-text-secondary">{t("workspace.currentMatchesSub")}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-5 xl:grid-cols-3">
        <ConditionGroup
          title={t("workspace.matched")}
          items={matched}
          selectedCondition={selectedCondition}
          onSelectCondition={onSelectCondition}
        />
        <ConditionGroup
          title={t("workspace.nearMatches")}
          items={near}
          selectedCondition={selectedCondition}
          onSelectCondition={onSelectCondition}
        />
        <ConditionGroup
          title={t("workspace.failed")}
          items={failed}
          selectedCondition={selectedCondition}
          onSelectCondition={onSelectCondition}
        />
      </div>

      {selectedCondition ? (
        <div className="mt-5 rounded-2xl bg-surface-alt/70 px-4 py-4 ring-1 ring-border">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.conditionActions")}</p>
              <p className="mt-1 text-sm font-semibold text-text">
                {(selectedCondition.timeframeLabel ?? selectedCondition.timeframe)} · {selectedCondition.label}
              </p>
              {selectedCondition.note ? (
                <p className="mt-1 text-[12px] text-text-secondary">{selectedCondition.note}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => onOpenConditionScan(selectedCondition)}>
                {t("actions.findAll")}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onCombineConditionScan(selectedCondition)}>
                {t("actions.combine")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

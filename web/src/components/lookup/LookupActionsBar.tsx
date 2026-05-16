"use client";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";

type LookupActionsBarProps = {
  screenerHref: string;
  onFindSimilar: () => void;
  onSaveSetup: () => void;
  onCopyConditions: () => void;
  onCompare: () => void;
  tickerHref: string;
  feedback: string | null;
  t: (key: string, values?: Record<string, string | number>) => string;
};

export function LookupActionsBar({
  screenerHref,
  onFindSimilar,
  onSaveSetup,
  onCopyConditions,
  onCompare,
  tickerHref,
  feedback,
  t,
}: LookupActionsBarProps) {
  return (
    <section className="ui-panel rounded-[22px] px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.quickActions")}</h2>
        {feedback ? <span className="text-[12px] text-text-muted">{feedback}</span> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={screenerHref}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-bold text-on-primary shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {t("actions.openInScreener")}
        </Link>
        <Button size="sm" variant="secondary" onClick={onFindSimilar}>
          {t("actions.findSimilar")}
        </Button>
        <Button size="sm" variant="secondary" onClick={onSaveSetup}>
          {t("actions.saveSetup")}
        </Button>
        <Button size="sm" variant="secondary" onClick={onCopyConditions}>
          {t("actions.copyConditions")}
        </Button>
        <Link
          href={tickerHref}
          className="ui-control inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-bold transition-colors hover:border-border-strong"
        >
          {t("actions.viewSequenceHistory")}
        </Link>
        <Button size="sm" variant="ghost" onClick={onCompare}>
          {t("actions.compareTicker")}
        </Button>
      </div>
    </section>
  );
}

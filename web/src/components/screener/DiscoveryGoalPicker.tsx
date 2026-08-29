"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { DISCOVERY_GOALS } from "@/lib/discovery-goals";
import type {
  DiscoveryGoal,
  ListingMarketFilter,
  ScreenerFilterAvailability,
} from "@/lib/screener-types";
import { discoveryGoalAvailable } from "@/lib/discovery-goals";

interface DiscoveryGoalPickerProps {
  selectedGoal?: DiscoveryGoal;
  market?: ListingMarketFilter;
  availability: ScreenerFilterAvailability | null;
  loadingGoal?: DiscoveryGoal | null;
  onSelectGoal: (goal: DiscoveryGoal) => void;
  onMarketChange: (market?: ListingMarketFilter) => void;
}

const GOAL_ICONS: Record<DiscoveryGoal, string> = {
  trend_leaders: "↗",
  confirmed_breakout: "◆",
  healthy_pullback: "⌁",
  stable_trend: "≈",
  aggressive_rebound: "↟",
};

export function DiscoveryGoalPicker({
  selectedGoal,
  market,
  availability,
  loadingGoal,
  onSelectGoal,
  onMarketChange,
}: DiscoveryGoalPickerProps) {
  const t = useTranslations("screener.discovery");
  const [expanded, setExpanded] = useState(!selectedGoal);

  if (selectedGoal && !expanded) {
    return (
      <section className="page-card-strong flex flex-col gap-3 !p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-xl font-bold text-primary">
            {GOAL_ICONS[selectedGoal]}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
              {t("activeLabel")}
            </p>
            <p className="truncate text-base font-bold text-text">
              {t(`goals.${selectedGoal}.title`)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="ui-badge-default rounded-full px-2.5 py-1 text-[11px] font-semibold">
            {t(`markets.${market ?? "all"}`)}
          </span>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="ui-control rounded-xl px-3 py-2 text-xs font-bold text-text-secondary transition-colors hover:border-border-strong hover:text-text"
          >
            {t("changeGoal")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="page-card-strong space-y-4 !p-4 sm:!p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
            {t("eyebrow")}
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-text sm:text-2xl">
            {t("title")}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
            {t("body")}
          </p>
        </div>
        <div className="shrink-0">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
            {t("marketLabel")}
          </p>
          <div className="ui-segment inline-flex rounded-xl p-1">
            {([undefined, "US", "TA"] as const).map((value) => (
              <button
                key={value ?? "all"}
                type="button"
                onClick={() => onMarketChange(value)}
                className={clsx(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  market === value || (!market && !value)
                    ? "ui-segment-item-active"
                    : "ui-segment-item hover:text-text"
                )}
              >
                {t(`markets.${value ?? "all"}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 md:grid md:grid-cols-2 md:overflow-visible md:pb-0 xl:grid-cols-5">
        {DISCOVERY_GOALS.map((goal) => {
          const available = discoveryGoalAvailable(goal, availability);
          const active = goal === selectedGoal;
          const busy = goal === loadingGoal;
          return (
            <button
              key={goal}
              type="button"
              aria-pressed={active}
              disabled={!available || !!loadingGoal}
              title={!available ? t("unavailable") : undefined}
              onClick={() => {
                setExpanded(false);
                onSelectGoal(goal);
              }}
              className={clsx(
                "group min-w-[78%] snap-start rounded-2xl border p-4 text-start transition-all md:min-w-0",
                active
                  ? "border-primary/45 bg-primary-soft shadow-[0_10px_28px_rgba(37,99,235,0.12)] dark:border-[#6f8bff]/55 dark:bg-[#18294b]"
                  : "ui-panel-subtle hover:-translate-y-0.5 hover:border-border-strong dark:hover:bg-[#203149]",
                (!available || !!loadingGoal) && "cursor-not-allowed opacity-55"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={clsx(
                  "inline-flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold",
                  active ? "bg-primary text-white" : "bg-surface-alt text-primary"
                )}>
                  {busy ? "…" : GOAL_ICONS[goal]}
                </span>
                <span className="ui-badge-default rounded-full px-2 py-0.5 text-[10px] font-semibold">
                  {t(`goals.${goal}.risk`)}
                </span>
              </div>
              <p className="mt-3 text-sm font-bold text-text">
                {t(`goals.${goal}.title`)}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">
                {t(`goals.${goal}.description`)}
              </p>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] leading-relaxed text-text-muted">
        {t("scoreNote")}
      </p>
    </section>
  );
}

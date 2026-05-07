"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  RULE_DEFINITIONS,
  activeRuleCountForTimeframe,
  countActiveFilters,
  createRule,
  ruleDefinitionsByField,
} from "@/lib/screener-query";
import type {
  ScreenerPayload,
  ScreenerRule,
  ScreenerRuleField,
  ScreenerTimeframe,
} from "@/lib/screener-types";

type CategoryTab = "sequence" | "signals" | "trend" | "location" | "volatility";

const TIMEFRAME_TABS: ScreenerTimeframe[] = ["1D", "1W", "1M"];
const CATEGORY_TABS: CategoryTab[] = ["sequence", "signals", "trend", "location", "volatility"];

function firstActiveTabState(
  filters: ScreenerPayload,
  definitions: Record<ScreenerRuleField, ReturnType<typeof ruleDefinitionsByField>[ScreenerRuleField]>
): { timeframe: ScreenerTimeframe; category: CategoryTab } | null {
  const firstRule = filters.rules[0];
  if (!firstRule) return null;
  const category = definitions[firstRule.field]?.category;
  if (!category) return null;
  return {
    timeframe: firstRule.timeframe,
    category,
  };
}

interface FilterPanelProps {
  filters: ScreenerPayload;
  onChange: (filters: ScreenerPayload) => void;
  onApply: () => void;
  loading?: boolean;
  onSaveScan: () => void;
  saveScanLoading?: boolean;
  onSaveFavorite: () => void;
  onLoadFavorite: () => void;
  favoriteSaving?: boolean;
  favoriteLoading?: boolean;
  favoriteAvailable?: boolean;
  favoriteStatus?: string | null;
  onClose?: () => void;
  hasPendingChanges?: boolean;
  appliedFilterCount?: number;
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill={filled ? "currentColor" : "none"}
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M10 2.25 12.4 7.1l5.35.78-3.87 3.77.91 5.32L10 14.45l-4.79 2.52.91-5.32L2.25 7.88l5.35-.78L10 2.25Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FilterChip({
  active,
  label,
  onClick,
  tooltip,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  tooltip?: string;
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          "inline-flex min-h-8 items-center rounded-md border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors",
          active
            ? "border-primary bg-primary text-on-primary shadow-[0_0_18px_rgba(45,212,191,0.18)]"
            : "border-border bg-surface text-text-secondary hover:border-border-strong hover:text-text"
        )}
      >
        {label}
      </button>
      {tooltip ? <Tooltip content={tooltip} /> : null}
    </div>
  );
}

function ActiveFilterPill({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[11px] font-bold text-text-secondary transition-colors hover:border-primary/30 hover:text-text"
    >
      <span>{label}</span>
      <span aria-hidden="true">×</span>
    </button>
  );
}

export function FilterPanel({
  filters,
  onChange,
  onApply,
  loading,
  onSaveScan,
  saveScanLoading,
  onSaveFavorite,
  onLoadFavorite,
  favoriteSaving,
  favoriteLoading,
  favoriteAvailable,
  favoriteStatus,
  onClose,
  hasPendingChanges,
  appliedFilterCount = 0,
}: FilterPanelProps) {
  const t = useTranslations("screener");
  const definitions = useMemo(() => ruleDefinitionsByField(), []);
  const [activeTimeframe, setActiveTimeframe] = useState<ScreenerTimeframe>(
    () => firstActiveTabState(filters, definitions)?.timeframe ?? "1D"
  );
  const [activeCategory, setActiveCategory] = useState<CategoryTab>(
    () => firstActiveTabState(filters, definitions)?.category ?? "sequence"
  );
  const activeFilterCount = countActiveFilters(filters);

  function clearAll() {
    onChange({ version: 1, rules: [] });
  }

  function getRule(timeframe: ScreenerTimeframe, field: ScreenerRuleField) {
    return filters.rules.find(
      (rule) => rule.timeframe === timeframe && rule.field === field
    );
  }

  function upsertRule(nextRule: ScreenerRule) {
    const existing = getRule(nextRule.timeframe, nextRule.field);
    if (existing) {
      onChange({
        ...filters,
        rules: filters.rules.map((rule) =>
          rule.id === existing.id ? { ...rule, ...nextRule, id: existing.id } : rule
        ),
      });
      return;
    }
    onChange({
      ...filters,
      rules: [...filters.rules, nextRule],
    });
  }

  function removeRule(timeframe: ScreenerTimeframe, field: ScreenerRuleField) {
    onChange({
      ...filters,
      rules: filters.rules.filter(
        (rule) => !(rule.timeframe === timeframe && rule.field === field)
      ),
    });
  }

  function toggleBooleanRule(timeframe: ScreenerTimeframe, field: ScreenerRuleField) {
    const existing = getRule(timeframe, field);
    if (existing) {
      removeRule(timeframe, field);
      return;
    }
    const seeded = createRule(field, timeframe);
    upsertRule({
      ...seeded,
      operator: "is_true",
      value: undefined,
    });
  }

  function setNumericRule(
    timeframe: ScreenerTimeframe,
    field: ScreenerRuleField,
    operator: ScreenerRule["operator"],
    rawValue: string
  ) {
    if (rawValue === "") {
      removeRule(timeframe, field);
      return;
    }
    const numeric = Number(rawValue);
    if (Number.isNaN(numeric)) return;
    const seeded = createRule(field, timeframe);
    upsertRule({
      ...seeded,
      operator,
      value: numeric,
    });
  }

  function setSelectRule(
    timeframe: ScreenerTimeframe,
    field: ScreenerRuleField,
    value: string
  ) {
    if (!value) {
      removeRule(timeframe, field);
      return;
    }
    const seeded = createRule(field, timeframe);
    upsertRule({
      ...seeded,
      operator: "eq",
      value,
    });
  }

  const currentDefinitions = RULE_DEFINITIONS.filter(
    (definition) => definition.category === activeCategory
  );

  const activeRulePills = filters.rules.map((rule) => {
    const definition = definitions[rule.field];
    let suffix = "";
    if (typeof rule.value === "number") {
      suffix = ` ${t(`operators.${rule.operator}`)} ${rule.value}`;
    }
    if (typeof rule.value === "string" && rule.field === "fib_zone") {
      suffix = ` ${t("operators.eq")} ${t(`fibZones.${rule.value}`)}`;
    }
    return {
      key: `${rule.timeframe}-${rule.field}`,
      label: `${t(`timeframes.${rule.timeframe}`)} · ${t(definition.labelKey)}${suffix}`,
      remove: () => removeRule(rule.timeframe, rule.field),
    };
  });

  const timeframeSummary = TIMEFRAME_TABS.map((timeframe) => ({
    timeframe,
    count: activeRuleCountForTimeframe(filters, timeframe),
  }));

  return (
    <aside className="overflow-hidden rounded-2xl border border-border-strong/70 bg-surface-raised shadow-[0_14px_40px_rgba(15,23,42,0.08)] dark:border-[#183241] dark:bg-[linear-gradient(180deg,rgba(5,11,17,0.98),rgba(7,14,22,0.98))] dark:shadow-[0_22px_55px_rgba(0,0,0,0.72)]">
      <div className="border-b border-border px-4 py-4 dark:border-[#183241]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
              {t("filters")}
            </p>
            <h2 className="mt-1 text-lg font-bold text-text">{t("workspace.compactTitle")}</h2>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              {t("workspace.compactHint")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-primary/25 bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">
              {activeFilterCount}
            </span>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition-colors hover:border-border-strong hover:text-text dark:border-[#1a2d39] dark:bg-[#071019]"
                aria-label={t("workspace.closeFilters")}
              >
                ×
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wide">
          <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-text-secondary dark:border-[#1a2d39] dark:bg-[#071019]">
            {hasPendingChanges ? t("workspace.draftPending") : t("workspace.draftSynced")}
          </span>
          <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-text-secondary dark:border-[#1a2d39] dark:bg-[#071019]">
            {t("workspace.appliedCount", { count: appliedFilterCount })}
          </span>
          {favoriteStatus ? (
            <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-text-secondary dark:border-[#1a2d39] dark:bg-[#071019]">
              {favoriteStatus}
            </span>
          ) : null}
        </div>
      </div>

      <div className="border-b border-border px-4 py-3 dark:border-[#183241]">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_132px_132px]">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label
                htmlFor="screener-listing-market"
                className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted"
              >
                {t("workspace.sections.universe")}
              </label>
              <select
                id="screener-listing-market"
                className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-[#1a2d39] dark:bg-[#09131c]"
                value={filters.listing_market ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  onChange({
                    ...filters,
                    listing_market: value === "" ? undefined : (value as "US" | "TA"),
                  });
                }}
              >
                <option value="">{t("listingMarket.all")}</option>
                <option value="US">{t("listingMarket.us")}</option>
                <option value="TA">{t("listingMarket.ta")}</option>
              </select>
            </div>
            <Input
              label={t("marketCap.gte")}
              type="number"
              step="1"
              value={filters.market_cap_gte ?? ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  market_cap_gte: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              placeholder="1000000000"
            />
            <Input
              label={t("marketCap.lte")}
              type="number"
              step="1"
              value={filters.market_cap_lte ?? ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  market_cap_lte: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              placeholder="50000000000"
            />
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onSaveScan}
            loading={saveScanLoading}
            disabled={activeFilterCount === 0}
            className="h-full justify-center"
          >
            {t("saveScan")}
          </Button>
          <Button
            type="button"
            variant={favoriteAvailable ? "secondary" : "ghost"}
            size="sm"
            onClick={onSaveFavorite}
            loading={favoriteSaving}
            disabled={activeFilterCount === 0}
            className={clsx(
              "h-full justify-center",
              favoriteAvailable &&
                "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300"
            )}
          >
            <StarIcon filled={!!favoriteAvailable} />
            <span>{favoriteAvailable ? t("favorite.update") : t("favorite.save")}</span>
          </Button>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-4">
          <div className="flex flex-col gap-2">
            {timeframeSummary.map(({ timeframe, count }) => (
              <button
                key={timeframe}
                type="button"
                onClick={() => setActiveTimeframe(timeframe)}
                className={clsx(
                  "flex min-h-12 flex-col items-center justify-center rounded-xl border text-xs font-black uppercase tracking-[0.18em] transition-colors",
                  activeTimeframe === timeframe
                    ? "border-primary bg-primary text-on-primary shadow-[0_0_20px_rgba(45,212,191,0.22)]"
                    : "border-border bg-surface text-text-secondary hover:border-border-strong hover:text-text dark:border-[#1a2d39] dark:bg-[#081018]"
                )}
              >
                <span>{timeframe.slice(1)}</span>
                <span
                  className={clsx(
                    "mt-1 text-[10px]",
                    activeTimeframe === timeframe ? "text-on-primary/80" : "text-text-muted"
                  )}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>

          <div className="min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
                  {t("workspace.currentTimeframe", {
                    timeframe: t(`timeframes.${activeTimeframe}`),
                  })}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {t("workspace.timeframeHint")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip content={t("workspace.help.timeframeMeta")} />
                <Tooltip content={t("workspace.help.maMeta")} />
              </div>
            </div>

            <div className="mt-4 border-b border-border">
              <div className="flex flex-wrap gap-2">
                {CATEGORY_TABS.map((category) => {
                  const count = filters.rules.filter(
                    (rule) =>
                      rule.timeframe === activeTimeframe &&
                      definitions[rule.field].category === category
                  ).length;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(category)}
                      className={clsx(
                        "inline-flex items-center gap-2 rounded-t-lg border border-b-0 px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors",
                        activeCategory === category
                          ? "border-border-strong bg-surface text-text dark:border-[#1e3b4b] dark:bg-[#081018]"
                          : "border-transparent bg-transparent text-text-muted hover:text-text"
                      )}
                    >
                      <span>{t(`categories.${category}`)}</span>
                      <span
                        className={clsx(
                          "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px]",
                          activeCategory === category
                            ? "bg-primary-soft text-primary"
                            : "bg-surface-alt text-text-muted dark:bg-[#0d1821]"
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex flex-wrap gap-2">
                {currentDefinitions
                  .filter((definition) => definition.input === "none")
                  .map((definition) => {
                    const active = !!getRule(activeTimeframe, definition.field);
                    return (
                      <FilterChip
                        key={`${activeTimeframe}-${definition.field}`}
                        active={active}
                        label={t(definition.labelKey)}
                        tooltip={
                          definition.descriptionKey ? t(definition.descriptionKey) : undefined
                        }
                        onClick={() => toggleBooleanRule(activeTimeframe, definition.field)}
                      />
                    );
                  })}
              </div>

              {currentDefinitions.some((definition) => definition.input === "number") ? (
                <div className="grid gap-3">
                  {currentDefinitions
                    .filter((definition) => definition.input === "number")
                    .map((definition) => {
                      const rule = getRule(activeTimeframe, definition.field);
                      const operator = definition.operators[0] as ScreenerRule["operator"];
                      return (
                        <div
                          key={`${activeTimeframe}-${definition.field}`}
                          className="grid gap-2 border-t border-border pt-3 sm:grid-cols-[minmax(0,1fr)_180px]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-text">{t(definition.labelKey)}</p>
                              <p className="mt-1 text-[11px] text-text-muted">
                                {t(`operators.${operator}`)}
                              </p>
                            </div>
                            {definition.descriptionKey ? (
                              <Tooltip content={t(definition.descriptionKey)} />
                            ) : null}
                          </div>
                          <Input
                            label={t("valueLabel")}
                            type="number"
                            step="0.1"
                            value={typeof rule?.value === "number" ? rule.value : ""}
                            onChange={(e) =>
                              setNumericRule(
                                activeTimeframe,
                                definition.field,
                                operator,
                                e.target.value
                              )
                            }
                            placeholder={t("valuePlaceholder")}
                          />
                        </div>
                      );
                    })}
                </div>
              ) : null}

              {currentDefinitions.some((definition) => definition.input === "select") ? (
                <div className="border-t border-border pt-3">
                  {currentDefinitions
                    .filter((definition) => definition.input === "select")
                    .map((definition) => {
                      const rule = getRule(activeTimeframe, definition.field);
                      return (
                        <div key={`${activeTimeframe}-${definition.field}`}>
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="text-sm font-bold text-text">{t(definition.labelKey)}</p>
                            {definition.descriptionKey ? (
                              <Tooltip content={t(definition.descriptionKey)} />
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {definition.valueOptions?.map((option) => (
                              <FilterChip
                                key={`${activeTimeframe}-${definition.field}-${option.value}`}
                                active={rule?.value === option.value}
                                label={t(option.labelKey)}
                                onClick={() =>
                                  setSelectRule(
                                    activeTimeframe,
                                    definition.field,
                                    rule?.value === option.value ? "" : option.value
                                  )
                                }
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border px-4 py-3 dark:border-[#183241]">
        <div className="flex flex-wrap gap-2">
          {activeRulePills.length === 0 &&
          !filters.listing_market &&
          filters.market_cap_gte === undefined &&
          filters.market_cap_lte === undefined ? (
            <p className="text-sm text-text-muted">{t("activeFiltersEmpty")}</p>
          ) : (
            <>
              {filters.listing_market ? (
                <ActiveFilterPill
                  label={`${t("listingMarket.label")} · ${t(`listingMarket.${filters.listing_market.toLowerCase()}`)}`}
                  onRemove={() => onChange({ ...filters, listing_market: undefined })}
                />
              ) : null}
              {filters.market_cap_gte !== undefined ? (
                <ActiveFilterPill
                  label={`${t("marketCap.gte")} ${filters.market_cap_gte}`}
                  onRemove={() => onChange({ ...filters, market_cap_gte: undefined })}
                />
              ) : null}
              {filters.market_cap_lte !== undefined ? (
                <ActiveFilterPill
                  label={`${t("marketCap.lte")} ${filters.market_cap_lte}`}
                  onRemove={() => onChange({ ...filters, market_cap_lte: undefined })}
                />
              ) : null}
              {activeRulePills.map((pill) => (
                <ActiveFilterPill key={pill.key} label={pill.label} onRemove={pill.remove} />
              ))}
            </>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-border bg-surface-raised/95 px-4 py-3 backdrop-blur dark:border-[#183241] dark:bg-[#071019f0]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
              {t("workspace.quickActions")}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {hasPendingChanges ? t("workspace.bottomHintDirty") : t("workspace.bottomHintReady")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onLoadFavorite}
              loading={favoriteLoading}
              disabled={!favoriteAvailable}
            >
              {t("favorite.load")}
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll} disabled={activeFilterCount === 0}>
              {t("clearFilters")}
            </Button>
            <Button size="sm" onClick={onApply} loading={loading}>
              {t("workspace.quickApply")}
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}

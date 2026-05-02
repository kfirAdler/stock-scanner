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
const CATEGORY_TABS: CategoryTab[] = [
  "sequence",
  "signals",
  "trend",
  "location",
  "volatility",
];

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

function TerminalChip({
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
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          "inline-flex min-h-9 items-center rounded-md border px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors",
          active
            ? "border-primary bg-primary text-on-primary shadow-sm"
            : "border-border bg-surface text-text-secondary hover:border-border-strong hover:text-text"
        )}
      >
        {label}
      </button>
      {tooltip ? (
        <span className={active ? "text-on-primary" : ""}>
          <Tooltip content={tooltip} />
        </span>
      ) : null}
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
      className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3 py-1.5 text-[11px] font-bold text-text-secondary transition-colors hover:border-primary/30 hover:text-text"
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
    <aside className="rounded-2xl border border-border-strong/70 bg-surface-raised shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
      <div className="border-b border-border bg-surface-alt/80 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
              {t("filters")}
            </p>
            <h2 className="mt-1 text-lg font-bold text-text">{t("title")}</h2>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              {t("layoutHint")}
            </p>
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-bold text-primary">
            {activeFilterCount}
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          <Button size="sm" onClick={onApply} loading={loading} className="w-full justify-center">
            {t("applyFilters")}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onSaveScan}
              loading={saveScanLoading}
              disabled={activeFilterCount === 0}
              className="w-full justify-center"
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
                "w-full justify-center",
                favoriteAvailable &&
                  "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300"
              )}
              aria-label={favoriteAvailable ? t("favorite.update") : t("favorite.save")}
            >
              <StarIcon filled={!!favoriteAvailable} />
              <span>{favoriteAvailable ? t("favorite.update") : t("favorite.save")}</span>
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onLoadFavorite}
              loading={favoriteLoading}
              disabled={!favoriteAvailable}
              className="w-full justify-center"
            >
              {t("favorite.load")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={activeFilterCount === 0}
              className="w-full justify-center"
            >
              {t("clearFilters")}
            </Button>
          </div>
        </div>
      </div>

      {favoriteStatus && (
        <div className="border-b border-border bg-surface px-4 py-2 text-xs font-medium text-text-secondary" aria-live="polite">
          {favoriteStatus}
        </div>
      )}

      <div className="space-y-5 p-4">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
              {t("listingMarket.label")}
            </h3>
            <span className="text-[11px] font-medium text-text-muted">{t("results")}</span>
          </div>
          <select
            id="screener-listing-market"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={filters.listing_market ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange({
                ...filters,
                listing_market: v === "" ? undefined : (v as "US" | "TA"),
              });
            }}
          >
            <option value="">{t("listingMarket.all")}</option>
            <option value="US">{t("listingMarket.us")}</option>
            <option value="TA">{t("listingMarket.ta")}</option>
          </select>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
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
        </section>

        <section className="space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
            {t("timeframes.1D")} / {t("timeframes.1W")} / {t("timeframes.1M")}
          </h3>
          <div className="grid gap-2">
            {timeframeSummary.map(({ timeframe, count }) => (
              <button
                key={timeframe}
                type="button"
                onClick={() => setActiveTimeframe(timeframe)}
                className={clsx(
                  "flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors",
                  activeTimeframe === timeframe
                    ? "border-primary bg-primary text-on-primary"
                    : "border-border bg-surface text-text-secondary hover:border-border-strong hover:text-text"
                )}
              >
                <div>
                  <p className="text-sm font-bold">{t(`timeframes.${timeframe}`)}</p>
                  <p className={clsx("text-[11px]", activeTimeframe === timeframe ? "text-on-primary/80" : "text-text-muted")}>
                    {t("blockSubtitle")}
                  </p>
                </div>
                <span
                  className={clsx(
                    "inline-flex min-w-7 items-center justify-center rounded-full px-2 py-1 text-[10px] font-bold",
                    activeTimeframe === timeframe
                      ? "bg-black/10 text-on-primary"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
              {t("blockTitle", {
                timeframe: t(`timeframes.${activeTimeframe}`),
                category: t(`categories.${activeCategory}`),
              })}
            </h3>
            <span className="text-[11px] text-text-muted">{currentDefinitions.length}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
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
                    "flex items-center justify-between rounded-md border px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors",
                    activeCategory === category
                      ? "border-text bg-text text-on-text"
                      : "border-border bg-surface text-text-muted hover:text-text"
                  )}
                >
                  <span>{t(`categories.${category}`)}</span>
                  <span
                    className={clsx(
                      "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px]",
                      activeCategory === category
                        ? "bg-black/10 text-on-text"
                        : "bg-primary/10 text-primary"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-border bg-surface p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold text-text">{t("blockSubtitle")}</p>
              <p className="text-[11px] text-text-muted">{t("selectHint")}</p>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {currentDefinitions
                  .filter((definition) => definition.input === "none")
                  .map((definition) => {
                    const active = !!getRule(activeTimeframe, definition.field);
                    return (
                      <TerminalChip
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
                          className="rounded-lg border border-border bg-surface-alt/70 p-3"
                        >
                          <div className="mb-2 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-text">{t(definition.labelKey)}</p>
                              <p className="text-[11px] text-text-muted">
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
                <div className="space-y-2 rounded-lg border border-border bg-surface-alt/70 p-3">
                  {currentDefinitions
                    .filter((definition) => definition.input === "select")
                    .map((definition) => {
                      const rule = getRule(activeTimeframe, definition.field);
                      return (
                        <div key={`${activeTimeframe}-${definition.field}`}>
                          <p className="mb-2 text-sm font-bold text-text">{t(definition.labelKey)}</p>
                          <div className="flex flex-wrap gap-2">
                            {definition.valueOptions?.map((option) => (
                              <TerminalChip
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
        </section>
      </div>

      <div className="border-t border-border bg-surface-alt/50 px-4 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
          {t("activeFiltersLabel")}
        </p>
        {activeRulePills.length === 0 &&
        !filters.listing_market &&
        filters.market_cap_gte === undefined &&
        filters.market_cap_lte === undefined ? (
          <p className="mt-2 text-sm text-text-muted">{t("activeFiltersEmpty")}</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
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
          </div>
        )}
      </div>
    </aside>
  );
}

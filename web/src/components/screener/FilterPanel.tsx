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

function ChipButton({
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
          "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition-colors",
          active
            ? "border-primary bg-primary text-white"
            : "border-border bg-surface text-text-secondary hover:border-primary/35 hover:text-text"
        )}
      >
        <span>{label}</span>
      </button>
      {tooltip ? (
        <span className={active ? "text-white" : ""}>
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
      className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10"
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
  const [activeTimeframe, setActiveTimeframe] = useState<ScreenerTimeframe>("1D");
  const [activeCategory, setActiveCategory] = useState<CategoryTab>("sequence");
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
    if (typeof rule.value === "number") suffix = ` ${t(`operators.${rule.operator}`)} ${rule.value}`;
    if (typeof rule.value === "string" && rule.field === "fib_zone") {
      suffix = ` ${t("operators.eq")} ${t(`fibZones.${rule.value}`)}`;
    }
    return {
      key: `${rule.timeframe}-${rule.field}`,
      label: `${t(`timeframes.${rule.timeframe}`)} · ${t(definition.labelKey)}${suffix}`,
      remove: () => removeRule(rule.timeframe, rule.field),
    };
  });

  return (
    <div className="rounded-2xl border border-border bg-surface-raised shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 bg-surface-alt border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-text">{t("filters")}</h2>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-white text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onSaveScan} loading={saveScanLoading} disabled={activeFilterCount === 0}>
            <span>{t("saveScan")}</span>
          </Button>
          <Button
            type="button"
            variant={favoriteAvailable ? "secondary" : "ghost"}
            size="sm"
            onClick={onSaveFavorite}
            loading={favoriteSaving}
            disabled={activeFilterCount === 0}
            className={clsx(
              "min-w-0",
              favoriteAvailable && "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300"
            )}
            aria-label={favoriteAvailable ? t("favorite.update") : t("favorite.save")}
            title={favoriteAvailable ? t("favorite.update") : t("favorite.save")}
          >
            <StarIcon filled={!!favoriteAvailable} />
            <span className="hidden sm:inline">
              {favoriteAvailable ? t("favorite.update") : t("favorite.save")}
            </span>
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onLoadFavorite} loading={favoriteLoading} disabled={!favoriteAvailable}>
            <span>{t("favorite.load")}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll} disabled={activeFilterCount === 0}>
            {t("clearFilters")}
          </Button>
          <Button size="sm" onClick={() => onApply()} loading={loading}>
            {t("applyFilters")}
          </Button>
        </div>
      </div>

      {favoriteStatus && (
        <div className="border-b border-border bg-surface px-5 py-2 text-xs font-medium text-text-secondary" aria-live="polite">
          {favoriteStatus}
        </div>
      )}

      <div className="grid gap-4 px-5 py-4 border-b border-border bg-surface-alt/50 md:grid-cols-3">
        <div>
          <label htmlFor="screener-listing-market" className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
            {t("listingMarket.label")}
          </label>
          <select
            id="screener-listing-market"
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
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

      <div className="px-5 pt-5 pb-3 border-b border-border bg-surface">
        <div role="tablist" className="flex flex-wrap gap-2">
          {TIMEFRAME_TABS.map((timeframe) => {
            const count = activeRuleCountForTimeframe(filters, timeframe);
            return (
              <button
                key={timeframe}
                type="button"
                role="tab"
                aria-selected={activeTimeframe === timeframe}
                onClick={() => setActiveTimeframe(timeframe)}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-colors",
                  activeTimeframe === timeframe
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-surface-alt text-text-secondary hover:text-text"
                )}
              >
                <span>{t(`timeframes.${timeframe}`)}</span>
                {count > 0 ? (
                  <span className={clsx(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                    activeTimeframe === timeframe
                      ? "bg-white/20 text-white"
                      : "bg-primary/10 text-primary"
                  )}>
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-text-muted">{t("layoutHint")}</p>
      </div>

      <div className="px-5 py-4 border-b border-border bg-surface">
        <div role="tablist" className="flex flex-wrap gap-2">
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
                role="tab"
                aria-selected={activeCategory === category}
                onClick={() => setActiveCategory(category)}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors",
                  activeCategory === category
                    ? "border-text bg-text text-white"
                    : "border-border bg-surface-alt text-text-muted hover:text-text"
                )}
              >
                <span>{t(`categories.${category}`)}</span>
                {count > 0 ? (
                  <span className={clsx(
                    "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px]",
                    activeCategory === category
                      ? "bg-white/20 text-white"
                      : "bg-primary/10 text-primary"
                  )}>
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5 space-y-5 bg-surface">
        <div>
          <h3 className="text-sm font-bold text-text">
            {t("blockTitle", {
              timeframe: t(`timeframes.${activeTimeframe}`),
              category: t(`categories.${activeCategory}`),
            })}
          </h3>
          <p className="mt-1 text-xs text-text-muted">{t("blockSubtitle")}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {currentDefinitions
            .filter((definition) => definition.input === "none")
            .map((definition) => {
              const active = !!getRule(activeTimeframe, definition.field);
              return (
                <ChipButton
                  key={`${activeTimeframe}-${definition.field}`}
                  active={active}
                  label={t(definition.labelKey)}
                  tooltip={
                    definition.descriptionKey ? t(definition.descriptionKey) : undefined
                  }
                  onClick={() =>
                    toggleBooleanRule(activeTimeframe, definition.field)
                  }
                />
              );
            })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {currentDefinitions
            .filter((definition) => definition.input === "number")
            .map((definition) => {
              const rule = getRule(activeTimeframe, definition.field);
              const operator = definition.operators[0] as ScreenerRule["operator"];
              return (
                <div key={`${activeTimeframe}-${definition.field}`} className="rounded-xl border border-border bg-surface-alt p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-text">{t(definition.labelKey)}</p>
                      <p className="mt-1 text-xs text-text-muted">
                        {t(`operators.${operator}`)}
                      </p>
                    </div>
                    {definition.descriptionKey ? (
                      <Tooltip content={t(definition.descriptionKey)} />
                    ) : null}
                  </div>
                  <div className="mt-3">
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
                </div>
              );
            })}

          {currentDefinitions
            .filter((definition) => definition.input === "select")
            .map((definition) => {
              const rule = getRule(activeTimeframe, definition.field);
              return (
                <div key={`${activeTimeframe}-${definition.field}`} className="rounded-xl border border-border bg-surface-alt p-4 md:col-span-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-text">{t(definition.labelKey)}</p>
                      <p className="mt-1 text-xs text-text-muted">{t("selectHint")}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {definition.valueOptions?.map((option) => (
                      <ChipButton
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
      </div>

      <div className="border-t border-border bg-surface-alt/40 px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
          {t("activeFiltersLabel")}
        </p>
        {activeRulePills.length === 0 && !filters.listing_market && filters.market_cap_gte === undefined && filters.market_cap_lte === undefined ? (
          <p className="mt-2 text-sm text-text-muted">{t("activeFiltersEmpty")}</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
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
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  RULE_DEFINITIONS,
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
  const activeFilterCount = countActiveFilters(filters);

  function updateRule(ruleId: string, patch: Partial<ScreenerRule>) {
    onChange({
      ...filters,
      rules: filters.rules.map((rule) => {
        if (rule.id !== ruleId) return rule;
        const next = { ...rule, ...patch };
        const definition = definitions[next.field];
        const nextOperator = definition.operators.includes(next.operator)
          ? next.operator
          : definition.operators[0];
        const nextValue =
          definition.input === "none"
            ? undefined
            : definition.input === "select"
              ? typeof next.value === "string"
                ? next.value
                : definition.valueOptions?.[0]?.value
              : typeof next.value === "number"
                ? next.value
                : Number(next.value ?? 0);
        return { ...next, operator: nextOperator as ScreenerRule["operator"], value: nextValue };
      }),
    });
  }

  function removeRule(ruleId: string) {
    onChange({
      ...filters,
      rules: filters.rules.filter((rule) => rule.id !== ruleId),
    });
  }

  function addRule() {
    onChange({
      ...filters,
      rules: [...filters.rules, createRule()],
    });
  }

  function clearAll() {
    onChange({ version: 1, rules: [] });
  }

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

      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-text">{t("ruleBuilder.title")}</h3>
            <p className="text-xs text-text-muted mt-1">{t("ruleBuilder.subtitle")}</p>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={addRule}>
            {t("ruleBuilder.addRule")}
          </Button>
        </div>

        {filters.rules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-sm text-text-muted">
            {t("ruleBuilder.empty")}
          </div>
        ) : (
          <div className="space-y-3">
            {filters.rules.map((rule) => {
              const definition = definitions[rule.field];
              return (
                <div key={rule.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="grid gap-3 lg:grid-cols-[120px_minmax(0,1fr)_140px_160px_auto]">
                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                        {t("ruleBuilder.timeframe")}
                      </label>
                      <select
                        className="w-full rounded-xl border border-border bg-surface-alt px-3 py-2 text-sm font-medium text-text"
                        value={rule.timeframe}
                        onChange={(e) =>
                          updateRule(rule.id, { timeframe: e.target.value as ScreenerTimeframe })
                        }
                      >
                        <option value="1D">{t("timeframes.1D")}</option>
                        <option value="1W">{t("timeframes.1W")}</option>
                        <option value="1M">{t("timeframes.1M")}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                        {t("ruleBuilder.condition")}
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          className="w-full rounded-xl border border-border bg-surface-alt px-3 py-2 text-sm font-medium text-text"
                          value={rule.field}
                          onChange={(e) =>
                            updateRule(rule.id, {
                              field: e.target.value as ScreenerRuleField,
                              operator: ruleDefinitionsByField()[e.target.value as ScreenerRuleField].operators[0] as ScreenerRule["operator"],
                              value:
                                ruleDefinitionsByField()[e.target.value as ScreenerRuleField].input === "select"
                                  ? ruleDefinitionsByField()[e.target.value as ScreenerRuleField].valueOptions?.[0]?.value
                                  : ruleDefinitionsByField()[e.target.value as ScreenerRuleField].input === "number"
                                    ? 0
                                    : undefined,
                            })
                          }
                        >
                          {RULE_DEFINITIONS.map((item) => (
                            <option key={item.field} value={item.field}>
                              {t(item.labelKey)}
                            </option>
                          ))}
                        </select>
                        {definition.descriptionKey && (
                          <Tooltip content={t(definition.descriptionKey)} />
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                        {t("ruleBuilder.operator")}
                      </label>
                      <select
                        className="w-full rounded-xl border border-border bg-surface-alt px-3 py-2 text-sm font-medium text-text"
                        value={rule.operator}
                        onChange={(e) => updateRule(rule.id, { operator: e.target.value as ScreenerRule["operator"] })}
                      >
                        {definition.operators.map((operator) => (
                          <option key={operator} value={operator}>
                            {t(`operators.${operator}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      {definition.input === "number" && (
                        <Input
                          label={t("ruleBuilder.value")}
                          type="number"
                          step="0.1"
                          value={typeof rule.value === "number" ? rule.value : ""}
                          onChange={(e) =>
                            updateRule(rule.id, {
                              value: e.target.value === "" ? undefined : Number(e.target.value),
                            })
                          }
                        />
                      )}
                      {definition.input === "select" && (
                        <div>
                          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                            {t("ruleBuilder.value")}
                          </label>
                          <select
                            className="w-full rounded-xl border border-border bg-surface-alt px-3 py-2 text-sm font-medium text-text"
                            value={typeof rule.value === "string" ? rule.value : definition.valueOptions?.[0]?.value}
                            onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                          >
                            {definition.valueOptions?.map((option) => (
                              <option key={option.value} value={option.value}>
                                {t(option.labelKey)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="flex items-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeRule(rule.id)}>
                        {t("ruleBuilder.remove")}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

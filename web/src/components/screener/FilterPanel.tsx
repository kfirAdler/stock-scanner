"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { RULE_DEFINITIONS, activeRuleCountForTimeframe, countActiveFilters, createRule, ruleDefinitionsByField } from "@/lib/screener-query";
import type { ScreenerPayload, ScreenerRule, ScreenerRuleField, ScreenerTimeframe } from "@/lib/screener-types";
import { ActiveFilterPill } from "./ActiveFilterPill";
import { AdvancedFiltersPanel } from "./AdvancedFiltersPanel";
import { DensityToggle, type DensityMode } from "./DensityToggle";
import { FilterCategoryTabs } from "./FilterCategoryTabs";
import { FilterChip } from "./FilterChip";
import { ScannerSidebar } from "./ScannerSidebar";
import { ScannerStatusBar } from "./ScannerStatusBar";
import { TimeframeSegmentedControl } from "./TimeframeSegmentedControl";

type CategoryTab = "sequence" | "signals" | "trend" | "location" | "volatility";

const TIMEFRAME_TABS: ScreenerTimeframe[] = ["1D", "1W", "1M"];
const CATEGORY_TABS: CategoryTab[] = ["sequence", "trend", "signals", "location", "volatility"];

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
  resultCount?: number;
  lastUpdatedLabel?: string | null;
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
  resultCount = 0,
  lastUpdatedLabel,
}: FilterPanelProps) {
  const t = useTranslations("screener");
  const definitions = useMemo(() => ruleDefinitionsByField(), []);
  const [activeTimeframe, setActiveTimeframe] = useState<ScreenerTimeframe>(
    () => firstActiveTabState(filters, definitions)?.timeframe ?? "1D"
  );
  const [activeCategory, setActiveCategory] = useState<CategoryTab>(
    () => firstActiveTabState(filters, definitions)?.category ?? "sequence"
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [density, setDensity] = useState<DensityMode>(() => {
    if (typeof window === "undefined") return "compact";
    const stored = window.localStorage.getItem("scanner.sidebar.density");
    return stored === "comfortable" ? "comfortable" : "compact";
  });
  const activeFilterCount = countActiveFilters(filters);

  useEffect(() => {
    window.localStorage.setItem("scanner.sidebar.density", density);
  }, [density]);

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
  const booleanDefinitions = currentDefinitions.filter((definition) => definition.input === "none");
  const numericDefinitions = currentDefinitions.filter((definition) => definition.input === "number");
  const selectDefinitions = currentDefinitions.filter((definition) => definition.input === "select");

  const timeframeSummary = TIMEFRAME_TABS.map((timeframe) => ({
    id: timeframe,
    label: t(`timeframes.${timeframe}`),
    count: activeRuleCountForTimeframe(filters, timeframe),
  }));

  const categorySummary = CATEGORY_TABS.map((category) => ({
    id: category,
    label: t(`categories.${category}`),
    count: filters.rules.filter(
      (rule) =>
        rule.timeframe === activeTimeframe &&
        definitions[rule.field].category === category
    ).length,
  }));

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

  return (
    <ScannerSidebar
      title={t("workspace.compactTitle")}
      subtitle={t("workspace.compactHint")}
      filterCount={activeFilterCount}
      onClose={onClose}
      statusBar={
        <ScannerStatusBar
          syncLabel={hasPendingChanges ? t("workspace.draftPending") : t("workspace.draftSynced")}
          pending={!!hasPendingChanges}
          activeFilters={activeFilterCount}
          appliedFiltersLabel={t("workspace.statusFilters")}
          resultCount={resultCount}
          resultLabel={t("workspace.statusMatches")}
          updatedLabel={lastUpdatedLabel ? t("updatedAt", { date: lastUpdatedLabel }) : null}
          statusMessage={favoriteStatus}
        />
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">
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
              onClick={() => onChange(filters)}
              disabled
              className="hidden"
            >
              noop
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearAll} disabled={activeFilterCount === 0}>
              {t("clearFilters")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(filters)}
              disabled={!hasPendingChanges}
              className="hidden"
            >
              noop
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onLoadFavorite}
              loading={favoriteLoading}
              disabled={!favoriteAvailable}
            >
              {t("favorite.load")}
            </Button>
            <Button size="sm" onClick={onApply} loading={loading}>
              {t("workspace.quickApply")}
            </Button>
          </div>
        </div>
      }
    >
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">
              {t("workspace.sections.timeframes")}
            </p>
            <p className="mt-1 text-xs text-text-secondary">{t("workspace.timeframeHint")}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">
              {t("workspace.density")}
            </p>
            <div className="mt-1">
              <DensityToggle
                value={density}
                onChange={setDensity}
                compactLabel={t("workspace.densityCompact")}
                comfortableLabel={t("workspace.densityComfortable")}
              />
            </div>
          </div>
        </div>
        <TimeframeSegmentedControl
          value={activeTimeframe}
          onChange={setActiveTimeframe}
          items={timeframeSummary}
          density={density}
        />
      </section>

      <section className="space-y-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">
            {t("workspace.sections.builder")}
          </p>
          <p className="mt-1 text-xs text-text-secondary">{t("workspace.sections.builderHint")}</p>
        </div>

        <FilterCategoryTabs
          tabs={categorySummary}
          activeTab={activeCategory}
          onChange={(value) => setActiveCategory(value as CategoryTab)}
          density={density}
        />

        <div className={clsx("flex flex-wrap", density === "compact" ? "gap-2" : "gap-2.5")}>
          {booleanDefinitions.map((definition) => {
            const active = !!getRule(activeTimeframe, definition.field);
            return (
              <FilterChip
                key={`${activeTimeframe}-${definition.field}`}
                active={active}
                density={density}
                label={t(definition.labelKey)}
                tooltip={definition.descriptionKey ? t(definition.descriptionKey) : undefined}
                onClick={() => toggleBooleanRule(activeTimeframe, definition.field)}
              />
            );
          })}
          {[...numericDefinitions, ...selectDefinitions].map((definition) => {
            const active = !!getRule(activeTimeframe, definition.field);
            return (
              <FilterChip
                key={`${activeTimeframe}-${definition.field}-advanced`}
                active={active}
                density={density}
                label={t(definition.labelKey)}
                tooltip={definition.descriptionKey ? t(definition.descriptionKey) : undefined}
                onClick={() => setAdvancedOpen(true)}
              />
            );
          })}
        </div>
      </section>

      <AdvancedFiltersPanel
        open={advancedOpen}
        onToggle={() => setAdvancedOpen((current) => !current)}
        title={t("workspace.advanced")}
        hint={t("workspace.advancedHint")}
      >
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">
              {t("workspace.sections.universe")}
            </p>
            <div className="grid gap-3">
              <div className="inline-flex rounded-2xl bg-surface-raised p-1 ring-1 ring-border">
                {[
                  { value: "", label: t("listingMarket.all") },
                  { value: "US", label: t("listingMarket.us") },
                  { value: "TA", label: t("listingMarket.ta") },
                ].map((option) => (
                  <button
                    key={option.value || "all"}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...filters,
                        listing_market:
                          option.value === "" ? undefined : (option.value as "US" | "TA"),
                      })
                    }
                    className={clsx(
                      "rounded-[14px] px-3 py-2 text-[12px] font-semibold transition-colors",
                      (filters.listing_market ?? "") === option.value
                        ? "bg-primary-soft text-primary"
                        : "text-text-secondary hover:text-text"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-text-secondary">
                    {t("marketCap.gte")}
                  </span>
                  <input
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
                    className="w-full rounded-xl bg-surface-raised px-3 py-2 text-sm text-text ring-1 ring-border transition focus:outline-none focus:ring-2 focus:ring-primary/25"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-text-secondary">
                    {t("marketCap.lte")}
                  </span>
                  <input
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
                    className="w-full rounded-xl bg-surface-raised px-3 py-2 text-sm text-text ring-1 ring-border transition focus:outline-none focus:ring-2 focus:ring-primary/25"
                  />
                </label>
              </div>
            </div>
          </div>

          {numericDefinitions.length > 0 ? (
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">
                {t("workspace.thresholds")}
              </p>
              <div className="grid gap-3">
                {numericDefinitions.map((definition) => {
                  const rule = getRule(activeTimeframe, definition.field);
                  const operator = definition.operators[0] as ScreenerRule["operator"];
                  return (
                    <label
                      key={`${activeTimeframe}-${definition.field}`}
                      className="grid gap-2 rounded-2xl bg-surface-raised p-3 ring-1 ring-border"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-text">{t(definition.labelKey)}</p>
                          <p className="text-[11px] text-text-muted">{t(`operators.${operator}`)}</p>
                        </div>
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        value={typeof rule?.value === "number" ? rule.value : ""}
                        onChange={(e) =>
                          setNumericRule(activeTimeframe, definition.field, operator, e.target.value)
                        }
                        placeholder={t("valuePlaceholder")}
                        className="w-full rounded-xl bg-surface px-3 py-2 text-sm text-text ring-1 ring-border transition focus:outline-none focus:ring-2 focus:ring-primary/25"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          {selectDefinitions.length > 0 ? (
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">
                {t("workspace.selectors")}
              </p>
              {selectDefinitions.map((definition) => {
                const rule = getRule(activeTimeframe, definition.field);
                return (
                  <div
                    key={`${activeTimeframe}-${definition.field}`}
                    className="space-y-2 rounded-2xl bg-surface-raised p-3 ring-1 ring-border"
                  >
                    <p className="text-sm font-semibold text-text">{t(definition.labelKey)}</p>
                    <div className="flex flex-wrap gap-2">
                      {definition.valueOptions?.map((option) => (
                        <FilterChip
                          key={`${activeTimeframe}-${definition.field}-${option.value}`}
                          active={rule?.value === option.value}
                          density={density}
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

          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">
              {t("workspace.quickActions")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onSaveScan}
                loading={saveScanLoading}
                disabled={activeFilterCount === 0}
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
                  favoriteAvailable &&
                    "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300"
                )}
              >
                {favoriteAvailable ? t("favorite.update") : t("favorite.save")}
              </Button>
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
            </div>
          </div>
        </div>
      </AdvancedFiltersPanel>

      <section className="space-y-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">
            {t("workspace.sections.active")}
          </p>
          <p className="mt-1 text-xs text-text-secondary">{t("workspace.sections.activeHint")}</p>
        </div>
        <div className={clsx("flex flex-wrap", density === "compact" ? "gap-2" : "gap-2.5")}>
          {activeRulePills.length === 0 &&
          !filters.listing_market &&
          filters.market_cap_gte === undefined &&
          filters.market_cap_lte === undefined ? (
            <p className="text-sm text-text-muted">{t("activeFiltersEmpty")}</p>
          ) : (
            <>
              {filters.listing_market ? (
                <ActiveFilterPill
                  density={density}
                  label={`${t("listingMarket.label")} · ${t(`listingMarket.${filters.listing_market.toLowerCase()}`)}`}
                  onRemove={() => onChange({ ...filters, listing_market: undefined })}
                />
              ) : null}
              {filters.market_cap_gte !== undefined ? (
                <ActiveFilterPill
                  density={density}
                  label={`${t("marketCap.gte")} ${filters.market_cap_gte}`}
                  onRemove={() => onChange({ ...filters, market_cap_gte: undefined })}
                />
              ) : null}
              {filters.market_cap_lte !== undefined ? (
                <ActiveFilterPill
                  density={density}
                  label={`${t("marketCap.lte")} ${filters.market_cap_lte}`}
                  onRemove={() => onChange({ ...filters, market_cap_lte: undefined })}
                />
              ) : null}
              {activeRulePills.map((pill) => (
                <ActiveFilterPill
                  key={pill.key}
                  density={density}
                  label={pill.label}
                  onRemove={pill.remove}
                />
              ))}
            </>
          )}
        </div>
      </section>
    </ScannerSidebar>
  );
}

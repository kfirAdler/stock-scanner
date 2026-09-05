"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { RULE_DEFINITIONS, activeRuleCountForTimeframe, countActiveFilters, createRule, ruleDefinitionsByField } from "@/lib/screener-query";
import type {
  ScreenerFilterAvailability,
  ScreenerPayload,
  ScreenerRule,
  ScreenerRuleField,
  ScreenerTimeframe,
} from "@/lib/screener-types";
import { ActiveFilterPill } from "./ActiveFilterPill";
import { AdvancedFiltersPanel } from "./AdvancedFiltersPanel";
import { DensityToggle, type DensityMode } from "./DensityToggle";
import { FilterCategoryTabs } from "./FilterCategoryTabs";
import { FilterChip } from "./FilterChip";
import { ScannerSidebar } from "./ScannerSidebar";
import { ScannerStatusBar } from "./ScannerStatusBar";
import { TimeframeSegmentedControl } from "./TimeframeSegmentedControl";

type CategoryTab = "sequence" | "signals" | "trend" | "location" | "volatility" | "quality";

const TIMEFRAME_TABS: ScreenerTimeframe[] = ["1D", "1W", "1M"];
const CATEGORY_TABS: CategoryTab[] = ["sequence", "trend", "signals", "location", "volatility", "quality"];

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
  onApplyTurningPointPreset: () => void;
  onApplyBreakoutPreset: () => void;
  onApplyGettingUpPreset: () => void;
  canApplyTurningPointPreset?: boolean;
  canApplyBreakoutPreset?: boolean;
  canApplyGettingUpPreset?: boolean;
  presetDisabledReason?: string | null;
  filterAvailability?: ScreenerFilterAvailability;
  onResetDraft?: () => void;
  loading?: boolean;
  onClose?: () => void;
  hasPendingChanges?: boolean;
  resultCount?: number;
  lastUpdatedLabel?: string | null;
}

export function FilterPanel({
  filters,
  onChange,
  onApply,
  onApplyTurningPointPreset,
  onApplyBreakoutPreset,
  onApplyGettingUpPreset,
  canApplyTurningPointPreset = true,
  canApplyBreakoutPreset = true,
  canApplyGettingUpPreset = true,
  presetDisabledReason,
  filterAvailability,
  onResetDraft,
  loading,
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
  const [filterSearch, setFilterSearch] = useState("");
  const [activeSummaryOpen, setActiveSummaryOpen] = useState(
    () => countActiveFilters(filters) <= 4
  );
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

  function isFilterAvailable(timeframe: ScreenerTimeframe, field: ScreenerRuleField) {
    return filterAvailability?.[timeframe]?.[field] ?? true;
  }

  const normalizedFilterSearch = filterSearch.trim().toLocaleLowerCase();
  const currentDefinitions = RULE_DEFINITIONS.filter((definition) =>
    normalizedFilterSearch
      ? t(definition.labelKey).toLocaleLowerCase().includes(normalizedFilterSearch)
      : definition.category === activeCategory
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

  const activeRuleGroups = TIMEFRAME_TABS.map((timeframe) => ({
    timeframe,
    pills: filters.rules
      .filter((rule) => rule.timeframe === timeframe)
      .map((rule) => {
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
          label: `${t(definition.labelKey)}${suffix}`,
          remove: () => removeRule(rule.timeframe, rule.field),
        };
      }),
  })).filter((group) => group.pills.length > 0);

  return (
    <ScannerSidebar
      eyebrow={t("workspace.builderEyebrow")}
      title={t("workspace.compactTitle")}
      filterCount={activeFilterCount}
      closeLabel={t("workspace.closeFilters")}
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
        />
      }
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <Button type="button" variant="ghost" size="sm" onClick={clearAll} disabled={activeFilterCount === 0}>
              {t("clearFilters")}
            </Button>
            {onResetDraft ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onResetDraft}
                disabled={!hasPendingChanges}
              >
                {t("workspace.resetDraft")}
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onApply} loading={loading} className="w-full sm:w-auto">
              {t("workspace.quickApply")}
            </Button>
          </div>
        </div>
      }
    >
      <details className="ui-panel-subtle group rounded-2xl p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
              {t("workspace.presetsTitle")}
            </span>
            <span className="mt-0.5 block text-[11px] text-text-secondary">{t("workspace.presetsHint")}</span>
          </span>
          <span className="text-text-muted transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
        </summary>
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <Button type="button" size="sm" variant="secondary" onClick={onApplyTurningPointPreset} className="w-full justify-start" disabled={!canApplyTurningPointPreset} title={!canApplyTurningPointPreset ? presetDisabledReason ?? undefined : undefined}>
            {t("workspace.presets.turningPoint")}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onApplyBreakoutPreset} className="w-full justify-start" disabled={!canApplyBreakoutPreset} title={!canApplyBreakoutPreset ? presetDisabledReason ?? undefined : undefined}>
            {t("workspace.presets.breakoutLeader")}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onApplyGettingUpPreset} className="w-full justify-start" disabled={!canApplyGettingUpPreset} title={!canApplyGettingUpPreset ? presetDisabledReason ?? undefined : undefined}>
            {t("workspace.presets.gettingUp")}
          </Button>
        </div>
      </details>

      <section className="space-y-2.5 rounded-2xl">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">
              {t("workspace.sections.timeframes")}
            </p>
            <p className="mt-0.5 text-[11px] text-text-muted">{t("workspace.sections.timeframesHint")}</p>
          </div>
          <div>
            <DensityToggle
              value={density}
              onChange={setDensity}
              compactLabel={t("workspace.densityCompact")}
              comfortableLabel={t("workspace.densityComfortable")}
            />
          </div>
        </div>
        <TimeframeSegmentedControl
          value={activeTimeframe}
          onChange={setActiveTimeframe}
          items={timeframeSummary}
          density={density}
        />
      </section>

      <section className="space-y-2.5 rounded-2xl">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">
            {t("workspace.sections.builder")}
          </p>
          <p className="mt-0.5 text-[11px] text-text-muted">{t("workspace.sections.builderHint")}</p>
        </div>
        <label className="relative block">
          <span className="sr-only">{t("workspace.filterSearchLabel")}</span>
          <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-text-muted" aria-hidden="true">⌕</span>
          <input
            type="search"
            value={filterSearch}
            onChange={(event) => setFilterSearch(event.target.value)}
            placeholder={t("workspace.filterSearchPlaceholder")}
            className="ui-control min-h-10 w-full rounded-xl ps-9 pe-9 text-sm outline-none transition focus:ring-2 focus:ring-primary/25"
          />
          {filterSearch ? (
            <button
              type="button"
              onClick={() => setFilterSearch("")}
              className="absolute end-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover hover:text-text"
              aria-label={t("workspace.clearFilterSearch")}
            >
              ×
            </button>
          ) : null}
        </label>
        {normalizedFilterSearch ? (
          <p className="text-[11px] text-text-muted">{t("workspace.filterSearchHint", { timeframe: t(`timeframes.${activeTimeframe}`) })}</p>
        ) : (
          <FilterCategoryTabs
            tabs={categorySummary}
            activeTab={activeCategory}
            onChange={(value) => setActiveCategory(value as CategoryTab)}
            density={density}
          />
        )}

        <div className={clsx("flex flex-wrap", density === "compact" ? "gap-2" : "gap-2.5")}>
          {booleanDefinitions.map((definition) => {
            const active = !!getRule(activeTimeframe, definition.field);
            const disabled = !active && !isFilterAvailable(activeTimeframe, definition.field);
            return (
              <FilterChip
                key={`${activeTimeframe}-${definition.field}`}
                active={active}
                density={density}
                label={t(definition.labelKey)}
                tooltip={
                  disabled
                    ? t("workspace.filterUnavailable", {
                        timeframe: t(`timeframes.${activeTimeframe}`),
                      })
                    : definition.descriptionKey
                      ? t(definition.descriptionKey)
                      : undefined
                }
                disabled={disabled}
                onClick={() => toggleBooleanRule(activeTimeframe, definition.field)}
              />
            );
          })}
          {[...numericDefinitions, ...selectDefinitions].map((definition) => {
            const active = !!getRule(activeTimeframe, definition.field);
            const disabled = !active && !isFilterAvailable(activeTimeframe, definition.field);
            return (
              <FilterChip
                key={`${activeTimeframe}-${definition.field}-advanced`}
                active={active}
                density={density}
                label={t(definition.labelKey)}
                tooltip={
                  disabled
                    ? t("workspace.filterUnavailable", {
                        timeframe: t(`timeframes.${activeTimeframe}`),
                      })
                    : definition.descriptionKey
                      ? t(definition.descriptionKey)
                      : undefined
                }
                disabled={disabled}
                onClick={() => {
                  setActiveCategory(definition.category as CategoryTab);
                  setFilterSearch("");
                  setAdvancedOpen(true);
                }}
              />
            );
          })}
          {currentDefinitions.length === 0 ? (
            <p className="py-3 text-sm text-text-muted">{t("workspace.noFilterSearchResults")}</p>
          ) : null}
        </div>
      </section>

      <AdvancedFiltersPanel
        open={advancedOpen}
        onToggle={() => setAdvancedOpen((current) => !current)}
        title={t("workspace.advanced")}
      >
        <div className="space-y-4">
          <div className="space-y-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">
              {t("workspace.sections.universe")}
            </p>
            <div className="grid gap-3">
              <div className="ui-segment inline-flex rounded-2xl p-1">
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
                        : "ui-segment-item text-text-secondary hover:text-text"
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
                    className="ui-control w-full rounded-xl px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-primary/25"
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
                    className="ui-control w-full rounded-xl px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-primary/25"
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
                      className="ui-panel-subtle grid gap-2 rounded-2xl p-3"
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
                        className="ui-control w-full rounded-xl bg-surface px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-primary/25"
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
                    className="ui-panel-subtle space-y-2 rounded-2xl p-3"
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

        </div>
      </AdvancedFiltersPanel>

      <section className="overflow-hidden rounded-2xl border border-border/80 bg-surface-alt/45">
        <button
          type="button"
          onClick={() => setActiveSummaryOpen((current) => !current)}
          className="flex min-h-12 w-full items-center justify-between gap-3 px-3.5 py-2.5 text-start"
          aria-expanded={activeSummaryOpen}
          aria-controls="active-scanner-filters"
        >
          <span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">
              {t("workspace.sections.active")}
            </span>
            <span className="mt-0.5 block text-[11px] text-text-secondary">
              {t("workspace.activeSummary", { count: activeFilterCount })}
            </span>
          </span>
          <span className="inline-flex items-center gap-2 text-[11px] font-bold text-primary">
            {activeSummaryOpen ? t("workspace.hideActive") : t("workspace.viewActive")}
            <span aria-hidden="true">{activeSummaryOpen ? "⌃" : "⌄"}</span>
          </span>
        </button>
        {activeSummaryOpen ? (
          <div
            id="active-scanner-filters"
            className="space-y-3 border-t border-border/80 px-3.5 py-3"
          >
          {activeRuleGroups.length === 0 &&
          !filters.listing_market &&
          filters.market_cap_gte === undefined &&
          filters.market_cap_lte === undefined ? (
            <p className="text-sm text-text-muted">{t("activeFiltersEmpty")}</p>
          ) : (
            <>
              {(filters.listing_market || filters.market_cap_gte !== undefined || filters.market_cap_lte !== undefined) ? (
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{t("workspace.sections.universe")}</p>
                  <div className={clsx("flex flex-wrap", density === "compact" ? "gap-2" : "gap-2.5")}>
                    {filters.listing_market ? (
                      <ActiveFilterPill density={density} label={`${t("listingMarket.label")} · ${t(`listingMarket.${filters.listing_market.toLowerCase()}`)}`} onRemove={() => onChange({ ...filters, listing_market: undefined })} removeLabel={t("workspace.removeFilter")} />
                    ) : null}
                    {filters.market_cap_gte !== undefined ? (
                      <ActiveFilterPill density={density} label={`${t("marketCap.gte")} ${filters.market_cap_gte}`} onRemove={() => onChange({ ...filters, market_cap_gte: undefined })} removeLabel={t("workspace.removeFilter")} />
                    ) : null}
                    {filters.market_cap_lte !== undefined ? (
                      <ActiveFilterPill density={density} label={`${t("marketCap.lte")} ${filters.market_cap_lte}`} onRemove={() => onChange({ ...filters, market_cap_lte: undefined })} removeLabel={t("workspace.removeFilter")} />
                    ) : null}
                  </div>
                </div>
              ) : null}
              {activeRuleGroups.map((group) => (
                <div key={group.timeframe}>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{t(`timeframes.${group.timeframe}`)}</p>
                  <div className={clsx("flex flex-wrap", density === "compact" ? "gap-2" : "gap-2.5")}>
                    {group.pills.map((pill) => (
                      <ActiveFilterPill key={pill.key} density={density} label={pill.label} onRemove={pill.remove} removeLabel={t("workspace.removeFilter")} />
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
          </div>
        ) : null}
      </section>
    </ScannerSidebar>
  );
}

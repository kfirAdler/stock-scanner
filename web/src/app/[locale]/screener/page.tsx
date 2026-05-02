"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FilterPanel } from "@/components/screener/FilterPanel";
import { ResultsTable } from "@/components/screener/ResultsTable";
import { PremiumGate } from "@/components/billing/PremiumGate";
import { Button } from "@/components/ui/Button";
import type { ScreenerPayload, ScreenerResultRow } from "@/lib/screener-types";
import {
  DEFAULT_SCREENER_PAYLOAD,
  coerceStoredScreen,
  countActiveFilters,
  parseScreenFromSearchParams,
  screenToQueryString,
} from "@/lib/screener-query";

type Gate = null | "login" | "subscribe";

function readInitialFilters(): ScreenerPayload {
  if (typeof window === "undefined") return DEFAULT_SCREENER_PAYLOAD;
  return parseScreenFromSearchParams(new URLSearchParams(window.location.search));
}

export default function ScreenerPage() {
  const t = useTranslations("screener");
  const locale = useLocale();
  const [filters, setFilters] = useState<ScreenerPayload>(() => readInitialFilters());
  const filtersRef = useRef<ScreenerPayload>(readInitialFilters());
  const [appliedFilters, setAppliedFilters] = useState<ScreenerPayload>(() => readInitialFilters());
  const [favoriteFilters, setFavoriteFilters] = useState<ScreenerPayload | null>(null);
  const [favoriteLoading, setFavoriteLoading] = useState(true);
  const [favoriteSaving, setFavoriteSaving] = useState(false);
  const [favoriteStatus, setFavoriteStatus] = useState<string | null>(null);
  const [saveScanLoading, setSaveScanLoading] = useState(false);
  const [filterPanelResetKey, setFilterPanelResetKey] = useState(0);
  const [results, setResults] = useState<ScreenerResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [gate, setGate] = useState<Gate>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [multiFilterGateOpen, setMultiFilterGateOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchResults = useCallback(async (nextFilters: ScreenerPayload = filtersRef.current) => {
    const normalizedFilters = coerceStoredScreen(nextFilters) ?? DEFAULT_SCREENER_PAYLOAD;
    setLoading(true);
    setHasSearched(true);
    setGate(null);
    setAppliedFilters(normalizedFilters);
    if (typeof window !== "undefined") {
      const query = screenToQueryString(normalizedFilters);
      const pathname = window.location.pathname;
      window.history.replaceState({}, "", query ? `${pathname}${query}` : pathname);
    }
    try {
      const res = await fetch("/api/screener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizedFilters),
      });
      if (res.status === 401) {
        setGate("login");
        setResults([]);
        return;
      }
      if (res.status === 403) {
        setGate("subscribe");
        setResults([]);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setResults(data.rows ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFavorite() {
      try {
        const res = await fetch("/api/preferences", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) {
            setFavoriteFilters(null);
          }
          return;
        }
        const data = await res.json();
        const favorite = data?.preferences?.favorite_screener_filter;
        if (!cancelled) {
          setFavoriteFilters(coerceStoredScreen(favorite));
        }
      } catch {
        if (!cancelled) {
          setFavoriteFilters(null);
        }
      } finally {
        if (!cancelled) {
          setFavoriteLoading(false);
        }
      }
    }

    void loadFavorite();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMarketMeta() {
      try {
        const res = await fetch("/api/market-meta");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setLastUpdated(data.lastUpdated ?? null);
        }
      } catch {
        if (!cancelled) {
          setLastUpdated(null);
        }
      }
    }

    void loadMarketMeta();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (countActiveFilters(filtersRef.current) > 0) {
      void fetchResults(filtersRef.current);
    }
  }, [fetchResults]);

  useEffect(() => {
    let cancelled = false;

    async function loadUserState() {
      try {
        const res = await fetch("/api/me/entitlement");
        const data = await res.json();
        if (!cancelled && data && typeof data.loggedIn === "boolean") {
          setLoggedIn(data.loggedIn);
        }
      } catch {
        if (!cancelled) {
          setLoggedIn(false);
        }
      }
    }

    void loadUserState();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);
  const hasFavorite = !!favoriteFilters && countActiveFilters(favoriteFilters) > 0;
  const resultSummary = useMemo(() => {
    const strongSignals = results.filter(
      (row) => row.strong_buy_signal || row.strong_sell_signal
    ).length;
    const higherTimeframeRules = filters.rules.filter(
      (rule) => rule.timeframe === "1W" || rule.timeframe === "1M"
    ).length;
    return {
      rows: results.length,
      rules: activeFilterCount,
      strongSignals,
      higherTimeframeRules,
    };
  }, [activeFilterCount, filters.rules, results]);
  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdated) return null;
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(lastUpdated));
    } catch {
      return null;
    }
  }, [lastUpdated, locale]);

  function handleFiltersChange(nextFilters: ScreenerPayload) {
    filtersRef.current = nextFilters;
    setFilters(nextFilters);
  }

  async function handleSaveFavorite() {
    if (activeFilterCount === 0) {
      setFavoriteStatus(t("favorite.emptySave"));
      return;
    }

    setFavoriteSaving(true);
    setFavoriteStatus(null);
    try {
      const normalized = coerceStoredScreen(filters) ?? DEFAULT_SCREENER_PAYLOAD;
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite_screener_filter: normalized }),
      });

      if (res.status === 401) {
        setFavoriteStatus(t("favorite.signInRequired"));
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to save favorite");
      }

      setFavoriteFilters(normalized);
      setFavoriteStatus(t("favorite.saved"));
    } catch {
      setFavoriteStatus(t("favorite.saveFailed"));
    } finally {
      setFavoriteSaving(false);
    }
  }

  async function handleSaveScan() {
    if (activeFilterCount === 0) {
      setFavoriteStatus(t("saveScanEmpty"));
      return;
    }

    const name = window.prompt(t("saveScanPrompt"), t("saveScanDefaultName"));
    if (!name || name.trim() === "") {
      return;
    }

    setSaveScanLoading(true);
    setFavoriteStatus(null);
    try {
      const normalized = coerceStoredScreen(filters) ?? DEFAULT_SCREENER_PAYLOAD;
      const res = await fetch("/api/saved-screens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), filter_json: normalized }),
      });

      if (res.status === 401) {
        setFavoriteStatus(t("saveScanSignInRequired"));
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to save scan");
      }

      setFavoriteStatus(t("saveScanSaved"));
    } catch {
      setFavoriteStatus(t("saveScanFailed"));
    } finally {
      setSaveScanLoading(false);
    }
  }

  async function handleLoadFavorite() {
    if (!favoriteFilters) {
      setFavoriteStatus(t("favorite.empty"));
      return;
    }

    setFilterPanelResetKey((current) => current + 1);
    setFilters(favoriteFilters);
    filtersRef.current = favoriteFilters;
    setFavoriteStatus(t("favorite.loaded"));
    setMobileFiltersOpen(false);
    await fetchResults(favoriteFilters);
  }

  async function handleApply() {
    if (!loggedIn && activeFilterCount > 1) {
      setMultiFilterGateOpen(true);
      return;
    }

    setMobileFiltersOpen(false);
    await fetchResults();
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6">
      <div className="space-y-6">
        <section className="rounded-[28px] border border-border-strong/70 bg-surface-raised shadow-[0_24px_70px_rgba(15,23,42,0.08)] dark:shadow-[0_28px_80px_rgba(2,6,23,0.55)]">
          <div className="grid gap-6 px-5 py-5 xl:grid-cols-[minmax(0,1fr)_420px] xl:px-6">
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                {t("terminalHeader.eyebrow")}
              </p>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
                  {t("title")}
                </h1>
                <p className="max-w-3xl text-sm leading-relaxed text-text-secondary">
                  {t("premiumSubtitle")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-text-muted">
                {formattedLastUpdated ? (
                  <span className="rounded-full border border-border bg-surface px-3 py-1.5">
                    {t("updatedAt", { date: formattedLastUpdated })}
                  </span>
                ) : null}
                <span className="rounded-full border border-border bg-surface px-3 py-1.5">
                  {t("terminalHeader.universeCount", { count: resultSummary.rows })}
                </span>
                <span className="rounded-full border border-border bg-surface px-3 py-1.5">
                  {t("terminalHeader.ruleCount", { count: resultSummary.rules })}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                  {t("terminalHeader.cards.rows")}
                </p>
                <p className="mt-2 text-2xl font-bold text-text">{resultSummary.rows}</p>
              </div>
              <div className="rounded-2xl border border-border bg-surface px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                  {t("terminalHeader.cards.rules")}
                </p>
                <p className="mt-2 text-2xl font-bold text-primary">{resultSummary.rules}</p>
              </div>
              <div className="rounded-2xl border border-border bg-surface px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                  {t("terminalHeader.cards.strong")}
                </p>
                <p className="mt-2 text-2xl font-bold text-success">{resultSummary.strongSignals}</p>
              </div>
              <div className="rounded-2xl border border-border bg-surface px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                  {t("terminalHeader.cards.multi")}
                </p>
                <p className="mt-2 text-2xl font-bold text-text">{resultSummary.higherTimeframeRules}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="rounded-2xl border border-warning/30 bg-warning-soft/40 px-5 py-4 text-sm text-text-secondary">
        <p className="font-bold text-text">{t("legalNotice.title")}</p>
        <p className="mt-1 leading-relaxed">
          {t("legalNotice.body")}{" "}
          <Link href="/terms" className="font-bold text-primary hover:underline">
            {t("legalNotice.link")}
          </Link>
        </p>
        </div>

        {gate && <PremiumGate kind={gate === "login" ? "login" : "subscribe"} />}

        {!gate && (
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[390px_minmax(0,1fr)]">
            <div className="hidden xl:sticky xl:top-20 xl:block xl:self-start">
              <FilterPanel
                key={filterPanelResetKey}
                filters={filters}
                onChange={handleFiltersChange}
                onApply={handleApply}
                loading={loading}
                onSaveScan={handleSaveScan}
                saveScanLoading={saveScanLoading}
                onSaveFavorite={handleSaveFavorite}
                onLoadFavorite={handleLoadFavorite}
                favoriteSaving={favoriteSaving}
                favoriteLoading={favoriteLoading}
                favoriteAvailable={hasFavorite}
                favoriteStatus={favoriteStatus}
              />
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-surface-alt/60 px-4 py-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
                      {t("results")}
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {t("terminalHeader.resultHint")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wide">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setMobileFiltersOpen(true)}
                      className="justify-center xl:hidden"
                    >
                      {t("mobile.openFilters", { count: activeFilterCount })}
                    </Button>
                    <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-text-secondary">
                      {t("terminalHeader.appliedRules", { count: appliedFilters.rules.length })}
                    </span>
                    <span className="rounded-full border border-primary/25 bg-primary-soft/70 px-3 py-1.5 text-primary">
                      {t("terminalHeader.multiBlocks", { count: resultSummary.higherTimeframeRules })}
                    </span>
                  </div>
                </div>
              </div>

              {hasSearched ? (
                <ResultsTable
                  rows={results}
                  loading={loading}
                  screenerFilters={appliedFilters}
                />
              ) : (
                <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-dashed border-border-strong bg-surface-raised px-6 text-center">
                  <div className="max-w-lg space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
                      {t("results")}
                    </p>
                    <h2 className="text-2xl font-bold text-text">{t("terminalHeader.emptyTitle")}</h2>
                    <p className="text-sm leading-relaxed text-text-secondary">
                      {t("terminalHeader.emptyBody")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {mobileFiltersOpen && !gate && (
          <div className="fixed inset-0 z-50 xl:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-text/50 backdrop-blur-sm"
              aria-label={t("mobile.closeFilters")}
              onClick={() => setMobileFiltersOpen(false)}
            />
            <div className="absolute inset-x-0 bottom-0 top-12 overflow-y-auto rounded-t-[28px] border border-border-strong/70 bg-surface-raised px-4 pb-6 pt-4 shadow-[0_-18px_50px_rgba(15,23,42,0.18)] dark:shadow-[0_-20px_60px_rgba(2,6,23,0.6)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
                    {t("mobile.filtersTitle")}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {t("mobile.filtersBody")}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setMobileFiltersOpen(false)}>
                  {t("mobile.closeFilters")}
                </Button>
              </div>
              <FilterPanel
                key={`mobile-${filterPanelResetKey}`}
                filters={filters}
                onChange={handleFiltersChange}
                onApply={handleApply}
                loading={loading}
                onSaveScan={handleSaveScan}
                saveScanLoading={saveScanLoading}
                onSaveFavorite={handleSaveFavorite}
                onLoadFavorite={handleLoadFavorite}
                favoriteSaving={favoriteSaving}
                favoriteLoading={favoriteLoading}
                favoriteAvailable={hasFavorite}
                favoriteStatus={favoriteStatus}
              />
            </div>
          </div>
        )}

        {multiFilterGateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/45 px-4 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl">
              <button
                type="button"
                onClick={() => setMultiFilterGateOpen(false)}
                className="absolute end-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-raised/90 text-text-secondary shadow-sm ring-1 ring-border transition-colors hover:text-text"
                aria-label={t("guestLimit.close")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M4.22 4.22a.75.75 0 011.06 0L10 8.94l4.72-4.72a.75.75 0 111.06 1.06L11.06 10l4.72 4.72a.75.75 0 11-1.06 1.06L10 11.06l-4.72 4.72a.75.75 0 11-1.06-1.06L8.94 10 4.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                </svg>
              </button>
              <PremiumGate kind="multiFilterLogin" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

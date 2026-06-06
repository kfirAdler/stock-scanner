"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FilterPanel } from "@/components/screener/FilterPanel";
import { ResultsTable } from "@/components/screener/ResultsTable";
import { PremiumGate } from "@/components/billing/PremiumGate";
import { Button } from "@/components/ui/Button";
import type {
  ScreenerPayload,
  ScreenerResultRow,
  ScreenerResultsPage,
  ScannerSortDir,
  ScannerSortKey,
} from "@/lib/screener-types";
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

const DEFAULT_LIMIT = 50;

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [gate, setGate] = useState<Gate>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [multiFilterGateOpen, setMultiFilterGateOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshTicker, setRefreshTicker] = useState(() => Date.now());
  const [sortKey, setSortKey] = useState<ScannerSortKey>("ticker");
  const [sortDir, setSortDir] = useState<ScannerSortDir>("asc");
  const requestInFlightRef = useRef(false);

  const fetchResults = useCallback(async ({
    nextFilters = filtersRef.current,
    nextOffset = 0,
    append = false,
    nextSortKey = sortKey,
    nextSortDir = sortDir,
  }: {
    nextFilters?: ScreenerPayload;
    nextOffset?: number;
    append?: boolean;
    nextSortKey?: ScannerSortKey;
    nextSortDir?: ScannerSortDir;
  } = {}) => {
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    const normalizedFilters = coerceStoredScreen(nextFilters) ?? DEFAULT_SCREENER_PAYLOAD;
    setResultsError(null);
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setResults([]);
      setHasMore(false);
    }
    setHasSearched(true);
    setGate(null);
    if (!append) {
      setAppliedFilters(normalizedFilters);
    }
    if (!append && typeof window !== "undefined") {
      const query = screenToQueryString(normalizedFilters);
      const pathname = window.location.pathname;
      window.history.replaceState({}, "", query ? `${pathname}${query}` : pathname);
    }
    try {
      const res = await fetch("/api/screener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screen: normalizedFilters,
          limit: DEFAULT_LIMIT,
          offset: nextOffset,
          sortKey: nextSortKey,
          sortDir: nextSortDir,
        }),
      });
      if (res.status === 401) {
        setGate("login");
        if (!append) setResults([]);
        return;
      }
      if (res.status === 403) {
        setGate("subscribe");
        if (!append) setResults([]);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as ScreenerResultsPage;
      const nextRows = data.rows ?? [];
      setHasMore(!!data.hasMore);
      setResults((current) => {
        if (!append) return nextRows;
        const seen = new Set(current.map((row) => row.ticker));
        const merged = [...current];
        for (const row of nextRows) {
          if (!seen.has(row.ticker)) {
            merged.push(row);
            seen.add(row.ticker);
          }
        }
        return merged;
      });
    } catch {
      setResultsError(t("resultsError"));
      if (!append) {
        setResults([]);
        setHasMore(false);
      }
    } finally {
      requestInFlightRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  }, [sortDir, sortKey, t]);

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
      void fetchResults({ nextFilters: filtersRef.current });
    }
  }, [fetchResults]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRefreshTicker(Date.now());
    }, 15000);
    return () => window.clearInterval(interval);
  }, []);

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
  const appliedFilterCount = useMemo(() => countActiveFilters(appliedFilters), [appliedFilters]);
  const hasFavorite = !!favoriteFilters && countActiveFilters(favoriteFilters) > 0;
  const hasPendingChanges = useMemo(() => {
    const normalizedDraft = coerceStoredScreen(filters) ?? DEFAULT_SCREENER_PAYLOAD;
    const normalizedApplied = coerceStoredScreen(appliedFilters) ?? DEFAULT_SCREENER_PAYLOAD;
    return JSON.stringify(normalizedDraft) !== JSON.stringify(normalizedApplied);
  }, [appliedFilters, filters]);
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
  const relativeLastUpdated = useMemo(() => {
    if (!lastUpdated) return null;
    try {
      const deltaMs = new Date(lastUpdated).getTime() - refreshTicker;
      const deltaSeconds = Math.round(deltaMs / 1000);
      const absSeconds = Math.abs(deltaSeconds);
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
      if (absSeconds < 60) return rtf.format(deltaSeconds, "second");
      const deltaMinutes = Math.round(deltaSeconds / 60);
      if (Math.abs(deltaMinutes) < 60) return rtf.format(deltaMinutes, "minute");
      const deltaHours = Math.round(deltaMinutes / 60);
      return rtf.format(deltaHours, "hour");
    } catch {
      return formattedLastUpdated;
    }
  }, [formattedLastUpdated, lastUpdated, locale, refreshTicker]);

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
    await fetchResults({ nextFilters: favoriteFilters });
  }

  async function handleApply() {
    if (!loggedIn && activeFilterCount > 1) {
      setMultiFilterGateOpen(true);
      return;
    }

    setMobileFiltersOpen(false);
    await fetchResults();
  }

  function handleResetDraft() {
    handleFiltersChange(appliedFilters);
  }

  function handleSortChange(key: ScannerSortKey) {
    const nextDir: ScannerSortDir =
      key === sortKey ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    setSortKey(key);
    setSortDir(nextDir);
    void fetchResults({
      nextFilters: filtersRef.current,
      nextOffset: 0,
      append: false,
      nextSortKey: key,
      nextSortDir: nextDir,
    });
  }

  function handleLoadMore() {
    if (loading || loadingMore || !hasMore || gate || requestInFlightRef.current) return;
    void fetchResults({
      nextFilters: appliedFilters,
      nextOffset: results.length,
      append: true,
      nextSortKey: sortKey,
      nextSortDir: sortDir,
    });
  }

  return (
    <div className="page-shell max-w-[1580px]">
      <div className="space-y-3">
        <section className="page-card-strong sticky top-3 z-30 !p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[17px] font-bold tracking-tight text-text">{t("title")}</h1>
              <span className="ui-badge-default rounded-full px-2.5 py-1 text-[11px] font-semibold">
                {resultSummary.rows} {t("workspace.statusMatches")}
              </span>
              <span className="ui-badge-default rounded-full px-2.5 py-1 text-[11px] font-semibold">
                {activeFilterCount} {t("workspace.statusFilters")}
              </span>
              <span
                className={hasPendingChanges
                  ? "rounded-full bg-warning-soft px-2.5 py-1 text-[11px] font-semibold text-warning ring-1 ring-warning/15"
                  : "rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success ring-1 ring-success/15"
                }
              >
                {hasPendingChanges ? t("workspace.draftPending") : t("workspace.draftSynced")}
              </span>
              {relativeLastUpdated ? (
                <span className="ui-badge-default rounded-full px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                  {t("workspace.statusUpdated")} {relativeLastUpdated}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDesktopFiltersOpen((current) => !current)}
                className="hidden xl:inline-flex"
              >
                {desktopFiltersOpen ? t("workspace.hideFilters") : t("workspace.openFilters")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setMobileFiltersOpen(true)}
                className="justify-center xl:hidden"
              >
                {t("mobile.openFilters", { count: activeFilterCount })}
              </Button>
              {hasFavorite ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleLoadFavorite}
                  loading={favoriteLoading}
                  className="border-warning/30 bg-warning-soft text-warning shadow-none hover:bg-warning-soft/80"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                      <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L10 14.77l-5.2 2.73.99-5.79L1.58 7.62l5.82-.85L10 1.5z" />
                    </svg>
                    {t("workspace.loadFavoriteShort")}
                  </span>
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetDraft}
                disabled={!hasPendingChanges}
              >
                {t("workspace.resetDraft")}
              </Button>
              <Button type="button" size="sm" onClick={handleApply} loading={loading}>
                {t("workspace.quickApply")}
              </Button>
            </div>
          </div>
        </section>

        <div className="ui-panel-subtle flex items-center gap-2 rounded-2xl px-3 py-2 text-[11px] text-text-secondary">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-warning-soft text-[10px] text-warning">
            i
          </span>
          <span>{t("legalNotice.inlineShort")}</span>
          <Link href="/terms" className="link-hover font-semibold text-primary hover:underline">
            {t("legalNotice.link")}
          </Link>
        </div>

        {gate && <PremiumGate kind={gate === "login" ? "login" : "subscribe"} />}

        {resultsError ? (
          <div className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger ring-1 ring-danger/15">
            {resultsError}
          </div>
        ) : null}

        {!gate && (
          <div
            className={desktopFiltersOpen
              ? "grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)]"
              : "grid gap-4"
            }
          >
            <div
              className={
                desktopFiltersOpen
                  ? "hidden xl:sticky xl:top-[5.5rem] xl:block xl:max-h-[calc(100vh-6.5rem)] xl:self-start xl:overflow-y-auto xl:overscroll-contain xl:pr-1"
                  : "hidden"
              }
            >
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
                onClose={() => setDesktopFiltersOpen(false)}
                hasPendingChanges={hasPendingChanges}
                resultCount={resultSummary.rows}
                lastUpdatedLabel={formattedLastUpdated}
                onResetDraft={handleResetDraft}
              />
            </div>

            <div className="space-y-3">
              <div className="ui-panel-subtle flex flex-wrap items-center gap-2 rounded-2xl px-3.5 py-2.5 text-text-secondary">
                <span className="ui-badge-default rounded-full px-2.5 py-1 text-[11px] font-semibold">
                  {t("workspace.appliedCount", { count: appliedFilterCount })}
                </span>
                <span className="ui-badge-default rounded-full px-2.5 py-1 text-[11px] font-semibold">
                  {t("terminalHeader.appliedRules", { count: appliedFilters.rules.length })}
                </span>
                {resultSummary.strongSignals > 0 ? (
                  <span className="rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success ring-1 ring-success/15">
                    {resultSummary.strongSignals} {t("terminalHeader.cards.strong")}
                  </span>
                ) : null}
                {resultSummary.higherTimeframeRules > 0 ? (
                  <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary ring-1 ring-primary/10">
                    {t("terminalHeader.multiBlocks", { count: resultSummary.higherTimeframeRules })}
                  </span>
                ) : null}
              </div>

              {hasSearched ? (
                <ResultsTable
                  rows={results}
                  loading={loading}
                  loadingMore={loadingMore}
                  hasMore={hasMore}
                  onLoadMore={handleLoadMore}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSortChange={handleSortChange}
                  screenerFilters={appliedFilters}
                />
              ) : (
                <div className="ui-panel flex min-h-[520px] items-center justify-center rounded-2xl border-dashed px-6 text-center">
                  <div className="max-w-lg space-y-2">
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
            <div className="ui-panel-strong absolute inset-x-0 bottom-0 top-12 overflow-y-auto rounded-t-[28px] px-4 pb-6 pt-4 shadow-[0_-18px_50px_rgba(15,23,42,0.18)]">
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
                onClose={() => setMobileFiltersOpen(false)}
                hasPendingChanges={hasPendingChanges}
                resultCount={resultSummary.rows}
                lastUpdatedLabel={formattedLastUpdated}
                onResetDraft={handleResetDraft}
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
                className="ui-control absolute end-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full text-text-secondary shadow-sm transition-colors hover:border-border-strong hover:text-text"
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

"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FilterPanel } from "@/components/screener/FilterPanel";
import { ResultsTable } from "@/components/screener/ResultsTable";
import { DiscoveryGoalPicker } from "@/components/screener/DiscoveryGoalPicker";
import { SaveScreenDialog } from "@/components/screener/SaveScreenDialog";
import { PremiumGate } from "@/components/billing/PremiumGate";
import { Button } from "@/components/ui/Button";
import { MoneyCelebration } from "@/components/ui/MoneyCelebration";
import { useModalDialog } from "@/hooks/useModalDialog";
import type {
  DiscoveryGoal,
  ListingMarketFilter,
  ScreenerFilterAvailability,
  ScreenerPayload,
  ScreenerResultRow,
  ScreenerResultsPage,
  ScreenerSectorBreakdownItem,
  ScannerSortDir,
  ScannerSortKey,
} from "@/lib/screener-types";
import { buildDiscoveryPayload } from "@/lib/discovery-goals";
import {
  DEFAULT_SCREENER_PAYLOAD,
  coerceStoredScreen,
  countActiveFilters,
  parseScreenFromSearchParams,
  screenToQueryString,
} from "@/lib/screener-query";

type Gate = null | "login" | "subscribe";
type ScannerMode = "guided" | "advanced";

const DEFAULT_LIMIT = 50;
const TURNING_POINT_PRESET: ScreenerPayload = {
  version: 1,
  rules: [
    { id: "preset-close-gte-5", timeframe: "1D", field: "close", operator: "gte", value: 5 },
    { id: "preset-rsi-14-lte-30", timeframe: "1D", field: "rsi_14", operator: "lte", value: 30 },
    { id: "preset-is-up-day", timeframe: "1D", field: "is_up_day", operator: "is_true" },
    { id: "preset-relative-volume-20-gt-2", timeframe: "1D", field: "relative_volume_20", operator: "gt", value: 2 },
  ],
};

const BREAKOUT_LEADER_PRESET: ScreenerPayload = {
  version: 1,
  rules: [
    { id: "preset-roe-gt-20", timeframe: "1D", field: "return_on_equity", operator: "gt", value: 20 },
    { id: "preset-dte-lt-1", timeframe: "1D", field: "debt_to_equity", operator: "lt", value: 1 },
    { id: "preset-above-sma200", timeframe: "1D", field: "is_above_sma200", operator: "is_true" },
    { id: "preset-avg-volume-20-gt-100k", timeframe: "1D", field: "avg_volume_20", operator: "gt", value: 100000 },
    { id: "preset-above-sma20", timeframe: "1D", field: "is_above_sma20", operator: "is_true" },
    { id: "preset-above-sma50", timeframe: "1D", field: "is_above_sma50", operator: "is_true" },
    { id: "preset-new-high-50", timeframe: "1D", field: "is_new_high_50", operator: "is_true" },
  ],
};

const GETTING_UP_PRESET: ScreenerPayload = {
  version: 1,
  rules: [
    { id: "preset-weekly-above-sma150", timeframe: "1W", field: "is_above_sma150", operator: "is_true" },
    { id: "preset-weekly-above-sma200", timeframe: "1W", field: "is_above_sma200", operator: "is_true" },
    { id: "preset-weekly-up-sequence", timeframe: "1W", field: "bullish_sequence_active", operator: "is_true" },
    { id: "preset-monthly-above-sma150", timeframe: "1M", field: "is_above_sma150", operator: "is_true" },
    { id: "preset-monthly-above-sma200", timeframe: "1M", field: "is_above_sma200", operator: "is_true" },
    { id: "preset-monthly-up-sequence", timeframe: "1M", field: "bullish_sequence_active", operator: "is_true" },
    { id: "preset-daily-down-sequence", timeframe: "1D", field: "bearish_sequence_active", operator: "is_true" },
    { id: "preset-daily-above-sma20", timeframe: "1D", field: "is_above_sma20", operator: "is_true" },
    { id: "preset-daily-above-sma50", timeframe: "1D", field: "is_above_sma50", operator: "is_true" },
  ],
};

function presetAvailable(
  preset: ScreenerPayload,
  availability: ScreenerFilterAvailability | null
) {
  if (!availability) return true;
  return preset.rules.every((rule) => availability[rule.timeframe]?.[rule.field] ?? true);
}

function ScreenerPageContent() {
  const t = useTranslations("screener");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const urlFilters = useMemo(
    () => parseScreenFromSearchParams(new URLSearchParams(searchParamsKey)),
    [searchParamsKey]
  );
  const savedScreenId = useMemo(
    () => new URLSearchParams(searchParamsKey).get("saved_screen"),
    [searchParamsKey]
  );
  const [filters, setFilters] = useState<ScreenerPayload>(urlFilters);
  const filtersRef = useRef<ScreenerPayload>(urlFilters);
  const [appliedFilters, setAppliedFilters] = useState<ScreenerPayload>(urlFilters);
  const appliedFiltersRef = useRef<ScreenerPayload>(urlFilters);
  const [favoriteFilters, setFavoriteFilters] = useState<ScreenerPayload | null>(null);
  const [favoriteLoading, setFavoriteLoading] = useState(true);
  const [favoriteSaving, setFavoriteSaving] = useState(false);
  const [favoriteStatus, setFavoriteStatus] = useState<string | null>(null);
  const [activeSavedScreenName, setActiveSavedScreenName] = useState<string | null>(null);
  const [saveScanLoading, setSaveScanLoading] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogError, setSaveDialogError] = useState<string | null>(null);
  const [celebrationRun, setCelebrationRun] = useState<number | null>(null);
  const [filterPanelResetKey, setFilterPanelResetKey] = useState(0);
  const [results, setResults] = useState<ScreenerResultRow[]>([]);
  const [totalMatches, setTotalMatches] = useState<number | null>(null);
  const [sectorBreakdown, setSectorBreakdown] = useState<ScreenerSectorBreakdownItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingGoal, setLoadingGoal] = useState<DiscoveryGoal | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [gate, setGate] = useState<Gate>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [multiFilterGateOpen, setMultiFilterGateOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(true);
  const [scannerMode, setScannerMode] = useState<ScannerMode>(() =>
    urlFilters.discovery_goal || countActiveFilters(urlFilters) === 0 ? "guided" : "advanced"
  );
  const [goalPickerOpen, setGoalPickerOpen] = useState(() => !urlFilters.discovery_goal);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshTicker, setRefreshTicker] = useState(() => Date.now());
  const [sortKey, setSortKey] = useState<ScannerSortKey>(
    () => urlFilters.discovery_goal ? "match_score" : "ticker"
  );
  const [sortDir, setSortDir] = useState<ScannerSortDir>(
    () => urlFilters.discovery_goal ? "desc" : "asc"
  );
  const [filterAvailability, setFilterAvailability] = useState<ScreenerFilterAvailability | null>(null);
  const requestInFlightRef = useRef(false);
  const requestAbortControllerRef = useRef<AbortController | null>(null);
  const requestSequenceRef = useRef(0);
  const handledSearchParamsRef = useRef<string | null>(null);
  const celebrationTimerRef = useRef<number | null>(null);
  const actionsMenuRef = useRef<HTMLDetailsElement | null>(null);
  const closeMobileFilters = useCallback(() => setMobileFiltersOpen(false), []);
  const closeMultiFilterGate = useCallback(() => setMultiFilterGateOpen(false), []);
  const mobileFiltersDialogRef = useModalDialog<HTMLDivElement>({
    open: mobileFiltersOpen,
    onClose: closeMobileFilters,
  });
  const multiFilterGateDialogRef = useModalDialog<HTMLDivElement>({
    open: multiFilterGateOpen,
    onClose: closeMultiFilterGate,
  });

  const fetchResults = useCallback(async ({
    nextFilters = filtersRef.current,
    nextOffset = 0,
    append = false,
    nextSortKey = sortKey,
    nextSortDir = sortDir,
    syncUrl = true,
  }: {
    nextFilters?: ScreenerPayload;
    nextOffset?: number;
    append?: boolean;
    nextSortKey?: ScannerSortKey;
    nextSortDir?: ScannerSortDir;
    syncUrl?: boolean;
  } = {}) => {
    if (append && requestInFlightRef.current) return;
    if (!append) {
      requestAbortControllerRef.current?.abort();
    }
    const requestId = ++requestSequenceRef.current;
    const abortController = new AbortController();
    requestAbortControllerRef.current = abortController;
    requestInFlightRef.current = true;
    const normalizedFilters = coerceStoredScreen(nextFilters) ?? DEFAULT_SCREENER_PAYLOAD;
    setResultsError(null);
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setLoadingMore(false);
      setResults([]);
      setTotalMatches(null);
      setSectorBreakdown([]);
      setHasMore(false);
    }
    setHasSearched(true);
    setGate(null);
    if (!append) {
      appliedFiltersRef.current = normalizedFilters;
      setAppliedFilters(normalizedFilters);
    }
    if (!append && syncUrl && typeof window !== "undefined") {
      const query = screenToQueryString(normalizedFilters);
      const pathname = window.location.pathname;
      handledSearchParamsRef.current = query.startsWith("?") ? query.slice(1) : "";
      window.history.replaceState(
        window.history.state,
        "",
        query ? `${pathname}${query}` : pathname
      );
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
        signal: abortController.signal,
      });
      if (requestId !== requestSequenceRef.current) return;
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
      if (requestId !== requestSequenceRef.current) return;
      const nextRows = data.rows ?? [];
      if (!append) {
        setTotalMatches(typeof data.totalCount === "number" ? data.totalCount : nextRows.length);
        setSectorBreakdown(data.sectorBreakdown ?? []);
      }
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
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      if (requestId !== requestSequenceRef.current) return;
      setResultsError(t("resultsError"));
      if (!append) {
        setResults([]);
        setTotalMatches(null);
        setSectorBreakdown([]);
        setHasMore(false);
      }
    } finally {
      if (requestId === requestSequenceRef.current) {
        requestInFlightRef.current = false;
        requestAbortControllerRef.current = null;
        setLoading(false);
        setLoadingMore(false);
      }
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

    async function loadFilterAvailability() {
      try {
        const res = await fetch("/api/screener/options", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { filterAvailability?: ScreenerFilterAvailability };
        if (!cancelled) {
          setFilterAvailability(data.filterAvailability ?? null);
        }
      } catch {
        if (!cancelled) {
          setFilterAvailability(null);
        }
      }
    }

    void loadFilterAvailability();

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
    let cancelled = false;
    const savedScreenAbortController = new AbortController();

    queueMicrotask(() => {
      if (cancelled) return;
      const urlScreenSignature = screenToQueryString(urlFilters);
      const appliedScreenSignature = screenToQueryString(appliedFiltersRef.current);
      if (
        handledSearchParamsRef.current === searchParamsKey &&
        (savedScreenId || urlScreenSignature === appliedScreenSignature)
      ) return;
      if (!savedScreenId) {
        handledSearchParamsRef.current = searchParamsKey;
      }

      function stopCurrentResultsRequest() {
        requestSequenceRef.current += 1;
        requestAbortControllerRef.current?.abort();
        requestAbortControllerRef.current = null;
        requestInFlightRef.current = false;
        setResults([]);
        setTotalMatches(null);
        setSectorBreakdown([]);
        setHasMore(false);
        setResultsError(null);
        setGate(null);
        setLoadingMore(false);
      }

      function applyResolvedScreen(nextFilters: ScreenerPayload, savedScreenName: string | null) {
        if (cancelled) return;
        const nextSortKey: ScannerSortKey = nextFilters.discovery_goal ? "match_score" : "ticker";
        const nextSortDir: ScannerSortDir = nextFilters.discovery_goal ? "desc" : "asc";
        filtersRef.current = nextFilters;
        appliedFiltersRef.current = nextFilters;
        setFilters(nextFilters);
        setAppliedFilters(nextFilters);
        setActiveSavedScreenName(savedScreenName);
        setSortKey(nextSortKey);
        setSortDir(nextSortDir);
        setScannerMode(
          nextFilters.discovery_goal || countActiveFilters(nextFilters) === 0 ? "guided" : "advanced"
        );
        setGoalPickerOpen(!nextFilters.discovery_goal);
        setMobileFiltersOpen(false);
        setMultiFilterGateOpen(false);
        setFilterPanelResetKey((current) => current + 1);
        setFavoriteStatus(null);

        if (countActiveFilters(nextFilters) > 0) {
          void fetchResults({
            nextFilters,
            nextSortKey,
            nextSortDir,
            syncUrl: false,
          });
          return;
        }

        stopCurrentResultsRequest();
        setHasSearched(false);
        setLoading(false);
      }

      async function loadSavedScreen() {
        if (!savedScreenId) return;

        // Remove the previous scan immediately. The URL copy provides a smooth
        // placeholder while the authoritative saved version is loaded by id.
        stopCurrentResultsRequest();
        const pendingFilters = countActiveFilters(urlFilters) > 0
          ? urlFilters
          : DEFAULT_SCREENER_PAYLOAD;
        filtersRef.current = pendingFilters;
        appliedFiltersRef.current = pendingFilters;
        setFilters(pendingFilters);
        setAppliedFilters(pendingFilters);
        setActiveSavedScreenName(null);
        setHasSearched(true);
        setLoading(true);

        try {
          const response = await fetch(`/api/saved-screens?id=${encodeURIComponent(savedScreenId)}`, {
            cache: "no-store",
            signal: savedScreenAbortController.signal,
          });
          if (cancelled) return;
          handledSearchParamsRef.current = searchParamsKey;
          if (response.status === 401) {
            setGate("login");
            setLoading(false);
            return;
          }
          if (response.status === 403) {
            setGate("subscribe");
            setLoading(false);
            return;
          }
          if (!response.ok) throw new Error("Failed to load saved screen");

          const data = (await response.json()) as {
            screen?: { name?: unknown; filter_json?: unknown };
          };
          const storedFilters = coerceStoredScreen(data.screen?.filter_json);
          if (!storedFilters) throw new Error("Saved screen has no valid filters");
          const storedName = typeof data.screen?.name === "string" ? data.screen.name : null;
          applyResolvedScreen(storedFilters, storedName);
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") return;
          if (cancelled) return;
          handledSearchParamsRef.current = searchParamsKey;
          setLoading(false);
          setHasSearched(false);
          setResultsError(t("savedScreenLoadError"));
        }
      }

      if (savedScreenId) {
        void loadSavedScreen();
        return;
      }

      applyResolvedScreen(urlFilters, null);
    });

    return () => {
      cancelled = true;
      savedScreenAbortController.abort();
    };
  }, [fetchResults, savedScreenId, searchParamsKey, t, urlFilters]);

  useEffect(() => {
    return () => {
      requestAbortControllerRef.current?.abort();
      if (celebrationTimerRef.current !== null) {
        window.clearTimeout(celebrationTimerRef.current);
      }
    };
  }, []);

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
  const currentIsFavorite = useMemo(() => {
    if (!favoriteFilters || appliedFilterCount === 0) return false;
    return JSON.stringify(favoriteFilters) === JSON.stringify(appliedFilters);
  }, [appliedFilterCount, appliedFilters, favoriteFilters]);
  const hasPendingChanges = useMemo(() => {
    const normalizedDraft = coerceStoredScreen(filters) ?? DEFAULT_SCREENER_PAYLOAD;
    const normalizedApplied = coerceStoredScreen(appliedFilters) ?? DEFAULT_SCREENER_PAYLOAD;
    return JSON.stringify(normalizedDraft) !== JSON.stringify(normalizedApplied);
  }, [appliedFilters, filters]);
  const resultSummary = useMemo(() => {
    return {
      rows: totalMatches ?? results.length,
    };
  }, [results.length, totalMatches]);
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
  const presetDisabledReason = t("workspace.presetUnavailable");
  const canApplyTurningPointPreset = presetAvailable(TURNING_POINT_PRESET, filterAvailability);
  const canApplyBreakoutPreset = presetAvailable(BREAKOUT_LEADER_PRESET, filterAvailability);
  const canApplyGettingUpPreset = presetAvailable(GETTING_UP_PRESET, filterAvailability);

  function handleFiltersChange(nextFilters: ScreenerPayload) {
    filtersRef.current = nextFilters;
    setFilters(nextFilters);
    if (!nextFilters.discovery_goal && sortKey === "match_score") {
      setSortKey("ticker");
      setSortDir("asc");
    }
  }

  async function handleApplyDiscoveryGoal(goal: DiscoveryGoal) {
    const preset = buildDiscoveryPayload(goal, filtersRef.current);
    setFilterPanelResetKey((current) => current + 1);
    setFavoriteStatus(null);
    setActiveSavedScreenName(null);
    setFilters(preset);
    filtersRef.current = preset;

    if (!loggedIn && countActiveFilters(preset) > 1) {
      setMultiFilterGateOpen(true);
      return;
    }

    setSortKey("match_score");
    setSortDir("desc");
    setScannerMode("guided");
    setGoalPickerOpen(false);
    setMobileFiltersOpen(false);
    setLoadingGoal(goal);
    try {
      await fetchResults({
        nextFilters: preset,
        nextSortKey: "match_score",
        nextSortDir: "desc",
      });
    } finally {
      setLoadingGoal(null);
    }
  }

  function handleDiscoveryMarketChange(market?: ListingMarketFilter) {
    const nextFilters: ScreenerPayload = {
      ...filtersRef.current,
      listing_market: market,
    };
    handleFiltersChange(nextFilters);
    if (nextFilters.discovery_goal) {
      void handleApplyDiscoveryGoal(nextFilters.discovery_goal);
    }
  }

  async function handleApplyTurningPointPreset() {
    const preset = coerceStoredScreen(TURNING_POINT_PRESET) ?? TURNING_POINT_PRESET;
    setFilterPanelResetKey((current) => current + 1);
    setFavoriteStatus(null);
    setActiveSavedScreenName(null);
    setFilters(preset);
    filtersRef.current = preset;

    if (!loggedIn && countActiveFilters(preset) > 1) {
      setMultiFilterGateOpen(true);
      return;
    }

    setMobileFiltersOpen(false);
    await fetchResults({ nextFilters: preset });
  }

  async function handleApplyBreakoutPreset() {
    const preset = coerceStoredScreen(BREAKOUT_LEADER_PRESET) ?? BREAKOUT_LEADER_PRESET;
    setFilterPanelResetKey((current) => current + 1);
    setFavoriteStatus(null);
    setActiveSavedScreenName(null);
    setFilters(preset);
    filtersRef.current = preset;

    if (!loggedIn && countActiveFilters(preset) > 1) {
      setMultiFilterGateOpen(true);
      return;
    }

    setMobileFiltersOpen(false);
    await fetchResults({ nextFilters: preset });
  }

  async function handleApplyGettingUpPreset() {
    const preset = coerceStoredScreen(GETTING_UP_PRESET) ?? GETTING_UP_PRESET;
    setFilterPanelResetKey((current) => current + 1);
    setFavoriteStatus(null);
    setActiveSavedScreenName(null);
    setFilters(preset);
    filtersRef.current = preset;

    if (!loggedIn && countActiveFilters(preset) > 1) {
      setMultiFilterGateOpen(true);
      return;
    }

    setMobileFiltersOpen(false);
    await fetchResults({ nextFilters: preset });
  }

  async function handleSaveFavorite() {
    if (appliedFilterCount === 0) {
      setFavoriteStatus(t("favorite.emptySave"));
      return;
    }

    setFavoriteSaving(true);
    setFavoriteStatus(null);
    try {
      const normalized = coerceStoredScreen(appliedFilters) ?? DEFAULT_SCREENER_PAYLOAD;
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

  function handleOpenSaveScan() {
    if (appliedFilterCount === 0) {
      setFavoriteStatus(t("saveScanEmpty"));
      return;
    }

    setSaveDialogError(null);
    setSaveDialogOpen(true);
  }

  async function handleSaveScan(name: string) {
    setSaveScanLoading(true);
    setSaveDialogError(null);
    setFavoriteStatus(null);
    try {
      const normalized = coerceStoredScreen(appliedFilters) ?? DEFAULT_SCREENER_PAYLOAD;
      const res = await fetch("/api/saved-screens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), filter_json: normalized }),
      });

      if (res.status === 401) {
        setSaveDialogError(t("saveScanSignInRequired"));
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to save scan");
      }

      setSaveDialogOpen(false);
      setFavoriteStatus(t("saveScanSaved"));
      setCelebrationRun(Date.now());
      if (celebrationTimerRef.current !== null) {
        window.clearTimeout(celebrationTimerRef.current);
      }
      celebrationTimerRef.current = window.setTimeout(() => {
        setCelebrationRun(null);
        celebrationTimerRef.current = null;
      }, 2900);
    } catch {
      setSaveDialogError(t("saveScanFailed"));
    } finally {
      setSaveScanLoading(false);
    }
  }

  async function handleApply() {
    if (!loggedIn && activeFilterCount > 1) {
      setMultiFilterGateOpen(true);
      return;
    }

    setMobileFiltersOpen(false);
    setActiveSavedScreenName(null);
    await fetchResults();
  }

  function handleResetDraft() {
    handleFiltersChange(appliedFilters);
  }

  function handleModeChange(mode: ScannerMode) {
    if (mode === "advanced") {
      openAdvancedBuilder();
      return;
    }
    setScannerMode(mode);
    setMobileFiltersOpen(false);
    setGoalPickerOpen(!filtersRef.current.discovery_goal);
  }

  function openAdvancedBuilder() {
    setScannerMode("advanced");
    setGoalPickerOpen(false);
    if (window.matchMedia("(min-width: 1280px)").matches) {
      setDesktopFiltersOpen(true);
    } else {
      setMobileFiltersOpen(true);
    }
  }

  function openGoalPicker() {
    actionsMenuRef.current?.removeAttribute("open");
    setScannerMode("guided");
    setDesktopFiltersOpen(false);
    setMobileFiltersOpen(false);
    setGoalPickerOpen(true);
  }

  function closeActionsMenu() {
    actionsMenuRef.current?.removeAttribute("open");
  }

  function handleSortChange(key: ScannerSortKey) {
    const nextDir: ScannerSortDir =
      key === sortKey
        ? (sortDir === "asc" ? "desc" : "asc")
        : key === "match_score" ? "desc" : "asc";
    setSortKey(key);
    setSortDir(nextDir);
    void fetchResults({
      nextFilters: appliedFilters,
      nextOffset: 0,
      append: false,
      nextSortKey: key,
      nextSortDir: nextDir,
      syncUrl: false,
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
        <section className="page-card-strong z-30 !p-3.5 sm:sticky sm:top-16 sm:!p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                {t("workspace.commandEyebrow")}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="truncate text-lg font-bold tracking-tight text-text">
                  {activeSavedScreenName ?? (appliedFilters.discovery_goal
                    ? t(`discovery.goals.${appliedFilters.discovery_goal}.title`)
                    : t("workspace.customScan"))}
                </h1>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary" aria-live="polite">
                  <span
                    className={hasPendingChanges ? "h-2 w-2 rounded-full bg-warning" : "h-2 w-2 rounded-full bg-success"}
                    aria-hidden="true"
                  />
                  {hasPendingChanges ? t("workspace.draftPending") : t("workspace.draftSynced")}
                </span>
              </div>
              <p className="mt-1 text-xs text-text-muted">
                {t("workspace.compactStatus", {
                  matches: resultSummary.rows,
                  filters: activeFilterCount,
                })}
                {relativeLastUpdated ? ` · ${t("workspace.statusUpdated")} ${relativeLastUpdated}` : ""}
              </p>
              {favoriteStatus ? (
                <p className="mt-1 text-[11px] font-semibold text-primary" aria-live="polite">
                  {favoriteStatus}
                </p>
              ) : null}
            </div>

            <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
              {hasPendingChanges ? (
                <Button type="button" size="sm" onClick={handleApply} loading={loading} className="flex-1 sm:flex-none">
                  {t("workspace.quickApply")}
                </Button>
              ) : (
                <Button type="button" size="sm" onClick={openAdvancedBuilder} className="flex-1 sm:flex-none">
                  {t("workspace.editScan")}
                </Button>
              )}

              <details ref={actionsMenuRef} className="relative">
                <summary
                  className="ui-control flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg text-lg font-black text-text-secondary [&::-webkit-details-marker]:hidden"
                  aria-label={t("workspace.moreActions")}
                >
                  ···
                </summary>
                <div className="ui-panel-overlay absolute end-0 top-12 z-50 w-60 overflow-hidden rounded-2xl p-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      closeActionsMenu();
                      void handleSaveFavorite();
                    }}
                    disabled={favoriteLoading || favoriteSaving || appliedFilterCount === 0 || currentIsFavorite}
                    className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-start text-xs font-bold text-text-secondary hover:bg-surface-hover hover:text-text disabled:opacity-50"
                  >
                    <span aria-hidden="true">{currentIsFavorite ? "★" : "☆"}</span>
                    {currentIsFavorite
                      ? t("favorite.current")
                      : hasFavorite ? t("favorite.update") : t("favorite.save")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeActionsMenu();
                      handleOpenSaveScan();
                    }}
                    disabled={appliedFilterCount === 0}
                    className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-start text-xs font-bold text-text-secondary hover:bg-surface-hover hover:text-text disabled:opacity-50"
                  >
                    <span aria-hidden="true">▣</span>
                    {t("saveScan")}
                  </button>
                  <button
                    type="button"
                    onClick={openGoalPicker}
                    className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-start text-xs font-bold text-text-secondary hover:bg-surface-hover hover:text-text"
                  >
                    <span aria-hidden="true">↗</span>
                    {t("workspace.changeGoalShort")}
                  </button>
                  <Link
                    href="/saved-screens"
                    onClick={closeActionsMenu}
                    className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-start text-xs font-bold text-text-secondary hover:bg-surface-hover hover:text-text"
                  >
                    <span aria-hidden="true">☰</span>
                    {t("workspace.savedScreensLink")}
                  </Link>
                  <div className="my-1 border-t border-border" />
                  <Link
                    href="/terms"
                    onClick={closeActionsMenu}
                    className="flex min-h-9 w-full items-center gap-2 rounded-xl px-3 text-start text-[11px] font-semibold text-text-muted hover:bg-surface-hover hover:text-text"
                  >
                    <span aria-hidden="true">ⓘ</span>
                    {t("legalNotice.inlineShort")} {t("legalNotice.link")}
                  </Link>
                </div>
              </details>
            </div>
          </div>

          {!hasSearched && appliedFilterCount === 0 ? (
            <div className="mt-3 flex items-center gap-2 border-t border-border/70 pt-3">
              <span className="text-xs font-semibold text-text-muted">{t("workspace.modeLabel")}</span>
              <div className="ui-segment grid grid-cols-2 rounded-xl p-1" role="group" aria-label={t("workspace.modeLabel")}>
                {(["guided", "advanced"] as ScannerMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={scannerMode === mode}
                    onClick={() => handleModeChange(mode)}
                    className={scannerMode === mode
                      ? "ui-segment-item-active min-h-9 rounded-lg px-3 text-xs font-bold"
                      : "ui-segment-item min-h-9 rounded-lg px-3 text-xs font-bold"
                    }
                  >
                    {t(`workspace.modes.${mode}`)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {scannerMode === "guided" && goalPickerOpen ? (
          <DiscoveryGoalPicker
            key={`goal-picker-${filters.discovery_goal ?? "empty"}-${goalPickerOpen}`}
            selectedGoal={filters.discovery_goal}
            market={filters.listing_market}
            availability={filterAvailability}
            loadingGoal={loadingGoal}
            initiallyExpanded
            onSelectGoal={(goal) => void handleApplyDiscoveryGoal(goal)}
            onMarketChange={handleDiscoveryMarketChange}
          />
        ) : null}

        {gate && <PremiumGate kind={gate === "login" ? "login" : "subscribe"} />}

        {resultsError ? (
          <div className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger ring-1 ring-danger/15" role="alert">
            {resultsError}
          </div>
        ) : null}

        {!gate && (
          <div
            className={scannerMode === "advanced" && desktopFiltersOpen
              ? "grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)]"
              : "grid gap-4"
            }
          >
            <div
              className={
                scannerMode === "advanced" && desktopFiltersOpen
                  ? "hidden xl:sticky xl:top-[5.5rem] xl:block xl:max-h-[calc(100vh-6.5rem)] xl:self-start xl:overflow-y-auto xl:overscroll-contain xl:pr-1"
                  : "hidden"
              }
            >
              <FilterPanel
                key={filterPanelResetKey}
                filters={filters}
                onChange={handleFiltersChange}
                onApply={handleApply}
                onApplyTurningPointPreset={handleApplyTurningPointPreset}
                onApplyBreakoutPreset={handleApplyBreakoutPreset}
                onApplyGettingUpPreset={handleApplyGettingUpPreset}
                canApplyTurningPointPreset={canApplyTurningPointPreset}
                canApplyBreakoutPreset={canApplyBreakoutPreset}
                canApplyGettingUpPreset={canApplyGettingUpPreset}
                presetDisabledReason={presetDisabledReason}
                filterAvailability={filterAvailability ?? undefined}
                loading={loading}
                onClose={() => setDesktopFiltersOpen(false)}
                hasPendingChanges={hasPendingChanges}
                resultCount={resultSummary.rows}
                lastUpdatedLabel={formattedLastUpdated}
                onResetDraft={handleResetDraft}
              />
            </div>

            <div className="min-w-0 space-y-3">
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
                  totalCount={totalMatches ?? undefined}
                  sectorBreakdown={sectorBreakdown}
                  lastUpdatedLabel={formattedLastUpdated}
                  onEditFilters={openAdvancedBuilder}
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
              onClick={closeMobileFilters}
            />
            <div
              ref={mobileFiltersDialogRef}
              role="dialog"
              aria-modal="true"
              aria-label={t("mobile.filtersTitle")}
              tabIndex={-1}
              className="ui-panel-strong absolute inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] top-[max(0.5rem,env(safe-area-inset-top))] overflow-y-auto overscroll-contain rounded-[24px] px-2.5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-18px_50px_rgba(15,23,42,0.18)] sm:inset-x-4 sm:rounded-[28px] sm:px-4 sm:pt-3"
            >
              <FilterPanel
                key={`mobile-${filterPanelResetKey}`}
                filters={filters}
                onChange={handleFiltersChange}
                onApply={handleApply}
                onApplyTurningPointPreset={handleApplyTurningPointPreset}
                onApplyBreakoutPreset={handleApplyBreakoutPreset}
                onApplyGettingUpPreset={handleApplyGettingUpPreset}
                canApplyTurningPointPreset={canApplyTurningPointPreset}
                canApplyBreakoutPreset={canApplyBreakoutPreset}
                canApplyGettingUpPreset={canApplyGettingUpPreset}
                presetDisabledReason={presetDisabledReason}
                filterAvailability={filterAvailability ?? undefined}
                loading={loading}
                onClose={closeMobileFilters}
                hasPendingChanges={hasPendingChanges}
                resultCount={resultSummary.rows}
                lastUpdatedLabel={formattedLastUpdated}
                onResetDraft={handleResetDraft}
              />
            </div>
          </div>
        )}

        {multiFilterGateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-text/45 px-3 py-3 backdrop-blur-sm sm:px-4">
            <div
              ref={multiFilterGateDialogRef}
              className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-3xl"
              role="dialog"
              aria-modal="true"
              aria-label={t("guestLimit.dialogLabel")}
              tabIndex={-1}
            >
              <button
                type="button"
                onClick={closeMultiFilterGate}
                className="ui-control absolute end-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full text-text-secondary shadow-sm transition-colors hover:border-border-strong hover:text-text"
                aria-label={t("guestLimit.close")}
                data-autofocus
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M4.22 4.22a.75.75 0 011.06 0L10 8.94l4.72-4.72a.75.75 0 111.06 1.06L11.06 10l4.72 4.72a.75.75 0 11-1.06 1.06L10 11.06l-4.72 4.72a.75.75 0 11-1.06-1.06L8.94 10 4.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                </svg>
              </button>
              <PremiumGate kind="multiFilterLogin" />
            </div>
          </div>
        )}

        {saveDialogOpen ? (
          <SaveScreenDialog
            defaultName={t("saveScanDefaultName")}
            filterCount={appliedFilterCount}
            loading={saveScanLoading}
            error={saveDialogError}
            onClose={() => {
              if (!saveScanLoading) setSaveDialogOpen(false);
            }}
            onSave={handleSaveScan}
          />
        ) : null}

        {celebrationRun !== null ? (
          <MoneyCelebration key={celebrationRun} message={t("saveScanSaved")} />
        ) : null}

      </div>
    </div>
  );
}

export default function ScreenerPage() {
  return (
    <Suspense
      fallback={(
        <div className="page-shell max-w-[1580px]" aria-hidden="true">
          <div className="ui-panel min-h-[520px] animate-pulse rounded-2xl" />
        </div>
      )}
    >
      <ScreenerPageContent />
    </Suspense>
  );
}

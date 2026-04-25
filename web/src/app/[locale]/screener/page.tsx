"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FilterPanel } from "@/components/screener/FilterPanel";
import { ResultsTable } from "@/components/screener/ResultsTable";
import { PremiumGate } from "@/components/billing/PremiumGate";
import type { ScreenerFilters, SnapshotRow } from "@/lib/screener-types";

type Gate = null | "login" | "subscribe";
const FAVORITE_FILTER_STORAGE_KEY = "screener.favoriteFilter";

function normalizeFilters(filters: ScreenerFilters): ScreenerFilters {
  return Object.fromEntries(
    Object.entries(filters)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .sort(([a], [b]) => a.localeCompare(b))
  ) as ScreenerFilters;
}

function countActiveFilters(filters: ScreenerFilters) {
  return Object.keys(normalizeFilters(filters)).length;
}

export default function ScreenerPage() {
  const t = useTranslations("screener");
  const [filters, setFilters] = useState<ScreenerFilters>({});
  const filtersRef = useRef<ScreenerFilters>({});
  const [appliedFilters, setAppliedFilters] = useState<ScreenerFilters>({});
  const [favoriteFilters, setFavoriteFilters] = useState<ScreenerFilters | null>(null);
  const [favoriteLoading, setFavoriteLoading] = useState(true);
  const [favoriteSaving, setFavoriteSaving] = useState(false);
  const [favoriteStatus, setFavoriteStatus] = useState<string | null>(null);
  const [results, setResults] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [gate, setGate] = useState<Gate>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [multiFilterGateOpen, setMultiFilterGateOpen] = useState(false);

  const fetchResults = useCallback(async (nextFilters: ScreenerFilters = filtersRef.current) => {
    const normalizedFilters = normalizeFilters(nextFilters);
    setLoading(true);
    setHasSearched(true);
    setGate(null);
    setAppliedFilters(normalizedFilters);
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(normalizedFilters)) {
        if (value !== undefined && value !== null && value !== "") {
          params.set(key, String(value));
        }
      }
      const res = await fetch(`/api/screener?${params.toString()}`);
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
        const stored = window.localStorage.getItem(FAVORITE_FILTER_STORAGE_KEY);
        if (stored && !cancelled) {
          const parsed = JSON.parse(stored) as ScreenerFilters;
          setFavoriteFilters(normalizeFilters(parsed));
        }
      } catch {
        // ignore malformed local storage
      }

      try {
        const res = await fetch("/api/preferences", { cache: "no-store" });
        if (!res.ok) {
          return;
        }
        const data = await res.json();
        const favorite = data?.preferences?.favorite_screener_filter;
        if (!cancelled) {
          const normalizedFavorite = favorite && typeof favorite === "object"
            ? normalizeFilters(favorite as ScreenerFilters)
            : null;
          setFavoriteFilters(normalizedFavorite);
          if (normalizedFavorite) {
            window.localStorage.setItem(
              FAVORITE_FILTER_STORAGE_KEY,
              JSON.stringify(normalizedFavorite)
            );
          } else {
            window.localStorage.removeItem(FAVORITE_FILTER_STORAGE_KEY);
          }
        }
      } catch {
        // ignore
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

  function handleFiltersChange(nextFilters: ScreenerFilters) {
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
      const normalized = normalizeFilters(filters);
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
      window.localStorage.setItem(
        FAVORITE_FILTER_STORAGE_KEY,
        JSON.stringify(normalized)
      );
      setFavoriteStatus(t("favorite.saved"));
    } catch {
      setFavoriteStatus(t("favorite.saveFailed"));
    } finally {
      setFavoriteSaving(false);
    }
  }

  async function handleLoadFavorite() {
    if (!favoriteFilters) {
      setFavoriteStatus(t("favorite.empty"));
      return;
    }

    setFilters(favoriteFilters);
    filtersRef.current = favoriteFilters;
    setFavoriteStatus(t("favorite.loaded"));
    await fetchResults(favoriteFilters);
  }

  async function handleApply() {
    if (!loggedIn && activeFilterCount > 1) {
      setMultiFilterGateOpen(true);
      return;
    }

    await fetchResults();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">{t("title")}</h1>
        <p className="text-sm text-text-muted max-w-2xl">{t("premiumSubtitle")}</p>
      </div>

      {gate && <PremiumGate kind={gate === "login" ? "login" : "subscribe"} />}

      {!gate && (
        <>
          <FilterPanel
            filters={filters}
            onChange={handleFiltersChange}
            onApply={handleApply}
            loading={loading}
            onSaveFavorite={handleSaveFavorite}
            onLoadFavorite={handleLoadFavorite}
            favoriteSaving={favoriteSaving}
            favoriteLoading={favoriteLoading}
            favoriteAvailable={hasFavorite}
            favoriteStatus={favoriteStatus}
          />
          {hasSearched && (
            <ResultsTable
              rows={results}
              loading={loading}
              screenerFilters={appliedFilters}
            />
          )}
        </>
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
  );
}

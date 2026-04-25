"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FilterPanel } from "@/components/screener/FilterPanel";
import { ResultsTable } from "@/components/screener/ResultsTable";
import { PremiumGate } from "@/components/billing/PremiumGate";
import type { ScreenerFilters, SnapshotRow } from "@/lib/screener-types";

type Gate = null | "login" | "subscribe";

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
  const [favoriteFilters, setFavoriteFilters] = useState<ScreenerFilters | null>(null);
  const [favoriteLoading, setFavoriteLoading] = useState(true);
  const [favoriteSaving, setFavoriteSaving] = useState(false);
  const [favoriteStatus, setFavoriteStatus] = useState<string | null>(null);
  const [results, setResults] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [gate, setGate] = useState<Gate>(null);

  const fetchResults = useCallback(async (nextFilters: ScreenerFilters = filters) => {
    setLoading(true);
    setHasSearched(true);
    setGate(null);
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(nextFilters)) {
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
  }, [filters]);

  useEffect(() => {
    let cancelled = false;

    async function loadFavorite() {
      try {
        const res = await fetch("/api/preferences");
        if (!res.ok) {
          return;
        }
        const data = await res.json();
        const favorite = data?.preferences?.favorite_screener_filter;
        if (!cancelled) {
          setFavoriteFilters(favorite && typeof favorite === "object"
            ? normalizeFilters(favorite as ScreenerFilters)
            : null);
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

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);
  const hasFavorite = !!favoriteFilters && countActiveFilters(favoriteFilters) > 0;
  const favoriteLabel = activeFilterCount > 0
    ? t("favorite.save")
    : t("favorite.load");

  async function handleFavoriteClick() {
    if (activeFilterCount > 0) {
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
        setFavoriteStatus(t("favorite.saved"));
      } catch {
        setFavoriteStatus(t("favorite.saveFailed"));
      } finally {
        setFavoriteSaving(false);
      }
      return;
    }

    if (!favoriteFilters) {
      setFavoriteStatus(t("favorite.empty"));
      return;
    }

    setFilters(favoriteFilters);
    setFavoriteStatus(t("favorite.loaded"));
    await fetchResults(favoriteFilters);
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
            onChange={setFilters}
            onApply={fetchResults}
            loading={loading}
            onFavoriteClick={handleFavoriteClick}
            favoriteLoading={favoriteLoading || favoriteSaving}
            favoriteAvailable={hasFavorite}
            favoriteLabel={favoriteLabel}
            favoriteStatus={favoriteStatus}
          />
          {hasSearched && (
            <ResultsTable
              rows={results}
              loading={loading}
              screenerFilters={filters}
            />
          )}
        </>
      )}
    </div>
  );
}

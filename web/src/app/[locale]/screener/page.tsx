"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { FilterPanel } from "@/components/screener/FilterPanel";
import { ResultsTable } from "@/components/screener/ResultsTable";
import { PremiumGate } from "@/components/billing/PremiumGate";
import type { ScreenerFilters, SnapshotRow } from "@/lib/screener-types";

type Gate = null | "login" | "subscribe";

export default function ScreenerPage() {
  const t = useTranslations("screener");
  const [filters, setFilters] = useState<ScreenerFilters>({});
  const [results, setResults] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [gate, setGate] = useState<Gate>(null);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setHasSearched(true);
    setGate(null);
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
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

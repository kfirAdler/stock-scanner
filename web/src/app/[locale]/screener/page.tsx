"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { FilterPanel } from "@/components/screener/FilterPanel";
import { ResultsTable } from "@/components/screener/ResultsTable";
import type { ScreenerFilters, SnapshotRow } from "@/lib/screener-types";

export default function ScreenerPage() {
  const t = useTranslations("screener");
  const [filters, setFilters] = useState<ScreenerFilters>({});
  const [results, setResults] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== "") {
          params.set(key, String(value));
        }
      }
      const res = await fetch(`/api/screener?${params.toString()}`);
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
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <FilterPanel
        filters={filters}
        onChange={setFilters}
        onApply={fetchResults}
        loading={loading}
      />
      {hasSearched && <ResultsTable rows={results} loading={loading} />}
    </div>
  );
}

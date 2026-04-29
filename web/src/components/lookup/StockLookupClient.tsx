"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useMessages, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { clsx } from "clsx";
import { Input } from "@/components/ui/Input";
import { PremiumGate } from "@/components/billing/PremiumGate";
import type { LegacyScreenerFilters } from "@/lib/screener-types";

type AccessGate = null | "login" | "subscribe";

type Suggestion = {
  ticker: string;
  market?: string | null;
  close: number;
  last_trade_date: string;
};

type CoverageEntry = {
  id: string;
  supported: boolean;
  reasonKey?: string;
  reasonParams?: Record<string, string | number>;
};

type FilterCoverageRow = CoverageEntry & { filterKey: keyof LegacyScreenerFilters };

type CoveragePayload = {
  ticker: string;
  market: string;
  barCount: number;
  snapshot: { close: number; last_trade_date: string };
  indicators: CoverageEntry[];
  screenerFilters: FilterCoverageRow[];
};

function debounceFn(fn: (arg: string) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (arg: string) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(arg), ms);
  };
}

function formatReason(
  template: string | undefined,
  params?: Record<string, string | number>
): string {
  if (!template) return "";
  let s = template;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

export function StockLookupClient() {
  const t = useTranslations("lookup");
  const tScr = useTranslations("screener");
  const messages = useMessages() as {
    lookup: {
      indicators: Record<string, string>;
      filterLabels: Record<string, string>;
      reason: Record<string, string>;
    };
  };
  const lookupMsg = messages.lookup;
  const listId = useId();
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [coverage, setCoverage] = useState<CoveragePayload | null>(null);
  const [loadingCoverage, setLoadingCoverage] = useState(false);
  const [error, setError] = useState("");
  const [accessGate, setAccessGate] = useState<AccessGate>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(async (prefix: string) => {
    const trimmed = prefix.trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }
    setLoadingSuggest(true);
    setError("");
    setAccessGate(null);
    try {
      const res = await fetch(
        `/api/tickers/search?q=${encodeURIComponent(trimmed)}`
      );
      if (res.status === 401) {
        setAccessGate("login");
        setSuggestions([]);
        return;
      }
      if (res.status === 403) {
        setAccessGate("subscribe");
        setSuggestions([]);
        return;
      }
      if (res.status === 400) {
        setSuggestions([]);
        setError(t("invalidPrefix"));
        return;
      }
      if (!res.ok) throw new Error("search failed");
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } catch {
      setSuggestions([]);
      setError(t("searchFailed"));
    } finally {
      setLoadingSuggest(false);
    }
  }, [t]);

  const debouncedSearch = useMemo(
    () =>
      debounceFn((prefix: string) => {
        void runSearch(prefix);
      }, 280),
    [runSearch]
  );

  useEffect(() => {
    debouncedSearch(q);
  }, [q, debouncedSearch]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  async function loadCoverage(ticker: string) {
    setLoadingCoverage(true);
    setError("");
    setAccessGate(null);
    setSuggestOpen(false);
    try {
      const res = await fetch(
        `/api/tickers/${encodeURIComponent(ticker)}/coverage`
      );
      if (res.status === 401) {
        setAccessGate("login");
        setCoverage(null);
        return;
      }
      if (res.status === 403) {
        setAccessGate("subscribe");
        setCoverage(null);
        return;
      }
      if (!res.ok) {
        if (res.status === 404) {
          setCoverage(null);
          setError(t("notFound"));
          return;
        }
        throw new Error("coverage");
      }
      const data = (await res.json()) as CoveragePayload;
      setCoverage(data);
    } catch {
      setCoverage(null);
      setError(t("coverageFailed"));
    } finally {
      setLoadingCoverage(false);
    }
  }

  function filterLabel(key: string): string {
    const m = key.match(/^is_(above|below)_sma(\d+)$/);
    if (m) {
      const period = Number(m[2]);
      return m[1] === "above"
        ? tScr("ma.aboveSMA", { period })
        : tScr("ma.belowSMA", { period });
    }
    const mapKeys: (keyof LegacyScreenerFilters)[] = [
      "pct_to_bb_upper_lte",
      "pct_to_bb_upper_gte",
      "pct_to_bb_lower_lte",
      "pct_to_bb_lower_gte",
      "atr_percent_lt",
      "atr_percent_gt",
      "atr_14_lt",
      "atr_14_gt",
      "close_gte",
      "close_lte",
      "up_sequence_count_gte",
      "down_sequence_count_gte",
      "up_sequence_break_bars_ago_lte",
      "down_sequence_break_bars_ago_lte",
      "down_sequence_broke_recently",
      "up_sequence_broke_recently",
      "down_sequence_broke_in_strong_up_context",
      "up_sequence_broke_in_strong_down_context",
      "buy_signal",
      "sell_signal",
      "strong_buy_signal",
      "strong_sell_signal",
      "bullish_sequence_active",
      "bearish_sequence_active",
      "strong_up_sequence_context",
      "strong_down_sequence_context",
    ];
    if (mapKeys.includes(key as keyof LegacyScreenerFilters)) {
      return lookupMsg.filterLabels[key] ?? key.replace(/_/g, " ");
    }
    return key;
  }

  function indicatorLabel(id: string): string {
    return lookupMsg.indicators[id] ?? id;
  }

  function reasonText(entry: CoverageEntry): string | null {
    if (!entry.reasonKey) return null;
    const template = lookupMsg.reason[entry.reasonKey];
    return formatReason(template, entry.reasonParams) || null;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text">{t("title")}</h1>
        <p className="mt-1 text-sm text-text-muted max-w-2xl">{t("subtitle")}</p>
      </div>

      {accessGate ? (
        <PremiumGate kind={accessGate === "login" ? "login" : "subscribe"} />
      ) : (
      <>
      <div ref={wrapRef} className="relative space-y-2">
        <label htmlFor={`${listId}-input`} className="text-sm font-bold text-text">
          {t("searchLabel")}
        </label>
        <Input
          id={`${listId}-input`}
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={t("placeholder")}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSuggestOpen(true);
          }}
          onFocus={() => setSuggestOpen(true)}
          aria-autocomplete="list"
          aria-controls={suggestOpen ? `${listId}-listbox` : undefined}
          aria-expanded={suggestOpen}
        />
        {suggestOpen && (q.trim().length > 0 || suggestions.length > 0) && (
          <ul
            id={`${listId}-listbox`}
            role="listbox"
            className="absolute z-30 mt-1 w-full max-h-64 overflow-auto rounded-xl border border-border bg-surface-raised shadow-lg py-1"
          >
            {loadingSuggest && (
              <li className="px-4 py-3 text-sm text-text-muted">{t("loadingSuggest")}</li>
            )}
            {!loadingSuggest && suggestions.length === 0 && q.trim().length > 0 && (
              <li className="px-4 py-3 text-sm text-text-muted">{t("noSuggestions")}</li>
            )}
            {suggestions.map((s) => (
              <li key={s.ticker} role="option">
                <button
                  type="button"
                  className="w-full text-start px-4 py-2.5 text-sm hover:bg-surface-alt flex justify-between gap-3"
                  onClick={() => {
                    setQ(s.ticker);
                    void loadCoverage(s.ticker);
                  }}
                >
                  <span className="font-bold text-primary">{s.ticker}</span>
                  <span className="text-text-muted text-xs shrink-0">
                    {s.market ?? "—"} · {Number(s.close).toFixed(2)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {loadingCoverage && (
        <p className="text-sm text-text-muted">{t("loadingCoverage")}</p>
      )}

      {coverage && !loadingCoverage && (
        <div className="space-y-8">
          <div className="rounded-2xl border border-border bg-surface-raised p-5 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{coverage.ticker}</h2>
                <p className="text-xs text-text-muted mt-1">
                  {t("meta", {
                    market: coverage.market,
                    bars: coverage.barCount,
                    date: coverage.snapshot.last_trade_date,
                  })}
                </p>
              </div>
              <Link
                href={`/ticker/${encodeURIComponent(coverage.ticker)}`}
                className="text-sm font-bold text-primary hover:underline"
              >
                {t("openTickerPage")}
              </Link>
            </div>
            <p className="mt-3 text-lg font-bold tabular-nums">
              ${Number(coverage.snapshot.close).toFixed(2)}
            </p>
          </div>

          <section>
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">
              {t("indicatorsSection")}
            </h3>
            <div className="rounded-2xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-alt border-b border-border text-start">
                    <th className="px-4 py-2.5 text-xs font-bold text-text-muted">{t("colIndicator")}</th>
                    <th className="px-4 py-2.5 text-xs font-bold text-text-muted w-28">{t("colSupported")}</th>
                    <th className="px-4 py-2.5 text-xs font-bold text-text-muted">{t("colNotes")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {coverage.indicators.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-2 font-mono text-xs">{indicatorLabel(row.id)}</td>
                      <td className="px-4 py-2">
                        <span
                          className={clsx(
                            "inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold",
                            row.supported
                              ? "bg-success-soft text-success"
                              : "bg-surface-alt text-text-muted"
                          )}
                        >
                          {row.supported ? t("yes") : t("no")}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-text-secondary">
                        {reasonText(row) ?? (row.supported ? "—" : "")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">
              {t("filtersSection")}
            </h3>
            <p className="text-xs text-text-muted mb-3">{t("filtersHint")}</p>
            <div className="rounded-2xl border border-border overflow-hidden max-h-[480px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-surface-alt border-b border-border text-start">
                    <th className="px-4 py-2.5 text-xs font-bold text-text-muted">{t("colFilter")}</th>
                    <th className="px-4 py-2.5 text-xs font-bold text-text-muted w-28">{t("colSupported")}</th>
                    <th className="px-4 py-2.5 text-xs font-bold text-text-muted">{t("colNotes")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {coverage.screenerFilters.map((row) => (
                    <tr key={row.filterKey}>
                      <td className="px-4 py-2 text-xs">{filterLabel(row.filterKey)}</td>
                      <td className="px-4 py-2">
                        <span
                          className={clsx(
                            "inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold",
                            row.supported
                              ? "bg-success-soft text-success"
                              : "bg-surface-alt text-text-muted"
                          )}
                        >
                          {row.supported ? t("yes") : t("no")}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-text-secondary">
                        {reasonText(row) ?? (row.supported ? "—" : "")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
      </>
      )}
    </div>
  );
}

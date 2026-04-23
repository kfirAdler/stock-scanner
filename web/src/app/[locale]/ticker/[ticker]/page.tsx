"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { clsx } from "clsx";
import { TickerChartPanel } from "./TickerChartPanel";
import type { SnapshotRow } from "@/lib/screener-types";

interface BarRow {
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export default function TickerDetailPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const t = useTranslations();
  const [snapshot, setSnapshot] = useState<SnapshotRow | null>(null);
  const [bars, setBars] = useState<BarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/tickers/${ticker}`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        setSnapshot(data.snapshot);
        setBars((data.recentBars ?? []).reverse());
      } catch {
        setError(t("common.error"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [ticker, t]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin h-8 w-8 border-[3px] border-primary/30 border-t-primary rounded-full" role="status" />
          <span className="text-sm text-text-muted">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center space-y-4">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-7 h-7 text-danger">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="text-text-secondary">{error || "Ticker not found"}</p>
        <Link href="/screener" className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-bold">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 rtl:rotate-180">
            <path fillRule="evenodd" d="M12 8a.75.75 0 01-.75.75H5.81l2.72 2.72a.75.75 0 11-1.06 1.06l-4-4a.75.75 0 010-1.06l4-4a.75.75 0 011.06 1.06L5.81 7.25h5.44A.75.75 0 0112 8z" clipRule="evenodd" />
          </svg>
          {t("nav.screener")}
        </Link>
      </div>
    );
  }

  const fmt = (v: number | null, d = 2) =>
    v === null || v === undefined ? "—" : v.toFixed(d);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-6">
      {/* Breadcrumb + Title */}
      <div>
        <Link href="/screener" className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors font-bold">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 rtl:rotate-180">
            <path fillRule="evenodd" d="M12 8a.75.75 0 01-.75.75H5.81l2.72 2.72a.75.75 0 11-1.06 1.06l-4-4a.75.75 0 010-1.06l4-4a.75.75 0 011.06 1.06L5.81 7.25h5.44A.75.75 0 0112 8z" clipRule="evenodd" />
          </svg>
          {t("nav.screener")}
        </Link>
        <div className="flex items-baseline gap-4 mt-2">
          <h1 className="text-3xl font-bold">{ticker.toUpperCase()}</h1>
          <span className="text-2xl font-bold tabular-nums">${fmt(snapshot.close)}</span>
        </div>
        <p className="text-xs text-text-muted mt-1">
          Last trade: {snapshot.last_trade_date}
        </p>
      </div>

      <Suspense
        fallback={
          <div
            className="flex items-center justify-center rounded-2xl border border-border bg-surface-alt"
            style={{ height: 560 }}
          >
            <span className="text-sm text-text-muted">{t("common.loading")}</span>
          </div>
        }
      >
        <TickerChartPanel ticker={String(ticker).toUpperCase()} bars={bars} />
      </Suspense>

      {/* Indicators Grid */}
      <section>
        <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">
          {t("ticker.indicators")}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatCard label="SMA 20" value={fmt(snapshot.sma_20)} relation={snapshot.is_above_sma20 ? "above" : snapshot.is_below_sma20 ? "below" : undefined} />
          <StatCard label="SMA 50" value={fmt(snapshot.sma_50)} relation={snapshot.is_above_sma50 ? "above" : snapshot.is_below_sma50 ? "below" : undefined} />
          <StatCard label="SMA 150" value={fmt(snapshot.sma_150)} relation={snapshot.is_above_sma150 ? "above" : snapshot.is_below_sma150 ? "below" : undefined} />
          <StatCard label="SMA 200" value={fmt(snapshot.sma_200)} relation={snapshot.is_above_sma200 ? "above" : snapshot.is_below_sma200 ? "below" : undefined} />
          <StatCard label="EMA 20" value={fmt(snapshot.ema_20)} />
          <StatCard label="ATR (14)" value={fmt(snapshot.atr_14)} />
          <StatCard label="ATR %" value={`${fmt(snapshot.atr_percent)}%`} />
          <StatCard label="BB Upper" value={fmt(snapshot.bb_upper_20_2)} />
          <StatCard label="BB Lower" value={fmt(snapshot.bb_lower_20_2)} />
          <StatCard label="% to BB Upper" value={`${fmt(snapshot.pct_to_bb_upper)}%`} />
          <StatCard label="% to BB Lower" value={`${fmt(snapshot.pct_to_bb_lower)}%`} />
          <StatCard
            label="Sequence"
            value={
              snapshot.buy_signal ? "BUY Signal" :
              snapshot.sell_signal ? "SELL Signal" :
              snapshot.bullish_sequence_active ? `Bullish (${snapshot.up_sequence_count})` :
              snapshot.bearish_sequence_active ? `Bearish (${snapshot.down_sequence_count})` :
              "Neutral"
            }
            signal={
              snapshot.buy_signal || snapshot.strong_buy_signal ? "buy" :
              snapshot.sell_signal || snapshot.strong_sell_signal ? "sell" :
              undefined
            }
          />
        </div>
      </section>

      {/* Recent Bars Table */}
      <section>
        <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">
          {t("ticker.recentBars")}
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-border shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-alt">
                <th scope="col" className="px-4 py-2.5 text-start text-xs font-bold text-text-muted">{t("ticker.date")}</th>
                <th scope="col" className="px-3 py-2.5 text-end text-xs font-bold text-text-muted">{t("ticker.open")}</th>
                <th scope="col" className="px-3 py-2.5 text-end text-xs font-bold text-text-muted">{t("ticker.high")}</th>
                <th scope="col" className="px-3 py-2.5 text-end text-xs font-bold text-text-muted">{t("ticker.low")}</th>
                <th scope="col" className="px-3 py-2.5 text-end text-xs font-bold text-text-muted">{t("ticker.close")}</th>
                <th scope="col" className="px-3 py-2.5 text-end text-xs font-bold text-text-muted">{t("ticker.volume")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bars.slice(-30).reverse().map((bar) => {
                const isUp = Number(bar.close) >= Number(bar.open);
                return (
                  <tr key={bar.trade_date} className="hover:bg-surface-alt/50 transition-colors">
                    <td className="px-4 py-2 text-xs text-text-secondary">{bar.trade_date}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{Number(bar.open).toFixed(2)}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{Number(bar.high).toFixed(2)}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{Number(bar.low).toFixed(2)}</td>
                    <td className={clsx("px-3 py-2 text-end tabular-nums font-bold", isUp ? "text-success" : "text-danger")}>
                      {Number(bar.close).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums text-text-secondary">{Number(bar.volume).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, relation, signal }: {
  label: string;
  value: string;
  relation?: "above" | "below";
  signal?: "buy" | "sell";
}) {
  return (
    <div className={clsx(
      "rounded-xl border p-3.5 transition-colors",
      signal === "buy" ? "border-success/30 bg-success-soft" :
      signal === "sell" ? "border-danger/30 bg-danger-soft" :
      "border-border bg-surface-raised"
    )}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{label}</p>
        {relation && (
          <span className={clsx(
            "text-[9px] font-bold px-1.5 py-0.5 rounded",
            relation === "above" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
          )}>
            {relation === "above" ? "ABOVE" : "BELOW"}
          </span>
        )}
      </div>
      <p className={clsx(
        "text-sm font-bold tabular-nums mt-1",
        signal === "buy" ? "text-success" :
        signal === "sell" ? "text-danger" :
        "text-text"
      )}>
        {value}
      </p>
    </div>
  );
}

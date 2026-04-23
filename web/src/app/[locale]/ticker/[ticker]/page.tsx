"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
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
        setBars(data.recentBars ?? []);
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
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" role="status">
          <span className="sr-only">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <p className="text-text-secondary">{error || "Ticker not found"}</p>
        <Link href="/screener" className="text-primary hover:underline mt-4 inline-block">
          ← {t("nav.screener")}
        </Link>
      </div>
    );
  }

  const fmt = (v: number | null, d = 2) =>
    v === null || v === undefined ? "—" : v.toFixed(d);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-8">
      <div>
        <Link href="/screener" className="text-sm text-primary hover:underline">
          ← {t("nav.screener")}
        </Link>
        <h1 className="text-3xl font-bold mt-2">{ticker.toUpperCase()}</h1>
        <p className="text-text-secondary text-sm">
          Last trade: {snapshot.last_trade_date} · Close: {fmt(snapshot.close)}
        </p>
      </div>

      <section>
        <h2 className="text-lg font-bold mb-3">{t("ticker.indicators")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          <Stat label="SMA 20" value={fmt(snapshot.sma_20)} />
          <Stat label="SMA 50" value={fmt(snapshot.sma_50)} />
          <Stat label="SMA 150" value={fmt(snapshot.sma_150)} />
          <Stat label="SMA 200" value={fmt(snapshot.sma_200)} />
          <Stat label="EMA 20" value={fmt(snapshot.ema_20)} />
          <Stat label="ATR 14" value={fmt(snapshot.atr_14)} />
          <Stat label="ATR %" value={fmt(snapshot.atr_percent)} />
          <Stat label="BB Upper" value={fmt(snapshot.bb_upper_20_2)} />
          <Stat label="BB Lower" value={fmt(snapshot.bb_lower_20_2)} />
          <Stat label="% to BB Upper" value={fmt(snapshot.pct_to_bb_upper)} />
          <Stat label="% to BB Lower" value={fmt(snapshot.pct_to_bb_lower)} />
          <Stat
            label="Sequence"
            value={
              snapshot.bullish_sequence_active
                ? `Bull ${snapshot.up_sequence_count}`
                : snapshot.bearish_sequence_active
                ? `Bear ${snapshot.down_sequence_count}`
                : "—"
            }
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">{t("ticker.recentBars")}</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-alt text-text-secondary">
                <th scope="col" className="px-3 py-2 text-start font-bold">{t("ticker.date")}</th>
                <th scope="col" className="px-3 py-2 text-end font-bold">{t("ticker.open")}</th>
                <th scope="col" className="px-3 py-2 text-end font-bold">{t("ticker.high")}</th>
                <th scope="col" className="px-3 py-2 text-end font-bold">{t("ticker.low")}</th>
                <th scope="col" className="px-3 py-2 text-end font-bold">{t("ticker.close")}</th>
                <th scope="col" className="px-3 py-2 text-end font-bold">{t("ticker.volume")}</th>
              </tr>
            </thead>
            <tbody>
              {bars.map((bar) => (
                <tr key={bar.trade_date} className="border-b border-border last:border-0 hover:bg-surface-alt">
                  <td className="px-3 py-2">{bar.trade_date}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{Number(bar.open).toFixed(2)}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{Number(bar.high).toFixed(2)}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{Number(bar.low).toFixed(2)}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{Number(bar.close).toFixed(2)}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{Number(bar.volume).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-alt p-3">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="text-sm font-bold tabular-nums mt-1">{value}</p>
    </div>
  );
}

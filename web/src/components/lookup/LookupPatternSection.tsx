"use client";

import { useId, useMemo, useState } from "react";
import { CandlestickChart } from "@/components/chart/CandlestickChart";
import { Link } from "@/i18n/navigation";
import type { LookupCoveragePayload } from "./types";

const NO_SMA: number[] = [];

export function LookupPatternSection({
  coverage,
  t,
}: {
  coverage: LookupCoveragePayload;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const previewId = useId();
  const { matches, peers, asOf } = coverage.patterns;
  const primary = matches[0];
  const previewMatch = previewIndex === null ? null : matches[previewIndex];
  const orderedBars = useMemo(
    () => [...coverage.recentBars].sort((a, b) => a.trade_date.localeCompare(b.trade_date)),
    [coverage.recentBars]
  );
  const formatPrice = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

  return (
    <section className="ui-panel rounded-[24px] px-5 py-5 md:px-6" aria-label={t("workspace.patternSectionTitle")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-neon">{t("workspace.patternSectionKicker")}</p>
          <h2 className="mt-1 text-xl font-bold text-text">{t("workspace.patternSectionTitle")}</h2>
          <p className="mt-1 text-sm text-text-secondary">{t("workspace.patternSectionSub")}</p>
        </div>
        {asOf && <span className="text-xs text-text-muted">{t("workspace.patternAsOf", { date: asOf })}</span>}
      </div>

      {!primary ? (
        <div className="mt-5 rounded-2xl bg-surface-alt/70 px-4 py-5 ring-1 ring-border/80">
          <p className="font-semibold text-text">{t("workspace.noPattern")}</p>
          <p className="mt-1 text-sm text-text-secondary">{t("workspace.noPatternSub")}</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.9fr)]">
          <div className="rounded-2xl bg-surface-alt/70 p-4 ring-1 ring-border/80">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-text">{t(`patternNames.${primary.pattern}`)}</p>
                {primary.pattern === "channel" && primary.channelDirection &&
                  <p className="text-sm text-text-secondary">{t(`channelDirections.${primary.channelDirection}`)}</p>}
              </div>
              <span className="rounded-xl bg-primary-soft px-3 py-1.5 text-sm font-bold tabular-nums text-primary ring-1 ring-primary/15">
                {t("workspace.patternFit", { percent: Math.round(primary.confidence * 100) })}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-text-muted">{t("workspace.patternBreakout")}</p><p className="mt-1 font-bold tabular-nums text-text" dir="ltr">{formatPrice(primary.breakoutLevel)}</p></div>
              <div><p className="text-text-muted">{t("workspace.patternInvalidation")}</p><p className="mt-1 font-bold tabular-nums text-text" dir="ltr">{formatPrice(primary.invalidationLevel)}</p></div>
            </div>
            <button type="button" aria-expanded={previewIndex !== null} aria-controls={previewId}
              onClick={() => setPreviewIndex((current) => current === null ? 0 : null)}
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary-soft px-3.5 py-2 text-sm font-semibold text-primary ring-1 ring-primary/20 transition-colors hover:ring-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              {t(previewIndex === null ? "workspace.patternPreviewShow" : "workspace.patternPreviewHide")}
              <span aria-hidden="true" className={`text-lg leading-none transition-transform ${previewIndex === null ? "" : "rotate-180"}`}>⌄</span>
            </button>
            {matches.length > 1 && <div className="mt-4 flex flex-wrap gap-2">{matches.slice(1).map((match) => (
              <span key={`${match.pattern}-${match.channelDirection ?? ""}`} className="rounded-full bg-surface-elevated px-2.5 py-1 text-xs text-text-secondary ring-1 ring-border">
                {t(`patternNames.${match.pattern}`)} · {Math.round(match.confidence * 100)}%
              </span>
            ))}</div>}
          </div>
          <div className="rounded-2xl bg-surface-alt/70 p-4 ring-1 ring-border/80">
            <p className="font-bold text-text">{t("workspace.patternPeers")}</p>
            <p className="mt-1 text-xs leading-5 text-text-secondary">{t("workspace.patternPeersSub")}</p>
            {peers.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {peers.map((peer) => (
                  <Link key={peer.ticker} href={`/stock-lookup?ticker=${encodeURIComponent(peer.ticker)}`}
                    title={peer.companyName ?? peer.ticker}
                    className="rounded-xl bg-surface-elevated px-3 py-2 text-sm font-semibold text-text ring-1 ring-border transition-colors hover:text-primary hover:ring-primary/40">
                    <span dir="ltr">{peer.ticker}</span> <span className="text-text-muted">{Math.round(peer.confidence * 100)}%</span>
                  </Link>
                ))}
              </div>
            ) : <p className="mt-4 text-sm text-text-muted">{t("workspace.noPatternPeers")}</p>}
          </div>
          <div id={previewId} hidden={!previewMatch}
            className="min-w-0 rounded-2xl bg-surface-alt/70 p-3 ring-1 ring-border/80 lg:col-span-2 md:p-4">
            {previewMatch && <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-text">{t("workspace.patternPreviewTitle")}</h3>
                  <p className="text-xs text-text-secondary">{t("workspace.patternPreviewHint")}</p>
                </div>
                {matches.length > 1 && <div role="group" className="flex flex-wrap gap-2" aria-label={t("workspace.patternPreviewSelect")}>
                  {matches.map((match, index) => (
                    <button key={`${match.pattern}-${match.channelDirection ?? ""}`} type="button"
                      aria-pressed={previewIndex === index} onClick={() => setPreviewIndex(index)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-colors ${previewIndex === index
                        ? "bg-primary-soft text-primary ring-primary/30" : "bg-surface-elevated text-text-secondary ring-border hover:text-text"}`}>
                      {t(`patternNames.${match.pattern}`)} · {Math.round(match.confidence * 100)}%
                    </button>
                  ))}
                </div>}
              </div>
              <CandlestickChart bars={orderedBars} height={320} smaPeriods={NO_SMA}
                patternLines={previewMatch.lines} />
            </>}
          </div>
        </div>
      )}
    </section>
  );
}

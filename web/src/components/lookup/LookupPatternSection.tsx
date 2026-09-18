"use client";

import { Link } from "@/i18n/navigation";
import type { LookupCoveragePayload } from "./types";

export function LookupPatternSection({
  coverage,
  t,
}: {
  coverage: LookupCoveragePayload;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const { matches, peers, asOf } = coverage.patterns;
  const primary = matches[0];
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
        </div>
      )}
    </section>
  );
}

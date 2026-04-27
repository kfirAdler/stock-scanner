"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { clsx } from "clsx";

type CardColor = "primary" | "accent" | "success" | "warning" | "danger";

type MarketMeta = {
  lastUpdated: string | null;
  snapshotCount: number;
};

const colorMap: Record<CardColor, string> = {
  primary: "bg-primary-soft text-primary",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function HomePageClient() {
  const t = useTranslations("marketing");
  const locale = useLocale();
  const [previewStep, setPreviewStep] = useState(0);
  const [marketMeta, setMarketMeta] = useState<MarketMeta | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPreviewStep((step) => (step + 1) % 6);
    }, 1600);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMeta() {
      try {
        const res = await fetch("/api/market-meta");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setMarketMeta({
            lastUpdated: data.lastUpdated ?? null,
            snapshotCount: data.snapshotCount ?? 0,
          });
        }
      } catch {
        // ignore
      }
    }

    void loadMeta();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = [
    { value: t("stats.speed.value"), label: t("stats.speed.label") },
    { value: t("stats.data.value"), label: t("stats.data.label") },
    { value: t("stats.refresh.value"), label: t("stats.refresh.label") },
    { value: t("stats.universe.value"), label: t("stats.universe.label") },
  ];

  const features = [
    { key: "ma", icon: <TrendIcon />, color: "primary" as const },
    { key: "bb", icon: <BandIcon />, color: "accent" as const },
    { key: "seq", icon: <SequenceIcon />, color: "success" as const },
    { key: "save", icon: <SaveIcon />, color: "warning" as const },
    { key: "alerts", icon: <AlertIcon />, color: "danger" as const },
    { key: "speed", icon: <SpeedIcon />, color: "primary" as const },
  ];

  const savedBullets = ["save", "rerun", "track", "premium"];

  const formattedUpdate = useMemo(() => {
    if (!marketMeta?.lastUpdated) return null;
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(marketMeta.lastUpdated));
    } catch {
      return null;
    }
  }, [locale, marketMeta?.lastUpdated]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="relative py-14 sm:py-20">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-80 opacity-55 dark:opacity-35"
          style={{
            background:
              "radial-gradient(620px 260px at 50% 0%, var(--color-primary-soft), transparent 72%)",
          }}
        />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface-raised/90 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary shadow-sm backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
            {t("badge")}
          </div>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-text sm:text-5xl md:text-6xl">
            {t("headline")}
          </h1>

          <p className="mx-auto mt-5 max-w-3xl text-base font-medium leading-relaxed text-text-secondary sm:text-lg">
            {t("lead")}
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/screener">
              <Button variant="primary" size="lg" className="min-w-[220px] w-full sm:w-auto">
                {t("ctaPrimary")}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="ms-1 h-5 w-5 rtl:rotate-180" aria-hidden>
                  <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                </svg>
              </Button>
            </Link>
            <Link href="/stock-lookup">
              <Button variant="secondary" size="lg" className="min-w-[200px] w-full sm:w-auto border-border-strong">
                {t("ctaSecondary")}
              </Button>
            </Link>
          </div>

          <p className="mt-4 text-sm text-text-muted">{t("microcopy")}</p>

          <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-border-strong/80 bg-surface-raised/80 px-4 py-4 text-start shadow-sm backdrop-blur-sm"
              >
                <strong className="block text-lg font-bold text-text sm:text-xl">
                  {stat.value}
                </strong>
                <span className="mt-1 block text-xs font-medium text-text-secondary sm:text-sm">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-10 sm:pb-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-primary">
            {t("preview.eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-text sm:text-4xl">
            {t("preview.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-text-secondary">
            {t("preview.body")}
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-6xl rounded-[28px] border border-border-strong/80 bg-surface-raised p-3 shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
          <div className="overflow-hidden rounded-[22px] border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border bg-surface-alt/80 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
              </div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">
                {t("preview.windowTitle")}
              </div>
              <div className="text-xs text-text-secondary">
                {marketMeta?.snapshotCount
                  ? t("preview.snapshotCount", { count: marketMeta.snapshotCount })
                  : t("preview.snapshotFallback")}
              </div>
            </div>

            <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="border-b border-border p-5 lg:border-b-0 lg:border-e">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">
                      {t("preview.filtersLabel")}
                    </p>
                    <h3 className="mt-2 text-xl font-bold text-text">
                      {t("preview.filtersTitle")}
                    </h3>
                  </div>
                  <div className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
                    {t("preview.strategyBadge")}
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {[
                    { key: "sma20", activeAt: 1 },
                    { key: "sma50", activeAt: 2 },
                    { key: "bb", activeAt: 3 },
                    { key: "signal", activeAt: 4 },
                  ].map((item) => {
                    const active = previewStep >= item.activeAt;
                    return (
                      <div
                        key={item.key}
                        className={clsx(
                          "rounded-2xl border px-4 py-3 transition-all duration-500",
                          active
                            ? "border-primary/35 bg-primary-soft/70 shadow-sm"
                            : "border-border bg-surface-raised"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-bold text-text">
                            {t(`preview.filters.${item.key}`)}
                          </span>
                          <span
                            className={clsx(
                              "h-5 w-5 rounded-md border transition-colors",
                              active
                                ? "border-primary bg-primary"
                                : "border-border-strong bg-surface"
                            )}
                          >
                            {active && (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="white" className="h-5 w-5">
                                <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.414 0l-3.25-3.25a1 1 0 011.414-1.42l2.543 2.544 6.543-6.544a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-2xl border border-border bg-surface-alt/70 p-4">
                  <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
                    <span>{t("preview.scanProgress")}</span>
                    <span>{previewStep >= 5 ? t("preview.scanDone") : t("preview.scanPreparing")}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-raised">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary-hover transition-all duration-700"
                      style={{ width: `${Math.min((previewStep + 1) * 18, 100)}%` }}
                    />
                  </div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Button
                      size="sm"
                      className={clsx(
                        "min-w-[160px]",
                        previewStep >= 4 && "shadow-[0_0_0_6px_rgba(30,64,175,0.08)]"
                      )}
                    >
                      {t("preview.runScan")}
                    </Button>
                    <div className="text-xs text-text-secondary">
                      {t("preview.scanHint")}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-surface-raised p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">
                      {t("preview.resultsLabel")}
                    </p>
                    <h3 className="mt-2 text-xl font-bold text-text">
                      {t("preview.resultsTitle")}
                    </h3>
                  </div>
                  <div className="rounded-full border border-success/30 bg-success-soft px-3 py-1 text-xs font-bold text-success">
                    {t("preview.fastTag")}
                  </div>
                </div>

                <div className="mt-6 overflow-hidden rounded-2xl border border-border shadow-sm">
                  <div className="grid grid-cols-[1.1fr_0.95fr_0.7fr_0.7fr_0.8fr] gap-2 border-b border-border bg-surface-alt px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-text-muted">
                    <span>{t("preview.table.ticker")}</span>
                    <span className="text-end">{t("preview.table.close")}</span>
                    <span className="text-center market-inline-ltr">{t("preview.table.sma20")}</span>
                    <span className="text-center market-inline-ltr">{t("preview.table.sma50")}</span>
                    <span>{t("preview.table.sequence")}</span>
                  </div>
                  <div className="divide-y divide-border bg-surface text-sm">
                    {[
                      {
                        ticker: "AAPL",
                        close: "214.42",
                        sma20: "up",
                        sma50: "up",
                        sequence: { label: t("preview.rows.aapl"), tone: "buy" as const },
                        activeAt: 3,
                      },
                      {
                        ticker: "AMD",
                        close: "176.83",
                        sma20: "down",
                        sma50: "up",
                        sequence: { label: t("preview.rows.amd"), tone: "bull" as const },
                        activeAt: 4,
                      },
                      {
                        ticker: "MSFT",
                        close: "468.15",
                        sma20: "up",
                        sma50: "up",
                        sequence: { label: t("preview.rows.msft"), tone: "strong" as const },
                        activeAt: 5,
                      },
                    ].map((row) => {
                      const visible = previewStep >= row.activeAt;
                      return (
                        <div
                          key={row.ticker}
                          className={clsx(
                            "grid grid-cols-[1.1fr_0.95fr_0.7fr_0.7fr_0.8fr] items-center gap-2 px-4 py-3 transition-all duration-500",
                            visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-30"
                          )}
                        >
                          <span className="market-inline-ltr font-bold text-primary">{row.ticker}</span>
                          <span className="text-end font-bold tabular-nums text-text">
                            {row.close}
                          </span>
                          <span className="text-center">
                            <PreviewSmaPill direction={row.sma20} />
                          </span>
                          <span className="text-center">
                            <PreviewSmaPill direction={row.sma50} />
                          </span>
                          <span>
                            <PreviewSignalBadge
                              tone={row.sequence.tone}
                              label={row.sequence.label}
                            />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-border bg-surface-alt/70 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-text">{t("preview.savedScreenTitle")}</p>
                      <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                        {t("preview.savedScreenBody")}
                      </p>
                    </div>
                    <span
                      className={clsx(
                        "rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em]",
                        previewStep >= 5
                          ? "border-primary/25 bg-primary-soft text-primary"
                          : "border-border bg-surface text-text-muted"
                      )}
                    >
                      {previewStep >= 5 ? t("preview.savedScreenDone") : t("preview.savedScreenPending")}
                    </span>
                  </div>
                </div>

                {formattedUpdate && (
                  <p className="mt-4 text-xs text-text-muted">
                    {t("updatedAt", { date: formattedUpdate })}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-10 sm:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-primary">
            {t("features.eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-text sm:text-4xl">
            {t("features.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-text-secondary">
            {t("features.body")}
          </p>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard
              key={feature.key}
              icon={feature.icon}
              color={feature.color}
              title={t(`features.cards.${feature.key}.title`)}
              description={t(`features.cards.${feature.key}.desc`)}
            />
          ))}
        </div>
      </section>

      <section id="saved-screens" className="py-10 sm:py-16">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-stretch">
          <div className="rounded-[28px] border border-border-strong/80 bg-surface-raised p-8 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-primary">
              {t("saved.eyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-text sm:text-4xl">
              {t("saved.title")}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-secondary">
              {t("saved.body")}
            </p>

            <ul className="mt-6 space-y-3 text-sm text-text-secondary">
              {savedBullets.map((key) => (
                <li key={key} className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary-soft text-primary">
                    <CheckIcon />
                  </span>
                  <span>{t(`saved.bullets.${key}`)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[28px] border border-border-strong/80 bg-[linear-gradient(180deg,rgba(219,234,254,0.85),rgba(255,255,255,0.95))] p-8 shadow-[0_14px_40px_rgba(15,23,42,0.06)] dark:bg-[linear-gradient(180deg,rgba(30,58,95,0.9),rgba(17,28,46,0.98))]">
            <div className="inline-flex items-center rounded-full border border-warning/30 bg-warning-soft px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-warning">
              {t("saved.comingSoon")}
            </div>
            <div className="mt-6 rounded-3xl border border-border bg-surface-raised p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                  {t("saved.mock.label")}
                </span>
                <span className="text-xs font-medium text-text-muted">
                  {t("saved.mock.time")}
                </span>
              </div>
              <strong className="mt-4 block text-lg text-text">
                {t("saved.mock.title")}
              </strong>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                {t("saved.mock.body")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-16 pt-10 sm:pb-24 sm:pt-16">
        <div className="rounded-[32px] border border-border-strong/70 bg-[linear-gradient(135deg,rgba(30,64,175,0.10),rgba(255,255,255,0.96))] px-6 py-10 shadow-[0_24px_70px_rgba(15,23,42,0.10)] dark:bg-[linear-gradient(135deg,rgba(30,58,95,0.9),rgba(17,28,46,0.98))] sm:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">
              {t("finalCta.title")}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-text-secondary">
              {t("finalCta.body")}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/screener">
                <Button variant="primary" size="lg" className="min-w-[220px] w-full sm:w-auto">
                  {t("finalCta.primary")}
                </Button>
              </Link>
              <Link href="/stock-lookup">
                <Button variant="secondary" size="lg" className="min-w-[200px] w-full sm:w-auto">
                  {t("finalCta.secondary")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  color,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  color: CardColor;
}) {
  return (
    <div className="group relative rounded-[24px] border border-border-strong/70 bg-surface-raised/90 p-6 shadow-[0_14px_40px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-black/5 dark:ring-white/10 ${colorMap[color]}`}>
        {icon}
      </div>
      <h3 className="mt-4 font-bold tracking-tight text-text">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-text-secondary">{description}</p>
    </div>
  );
}

function TrendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M12.577 4.878a.75.75 0 01.919-.53l4.78 1.281a.75.75 0 01.531.919l-1.281 4.78a.75.75 0 01-1.449-.387l.81-3.022a19.407 19.407 0 00-5.594 5.203.75.75 0 01-1.139.093L7 10.06l-4.72 4.72a.75.75 0 01-1.06-1.061l5.25-5.25a.75.75 0 011.06 0l3.074 3.073a20.923 20.923 0 015.545-4.931l-3.042.815a.75.75 0 01-.53-.919z" clipRule="evenodd" />
    </svg>
  );
}

function BandIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0016.5 2h-1zM9.5 6A1.5 1.5 0 008 7.5v9A1.5 1.5 0 009.5 18h1a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0010.5 6h-1zM3.5 10A1.5 1.5 0 002 11.5v5A1.5 1.5 0 003.5 18h1A1.5 1.5 0 006 16.5v-5A1.5 1.5 0 004.5 10h-1z" />
    </svg>
  );
}

function SequenceIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 002 4.25v2.5A2.25 2.25 0 004.25 9h2.5A2.25 2.25 0 009 6.75v-2.5A2.25 2.25 0 006.75 2h-2.5zm0 9A2.25 2.25 0 002 13.25v2.5A2.25 2.25 0 004.25 18h2.5A2.25 2.25 0 009 15.75v-2.5A2.25 2.25 0 006.75 11h-2.5zm9-9A2.25 2.25 0 0011 4.25v2.5A2.25 2.25 0 0013.25 9h2.5A2.25 2.25 0 0018 6.75v-2.5A2.25 2.25 0 0015.75 2h-2.5zm0 9A2.25 2.25 0 0011 13.25v2.5A2.25 2.25 0 0013.25 18h2.5A2.25 2.25 0 0018 15.75v-2.5A2.25 2.25 0 0015.75 11h-2.5z" clipRule="evenodd" />
    </svg>
  );
}

function SpeedIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
      <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1.586A2 2 0 015.414 9L4.707 9.707A1 1 0 005.414 11h9.172a1 1 0 00.707-1.707L14.586 9A2 2 0 0114 7.586V6a4 4 0 00-4-4zm-2 12a2 2 0 104 0H8z" clipRule="evenodd" />
    </svg>
  );
}

function PreviewSmaPill({ direction }: { direction: "up" | "down" }) {
  if (direction === "up") {
    return (
      <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold bg-success-soft text-success">
        ↑
      </span>
    );
  }

  return (
    <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold bg-danger-soft text-danger">
      ↓
    </span>
  );
}

function PreviewSignalBadge({
  tone,
  label,
}: {
  tone: "buy" | "bull" | "strong";
  label: string;
}) {
  if (tone === "strong") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold text-success">
        ▲▲ {label}
      </span>
    );
  }

  if (tone === "buy") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold text-success">
        ▲ {label}
      </span>
    );
  }

  return <span className="text-[10px] font-bold text-success">{label}</span>;
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.414 0l-3.25-3.25a1 1 0 011.414-1.42l2.543 2.544 6.543-6.544a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { CandlestickLoader } from "@/components/ui/CandlestickLoader";

type NewsItem = {
  title: string;
  source: string | null;
  url: string;
  publishedAt: string | null;
};

type NewsPayload = { company: NewsItem[]; sector: NewsItem[] };

function NewsColumn({
  title,
  subtitle,
  items,
  empty,
  locale,
}: {
  title: string;
  subtitle: string;
  items: NewsItem[];
  empty: string;
  locale: string;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-3">
        <h3 className="text-base font-bold text-text">{title}</h3>
        <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>
      </div>
      {items.length ? (
        <div className="divide-y divide-divider-soft">
          {items.map((item) => (
            <a
              key={`${item.url}-${item.title}`}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="group block py-3 first:pt-0"
            >
              <p className="text-sm font-semibold leading-5 text-text transition-colors group-hover:text-neon">
                {item.title}
              </p>
              <p className="mt-1 text-[11px] text-text-muted">
                {[item.source, item.publishedAt ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(item.publishedAt)) : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </a>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-surface-alt/70 px-4 py-5 text-sm text-text-muted">{empty}</p>
      )}
    </div>
  );
}

export function StockNewsPanel({
  ticker,
  company,
  sector,
  industry,
  market,
  t,
}: {
  ticker: string;
  company?: string | null;
  sector?: string | null;
  industry?: string | null;
  market: string;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const locale = useLocale();
  const [payload, setPayload] = useState<NewsPayload>({ company: [], sector: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ locale, market });
    if (company) query.set("company", company);
    if (sector) query.set("sector", sector);
    if (industry) query.set("industry", industry);
    fetch(`/api/tickers/${encodeURIComponent(ticker)}/news?${query}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("news")))
      .then((data: NewsPayload) => setPayload(data))
      .catch(() => {
        if (!controller.signal.aborted) setPayload({ company: [], sector: [] });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [company, industry, locale, market, sector, ticker]);

  return (
    <section className="ui-panel rounded-[24px] px-5 py-5 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neon">{t("news.kicker")}</p>
          <h2 className="mt-1 text-xl font-bold text-text">{t("news.title")}</h2>
          <p className="mt-1 text-sm text-text-secondary">{t("news.subtitle")}</p>
        </div>
        <span className="text-xs text-text-muted">{t("news.lastWeek")}</span>
      </div>
      {loading ? (
        <CandlestickLoader label={t("news.loading")} compact />
      ) : (
        <div className="mt-5 grid gap-6 lg:grid-cols-2 lg:divide-x lg:divide-divider-soft rtl:lg:divide-x-reverse">
          <div className="lg:pe-6">
            <NewsColumn
              title={t("news.companyTitle", { ticker })}
              subtitle={company || ticker}
              items={payload.company}
              empty={t("news.emptyCompany")}
              locale={locale}
            />
          </div>
          <div className="lg:ps-6">
            <NewsColumn
              title={t("news.sectorTitle")}
              subtitle={[sector, industry].filter(Boolean).join(" · ") || t("news.sectorFallback")}
              items={payload.sector}
              empty={t("news.emptySector")}
              locale={locale}
            />
          </div>
        </div>
      )}
    </section>
  );
}

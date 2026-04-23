import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { setRequestLocale } from "next-intl/server";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <DashboardContent />;
}

function DashboardContent() {
  const t = useTranslations();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {t("common.appName")}
        </h1>
        <p className="text-lg text-text-secondary max-w-2xl mx-auto">
          Screen S&P 500 stocks using precomputed technical indicators, sequence analysis, and volatility filters.
        </p>
        <div className="flex justify-center gap-4 pt-4">
          <Link
            href="/screener"
            className="inline-flex items-center rounded-lg bg-primary px-6 py-3 font-bold text-white hover:bg-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {t("nav.screener")}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 ms-2 rtl:rotate-180" aria-hidden="true">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          title="Moving Averages"
          description="Filter by SMA 20, 50, 150, 200 positions relative to current price."
        />
        <FeatureCard
          title="Bollinger Bands"
          description="Find stocks near upper or lower Bollinger Bands within a 2% threshold."
        />
        <FeatureCard
          title="Sequence Analysis"
          description="Detect sequence breaks, strong context patterns, and buy/sell signals."
        />
        <FeatureCard
          title="Volatility"
          description="Screen by ATR percentage to find high or low volatility stocks."
        />
        <FeatureCard
          title="Precomputed Data"
          description="All indicators are precomputed daily for instant query results."
        />
        <FeatureCard
          title="Save & Share"
          description="Save your favorite filter combinations for quick access."
        />
      </div>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 space-y-2">
      <h3 className="font-bold">{title}</h3>
      <p className="text-sm text-text-secondary">{description}</p>
    </div>
  );
}

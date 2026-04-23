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
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="py-16 sm:py-24 text-center space-y-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-xs font-bold text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          S&P 500 · Precomputed Daily
        </div>

        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl bg-gradient-to-br from-text to-text-secondary bg-clip-text">
          {t("common.appName")}
        </h1>

        <p className="text-lg text-text-secondary max-w-xl mx-auto leading-relaxed">
          Screen stocks using technical indicators, sequence analysis, and volatility filters — all precomputed for instant results.
        </p>

        <div className="flex justify-center gap-3 pt-2">
          <Link
            href="/screener"
            className="inline-flex items-center rounded-xl bg-primary px-7 py-3 font-bold text-white shadow-lg shadow-primary/25 hover:bg-primary-hover hover:shadow-primary/35 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {t("nav.screener")}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 ms-2 rtl:rotate-180" aria-hidden="true">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      </div>

      <div className="pb-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          icon={<TrendIcon />}
          title="Moving Averages"
          description="Filter by SMA 20, 50, 150, 200 positions relative to price."
          color="primary"
        />
        <FeatureCard
          icon={<BandIcon />}
          title="Bollinger Bands"
          description="Find stocks near upper or lower bands within 2% proximity."
          color="accent"
        />
        <FeatureCard
          icon={<SequenceIcon />}
          title="Sequence Analysis"
          description="Detect sequence breaks, strong context patterns, and signals."
          color="success"
        />
        <FeatureCard
          icon={<VolatilityIcon />}
          title="Volatility (ATR)"
          description="Screen by ATR% for high or low volatility stocks."
          color="warning"
        />
        <FeatureCard
          icon={<SpeedIcon />}
          title="Instant Results"
          description="All indicators precomputed daily — queries return in milliseconds."
          color="danger"
        />
        <FeatureCard
          icon={<SaveIcon />}
          title="Save Screens"
          description="Save your favorite filter combinations for quick reuse."
          color="primary"
        />
      </div>
    </div>
  );
}

type CardColor = "primary" | "accent" | "success" | "warning" | "danger";

const colorMap: Record<CardColor, string> = {
  primary: "bg-primary-soft text-primary",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

function FeatureCard({ icon, title, description, color }: { icon: React.ReactNode; title: string; description: string; color: CardColor }) {
  return (
    <div className="group rounded-2xl border border-border bg-surface-raised p-6 space-y-4 hover:border-border-strong hover:shadow-sm transition-all duration-200">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${colorMap[color]}`}>
        {icon}
      </div>
      <h3 className="font-bold text-text">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
    </div>
  );
}

function TrendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M12.577 4.878a.75.75 0 01.919-.53l4.78 1.281a.75.75 0 01.531.919l-1.281 4.78a.75.75 0 01-1.449-.387l.81-3.022a19.407 19.407 0 00-5.594 5.203.75.75 0 01-1.139.093L7 10.06l-4.72 4.72a.75.75 0 01-1.06-1.061l5.25-5.25a.75.75 0 011.06 0l3.074 3.073a20.923 20.923 0 015.545-4.931l-3.042.815a.75.75 0 01-.53-.919z" clipRule="evenodd" />
    </svg>
  );
}
function BandIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0016.5 2h-1zM9.5 6A1.5 1.5 0 008 7.5v9A1.5 1.5 0 009.5 18h1a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0010.5 6h-1zM3.5 10A1.5 1.5 0 002 11.5v5A1.5 1.5 0 003.5 18h1A1.5 1.5 0 006 16.5v-5A1.5 1.5 0 004.5 10h-1z" />
    </svg>
  );
}
function SequenceIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 002 4.25v2.5A2.25 2.25 0 004.25 9h2.5A2.25 2.25 0 009 6.75v-2.5A2.25 2.25 0 006.75 2h-2.5zm0 9A2.25 2.25 0 002 13.25v2.5A2.25 2.25 0 004.25 18h2.5A2.25 2.25 0 009 15.75v-2.5A2.25 2.25 0 006.75 11h-2.5zm9-9A2.25 2.25 0 0011 4.25v2.5A2.25 2.25 0 0013.25 9h2.5A2.25 2.25 0 0018 6.75v-2.5A2.25 2.25 0 0015.75 2h-2.5zm0 9A2.25 2.25 0 0011 13.25v2.5A2.25 2.25 0 0013.25 18h2.5A2.25 2.25 0 0018 15.75v-2.5A2.25 2.25 0 0015.75 11h-2.5z" clipRule="evenodd" />
    </svg>
  );
}
function VolatilityIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M11.983 1.907a.75.75 0 00-1.292-.657l-8.5 9.5A.75.75 0 002.75 12h6.572l-1.305 6.093a.75.75 0 001.292.657l8.5-9.5A.75.75 0 0017.25 8h-6.572l1.305-6.093z" />
    </svg>
  );
}
function SpeedIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
    </svg>
  );
}
function SaveIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
      <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
    </svg>
  );
}

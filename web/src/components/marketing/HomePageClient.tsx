"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";

type CardColor = "primary" | "accent" | "success" | "warning" | "danger";

const colorMap: Record<CardColor, string> = {
  primary: "bg-primary-soft text-primary",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function HomePageClient() {
  const t = useTranslations("marketing");
  const tNav = useTranslations("nav");

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="relative py-16 sm:py-24 text-center space-y-8">
        <div
          className="pointer-events-none absolute inset-x-0 -top-24 h-72 opacity-40 dark:opacity-30"
          style={{
            background:
              "radial-gradient(520px 220px at 50% 0%, var(--color-premium-glow), transparent 70%)",
          }}
        />

        <div className="relative inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface-raised/90 backdrop-blur-sm px-5 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-premium shadow-inner-premium">
          <span className="h-1.5 w-1.5 rounded-full bg-premium shadow-[0_0_12px_var(--color-premium)]" />
          {t("badge")}
        </div>

        <h1 className="relative text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-text">
          <span className="bg-gradient-to-br from-text via-text to-text-secondary bg-clip-text text-transparent">
            {t("headline")}
          </span>
        </h1>

        <p className="relative text-base sm:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed font-medium">
          {t("lead")}
        </p>

        <div className="relative flex flex-col sm:flex-row justify-center gap-3 pt-4">
          <Link href="/screener">
            <Button variant="lux" size="lg" className="w-full sm:w-auto min-w-[220px] shadow-premium">
              {tNav("screener")}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 ms-1 rtl:rotate-180" aria-hidden>
                <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
              </svg>
            </Button>
          </Link>
          <Link href="/stock-lookup">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto min-w-[200px] border-border-strong">
              {tNav("stockLookup")}
            </Button>
          </Link>
        </div>
      </div>

      <div className="pb-24 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard icon={<TrendIcon />} color="primary" title={t("features.ma.title")} description={t("features.ma.desc")} />
        <FeatureCard icon={<BandIcon />} color="accent" title={t("features.bb.title")} description={t("features.bb.desc")} />
        <FeatureCard icon={<SequenceIcon />} color="success" title={t("features.seq.title")} description={t("features.seq.desc")} />
        <FeatureCard icon={<VolatilityIcon />} color="warning" title={t("features.atr.title")} description={t("features.atr.desc")} />
        <FeatureCard icon={<SpeedIcon />} color="danger" title={t("features.speed.title")} description={t("features.speed.desc")} />
        <FeatureCard icon={<SaveIcon />} color="primary" title={t("features.save.title")} description={t("features.save.desc")} />
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: CardColor;
}) {
  return (
    <div className="group relative rounded-2xl border border-border bg-surface-raised/80 backdrop-blur-sm p-6 space-y-4 transition-all duration-300 hover:border-border-strong hover:shadow-premium hover:-translate-y-0.5">
      <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-black/5 dark:ring-white/10 ${colorMap[color]}`}>
        {icon}
      </div>
      <h3 className="font-bold text-text tracking-tight">{title}</h3>
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

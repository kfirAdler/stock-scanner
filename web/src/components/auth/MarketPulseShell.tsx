import type { ReactNode } from "react";
import { clsx } from "clsx";
import { Link } from "@/i18n/navigation";
import { MarketPulseBackground } from "./MarketPulseBackground";

export function MarketPulseShell({
  title,
  subtitle,
  brand,
  motto,
  homeLabel,
  wide = false,
  children,
}: {
  title: string;
  subtitle: string;
  brand: string;
  motto: string;
  homeLabel: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="market-auth-shell">
      <MarketPulseBackground />
      <div className="market-auth-vignette" aria-hidden="true" />
      <div className="market-auth-content">
        <section className={clsx("market-auth-card", wide && "market-auth-card-wide")}>
          <header className="text-center">
            <Link href="/" className="market-auth-logo" aria-label={homeLabel}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 16.5 8.1 11l3.3 3.1L20.5 5" />
                <path d="M15.5 5h5v5" />
              </svg>
            </Link>
            <p className="market-auth-brand">{brand}</p>
            <h1 className="market-auth-title">{title}</h1>
            <p className="market-auth-subtitle">{subtitle}</p>
          </header>

          <div className="mt-7">{children}</div>

          <div className="market-auth-motto">
            <span aria-hidden="true" />
            <p>{motto}</p>
            <span aria-hidden="true" />
          </div>
        </section>
      </div>
    </div>
  );
}

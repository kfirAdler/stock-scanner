"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";

type GateKind = "login" | "subscribe";

export function PremiumGate({ kind }: { kind: GateKind }) {
  const t = useTranslations("premium");

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border-strong bg-surface-raised shadow-lg ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
      <div
        className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-40"
        style={{
          background:
            "radial-gradient(720px 320px at 50% -30%, var(--color-primary-soft), transparent 58%)",
        }}
      />
      <div className="relative px-6 py-10 sm:px-10 sm:py-12 text-center space-y-5 max-w-lg mx-auto">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-border-strong bg-surface-alt text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden>
            <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3A5.25 5.25 0 0012 1.5zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
          {kind === "login" ? t("gateTitleLogin") : t("gateTitleSubscribe")}
        </h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          {kind === "login" ? t("gateBodyLogin") : t("gateBodySubscribe")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          {kind === "login" ? (
            <Link href="/auth/login">
              <Button variant="primary" size="lg" className="w-full sm:w-auto min-w-[200px]">
                {t("signIn")}
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/settings">
                <Button variant="primary" size="lg" className="w-full sm:w-auto min-w-[200px]">
                  {t("viewAccount")}
                </Button>
              </Link>
              {process.env.NEXT_PUBLIC_PREMIUM_CONTACT_EMAIL ? (
                <a href={`mailto:${process.env.NEXT_PUBLIC_PREMIUM_CONTACT_EMAIL}`}>
                  <Button variant="secondary" size="lg" className="w-full sm:w-auto min-w-[200px]">
                    {t("contactSales")}
                  </Button>
                </a>
              ) : null}
            </>
          )}
        </div>
        {process.env.NEXT_PUBLIC_PREMIUM_CONTACT_EMAIL && kind === "subscribe" && (
          <p className="text-xs text-text-muted pt-2">
            {t("emailLine", { email: process.env.NEXT_PUBLIC_PREMIUM_CONTACT_EMAIL })}
          </p>
        )}
      </div>
    </div>
  );
}

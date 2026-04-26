"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";

type ClientEntitlement = {
  loggedIn: boolean;
  requiresSubscription: boolean;
  tier: "free" | "premium" | "essential" | "demo";
  effectiveTier: "free" | "premium" | "essential" | "demo";
  status: "active" | "inactive" | "expired";
  expiresAt: string | null;
};

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tp = useTranslations("premium");
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [entitlement, setEntitlement] = useState<ClientEntitlement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    fetch("/api/me/entitlement")
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d.loggedIn === "boolean") {
          setEntitlement({
            loggedIn: d.loggedIn,
            requiresSubscription: !!d.requiresSubscription,
            tier: d.tier ?? "free",
            effectiveTier: d.effectiveTier ?? "free",
            status: d.status ?? "inactive",
            expiresAt: d.expiresAt ?? null,
          });
        }
      })
      .catch(() => setEntitlement(null));
  }, []);

  async function savePreferences(locale: string, themeVal: string) {
    setSaving(true);
    try {
      await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, theme: themeVal }),
      });
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) return null;

  const themes = [
    { value: "light", label: t("themeLight") },
    { value: "dark", label: t("themeDark") },
    { value: "system", label: t("themeSystem") },
  ];

  let planLabel = tp("planFree");
  if (entitlement?.tier === "premium") {
    planLabel = tp("planPremium");
  } else if (entitlement?.tier === "essential") {
    planLabel = tp("planEssential");
  } else if (entitlement?.tier === "demo") {
    planLabel =
      entitlement.status === "expired" ? tp("planDemoExpired") : tp("planDemo");
  }

  return (
    <div className="mx-auto max-w-xl space-y-8 px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>

      <section className="space-y-3 rounded-2xl border border-border-strong bg-surface-raised p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted">
          {t("membershipTitle")}
        </h2>
        {!entitlement ? (
          <p className="text-sm text-text-muted">{t("membershipLoading")}</p>
        ) : (
          <>
            <p className="text-sm font-bold text-text">
              {t("membershipPlanLabel")}:{" "}
              <span
                className={
                  entitlement.effectiveTier !== "free" ? "text-primary" : ""
                }
              >
                {planLabel}
              </span>
            </p>
            {entitlement.tier === "demo" && entitlement.expiresAt && (
              <p className="text-xs text-text-secondary">
                {tp("planExpiresOn", {
                  date: new Date(entitlement.expiresAt).toLocaleDateString(),
                })}
              </p>
            )}
            <p className="text-xs leading-relaxed text-text-secondary">
              {entitlement.requiresSubscription
                ? tp("planHintPaid")
                : tp("planHintOpen")}
            </p>
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">{t("theme")}</h2>
        <div className="flex gap-2">
          {themes.map((opt) => (
            <Button
              key={opt.value}
              variant={theme === opt.value ? "primary" : "secondary"}
              size="sm"
              onClick={() => {
                setTheme(opt.value);
                void savePreferences("en", opt.value);
              }}
              disabled={saving}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">{t("language")}</h2>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.replace("/settings", { locale: "en" })}
          >
            English
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.replace("/settings", { locale: "he" })}
          >
            עברית
          </Button>
        </div>
      </section>
    </div>
  );
}

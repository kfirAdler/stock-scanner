"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export default function TermsPage() {
  const t = useTranslations("terms");
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const sections = [
    "eligibility",
    "informationOnly",
    "noAdvice",
    "noLicense",
    "userResponsibility",
    "dataAvailability",
    "liability",
    "indemnity",
    "thirdParty",
    "noWarranty",
    "riskAcknowledgement",
    "changes",
    "governingLaw",
  ] as const;
  const visibleSections = sections.filter((section) =>
    t.has(`sections.${section}.title`)
  );

  async function handleAccept() {
    setSaving(true);
    try {
      const res = await fetch("/api/terms/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms_version: CURRENT_TERMS_VERSION }),
      });
      if (res.ok) {
        setDone(true);
        router.replace("/");
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-xs text-text-secondary">{t("version", { version: CURRENT_TERMS_VERSION })}</p>

      <div className="rounded-2xl border border-warning/30 bg-warning-soft/40 p-5 text-sm leading-relaxed text-text-secondary">
        <p className="font-bold text-text">{t("summaryTitle")}</p>
        <p className="mt-2">{t("summaryBody")}</p>
      </div>

      <div className="rounded-2xl border border-border bg-surface-alt p-6 space-y-6">
        <p className="text-sm leading-relaxed text-text-secondary">{t("intro")}</p>
        {visibleSections.map((section) => (
          <section key={section} className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted">
              {t(`sections.${section}.title`)}
            </h2>
            <p className="text-sm leading-relaxed text-text-secondary">
              {t(`sections.${section}.body`)}
            </p>
          </section>
        ))}
      </div>

      {!done ? (
        <div className="space-y-4">
          <Checkbox
            label={t("accept")}
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <Button onClick={handleAccept} disabled={!accepted} loading={saving}>
            {t("accept")}
          </Button>
        </div>
      ) : (
        <p className="text-success font-bold">{t("acceptedSuccess")}</p>
      )}
    </div>
  );
}

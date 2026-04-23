"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";

export default function TermsPage() {
  const t = useTranslations("terms");
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleAccept() {
    setSaving(true);
    try {
      const res = await fetch("/api/terms/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms_version: "1.0" }),
      });
      if (res.ok) setDone(true);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-xs text-text-secondary">{t("version", { version: "1.0" })}</p>

      <div className="rounded-xl border border-border bg-surface-alt p-6 text-sm leading-relaxed text-text-secondary">
        {t("body")}
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
        <p className="text-success font-bold">Terms accepted successfully.</p>
      )}
    </div>
  );
}

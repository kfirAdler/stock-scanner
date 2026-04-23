"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => setMounted(true), []);

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

  return (
    <div className="mx-auto max-w-xl px-4 py-6 space-y-8">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

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
                savePreferences("en", opt.value);
              }}
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

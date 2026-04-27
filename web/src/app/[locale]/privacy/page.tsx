import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("privacy");

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-text">{t("title")}</h1>
        <p className="max-w-3xl text-base leading-relaxed text-text-secondary">
          {t("intro")}
        </p>
      </div>

      {["data", "usage", "sharing"].map((key) => (
        <section
          key={key}
          className="rounded-[24px] border border-border-strong/70 bg-surface-raised p-6 shadow-sm"
        >
          <h2 className="text-xl font-bold text-text">{t(`sections.${key}.title`)}</h2>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            {t(`sections.${key}.body`)}
          </p>
        </section>
      ))}
    </div>
  );
}

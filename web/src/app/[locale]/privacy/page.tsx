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
    <div className="page-shell page-stack max-w-4xl">
      <div className="page-hero">
        <h1 className="text-3xl font-bold tracking-tight text-text">{t("title")}</h1>
        <p className="max-w-3xl text-base leading-relaxed text-text-secondary">
          {t("intro")}
        </p>
      </div>

      {["data", "usage", "sharing"].map((key) => (
        <section
          key={key}
          className="page-card"
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

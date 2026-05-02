import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contact");
  const email = process.env.NEXT_PUBLIC_PREMIUM_CONTACT_EMAIL ?? "";

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-text">{t("title")}</h1>
        <p className="max-w-2xl text-base leading-relaxed text-text-secondary">
          {t("body")}
        </p>
      </div>

      <section className="rounded-[24px] border border-border-strong/70 bg-surface-raised p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">
          {t("emailLabel")}
        </p>
        {email ? (
          <a
            href={`mailto:${email}`}
            className="mt-3 inline-flex rounded-full border border-primary/20 bg-primary-soft px-4 py-2 text-sm font-bold text-primary hover:bg-primary hover:text-on-primary"
          >
            {email}
          </a>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            {t("emailFallback")}
          </p>
        )}
      </section>
    </div>
  );
}

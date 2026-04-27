import { Assistant } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Providers } from "@/components/layout/Providers";
import { Header } from "@/components/layout/Header";
import { TermsAcceptanceGate } from "@/components/layout/TermsAcceptanceGate";
import { Link } from "@/i18n/navigation";

const assistant = Assistant({
  subsets: ["latin", "hebrew"],
  variable: "--font-assistant",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const dir = locale === "he" ? "rtl" : "ltr";

  let messages;
  try {
    messages = (await import(`@/messages/${locale}.json`)).default;
  } catch {
    notFound();
  }

  return (
    <html lang={locale} dir={dir} className={`${assistant.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans antialiased bg-surface text-text">
        <Providers>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <TermsAcceptanceGate />
            <Header />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-border-strong/40 bg-surface-alt/70">
              <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="max-w-2xl space-y-2">
                    <p className="text-sm font-bold text-text">{messages.common.appName}</p>
                    <p className="text-xs leading-relaxed text-text-muted">
                      {messages.footer.disclaimer}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-text-secondary">
                    <Link href="/terms" className="hover:text-text">
                      {messages.footer.terms}
                    </Link>
                    <Link href="/privacy" className="hover:text-text">
                      {messages.footer.privacy}
                    </Link>
                    <Link href="/disclaimer" className="hover:text-text">
                      {messages.footer.disclaimerLink}
                    </Link>
                    <Link href="/contact" className="hover:text-text">
                      {messages.footer.contact}
                    </Link>
                  </div>
                </div>
                <div className="mt-4 border-t border-border/70 pt-3 text-[11px] text-text-muted">
                  {messages.footer.educationalOnly}
                </div>
              </div>
            </footer>
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}

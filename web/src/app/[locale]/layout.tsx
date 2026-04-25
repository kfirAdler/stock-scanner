import { Assistant } from "next/font/google";
import { NextIntlClientProvider, useMessages } from "next-intl";
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
            <footer className="border-t border-border-strong/40 bg-surface-alt/60">
              <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 text-xs text-text-muted sm:px-6">
                <p>{messages.common.appName}</p>
                <Link href="/terms" className="font-bold text-text-secondary hover:text-text">
                  {messages.nav.terms}
                </Link>
              </div>
            </footer>
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/Button";

export function Header() {
  const t = useTranslations();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => setUser(data.user));

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });

      return () => subscription.unsubscribe();
    } catch {
      // Supabase not configured yet
    }
  }, []);

  async function handleSignOut() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold text-text hover:text-primary transition-colors">
            {t("common.appName")}
          </Link>
          <nav className="hidden md:flex items-center gap-4" aria-label="Main navigation">
            <Link href="/screener" className="text-sm text-text-secondary hover:text-text transition-colors">
              {t("nav.screener")}
            </Link>
            {user && (
              <Link href="/saved-screens" className="text-sm text-text-secondary hover:text-text transition-colors">
                {t("nav.savedScreens")}
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                aria-expanded={menuOpen}
                aria-haspopup="true"
              >
                <span className="hidden sm:inline truncate max-w-[150px]">
                  {user.email}
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>
              {menuOpen && (
                <div
                  className="absolute end-0 mt-1 w-48 rounded-lg border border-border bg-surface shadow-lg py-1 z-50"
                  role="menu"
                >
                  <Link
                    href="/settings"
                    className="block px-4 py-2 text-sm text-text-secondary hover:bg-surface-alt"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                  >
                    {t("nav.settings")}
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="block w-full text-start px-4 py-2 text-sm text-danger hover:bg-surface-alt"
                    role="menuitem"
                  >
                    {t("common.signOut")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/auth/login">
              <Button size="sm">{t("common.signIn")}</Button>
            </Link>
          )}

          <button
            className="md:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg text-text-secondary hover:bg-surface-alt"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
              <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

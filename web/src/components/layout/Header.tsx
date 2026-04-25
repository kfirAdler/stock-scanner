"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/Button";
import { clsx } from "clsx";

export function Header() {
  const t = useTranslations();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [entitlement, setEntitlement] = useState<{
    requiresSubscription: boolean;
    tier: "free" | "pro";
  } | null>(null);

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

  useEffect(() => {
    fetch("/api/me/entitlement")
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d.requiresSubscription === "boolean" && d.tier) {
          setEntitlement({
            requiresSubscription: d.requiresSubscription,
            tier: d.tier === "pro" ? "pro" : "free",
          });
        }
      })
      .catch(() => setEntitlement(null));
  }, [user]);

  async function handleSignOut() {
    try {
      window.localStorage.removeItem("screener.favoriteFilter");
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    window.location.href = "/";
  }

  const showMemberBadge =
    entitlement?.requiresSubscription && user && entitlement.tier === "pro";
  const showPreviewBadge =
    entitlement?.requiresSubscription && user && entitlement.tier === "free";

  return (
    <header className="sticky top-0 z-40 border-b border-border-strong/40 bg-surface/85 backdrop-blur-xl shadow-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center shadow-md ring-1 ring-black/5 dark:ring-white/10">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="white" className="w-4 h-4">
                <path fillRule="evenodd" d="M12.577 4.878a.75.75 0 01.919-.53l4.78 1.281a.75.75 0 01.531.919l-1.281 4.78a.75.75 0 01-1.449-.387l.81-3.022a19.407 19.407 0 00-5.594 5.203.75.75 0 01-1.139.093L7 10.06l-4.72 4.72a.75.75 0 01-1.06-1.061l5.25-5.25a.75.75 0 011.06 0l3.074 3.073a20.923 20.923 0 015.545-4.931l-3.042.815a.75.75 0 01-.53-.919z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-base font-bold text-text group-hover:text-primary transition-colors hidden sm:inline tracking-tight">
              {t("common.appName")}
            </span>
            {showMemberBadge && (
              <span className="hidden sm:inline-flex items-center rounded-full border border-primary/25 bg-primary-soft px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                {t("premium.headerBadge")}
              </span>
            )}
            {showPreviewBadge && (
              <span
                className={clsx(
                  "hidden sm:inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  "border-border-strong bg-surface-alt text-text-muted"
                )}
              >
                {t("premium.headerBadgeLocked")}
              </span>
            )}
          </Link>
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            <Link
              href="/screener"
              className="px-3 py-1.5 rounded-md text-sm font-bold text-text-secondary hover:text-text hover:bg-surface-alt transition-colors"
            >
              {t("nav.screener")}
            </Link>
            <Link
              href="/stock-lookup"
              className="px-3 py-1.5 rounded-md text-sm font-bold text-text-secondary hover:text-text hover:bg-surface-alt transition-colors"
            >
              {t("nav.stockLookup")}
            </Link>
            {user && (
              <Link
                href="/saved-screens"
                className="px-3 py-1.5 rounded-md text-sm font-bold text-text-secondary hover:text-text hover:bg-surface-alt transition-colors"
              >
                {t("nav.savedScreens")}
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          <LanguageToggle />
          <ThemeToggle />

          {user ? (
            <div className="relative ms-1">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-text-secondary hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                aria-expanded={menuOpen}
                aria-haspopup="true"
              >
                <div className="h-6 w-6 rounded-full bg-primary-soft flex items-center justify-center text-xs font-bold text-primary">
                  {user.email?.[0]?.toUpperCase() ?? "U"}
                </div>
                <span className="hidden sm:inline truncate max-w-[120px] text-xs">
                  {user.email}
                </span>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div
                    className="absolute end-0 mt-1.5 w-48 rounded-xl border border-border bg-surface-raised shadow-xl py-1.5 z-50"
                    role="menu"
                  >
                    <Link
                      href="/settings"
                      className="block px-4 py-2 text-sm text-text-secondary hover:text-text hover:bg-surface-alt transition-colors"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                    >
                      {t("nav.settings")}
                    </Link>
                    <div className="my-1 border-t border-border" />
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-start px-4 py-2 text-sm text-danger hover:bg-danger-soft transition-colors"
                      role="menuitem"
                    >
                      {t("common.signOut")}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link href="/auth/login" className="ms-1">
              <Button size="sm">{t("common.signIn")}</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

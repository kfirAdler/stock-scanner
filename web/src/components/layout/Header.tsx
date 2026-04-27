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

type ClientEntitlement = {
  requiresSubscription: boolean;
  tier: "free" | "premium" | "essential" | "demo";
  effectiveTier: "free" | "premium" | "essential" | "demo";
  status: "active" | "inactive" | "expired";
  canUseScreener: boolean;
};

function NavLink({
  href,
  label,
  onClick,
  mobile = false,
}: {
  href: string;
  label: string;
  onClick?: () => void;
  mobile?: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "rounded-md font-bold text-text-secondary transition-colors hover:bg-surface-alt hover:text-text",
        mobile ? "block px-3 py-2 text-sm" : "px-3 py-1.5 text-sm"
      )}
      onClick={onClick}
    >
      {label}
    </Link>
  );
}

export function Header() {
  const t = useTranslations();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [entitlement, setEntitlement] = useState<ClientEntitlement | null>(null);

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
    setMenuOpen(false);
    setMobileNavOpen(false);
  }, [user]);

  useEffect(() => {
    fetch("/api/me/entitlement")
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d.requiresSubscription === "boolean" && d.tier) {
          setEntitlement({
            requiresSubscription: d.requiresSubscription,
            tier: d.tier,
            effectiveTier: d.effectiveTier ?? "free",
            status: d.status ?? "inactive",
            canUseScreener: !!d.canUseScreener,
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

  const badgeTier = entitlement?.effectiveTier ?? "free";
  const showMemberBadge =
    entitlement?.requiresSubscription && user && badgeTier !== "free";
  const showPreviewBadge =
    entitlement?.requiresSubscription &&
    user &&
    (badgeTier === "free" || entitlement?.status === "expired");
  const showSavedScreensLink =
    user && (!entitlement?.requiresSubscription || entitlement.canUseScreener);

  const badgeLabel =
    badgeTier === "premium"
      ? t("premium.headerBadgePremium")
      : badgeTier === "essential"
        ? t("premium.headerBadgeEssential")
        : t("premium.headerBadgeDemo");

  function closeMenus() {
    setMenuOpen(false);
    setMobileNavOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border-strong/40 bg-surface/85 backdrop-blur-xl shadow-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-8">
          <Link href="/" className="flex items-center gap-2 group" onClick={closeMenus}>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-hover shadow-md ring-1 ring-black/5 dark:ring-white/10">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="white" className="h-4 w-4">
                <path fillRule="evenodd" d="M12.577 4.878a.75.75 0 01.919-.53l4.78 1.281a.75.75 0 01.531.919l-1.281 4.78a.75.75 0 01-1.449-.387l.81-3.022a19.407 19.407 0 00-5.594 5.203.75.75 0 01-1.139.093L7 10.06l-4.72 4.72a.75.75 0 01-1.06-1.061l5.25-5.25a.75.75 0 011.06 0l3.074 3.073a20.923 20.923 0 015.545-4.931l-3.042.815a.75.75 0 01-.53-.919z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="hidden text-base font-bold tracking-tight text-text transition-colors group-hover:text-primary sm:inline">
              {t("common.appName")}
            </span>
            {showMemberBadge && (
              <span className="hidden items-center rounded-full border border-primary/25 bg-primary-soft px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary sm:inline-flex">
                {badgeLabel}
              </span>
            )}
            {showPreviewBadge && (
              <span
                className={clsx(
                  "hidden items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider sm:inline-flex",
                  "border-border-strong bg-surface-alt text-text-muted"
                )}
              >
                {t("premium.headerBadgeLocked")}
              </span>
            )}
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            <NavLink href="/screener" label={t("nav.screener")} />
            <NavLink href="/stock-lookup" label={t("nav.stockLookup")} />
            <NavLink href="/#features" label={t("nav.features")} />
            {showSavedScreensLink && <NavLink href="/saved-screens" label={t("nav.savedScreens")} />}
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          <LanguageToggle />
          <ThemeToggle />

          {user ? (
            <div className="relative ms-1 hidden sm:block">
              <button
                onClick={() => {
                  setMenuOpen(!menuOpen);
                  setMobileNavOpen(false);
                }}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-expanded={menuOpen}
                aria-haspopup="true"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                  {user.email?.[0]?.toUpperCase() ?? "U"}
                </div>
                <span className="truncate text-xs max-w-[120px]">{user.email}</span>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div
                    className="absolute end-0 z-50 mt-1.5 w-48 rounded-xl border border-border bg-surface-raised py-1.5 shadow-xl"
                    role="menu"
                  >
                    <Link
                      href="/settings"
                      className="block px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-alt hover:text-text"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                    >
                      {t("nav.settings")}
                    </Link>
                    <Link
                      href="/terms"
                      className="block px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-alt hover:text-text"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                    >
                      {t("nav.terms")}
                    </Link>
                    <div className="my-1 border-t border-border" />
                    <button
                      onClick={handleSignOut}
                      className="block w-full px-4 py-2 text-start text-sm text-danger transition-colors hover:bg-danger-soft"
                      role="menuitem"
                    >
                      {t("common.signOut")}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <Link href="/auth/login" className="ms-1 hidden sm:block">
                <Button size="sm">{t("common.signIn")}</Button>
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setMobileNavOpen(!mobileNavOpen);
              setMenuOpen(false);
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-alt hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden"
            aria-label={t("nav.menu")}
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-site-nav"
          >
            {mobileNavOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                <path fillRule="evenodd" d="M4.22 4.22a.75.75 0 011.06 0L10 8.94l4.72-4.72a.75.75 0 111.06 1.06L11.06 10l4.72 4.72a.75.75 0 11-1.06 1.06L10 11.06l-4.72 4.72a.75.75 0 11-1.06-1.06L8.94 10 4.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                <path fillRule="evenodd" d="M3.25 5A.75.75 0 014 4.25h12a.75.75 0 010 1.5H4A.75.75 0 013.25 5zm0 5A.75.75 0 014 9.25h12a.75.75 0 010 1.5H4a.75.75 0 01-.75-.75zm0 5A.75.75 0 014 14.25h12a.75.75 0 010 1.5H4a.75.75 0 01-.75-.75z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mobileNavOpen && (
        <div id="mobile-site-nav" className="border-t border-border/70 md:hidden">
          <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
            {user && (
              <div className="mb-3 rounded-xl border border-border bg-surface-alt px-3 py-2">
                <p className="text-xs font-bold uppercase tracking-wider text-text-muted">
                  {showMemberBadge ? badgeLabel : t("premium.headerBadgeLocked")}
                </p>
                <p className="mt-1 truncate text-sm text-text">{user.email}</p>
              </div>
            )}

            <nav className="space-y-1" aria-label="Mobile navigation">
              <NavLink href="/screener" label={t("nav.screener")} mobile onClick={closeMenus} />
              <NavLink href="/stock-lookup" label={t("nav.stockLookup")} mobile onClick={closeMenus} />
              <NavLink href="/#features" label={t("nav.features")} mobile onClick={closeMenus} />
              {showSavedScreensLink && (
                <>
                  <NavLink href="/saved-screens" label={t("nav.savedScreens")} mobile onClick={closeMenus} />
                  <NavLink href="/settings" label={t("nav.settings")} mobile onClick={closeMenus} />
                </>
              )}
              {user && !showSavedScreensLink && (
                <NavLink href="/settings" label={t("nav.settings")} mobile onClick={closeMenus} />
              )}
            </nav>

            <div className="mt-4">
              {user ? (
                <Button size="sm" variant="secondary" className="w-full" onClick={handleSignOut}>
                  {t("common.signOut")}
                </Button>
              ) : (
                <Link href="/auth/login" onClick={closeMenus}>
                  <Button size="sm" className="w-full">
                    {t("common.signIn")}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

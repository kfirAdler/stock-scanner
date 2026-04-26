"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";
import { clsx } from "clsx";

type SignupPlan = "premium" | "essential" | "demo";

const PLAN_OPTIONS: SignupPlan[] = ["premium", "essential", "demo"];

export default function RegisterPage() {
  const t = useTranslations();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<SignupPlan>("essential");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!termsAccepted) {
      setError(t("terms.mustAccept"));
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          requested_plan: selectedPlan,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from("user_terms_acceptance").insert({
        user_id: data.user.id,
        terms_version: CURRENT_TERMS_VERSION,
      });
    }

    window.location.href = "/";
  }

  async function handleGoogleSignUp() {
    setError("");
    if (!termsAccepted) {
      setError(t("terms.mustAccept"));
      return;
    }

    const supabase = createClient();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("plan", selectedPlan);
    callbackUrl.searchParams.set("next", "/");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{t("auth.registerTitle")}</h1>
          <p className="mt-2 text-sm text-text-secondary">{t("auth.planHelp")}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {PLAN_OPTIONS.map((plan) => {
            const selected = selectedPlan === plan;
            return (
              <button
                key={plan}
                type="button"
                onClick={() => setSelectedPlan(plan)}
                className={clsx(
                  "rounded-2xl border p-4 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  selected
                    ? "border-primary bg-primary-soft shadow-sm"
                    : "border-border bg-surface hover:border-border-strong hover:bg-surface-alt"
                )}
                aria-pressed={selected}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-text">
                    {t(`auth.plan.${plan}.title`)}
                  </span>
                  <span
                    className={clsx(
                      "h-4 w-4 rounded-full border",
                      selected
                        ? "border-primary bg-primary"
                        : "border-border-strong bg-surface"
                    )}
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                  {t(`auth.plan.${plan}.body`)}
                </p>
              </button>
            );
          })}
        </div>

        <Button
          variant="secondary"
          className="w-full"
          onClick={handleGoogleSignUp}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {t("auth.googleSignIn")}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-surface px-2 text-text-secondary">{t("common.or")}</span>
          </div>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <Input
            type="email"
            label={t("common.email")}
            placeholder={t("auth.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            type="password"
            label={t("common.password")}
            placeholder={t("auth.passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />

          <div className="space-y-2">
            <Checkbox
              label={t("terms.accept")}
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
            />
            <Link href="/terms" className="block text-xs text-primary hover:underline">
              {t("nav.terms")}
            </Link>
          </div>

          {error && (
            <p className="text-sm text-danger" role="alert">{error}</p>
          )}

          <Button type="submit" className="w-full" loading={loading}>
            {t("common.signUp")}
          </Button>
        </form>

        <p className="text-center text-sm text-text-secondary">
          {t("auth.hasAccount")}{" "}
          <Link href="/auth/login" className="font-bold text-primary hover:underline">
            {t("common.signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}

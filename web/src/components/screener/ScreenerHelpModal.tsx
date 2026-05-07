"use client";

import { useTranslations } from "next-intl";

interface ScreenerHelpModalProps {
  open: boolean;
  onClose: () => void;
}

function MockRow() {
  return <div className="h-14 rounded-xl border border-border bg-surface" />;
}

export function ScreenerHelpModal({ open, onClose }: ScreenerHelpModalProps) {
  const t = useTranslations("screener");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-[28px] border border-border-strong bg-surface-raised shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute end-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition-colors hover:border-border-strong hover:text-text"
          aria-label={t("workspace.help.close")}
        >
          ×
        </button>

        <div className="grid gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="border-b border-border bg-surface-alt p-6 lg:border-b-0 lg:border-e">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
              {t("workspace.help.eyebrow")}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-text">{t("workspace.help.title")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              {t("workspace.help.body")}
            </p>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-sm font-bold text-text">{t("workspace.help.meaningTitle")}</p>
                <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                  <li>{t("workspace.help.meanings.up5")}</li>
                  <li>{t("workspace.help.meanings.up13")}</li>
                  <li>{t("workspace.help.meanings.ma")}</li>
                  <li>{t("workspace.help.meanings.customize")}</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-sm font-bold text-text">{t("workspace.help.flowTitle")}</p>
                <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                  <li>{t("workspace.help.flow.one")}</li>
                  <li>{t("workspace.help.flow.two")}</li>
                  <li>{t("workspace.help.flow.three")}</li>
                  <li>{t("workspace.help.flow.four")}</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="rounded-[28px] border border-border-strong bg-surface p-5">
              <div className="grid gap-5 lg:grid-cols-[180px_minmax(0,1fr)]">
                <div className="space-y-5">
                  <div className="rounded-2xl border border-border bg-surface-alt p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex w-11 flex-col gap-2">
                        {["D", "W", "M"].map((label, index) => (
                          <div
                            key={label}
                            className={
                              index === 0
                                ? "flex h-11 items-center justify-center rounded-xl border border-primary bg-primary text-sm font-black text-on-primary"
                                : "flex h-11 items-center justify-center rounded-xl border border-border bg-surface text-sm font-black text-text-secondary"
                            }
                          >
                            {label}
                          </div>
                        ))}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
                          {t("workspace.help.mock.categories")}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {Array.from({ length: 6 }).map((_, idx) => (
                            <div key={idx} className="h-9 rounded-lg border border-border bg-surface" />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-surface-alt p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
                      {t("workspace.help.mock.summary")}
                    </p>
                    <div className="mt-3 h-40 rounded-2xl border border-border bg-surface" />
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-surface-alt p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
                        {t("workspace.help.mock.results")}
                      </p>
                      <p className="mt-1 text-sm font-bold text-text">{t("workspace.help.mock.symbols")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {["bullish", "bearish", "strong"].map((key) => (
                        <div key={key} className="rounded-xl border border-border bg-surface px-4 py-2 text-center">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                            {t(`workspace.cards.${key}`)}
                          </p>
                          <p className="mt-1 text-lg font-bold text-text">5</p>
                        </div>
                      ))}
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface font-bold text-text">
                        ?
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3 rounded-[28px] border border-border bg-surface p-4">
                    <MockRow />
                    <MockRow />
                    <MockRow />
                    <MockRow />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

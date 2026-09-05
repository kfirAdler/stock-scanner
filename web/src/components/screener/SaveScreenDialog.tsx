"use client";

import { useState, type FormEvent, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useModalDialog } from "@/hooks/useModalDialog";

interface SaveScreenDialogProps {
  defaultName: string;
  filterCount: number;
  loading: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}

export function SaveScreenDialog({
  defaultName,
  filterCount,
  loading,
  error,
  onClose,
  onSave,
}: SaveScreenDialogProps) {
  const t = useTranslations("screener");
  const [name, setName] = useState(defaultName);
  const [nameError, setNameError] = useState<string | null>(null);
  const dialogRef = useModalDialog<HTMLFormElement>({
    onClose,
    closeDisabled: loading,
  });

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !loading) onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName) {
      setNameError(t("saveDialog.nameRequired"));
      return;
    }
    setNameError(null);
    await onSave(normalizedName);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-text/55 p-3 backdrop-blur-sm sm:p-4"
      onMouseDown={handleBackdropClick}
    >
      <form
        ref={dialogRef}
        onSubmit={handleSubmit}
        className="ui-panel-strong max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-[24px] shadow-[0_30px_80px_rgba(15,23,42,0.3)] sm:max-h-[calc(100dvh-2rem)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-screen-title"
        aria-describedby="save-screen-description"
        aria-busy={loading}
        tabIndex={-1}
      >
        <div className="border-b border-border bg-surface-alt/65 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                {t("saveDialog.eyebrow")}
              </p>
              <h2 id="save-screen-title" className="mt-1 text-xl font-bold text-text">
                {t("saveDialog.title")}
              </h2>
              <p id="save-screen-description" className="mt-1 text-sm leading-relaxed text-text-secondary">
                {t("saveDialog.body", { count: filterCount })}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="ui-control inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg text-text-secondary transition-colors hover:border-border-strong hover:text-text disabled:opacity-50"
              aria-label={t("saveDialog.close")}
            >
              ×
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <label className="block">
            <span className="text-xs font-bold text-text">{t("saveDialog.nameLabel")}</span>
            <input
              data-autofocus
              value={name}
              maxLength={80}
              onChange={(event) => {
                setName(event.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder={t("saveDialog.namePlaceholder")}
              className="ui-control mt-2 w-full rounded-xl px-3.5 py-2.5 text-sm text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              aria-invalid={!!(nameError || error)}
              aria-describedby={nameError || error ? "save-screen-error" : undefined}
            />
          </label>

          {nameError || error ? (
            <p id="save-screen-error" className="rounded-xl bg-danger-soft px-3 py-2 text-xs font-semibold text-danger" role="alert">
              {nameError ?? error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border bg-surface-alt/45 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading} className="w-full sm:w-auto">
            {t("saveDialog.cancel")}
          </Button>
          <Button type="submit" size="sm" loading={loading} className="w-full sm:w-auto">
            {t("saveDialog.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { PatternKind } from '@/lib/patterns/types';
import type { PatternRequestStatus, PatternSearchJob } from '@/lib/patterns/request-types';

export function PatternRequestPanel({ market, pattern, onPatternChange, onViewResults }: {
  market: 'US' | 'TA';
  pattern: PatternKind;
  onPatternChange: (pattern: PatternKind) => void;
  onViewResults: (job: PatternSearchJob) => void;
}) {
  const t = useTranslations('patterns');
  const [state, setState] = useState<PatternRequestStatus | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clockOffset = useRef(0);
  const version = useRef(0);
  const submitController = useRef<AbortController | null>(null);

  const apply = useCallback((data: PatternRequestStatus) => {
    clockOffset.current = Date.parse(data.serverTime) - Date.now();
    setState(data);
    setRemaining(data.nextAllowedAt ? Math.max(0, Math.ceil((Date.parse(data.nextAllowedAt) - Date.parse(data.serverTime)) / 1000)) : 0);
    setError(null);
  }, []);

  const load = useCallback(async (signal: AbortSignal) => {
    const current = ++version.current;
    try {
      const response = await fetch('/api/patterns/requests', { signal, cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      if (!signal.aborted && current === version.current) apply(data);
    } catch (e) {
      if (!signal.aborted && current === version.current) setError(e instanceof Error && e.message === '401' ? 'login' : e instanceof Error && e.message === '403' ? 'subscribe' : 'requestError');
    }
  }, [apply]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => { if (!controller.signal.aborted) return load(controller.signal); });
    return () => { controller.abort(); submitController.current?.abort(); };
  }, [load]);

  useEffect(() => {
    if (!state?.nextAllowedAt) return;
    const next = Date.parse(state.nextAllowedAt);
    const timer = window.setInterval(() => setRemaining(Math.max(0, Math.ceil((next - Date.now() - clockOffset.current) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [state?.nextAllowedAt]);

  const pending = state?.job?.status === 'queued' || state?.job?.status === 'running';
  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController();
    // Poll only active work, once a minute, while this tab is visible.
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(controller.signal); }, 60_000);
    return () => { window.clearInterval(timer); controller.abort(); };
  }, [pending, load]);

  async function submit() {
    if (busy || remaining > 0 || pending) return;
    const current = ++version.current;
    const controller = new AbortController();
    submitController.current = controller;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/patterns/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern, market }), signal: controller.signal,
      });
      if (!response.ok && response.status !== 429) throw new Error(String(response.status));
      const data = await response.json();
      if (!controller.signal.aborted && current === version.current) apply(data);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error && e.message === '401' ? 'login' : e instanceof Error && e.message === '403' ? 'subscribe' : 'requestError');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  const minutes = Math.floor(remaining / 60);
  const countdown = String(Math.floor(minutes / 60)).padStart(2,'0') + ':' + String(minutes % 60).padStart(2,'0') + ':' + String(remaining % 60).padStart(2,'0');
  const job = state?.job;
  return <section className="page-card !p-5 sm:!p-6" aria-labelledby="pattern-request-title">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="max-w-xl"><h2 id="pattern-request-title" className="text-lg font-extrabold">{t('requestTitle')}</h2><p className="mt-1 text-sm text-text-muted">{t('requestHint')}</p></div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-48 text-xs font-semibold text-text-secondary">{t('requestPattern')}<select id="pattern-request-selection" value={pattern} onChange={e => onPatternChange(e.target.value as PatternKind)} className="ui-control mt-1 block w-full rounded-xl px-3 py-3 text-sm">{(['ascending_triangle','channel','cup_and_handle'] as const).map(p => <option key={p} value={p}>{t(p)}</option>)}</select></label>
        <button onClick={submit} disabled={busy || !state || remaining > 0 || pending || !!error} className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary disabled:cursor-not-allowed">{t(busy ? 'requestSubmitting' : remaining > 0 ? 'requestLocked' : pending ? 'requestPending' : 'requestSearch')}</button>
      </div>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-text-muted">
      <span>{t(market)} · {t('daily')}</span>
      {remaining > 0 ? <span>{t('requestNext')} <strong className="font-mono tabular-nums text-text" dir="ltr">{countdown}</strong></span> : <span>{t(state ? 'requestAvailable' : 'requestChecking')}</span>}
    </div>
    {job && <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-alt px-4 py-3 text-sm"><div><p className="font-semibold">{t(job.pattern)} · {t(job.market)} — {t('requestStatus_' + job.status)}</p><p className="mt-1 text-xs text-text-muted">{t(job.status === 'queued' ? 'requestQueuedHint' : job.status === 'running' ? 'requestRunningHint' : job.status === 'failed' ? 'requestFailedHint' : 'requestCompletedHint')}</p></div>{job.status === 'completed' && job.summary && <button onClick={() => onViewResults(job)} className="font-bold text-primary">{t('requestView')}</button>}</div>}
    {error && <div role="alert" className="mt-3 text-sm text-danger">{t(error as 'requestError')} {error === 'login' || error === 'subscribe' ? <Link className="underline" href={error === 'login' ? '/auth/login' : '/settings'}>{t('settings')}</Link> : <button className="underline" disabled={busy} onClick={() => { const controller = new AbortController(); submitController.current = controller; void load(controller.signal); }}>{t('retry')}</button>}</div>}
  </section>;
}

"use client";
import { useLocale, useTranslations } from 'next-intl';
import type { PatternPayload, PatternKind } from '@/lib/patterns/types';

export function ScanSummary({ data, pattern, requested }: {data:PatternPayload;pattern?:PatternKind;requested:boolean}) {
  const t=useTranslations('patterns');
  const locale=useLocale();
  const strict=data.rows.filter(r=>r.matches.some(m=>!pattern||m.pattern===pattern)).length;
  const developing=data.rows.filter(r=>r.developing?.some(d=>!pattern||d.match.pattern===pattern)).length;
  const rejected=Object.entries(data.diagnostics?.rejected??{}).sort((a,b)=>b[1]-a[1]);
  return <section className="page-card !p-5 sm:!p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-success">{t(requested?'scanComplete':'snapshotOverview')}</p><h2 className="mt-2 text-xl font-extrabold">{pattern?t(pattern)+' · ':''}{t('scanHeadline',{scanned:data.coverage.scanned,matches:strict})}</h2></div><div className="text-xs text-text-muted">{data.updatedAt && <p>{t('completedAt')}: {new Date(data.updatedAt).toLocaleString(locale)}</p>}{data.durationSeconds!==undefined && <p className="mt-1">{t('scanDuration',{seconds:data.durationSeconds})}</p>}</div></div>
    <p className="mt-4 text-sm text-text-muted">{t('automaticSearchInfo')}</p>
    {data.lastAttempt && <p className="mt-2 text-sm text-text-secondary">{t('lastAutomaticAttempt')}: <time dateTime={data.lastAttempt.startedAt}>{new Date(data.lastAttempt.startedAt).toLocaleString(locale)}</time> · {t(data.lastAttempt.status==='running'?'autoRunning':data.lastAttempt.status==='completed'?'autoCompleted':'autoErrors')}</p>}
    <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['scanned',data.coverage.scanned],['strictMatches',strict],['developingSetups',data.diagnostics?developing:'—'],['skipped',data.coverage.stale+data.coverage.insufficient]].map(([label,value])=><div key={label} className="premium-metric-card"><p className="premium-metric-label">{t(label as 'scanned')}</p><p className="premium-metric-value">{value}</p>{label==='skipped' && <p className="mt-1 text-xs text-text-muted">{t('skipDetail',{stale:data.coverage.stale,short:data.coverage.insufficient})}</p>}</div>)}</div>
    {data.diagnostics ? <details className="mt-5 border-t border-border pt-4"><summary className="cursor-pointer text-sm font-bold text-primary">{t('whyRejected')}</summary><p className="mt-2 text-xs text-text-muted">{t('firstFailedRule')}</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{rejected.map(([reason,count])=><div key={reason} className="rounded-xl bg-surface-alt px-4 py-3"><div className="flex justify-between gap-3 text-sm"><span>{t(('reason_'+reason) as 'reason_poor_line_fit')}</span><strong className="tabular-nums">{count}</strong></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary/65" style={{width:(count/Math.max(1,data.coverage.scanned)*100)+'%'}} /></div></div>)}</div>{!rejected.length && <p className="mt-3 text-sm text-text-muted">{t('noRejections')}</p>}<p className="mt-4 text-xs text-text-muted">{t('channelScope')}</p></details> : requested && pattern==='channel' ? <p className="mt-4 border-t border-border pt-4 text-xs text-text-muted">{t('legacyDiagnostics')}</p> : null}
  </section>;
}

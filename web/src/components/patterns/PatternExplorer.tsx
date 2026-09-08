"use client";

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { CandlestickChart } from '@/components/chart/CandlestickChart';
import type { PatternKind, PatternMatch, PatternPayload, PatternSnapshot } from '@/lib/patterns/types';

import { PatternRequestPanel } from './PatternRequestPanel';
import type { PatternSearchJob } from '@/lib/patterns/request-types';

const kinds: PatternKind[] = ['ascending_triangle', 'channel', 'cup_and_handle'];
const noSma: number[] = [];

function Sketch({ match }: { match: PatternMatch }) {
  const points = match.lines.flatMap(l => [[l.x1,l.y1],[l.x2,l.y2]]);
  const minX = Math.min(...points.map(p => p[0]));
  const maxX = Math.max(...points.map(p => p[0]));
  const minY = Math.min(...points.map(p => p[1]));
  const maxY = Math.max(...points.map(p => p[1]));
  const x = (v: number) => 20 + (v-minX)/Math.max(1,maxX-minX)*280;
  const y = (v: number) => 94 - (v-minY)/Math.max(0.01,maxY-minY)*68;
  return <svg viewBox="0 0 320 120" className="h-28 w-full" aria-hidden="true">
    {[30,60,90].map(v => <path key={v} d={'M 0 '+v+' H 320'} stroke="currentColor" opacity=".08" />)}
    {match.lines.map((l,i) => <line key={i} x1={x(l.x1)} y1={y(l.y1)} x2={x(l.x2)} y2={y(l.y2)} stroke={l.style === 'support' ? 'var(--color-neon)' : l.style === 'guide' ? 'var(--color-accent)' : 'var(--color-primary)'} strokeWidth="2.5" strokeLinecap="round" />)}
  </svg>;
}

function SetupChart({ snapshot, pattern, jobId }: { snapshot: PatternSnapshot; pattern: PatternKind; jobId?: string }) {
  const t = useTranslations('patterns');
  const [row,setRow] = useState<PatternSnapshot | null>(null);
  const [error,setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(jobId ? '/api/patterns/requests/detail?jobId='+encodeURIComponent(jobId)+'&ticker='+encodeURIComponent(snapshot.ticker) : '/api/patterns?market='+snapshot.market+'&ticker='+encodeURIComponent(snapshot.ticker), { signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { if (!data.row) setError(true); else setRow(data.row); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [snapshot.market,snapshot.ticker,jobId]);
  const bars = useMemo(() => (row?.candles ?? []).map(c => ({ ...c, trade_date: c.date, volume: 0 })), [row]);
  if (error) return <p role="alert" className="p-6 text-danger">{t('noChart')}</p>;
  if (!row) return <p role="status" className="p-6 text-text-muted">{t('loading')}</p>;
  const match = row.matches.find(m => m.pattern === pattern);
  if (!match || row.status !== 'scanned' || !bars.length) return <p className="p-6">{t('staleDetail')}</p>;
  return <div className="space-y-3" dir="ltr"><CandlestickChart bars={bars} smaPeriods={noSma} patternLines={match.lines} patternLevels={{breakout:match.breakoutLevel,invalidation:match.invalidationLevel,breakoutLabel:t('breakout'),invalidationLabel:t('invalidation')}} height={360} /><p className="text-xs text-text-muted">{t('asOf')}: {row.as_of} · {t('daily')}</p></div>;
}

export function PatternExplorer() {
  const t = useTranslations('patterns');
  const locale = useLocale();
  const [market,setMarket] = useState<'US' | 'TA'>('US');
  const [kind,setKind] = useState<PatternKind | 'all'>('all');
  const [search,setSearch] = useState('');
  const [sharedData,setData] = useState<PatternPayload | null>(null);
  const [requestedJob,setRequestedJob] = useState<PatternSearchJob | null>(null);
  const data = requestedJob?.summary ?? sharedData;
  const [status,setStatus] = useState('loading');
  const displayStatus = requestedJob ? 'ready' : status;
  const [retry,setRetry] = useState(0);
  const [expanded,setExpanded] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/patterns?market='+market, { signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(payload => { setData(payload); setStatus('ready'); })
      .catch(e => { if (!controller.signal.aborted) setStatus(e.message === '401' ? 'login' : e.message === '403' ? 'subscribe' : 'error'); });
    return () => controller.abort();
  }, [market,retry]);
  const cards = useMemo(() => (data?.rows ?? []).filter(r => (r.ticker+' '+(r.company_name ?? '')).toLowerCase().includes(search.toLowerCase().trim())).flatMap(row => row.matches.filter(m => kind === 'all' || m.pattern === kind).map(match => ({ row,match }))).sort((a,b) => b.match.confidence-a.match.confidence || a.row.ticker.localeCompare(b.row.ticker)), [data,search,kind]);
  const number = (value: number | null) => value === null ? '—' : new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(value);
  function reload() { setRequestedJob(null); setStatus('loading'); setExpanded(null); setRetry(v=>v+1); }
  return <div className="page-shell page-stack">
    <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary-soft via-surface-raised to-surface p-6 sm:p-10">
      <div className="max-w-2xl"><p className="text-xs font-bold tracking-[.2em] text-primary">{t('eyebrow')}</p><h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">{t('title')}</h1><p className="mt-4 max-w-xl text-text-secondary">{t('subtitle')}</p></div>
      <div className="mt-6 inline-flex gap-1 rounded-xl border border-border bg-surface-raised p-1">{(['US','TA'] as const).map(m => <button key={m} aria-pressed={market===m} onClick={()=>{if(m!==market){setMarket(m);setRequestedJob(null);setData(null);setStatus('loading');setExpanded(null);}}} className={'rounded-lg px-5 py-2 text-sm font-bold '+(market===m?'bg-primary text-on-primary':'text-text-secondary')}>{t(m)}</button>)}</div>
    </section>
    <PatternRequestPanel market={market} onViewResults={job => { setRequestedJob(job); setMarket(job.market); setKind(job.pattern); setSearch(''); setExpanded(null); }} />
    {requestedJob && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary-soft px-5 py-3 text-sm"><p>{t('requestResults')}: <strong>{t(requestedJob.pattern)} · {t(requestedJob.market)}</strong></p><button className="font-bold text-primary" onClick={() => { setRequestedJob(null); setKind('all'); setExpanded(null); }}>{t('requestBack')}</button></div>}
    {displayStatus === 'loading' && <div role="status" className="page-card animate-pulse py-16 text-center">{t('loading')}</div>}
    {displayStatus !== 'ready' && displayStatus !== 'loading' && <div role="alert" className="page-empty-state text-center"><p>{t(status === 'login' ? 'login' : status === 'subscribe' ? 'subscribe' : 'error')}</p>{status === 'login' || status === 'subscribe' ? <Link className="mt-4 inline-block font-bold text-primary" href={status === 'login' ? '/auth/login' : '/settings'}>{t(status === 'login' ? 'login' : 'settings')}</Link> : <button className="ui-control mt-4 rounded-xl px-5 py-2" onClick={reload}>{t('retry')}</button>}</div>}
    {displayStatus === 'ready' && data && <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['scanned',data.coverage.scanned],['setups',data.rows.length],['stale',data.coverage.stale],['insufficient',data.coverage.insufficient]].map(([label,value]) => <div key={label} className="premium-metric-card"><p className="premium-metric-label">{t(label as 'scanned')}</p><p className="premium-metric-value">{number(value as number)}</p></div>)}</div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap gap-2">{(['all',...kinds] as const).map(k => <button key={k} onClick={()=>setKind(k)} aria-pressed={kind===k} className={'rounded-full border px-4 py-2 text-sm font-semibold '+(kind===k?'border-primary bg-primary-soft text-primary':'border-border bg-surface-raised text-text-secondary')}>{t(k)}</button>)}</div><input aria-label={t('search')} placeholder={t('search')} value={search} onChange={e=>setSearch(e.target.value)} className="ui-control rounded-xl px-4 py-3 text-sm lg:w-64" /></div>
      {!cards.length ? <div className="page-empty-state py-14 text-center"><h2 className="text-xl font-bold">{t(data.coverage.total ? 'empty' : 'waiting')}</h2><p className="mt-2 text-text-muted">{t(data.coverage.total ? 'emptyBody' : 'waitingBody')}</p>{(search || kind!=='all') && <button className="mt-4 text-primary" onClick={()=>{setKind('all');setSearch('');}}>{t('reset')}</button>}</div> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{cards.map(({row,match}) => { const id=row.ticker+':'+match.pattern; const open=expanded===id; return <article key={id} className={'page-card !p-5 '+(open?'md:col-span-2 xl:col-span-3':'ui-elevated-hover')}>
        <div className="flex items-start justify-between gap-3"><div><Link href={'/ticker/'+encodeURIComponent(row.ticker)} className="link-hover text-xl font-extrabold" dir="ltr">{row.ticker}</Link><p className="mt-1 text-xs text-text-muted">{row.company_name ?? t(market)}</p></div><span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">{t(match.pattern)}</span></div>
        {!open && <Sketch match={match} />}
        <div className="mt-4 flex items-center justify-between text-xs"><span className="text-text-muted">{t('fit')}</span><span className="font-bold tabular-nums">{Math.round(match.confidence*100)}%</span></div><div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-alt"><div className="h-full rounded-full bg-primary" style={{width:Math.max(0,Math.min(100,match.confidence*100))+'%'}} /></div>
        <dl className="my-5 grid grid-cols-3 gap-2 text-sm">{[['close',row.close],['breakout',match.breakoutLevel],['invalidation',match.invalidationLevel]].map(([label,value]) => <div key={label}><dt className="text-[11px] text-text-muted">{t(label as 'close')}</dt><dd className="mt-1 font-bold tabular-nums" dir="ltr">{number(value as number | null)}</dd></div>)}</dl>
        <button aria-expanded={open} onClick={()=>setExpanded(open?null:id)} className="ui-control w-full rounded-xl px-4 py-2.5 text-sm font-bold">{t(open?'hide':'open')}</button>
        {open && <div className="mt-5"><SetupChart key={(requestedJob?.id ?? "snapshot")+id} snapshot={row} pattern={match.pattern} jobId={requestedJob?.id} /></div>}
      </article>; })}</div>}
      <footer className="flex flex-wrap justify-between gap-3 text-xs text-text-muted"><p>{t('quality')}</p>{data.updatedAt && <p>{t('updated')}: {new Date(data.updatedAt).toLocaleString(locale)}</p>}</footer>
    </>}
  </div>;
}

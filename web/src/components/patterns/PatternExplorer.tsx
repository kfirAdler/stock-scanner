"use client";

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { CandlestickChart } from '@/components/chart/CandlestickChart';
import type { PatternKind, PatternPayload, PatternSnapshot } from '@/lib/patterns/types';
import { PatternPreview } from './PatternPreview';
import { ScanSummary } from './ScanSummary';

const kinds: PatternKind[] = ['ascending_triangle', 'channel', 'cup_and_handle'];
const noSma: number[] = [];
type ResultView = 'strict' | 'developing';

function SetupChart({ snapshot, pattern, jobId, view }: {
  snapshot: PatternSnapshot; pattern: PatternKind; jobId?: string; view: ResultView;
}) {
  const t = useTranslations('patterns');
  const [row,setRow] = useState<PatternSnapshot | null>(null);
  const [error,setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const url = jobId
      ? '/api/patterns/requests/detail?jobId='+encodeURIComponent(jobId)+'&ticker='+encodeURIComponent(snapshot.ticker)
      : '/api/patterns?market='+snapshot.market+'&ticker='+encodeURIComponent(snapshot.ticker);
    fetch(url, { signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { if (!data.row) setError(true); else setRow(data.row); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [snapshot.market,snapshot.ticker,jobId]);
  const bars = useMemo(() => (row?.candles ?? []).map(c => ({ ...c, trade_date: c.date, volume: 0 })), [row]);
  if (error) return <p role="alert" className="p-6 text-danger">{t('noChart')}</p>;
  if (!row) return <p role="status" className="p-6 text-text-muted">{t('loading')}</p>;
  const developing = view==='developing' ? row.developing?.find(d=>d.match.pattern===pattern) : undefined;
  const match = view==='developing' ? developing?.match : row.matches.find(m => m.pattern === pattern);
  if (!match || row.status !== 'scanned' || !bars.length) return <p className="p-6">{t('staleDetail')}</p>;
  return <div className="space-y-3" dir="ltr">
    <CandlestickChart bars={bars} smaPeriods={noSma} patternLines={match.lines} patternBreachIndices={developing?.breachIndices}
      patternLevels={{breakout:match.breakoutLevel,invalidation:match.invalidationLevel,breakoutLabel:t('breakout'),invalidationLabel:t('invalidation')}} height={360} />
    <p className="text-xs text-text-muted">{t('asOf')}: {row.as_of} · {t('daily')}{developing?' · '+t('breachLegend'):''}</p>
  </div>;
}

export function PatternExplorer() {
  const t = useTranslations('patterns');
  const locale = useLocale();
  const [market,setMarket] = useState<'US' | 'TA'>('US');
  const [kind,setKind] = useState<PatternKind | 'all'>('all');
  const [view,setView] = useState<ResultView>('strict');
  const [search,setSearch] = useState('');
  const [sharedData,setData] = useState<PatternPayload | null>(null);
  const data = sharedData;
  const [status,setStatus] = useState('loading');
  const displayStatus = status;
  const [retry,setRetry] = useState(0);
  const [expanded,setExpanded] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/patterns?market='+market, { signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(payload => { setData(payload); setStatus('ready'); })
      .catch(e => { if (!controller.signal.aborted) setStatus(e.message==='401'?'login':e.message==='403'?'subscribe':'error'); });
    return () => controller.abort();
  }, [market,retry]);
  const cards = useMemo(() => (data?.rows ?? [])
    .filter(r => (r.ticker+' '+(r.company_name ?? '')).toLowerCase().includes(search.toLowerCase().trim()))
    .flatMap(row => (view==='strict'
      ? row.matches.map(match=>({row,match,developing:undefined}))
      : (row.developing??[]).map(developing=>({row,match:developing.match,developing})))
      .filter(card=>kind==='all'||card.match.pattern===kind))
    .sort((a,b) => b.match.confidence-a.match.confidence || a.row.ticker.localeCompare(b.row.ticker)), [data,search,kind,view]);
  const developingCount = data?.rows.filter(r=>r.developing?.length).length ?? 0;
  const number = (value: number | null) => value===null?'—':new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(value);
  const emptySharedChannel = kind==='channel' && !search.trim() && !!data?.coverage.scanned;
  const filtered = !!search.trim() || kind!=='all';
  function reload() {  setView('strict'); setStatus('loading'); setExpanded(null); setRetry(v=>v+1); }
  function changeView(next: ResultView) { setView(next); setExpanded(null); }
  return <div className="page-shell page-stack">
    <section className="flex flex-col gap-5 rounded-3xl border border-border bg-gradient-to-br from-primary-soft via-surface-raised to-surface p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div className="max-w-2xl"><p className="text-xs font-bold tracking-[.2em] text-primary">{t('eyebrow')}</p><h1 className="mt-2 text-4xl font-extrabold">{t('title')}</h1><p className="mt-3 max-w-xl text-sm text-text-secondary">{t('subtitle')}</p></div>
      <div className="inline-flex shrink-0 self-start gap-1 rounded-xl border border-border bg-surface-raised p-1 sm:self-center">{(['US','TA'] as const).map(m=><button key={m} aria-pressed={market===m} onClick={()=>{if(m!==market){setMarket(m);setData(null);setStatus('loading');setExpanded(null);setView('strict');}}} className={'rounded-lg px-5 py-2 text-sm font-bold '+(market===m?'bg-primary text-on-primary':'text-text-secondary')}>{t(m)}</button>)}</div>
    </section>
    {displayStatus==='loading' && <div role="status" className="page-card animate-pulse py-16 text-center">{t('loading')}</div>}
    {displayStatus!=='ready' && displayStatus!=='loading' && <div role="alert" className="page-empty-state text-center"><p>{t(status==='login'?'login':status==='subscribe'?'subscribe':'error')}</p>{status==='login'||status==='subscribe'?<Link className="mt-4 inline-block font-bold text-primary" href={status==='login'?'/auth/login':'/settings'}>{t(status==='login'?'login':'settings')}</Link>:<button className="ui-control mt-4 rounded-xl px-5 py-2" onClick={reload}>{t('retry')}</button>}</div>}
    {displayStatus==='ready' && data && <>
      <ScanSummary data={data} pattern={kind==='all'?undefined:kind} requested={false} />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap gap-2">{(['all',...kinds] as const).map(k=><button key={k} onClick={()=>{setKind(k);setView('strict');setExpanded(null);}} aria-pressed={kind===k} className={'rounded-full border px-4 py-2 text-sm font-semibold '+(kind===k?'border-primary bg-primary-soft text-primary':'border-border bg-surface-raised text-text-secondary')}>{t(k)}</button>)}</div><input aria-label={t('search')} placeholder={t('search')} value={search} onChange={e=>setSearch(e.target.value)} className="ui-control rounded-xl px-4 py-3 text-sm lg:w-64" /></div>
      {!cards.length ? <div className="page-empty-state py-12 text-center"><h2 className="text-xl font-bold">{t(!data.coverage.total?'waiting':emptySharedChannel?'noChannels':filtered?'empty':view==='developing'?'noDeveloping':'noStrictMatches')}</h2><p className="mx-auto mt-2 max-w-xl text-sm text-text-muted">{t(!data.coverage.total?'waitingBody':emptySharedChannel?'noChannelsBody':filtered?'emptyBody':view==='developing'?'noDevelopingBody':'strictEmptyBody')}</p>{filtered && !emptySharedChannel && <button className="mt-4 text-primary" onClick={()=>{setKind('all');setSearch('');}}>{t('reset')}</button>}{!filtered && view==='strict' && developingCount>0 && <button className="mt-5 rounded-xl bg-warning-soft px-5 py-3 text-sm font-bold text-warning" onClick={()=>changeView('developing')}>{t('viewDeveloping',{count:developingCount})}</button>}</div> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{cards.map(({row,match,developing})=>{const id=row.ticker+':'+match.pattern+':'+view;const open=expanded===id;return <article key={id} className={'page-card !p-5 '+(open?'md:col-span-2 xl:col-span-3':'ui-elevated-hover')}>
        <div className="flex items-start justify-between gap-3"><div><Link href={'/ticker/'+encodeURIComponent(row.ticker)} className="link-hover text-xl font-extrabold" dir="ltr">{row.ticker}</Link><p className="mt-1 text-xs text-text-muted">{row.company_name??t(market)}</p></div><span className={'rounded-full px-3 py-1 text-xs font-bold '+(developing?'bg-warning-soft text-warning':'bg-primary-soft text-primary')}>{t(developing?'developingBadge':match.pattern)}</span></div>
        {!open && <PatternPreview preview={row.preview} match={match} breachIndices={developing?.breachIndices} />}
        {developing && <div className="my-4 rounded-xl border border-warning/20 bg-warning-soft p-3 text-xs text-warning"><p className="font-bold">{t('missedBoundaryRule')}</p><p className="mt-1">{t('breachDetail',{count:developing.breachCount,percent:number(developing.maxBreachPercent)})}</p></div>}
        <div className="mt-4 flex items-center justify-between text-xs"><span className="text-text-muted">{t('fit')}</span><span className="font-bold tabular-nums">{Math.round(match.confidence*100)}%</span></div><div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-alt"><div className={'h-full rounded-full '+(developing?'bg-warning':'bg-primary')} style={{width:Math.max(0,Math.min(100,match.confidence*100))+'%'}} /></div>
        <dl className="my-5 grid grid-cols-3 gap-2 text-sm">{[['close',row.close],['breakout',match.breakoutLevel],['invalidation',match.invalidationLevel]].map(([label,value])=><div key={label}><dt className="text-[11px] text-text-muted">{t(label as 'close')}</dt><dd className="mt-1 font-bold tabular-nums" dir="ltr">{number(value as number|null)}</dd></div>)}</dl>
        <button aria-expanded={open} onClick={()=>setExpanded(open?null:id)} className="ui-control w-full rounded-xl px-4 py-2.5 text-sm font-bold">{t(open?'hide':'open')}</button>
        {open && <div className="mt-5"><SetupChart key={'snapshot'+id} snapshot={row} pattern={match.pattern} view={view} /></div>}
      </article>;})}</div>}
      <p className="text-xs text-text-muted">{t('quality')}</p>
    </>}
  </div>;
}

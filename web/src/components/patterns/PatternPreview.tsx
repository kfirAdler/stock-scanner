"use client";
import { useId } from 'react';
import { useTranslations } from 'next-intl';
import type { CandlePreview, PatternMatch } from '@/lib/patterns/types';

export function PatternPreview({ preview, match, breachIndices = [] }: {
  preview?: CandlePreview | null; match: PatternMatch; breachIndices?: number[];
}) {
  const t = useTranslations('patterns');
  const clip = useId();
  if (!preview?.candles.length) return <div className="my-4 flex h-36 items-center justify-center rounded-xl bg-surface-alt px-4 text-center text-xs text-text-muted">{t('previewUnavailable')}</div>;
  const candles = preview.candles;
  const low = Math.min(...candles.map(c=>c[2]));
  const high = Math.max(...candles.map(c=>c[1]));
  const padding = Math.max((high-low)*.12, high*.001);
  const y = (v: number) => 136 - (v-low+padding)/(high-low+2*padding)*120;
  const x = (index: number) => 8 + (index-preview.offset+.5)/candles.length*304;
  const width = Math.max(1,304/candles.length*.6);
  const breaches = new Set(breachIndices);
  return <figure className="my-4 overflow-hidden rounded-xl border border-border bg-surface-alt/50" dir="ltr">
    <svg viewBox="0 0 320 152" role="img" aria-label={t('previewLabel',{count:candles.length})} className="h-40 w-full">
      <defs><clipPath id={clip}><rect x="4" y="4" width="312" height="144" /></clipPath></defs>
      {[36,76,116].map(v=><path key={v} d={'M 4 '+v+' H 316'} stroke="currentColor" opacity=".07" />)}
      <g clipPath={'url(#'+clip+')'}>{candles.map((c,i)=>{const px=x(preview.offset+i);const breached=breaches.has(preview.offset+i);const color=breached?'var(--color-warning)':c[3]>=c[0]?'var(--color-chart-up)':'var(--color-chart-down)';return <g key={i}><line x1={px} x2={px} y1={y(c[1])} y2={y(c[2])} stroke={color} /><rect x={px-width/2} y={y(Math.max(c[0],c[3]))} width={width} height={Math.max(1,Math.abs(y(c[0])-y(c[3])))} fill={color} />{breached && <circle cx={px} cy={y(c[1])-4} r="2" fill="var(--color-warning)" />}</g>;})}
      {match.lines.map((line,i)=><line key={i} x1={x(line.x1)} x2={x(line.x2)} y1={y(line.y1)} y2={y(line.y2)} stroke={line.style==='support'?'var(--color-neon)':line.style==='guide'?'var(--color-accent)':'var(--color-primary)'} strokeWidth="1.6" strokeDasharray={line.style==='guide'?'4 3':undefined} />)}</g>
    </svg><figcaption className="px-3 pb-2 text-[10px] text-text-muted">{t('previewLabel',{count:candles.length})}{breaches.size>0?' · '+t('breachLegend'):''}</figcaption>
  </figure>;
}

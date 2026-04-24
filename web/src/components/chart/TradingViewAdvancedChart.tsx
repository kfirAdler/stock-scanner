"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTheme } from "next-themes";
import type { TvStudySpec } from "@/lib/screener-query";

type TvWidget = { remove?: () => void };

declare global {
  interface Window {
    TradingView?: {
      widget: new (opts: Record<string, unknown>) => TvWidget;
    };
  }
}

function loadTradingViewScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.TradingView) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://s3.tradingview.com/tv.js"]'
    );
    if (existing) {
      if (window.TradingView) resolve();
      else existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("TradingView script failed to load"));
    document.head.appendChild(script);
  });
}

interface TradingViewAdvancedChartProps {
  symbol: string;
  height?: number;
  studies?: TvStudySpec[];
  /** Stable fingerprint of `studies` so the effect does not thrash on new array refs. */
  studiesKey?: string;
  locale?: string;
}

export function TradingViewAdvancedChart({
  symbol,
  height = 560,
  studies = [],
  studiesKey,
  locale = "en",
}: TradingViewAdvancedChartProps) {
  const reactId = useId().replace(/:/g, "");
  const containerId = `tv_chart_${reactId}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<TvWidget | null>(null);
  const studiesRef = useRef(studies);
  studiesRef.current = studies;
  const { resolvedTheme } = useTheme();
  const [scriptError, setScriptError] = useState(false);
  const tvLocale = locale === "he" ? "he_IL" : "en";
  const studiesDep = studiesKey ?? JSON.stringify(studies);

  useEffect(() => {
    setScriptError(false);
  }, [symbol]);

  useEffect(() => {
    let cancelled = false;
    let rafId = 0;

    (async () => {
      try {
        await loadTradingViewScript();
      } catch {
        if (!cancelled) setScriptError(true);
        return;
      }
      if (cancelled || !containerRef.current || !window.TradingView) return;

      rafId = requestAnimationFrame(() => {
        if (cancelled || !containerRef.current || !window.TradingView) return;

        const el = containerRef.current;
        widgetRef.current?.remove?.();
        widgetRef.current = null;
        el.innerHTML = "";

        const theme = resolvedTheme === "dark" ? "dark" : "light";
        const latestStudies = studiesRef.current;

        const opts: Record<string, unknown> = {
          autosize: true,
          symbol,
          interval: "D",
          timezone: "America/New_York",
          theme,
          style: "1",
          locale: tvLocale,
          toolbar_bg: theme === "dark" ? "#131722" : "#f1f3f6",
          enable_publishing: false,
          allow_symbol_change: false,
          hide_side_toolbar: false,
          hide_top_toolbar: false,
          hide_legend: false,
          hide_volume: false,
          details: true,
          hotlist: true,
          calendar: true,
          container_id: containerId,
          width: "100%",
          height,
        };

        if (latestStudies.length > 0) {
          opts.studies = latestStudies;
        }

        widgetRef.current = new window.TradingView.widget(opts);
      });
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      widgetRef.current?.remove?.();
      widgetRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [symbol, height, resolvedTheme, studiesDep, containerId, tvLocale]);

  if (scriptError) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-border bg-surface-alt px-4 text-center text-sm text-text-secondary"
        style={{ height }}
      >
        Chart could not load. Check your network or try again later.
      </div>
    );
  }

  return (
    <div
      dir="ltr"
      className="w-full overflow-hidden rounded-2xl border border-border bg-surface-alt"
      style={{ height }}
    >
      <div ref={containerRef} id={containerId} className="h-full w-full" />
    </div>
  );
}

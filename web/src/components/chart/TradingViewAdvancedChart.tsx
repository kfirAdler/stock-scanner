"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import type { TvStudySpec } from "@/lib/screener-query";

type TvWidget = { id?: string; iframe?: HTMLIFrameElement; remove?: () => void };

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
  compact?: boolean;
  drawingTools?: boolean;
}

export function TradingViewAdvancedChart({
  symbol,
  height = 560,
  studies = [],
  studiesKey,
  locale = "en",
  compact = false,
  drawingTools = false,
}: TradingViewAdvancedChartProps) {
  const reactId = useId().replace(/:/g, "");
  const containerId = `tv_chart_${reactId}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<TvWidget | null>(null);
  const studiesRef = useRef(studies);
  const { resolvedTheme } = useTheme();
  const [scriptErrorSymbol, setScriptErrorSymbol] = useState<string | null>(null);
  const tvLocale = locale === "he" ? "he_IL" : "en";
  const studiesDep = studiesKey ?? JSON.stringify(studies);

  // tv.js remove() looks up its iframe by ID and assumes it still has a
  // parentNode. React may have already detached it during a passive cleanup.
  const removeWidget = useCallback(() => {
    const widget = widgetRef.current;
    widgetRef.current = null;
    const iframe = widget?.id ? document.getElementById(widget.id) : widget?.iframe;
    if (iframe?.parentNode) widget?.remove?.();
  }, []);

  useEffect(() => {
    studiesRef.current = studies;
  }, [studies, studiesDep]);

  useLayoutEffect(() => {
    let cancelled = false;
    let rafId = 0;
    let activeContainer: HTMLDivElement | null = null;

    (async () => {
      try {
        await loadTradingViewScript();
      } catch {
        if (!cancelled) setScriptErrorSymbol(symbol);
        return;
      }
      if (cancelled || !containerRef.current || !window.TradingView) return;

      rafId = requestAnimationFrame(() => {
        if (cancelled || !containerRef.current || !window.TradingView) return;

        const el = containerRef.current;
        activeContainer = el;
        removeWidget();
        el.replaceChildren();

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
          hide_side_toolbar: compact && !drawingTools,
          hide_top_toolbar: compact,
          hide_legend: compact,
          hide_volume: compact,
          details: !compact,
          hotlist: !compact,
          calendar: !compact,
          withdateranges: !compact,
          save_image: !compact,
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
      removeWidget();
      if (activeContainer) {
        activeContainer.replaceChildren();
      }
    };
  }, [symbol, height, resolvedTheme, studiesDep, containerId, tvLocale, compact, drawingTools, removeWidget]);

  if (scriptErrorSymbol === symbol) {
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

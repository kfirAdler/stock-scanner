import { clsx } from "clsx";
import type { CSSProperties } from "react";

const candles = [
  { bodyTop: 48, bodyHeight: 22, wickTop: 38, wickBottom: 78, down: false },
  { bodyTop: 31, bodyHeight: 28, wickTop: 22, wickBottom: 68, down: false },
  { bodyTop: 27, bodyHeight: 32, wickTop: 17, wickBottom: 73, down: true },
  { bodyTop: 12, bodyHeight: 38, wickTop: 3, wickBottom: 61, down: false },
];

type CandleStyle = CSSProperties & {
  "--candle-body-top": string;
  "--candle-body-height": string;
  "--candle-wick-top": string;
  "--candle-wick-bottom": string;
};

export function CandlestickLoader({
  label,
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={clsx("candlestick-loader", compact && "candlestick-loader-compact")}
      role={label ? "status" : undefined}
      aria-live={label ? "polite" : undefined}
    >
      <div className="candlestick-loader-chart" aria-hidden="true">
        {candles.map((candle, index) => {
          const style: CandleStyle = {
            "--candle-body-top": `${candle.bodyTop}px`,
            "--candle-body-height": `${candle.bodyHeight}px`,
            "--candle-wick-top": `${candle.wickTop}px`,
            "--candle-wick-bottom": `${candle.wickBottom}px`,
          };
          return (
            <span
              key={index}
              className={clsx("candlestick-loader-candle", candle.down && "is-down")}
              style={style}
            >
              <span className="candlestick-loader-wick candlestick-loader-wick-top" />
              <span className="candlestick-loader-body" />
              <span className="candlestick-loader-wick candlestick-loader-wick-bottom" />
            </span>
          );
        })}
      </div>
      {label ? <p className="candlestick-loader-label">{label}</p> : null}
    </div>
  );
}

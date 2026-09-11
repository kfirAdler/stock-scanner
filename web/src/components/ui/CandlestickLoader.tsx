import { clsx } from "clsx";

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
        {[false, false, true, false].map((down, index) => (
          <span key={index} className={clsx("candlestick-loader-candle", down && "is-down")}>
            <span className="candlestick-loader-wick candlestick-loader-wick-top" />
            <span className="candlestick-loader-body" />
            <span className="candlestick-loader-wick candlestick-loader-wick-bottom" />
          </span>
        ))}
      </div>
      {label ? <p className="candlestick-loader-label">{label}</p> : null}
    </div>
  );
}

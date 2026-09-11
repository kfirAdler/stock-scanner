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
        {[0, 1, 2, 3].map((index) => (
          <span key={index} className="candlestick-loader-candle">
            <span className="candlestick-loader-wick" />
            <span className="candlestick-loader-body" />
          </span>
        ))}
      </div>
      {label ? <p className="candlestick-loader-label">{label}</p> : null}
    </div>
  );
}

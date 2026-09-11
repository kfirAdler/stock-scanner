export function MarketBackdrop() {
  const candles = [
    { x: 110, open: 690, close: 640 },
    { x: 205, open: 655, close: 585 },
    { x: 300, open: 600, close: 625, down: true },
    { x: 395, open: 620, close: 535 },
    { x: 490, open: 548, close: 475 },
    { x: 585, open: 490, close: 515, down: true },
    { x: 680, open: 505, close: 420 },
    { x: 775, open: 435, close: 360 },
    { x: 870, open: 375, close: 400, down: true },
    { x: 965, open: 395, close: 305 },
    { x: 1060, open: 320, close: 255 },
    { x: 1155, open: 270, close: 292, down: true },
    { x: 1250, open: 285, close: 205 },
    { x: 1345, open: 220, close: 155 },
  ];

  return (
    <svg
      aria-hidden="true"
      className="market-backdrop"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="market-backdrop-line" x1="0" x2="1" y1="1" y2="0">
          <stop offset="0" stopColor="var(--color-primary)" stopOpacity="0.12" />
          <stop offset="0.58" stopColor="var(--color-neon)" stopOpacity="0.52" />
          <stop offset="1" stopColor="var(--color-neon)" stopOpacity="0.08" />
        </linearGradient>
        <radialGradient id="market-backdrop-glow" cx="72%" cy="28%" r="52%">
          <stop offset="0" stopColor="var(--color-neon)" stopOpacity="0.12" />
          <stop offset="1" stopColor="var(--color-neon)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#market-backdrop-glow)" />
      <g className="market-backdrop-grid">
        {[160, 320, 480, 640, 800, 960, 1120, 1280, 1440].map((x) => <line key={`x-${x}`} x1={x} x2={x} y1="70" y2="830" />)}
        {[150, 280, 410, 540, 670, 800].map((y) => <line key={`y-${y}`} x1="45" x2="1555" y1={y} y2={y} />)}
      </g>
      <path
        className="market-backdrop-trend"
        d="M55 770 C230 730 270 650 420 625 S650 505 785 470 S1010 350 1160 320 S1360 205 1540 125"
      />
      <g className="market-backdrop-candles">
        {candles.map((candle, index) => {
          const top = Math.min(candle.open, candle.close);
          const height = Math.max(22, Math.abs(candle.close - candle.open));
          const wickTop = top - 22 - (index % 3) * 5;
          const wickBottom = top + height + 24 + (index % 2) * 7;
          return (
            <g key={candle.x} className={candle.down ? "is-down" : "is-up"}>
              <line x1={candle.x} x2={candle.x} y1={wickTop} y2={top} />
              <rect x={candle.x - 18} y={top} width="36" height={height} rx="5" />
              <line x1={candle.x} x2={candle.x} y1={top + height} y2={wickBottom} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

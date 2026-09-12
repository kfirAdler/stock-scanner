"use client";

import { useEffect, useRef } from "react";

type MarketTicker = {
  symbol: string;
  price: number;
  change: number;
  x: number;
  y: number;
  z: number;
  speed: number;
  opacity: number;
};

type Particle = { x: number; y: number; z: number; speed: number; size: number };
type ChartTrace = { y: number; amplitude: number; phase: number; speed: number; color: string };

const STOCKS = [
  ["NVDA", 182.14, 2.84], ["AAPL", 239.41, 1.16], ["AMZN", 231.76, -0.72],
  ["MSFT", 516.28, 0.94], ["META", 748.53, 1.88], ["TSLA", 347.22, -1.34],
  ["GOOG", 208.19, 0.63], ["NFLX", 1217.45, -0.48], ["AMD", 168.32, 2.12],
  ["AVGO", 356.91, 1.42], ["PLTR", 176.08, -0.91], ["SPY", 672.55, 0.38],
  ["QQQ", 601.42, 0.57], ["JPM", 309.17, -0.36], ["COST", 963.84, 0.74],
] as const;

const FOV = 700;
const random = (min: number, max: number) => min + Math.random() * (max - min);

function resetTicker(ticker: MarketTicker, width: number, height: number, initial = false) {
  const stock = STOCKS[Math.floor(Math.random() * STOCKS.length)];
  ticker.symbol = stock[0];
  ticker.price = stock[1];
  ticker.change = stock[2];
  ticker.x = random(-width * 0.9, width * 0.9);
  ticker.y = random(-height * 0.62, height * 0.62);
  ticker.z = initial ? random(320, 1550) : random(1150, 1650);
  ticker.speed = random(0.42, 1.05);
  ticker.opacity = random(0.28, 0.72);
}

function resetParticle(particle: Particle, width: number, height: number, initial = false) {
  particle.x = random(-width, width);
  particle.y = random(-height, height);
  particle.z = initial ? random(220, 1500) : random(1200, 1650);
  particle.speed = random(0.28, 0.72);
  particle.size = random(0.7, 1.7);
}

export function MarketPulseBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasNode = canvasRef.current;
    const contextNode = canvasNode?.getContext("2d");
    if (!canvasNode || !contextNode) return;

    // Stable aliases retain their non-null types inside animation callbacks.
    const canvas: HTMLCanvasElement = canvasNode;
    const context: CanvasRenderingContext2D = contextNode;

    let width = 0;
    let height = 0;
    let frame = 0;
    let lastTime = performance.now();
    let pointerX = 0;
    let pointerY = 0;
    let parallaxX = 0;
    let parallaxY = 0;
    let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let tickers: MarketTicker[] = [];
    let particles: Particle[] = [];
    const traces: ChartTrace[] = [
      { y: 0.26, amplitude: 24, phase: 0.2, speed: 0.00005, color: "74, 222, 170" },
      { y: 0.72, amplitude: 34, phase: 2.4, speed: 0.000035, color: "96, 145, 255" },
      { y: 0.48, amplitude: 18, phase: 4.1, speed: 0.00004, color: "255, 107, 107" },
    ];

    function populate() {
      const mobile = width < 768;
      tickers = Array.from({ length: mobile ? 14 : 34 }, () => {
        const ticker = {} as MarketTicker;
        resetTicker(ticker, width, height, true);
        return ticker;
      });
      particles = Array.from({ length: mobile ? 14 : 32 }, () => {
        const particle = {} as Particle;
        resetParticle(particle, width, height, true);
        return particle;
      });
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      populate();
      if (reducedMotion) draw(performance.now());
    }

    function drawTraces(time: number) {
      for (const trace of traces) {
        context.beginPath();
        for (let x = -20; x <= width + 20; x += 18) {
          const progress = x / Math.max(width, 1);
          const trend = (progress - 0.5) * -42;
          const wave = Math.sin(progress * 11 + trace.phase + time * trace.speed) * trace.amplitude;
          const detail = Math.sin(progress * 29 + trace.phase * 2) * trace.amplitude * 0.22;
          const y = height * trace.y + trend + wave + detail + parallaxY * 0.12;
          if (x === -20) context.moveTo(x + parallaxX * 0.12, y);
          else context.lineTo(x + parallaxX * 0.12, y);
        }
        context.strokeStyle = `rgba(${trace.color}, 0.09)`;
        context.lineWidth = 1.2;
        context.stroke();
      }
    }

    function drawCandles(time: number) {
      const strips = width < 768 ? 2 : 4;
      for (let strip = 0; strip < strips; strip++) {
        const baseY = height * (0.22 + strip * 0.19);
        const drift = ((time * 0.006 + strip * 190) % 90) - 45;
        for (let index = 0; index < 10; index++) {
          const x = strip % 2 === 0
            ? width * 0.05 + index * 31 + drift
            : width * 0.68 + index * 31 - drift;
          const rise = index * 4.4;
          const body = 8 + ((index * 7 + strip * 3) % 13);
          const down = (index + strip * 2) % 4 === 2;
          const top = baseY - rise - (down ? 0 : body);
          context.strokeStyle = down ? "rgba(255, 107, 107, 0.1)" : "rgba(69, 230, 168, 0.1)";
          context.fillStyle = down ? "rgba(255, 107, 107, 0.055)" : "rgba(69, 230, 168, 0.055)";
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(x, top - 7);
          context.lineTo(x, top);
          context.moveTo(x, top + body);
          context.lineTo(x, top + body + 8);
          context.stroke();
          context.fillRect(x - 4, top, 8, body);
        }
      }
    }

    function draw(time: number) {
      const elapsed = Math.min(2, (time - lastTime) / 16.67);
      lastTime = time;
      context.clearRect(0, 0, width, height);
      parallaxX += (pointerX - parallaxX) * 0.035;
      parallaxY += (pointerY - parallaxY) * 0.035;
      drawTraces(time);
      drawCandles(time);

      for (const particle of particles) {
        if (!reducedMotion) particle.z -= particle.speed * elapsed;
        if (particle.z < 90) resetParticle(particle, width, height);
        const scale = FOV / particle.z;
        const x = width / 2 + (particle.x + parallaxX * 0.45) * scale;
        const y = height / 2 + (particle.y + parallaxY * 0.45) * scale;
        const alpha = Math.min(0.32, 0.035 + scale * 0.08);
        context.beginPath();
        context.arc(x, y, Math.min(3, particle.size * scale), 0, Math.PI * 2);
        context.fillStyle = `rgba(164, 213, 255, ${alpha})`;
        context.fill();
      }

      const safeWidth = Math.min(560, width * 0.78);
      const safeHeight = Math.min(690, height * 0.82);
      const safeLeft = (width - safeWidth) / 2;
      const safeTop = (height - safeHeight) / 2;
      for (const ticker of tickers) {
        if (!reducedMotion) ticker.z -= ticker.speed * elapsed;
        if (ticker.z < 95) resetTicker(ticker, width, height);
        const scale = FOV / ticker.z;
        const x = width / 2 + (ticker.x + parallaxX) * scale;
        const y = height / 2 + (ticker.y + parallaxY) * scale;
        if ((x < -180 || x > width + 180 || y < -100 || y > height + 100) && ticker.z < 360) {
          resetTicker(ticker, width, height);
          continue;
        }
        const inSafeZone = x > safeLeft && x < safeLeft + safeWidth && y > safeTop && y < safeTop + safeHeight;
        const depthAlpha = Math.min(0.72, 0.08 + scale * 0.21) * ticker.opacity * (inSafeZone ? 0.12 : 1);
        const fontSize = Math.max(10, Math.min(width < 768 ? 30 : 58, 13 * scale));
        const positive = ticker.change >= 0;
        const color = positive ? "69, 230, 168" : "255, 107, 107";
        context.save();
        context.globalAlpha = depthAlpha;
        context.shadowBlur = ticker.z < 270 ? 12 : 4;
        context.shadowColor = `rgba(${color}, 0.42)`;
        context.fillStyle = `rgb(${color})`;
        context.font = `700 ${fontSize}px Assistant, sans-serif`;
        context.textAlign = "center";
        context.fillText(ticker.symbol, x, y);
        context.shadowBlur = 0;
        context.fillStyle = "rgba(225, 238, 246, 0.76)";
        context.font = `500 ${Math.max(8, fontSize * 0.5)}px Assistant, sans-serif`;
        context.fillText(`${ticker.price.toFixed(2)}  ${positive ? "▲" : "▼"} ${positive ? "+" : ""}${ticker.change.toFixed(2)}%`, x, y + fontSize * 0.72);
        context.restore();
      }

      if (!reducedMotion) frame = requestAnimationFrame(draw);
    }

    function onPointerMove(event: PointerEvent) {
      pointerX = (event.clientX / Math.max(width, 1) - 0.5) * 22;
      pointerY = (event.clientY / Math.max(height, 1) - 0.5) * 14;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    function onMotionChange(event: MediaQueryListEvent) {
      reducedMotion = event.matches;
      cancelAnimationFrame(frame);
      lastTime = performance.now();
      draw(lastTime);
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    motionQuery.addEventListener("change", onMotionChange);
    draw(lastTime);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      motionQuery.removeEventListener("change", onMotionChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="market-pulse-canvas" aria-hidden="true" />;
}

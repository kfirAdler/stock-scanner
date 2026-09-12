"use client";

import { useEffect, useRef } from "react";

type DepthLayer = "far" | "mid" | "near";

type MarketTicker = {
  symbol: string;
  price: number;
  change: number;
  x: number;
  y: number;
  z: number;
  speed: number;
  opacity: number;
  layer: DepthLayer;
};

type Particle = { x: number; y: number; z: number; speed: number; size: number };
type ChartTrace = {
  x: number;
  y: number;
  width: number;
  amplitude: number;
  phase: number;
  speed: number;
  color: string;
  opacity: number;
};

const STOCKS = [
  ["NVDA", 182.14, 2.84], ["AAPL", 239.41, 1.16], ["AMZN", 231.76, -0.72],
  ["MSFT", 516.28, 0.94], ["META", 748.53, 1.88], ["TSLA", 347.22, -1.34],
  ["GOOG", 208.19, 0.63], ["NFLX", 1217.45, -0.48], ["AMD", 168.32, 2.12],
  ["AVGO", 356.91, 1.42], ["PLTR", 176.08, -0.91], ["SPY", 672.55, 0.38],
  ["QQQ", 601.42, 0.57], ["JPM", 309.17, -0.36], ["COST", 963.84, 0.74],
] as const;

const FOV = 700;
const random = (min: number, max: number) => min + Math.random() * (max - min);

function layerRange(layer: DepthLayer, initial: boolean) {
  if (layer === "far") return initial ? [900, 1600] : [1250, 1650];
  if (layer === "mid") return initial ? [350, 900] : [760, 980];
  return initial ? [130, 500] : [360, 520];
}

function resetTicker(
  ticker: MarketTicker,
  width: number,
  height: number,
  layer: DepthLayer,
  initial = false
) {
  const stock = STOCKS[Math.floor(Math.random() * STOCKS.length)];
  const [minimumZ, maximumZ] = layerRange(layer, initial);
  ticker.symbol = stock[0];
  ticker.price = stock[1];
  ticker.change = stock[2];
  ticker.layer = layer;
  ticker.x = layer === "near"
    ? (Math.random() < 0.5 ? -1 : 1) * random(width * 0.48, width * 0.76)
    : random(-width * 0.92, width * 0.92);
  ticker.y = random(-height * 0.6, height * 0.6);
  ticker.z = random(minimumZ, maximumZ);
  ticker.speed = layer === "far" ? random(0.5, 1.05) : layer === "mid" ? random(1.1, 2.05) : random(0.8, 1.45);
  ticker.opacity = layer === "far" ? random(0.12, 0.22) : layer === "mid" ? random(0.28, 0.45) : random(0.6, 0.85);
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
      { x: 0.03, y: 0.2, width: 0.23, amplitude: 18, phase: 0.2, speed: 0.00005, color: "66, 230, 164", opacity: 0.12 },
      { x: 0.73, y: 0.18, width: 0.23, amplitude: 23, phase: 2.4, speed: 0.000035, color: "83, 154, 194", opacity: 0.1 },
      { x: 0.04, y: 0.71, width: 0.28, amplitude: 27, phase: 4.1, speed: 0.00004, color: "255, 105, 105", opacity: 0.08 },
      { x: 0.7, y: 0.68, width: 0.26, amplitude: 20, phase: 1.1, speed: 0.000045, color: "66, 230, 164", opacity: 0.11 },
      { x: 0.37, y: 0.89, width: 0.26, amplitude: 14, phase: 3.5, speed: 0.00003, color: "89, 146, 184", opacity: 0.07 },
    ];

    function addTickers(layer: DepthLayer, count: number) {
      for (let index = 0; index < count; index++) {
        const ticker = {} as MarketTicker;
        resetTicker(ticker, width, height, layer, true);
        tickers.push(ticker);
      }
    }

    function populate() {
      const mobile = width < 768;
      tickers = [];
      addTickers("far", mobile ? 12 : 22);
      addTickers("mid", mobile ? 5 : 10);
      if (!mobile) addTickers("near", 2);
      particles = Array.from({ length: mobile ? 16 : 34 }, () => {
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

    function drawStreaks(time: number, cameraX: number, cameraY: number) {
      const originX = width / 2 + cameraX * 0.2;
      const originY = height * 0.47 + cameraY * 0.2;
      const count = width < 768 ? 7 : 12;
      for (let index = 0; index < count; index++) {
        const angle = (Math.PI * 2 * index) / count + 0.16;
        const pulse = 0.88 + Math.sin(time * 0.00018 + index) * 0.06;
        const inner = Math.min(width, height) * 0.32;
        const outer = Math.max(width, height) * 0.82 * pulse;
        context.beginPath();
        context.moveTo(originX + Math.cos(angle) * inner, originY + Math.sin(angle) * inner);
        context.lineTo(originX + Math.cos(angle) * outer, originY + Math.sin(angle) * outer);
        context.strokeStyle = index % 3 === 0 ? "rgba(66, 230, 164, 0.055)" : "rgba(70, 140, 180, 0.04)";
        context.lineWidth = 1;
        context.stroke();
      }
    }

    function drawTraces(time: number, cameraX: number, cameraY: number) {
      for (const trace of traces) {
        const startX = width * trace.x;
        const traceWidth = width * trace.width;
        context.beginPath();
        for (let offset = 0; offset <= traceWidth; offset += 12) {
          const progress = offset / Math.max(traceWidth, 1);
          const trend = (progress - 0.5) * -28;
          const wave = Math.sin(progress * 9 + trace.phase + time * trace.speed) * trace.amplitude;
          const detail = Math.sin(progress * 25 + trace.phase * 2) * trace.amplitude * 0.24;
          const x = startX + offset + cameraX * 0.2;
          const y = height * trace.y + trend + wave + detail + cameraY * 0.2;
          if (offset === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.strokeStyle = `rgba(${trace.color}, ${trace.opacity})`;
        context.lineWidth = 1.2;
        context.stroke();
      }
    }

    function drawCandles(time: number, cameraX: number, cameraY: number) {
      const strips = width < 768 ? 2 : 4;
      for (let strip = 0; strip < strips; strip++) {
        const baseY = height * (0.2 + strip * 0.21) + cameraY * 0.18;
        const startX = strip % 2 === 0 ? width * 0.035 : width * 0.76;
        const drift = reducedMotion ? 0 : ((time * 0.004 + strip * 120) % 44) - 22;
        for (let index = 0; index < 7; index++) {
          const x = startX + index * 27 + (strip % 2 === 0 ? drift : -drift) + cameraX * 0.18;
          const rise = index * 4.2;
          const body = 8 + ((index * 7 + strip * 3) % 13);
          const down = (index + strip * 2) % 4 === 2;
          const top = baseY - rise - (down ? 0 : body);
          context.strokeStyle = down ? "rgba(255, 105, 105, 0.16)" : "rgba(66, 230, 164, 0.16)";
          context.fillStyle = down ? "rgba(255, 105, 105, 0.1)" : "rgba(66, 230, 164, 0.1)";
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
      if (!reducedMotion) {
        parallaxX += (pointerX - parallaxX) * 0.035;
        parallaxY += (pointerY - parallaxY) * 0.035;
      }
      const cameraX = reducedMotion ? 0 : Math.sin(time * 0.00015) * 8;
      const cameraY = reducedMotion ? 0 : Math.cos(time * 0.00011) * 5;
      drawStreaks(time, cameraX, cameraY);
      drawTraces(time, cameraX, cameraY);
      drawCandles(time, cameraX, cameraY);

      for (const particle of particles) {
        if (!reducedMotion) particle.z -= particle.speed * elapsed;
        if (particle.z < 90) resetParticle(particle, width, height);
        const scale = FOV / particle.z;
        const x = width / 2 + (particle.x + (parallaxX + cameraX) * 0.4) * scale;
        const y = height / 2 + (particle.y + (parallaxY + cameraY) * 0.4) * scale;
        const alpha = Math.min(0.3, 0.08 + scale * 0.07);
        context.beginPath();
        context.arc(x, y, Math.min(2.5, particle.size * scale), 0, Math.PI * 2);
        context.fillStyle = `rgba(145, 224, 207, ${alpha})`;
        context.fill();
      }

      const safeWidth = Math.min(620, width * 0.82);
      const safeHeight = Math.min(760, height * 0.86);
      const safeLeft = (width - safeWidth) / 2;
      const safeTop = (height - safeHeight) / 2;

      for (const ticker of tickers) {
        if (!reducedMotion) ticker.z -= ticker.speed * elapsed;
        const resetAt = ticker.layer === "far" ? 850 : ticker.layer === "mid" ? 300 : 78;
        if (ticker.z < resetAt) resetTicker(ticker, width, height, ticker.layer);

        const scale = FOV / ticker.z;
        const layerStrength = ticker.layer === "far" ? 0.2 : ticker.layer === "mid" ? 0.55 : 1;
        const motionX = (parallaxX + cameraX) * layerStrength;
        const motionY = (parallaxY + cameraY) * layerStrength;
        const x = width / 2 + (ticker.x + motionX) * scale;
        const y = height / 2 + (ticker.y + motionY) * scale;
        const inSafeZone = x > safeLeft && x < safeLeft + safeWidth && y > safeTop && y < safeTop + safeHeight;
        const safeMultiplier = inSafeZone ? (ticker.layer === "far" ? 0.42 : 0.08) : 1;
        const alpha = ticker.opacity * safeMultiplier;
        const fontSize = ticker.layer === "far"
          ? Math.max(9, Math.min(16, 11 * scale))
          : ticker.layer === "mid"
            ? Math.max(13, Math.min(30, 13 * scale))
            : Math.max(30, Math.min(80, 13 * scale));
        const positive = ticker.change >= 0;
        const color = positive ? "66, 230, 164" : "255, 105, 105";
        const blur = ticker.layer === "far"
          ? 1.5 + ((ticker.z - 900) / 700) * 1.5
          : ticker.layer === "mid"
            ? Math.max(0, (ticker.z - 350) / 550)
            : ticker.z < 110 ? 4 : 0;

        context.save();
        context.globalAlpha = alpha;
        context.filter = `blur(${width < 768 ? Math.min(1, Math.max(0, blur)) : Math.max(0, blur)}px)`;
        context.shadowBlur = width < 768 ? 0 : ticker.layer === "near" ? (ticker.z < 130 ? 22 : 12) : 4;
        context.shadowColor = `rgba(${color}, ${ticker.layer === "near" ? 0.28 : 0.16})`;
        context.fillStyle = `rgb(${color})`;
        context.font = `700 ${fontSize}px Assistant, sans-serif`;
        context.textAlign = "center";
        context.fillText(ticker.symbol, x, y);
        context.shadowBlur = 0;
        context.fillStyle = "rgba(220, 235, 240, 0.65)";
        context.font = `500 ${Math.max(8, fontSize * 0.48)}px Assistant, sans-serif`;
        const priceLine = `$${ticker.price.toFixed(2)}`;
        const changeLine = `${positive ? "▲ +" : "▼ "}${ticker.change.toFixed(2)}%`;
        if (ticker.layer === "near") {
          context.fillText(priceLine, x, y + fontSize * 0.72);
          context.fillStyle = `rgba(${color}, 0.9)`;
          context.fillText(changeLine, x, y + fontSize * 1.2);
        } else {
          context.fillText(`${priceLine}  ${changeLine}`, x, y + fontSize * 0.72);
        }
        context.restore();
      }

      if (!reducedMotion) frame = requestAnimationFrame(draw);
    }

    function onPointerMove(event: PointerEvent) {
      pointerX = (event.clientX / Math.max(width, 1) - 0.5) * 44;
      pointerY = (event.clientY / Math.max(height, 1) - 0.5) * 28;
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

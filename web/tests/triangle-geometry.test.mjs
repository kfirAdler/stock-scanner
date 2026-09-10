import test from 'node:test';
import assert from 'node:assert/strict';
import { detectAscendingTriangle } from '../src/lib/patterns/engine/detectors.mjs';

function convergingTriangle() {
  return Array.from({ length: 90 }, (_, index) => {
    const support = 100 + index * 0.2;
    const resistance = 131 - index * 0.035;
    const wave = Math.sin((index - 2) * Math.PI / 7);
    const close = (support + resistance) / 2 + wave * (resistance - support) * 0.44;
    return {
      date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
      open: close - 0.1,
      high: close + 0.45,
      low: close - 0.45,
      close,
    };
  });
}

test('ascending triangle draws both fitted edges instead of a horizontal average', () => {
  const match = detectAscendingTriangle(convergingTriangle());
  assert.ok(match);

  const resistance = match.lines.find(line => line.style === 'resistance');
  const support = match.lines.find(line => line.style === 'support');
  assert.ok(resistance);
  assert.ok(support);
  assert.notEqual(resistance.y1, resistance.y2);
  assert.ok(resistance.y2 < resistance.y1);
  assert.ok(support.y2 > support.y1);
  assert.ok((resistance.y2 - support.y2) < (resistance.y1 - support.y1));
  assert.equal(match.breakoutLevel, resistance.y2);
});

test('an expanding wedge is not labeled as an ascending triangle', () => {
  const candles = convergingTriangle().map((candle, index) => ({
    ...candle,
    high: candle.high + index * 0.3,
  }));
  assert.equal(detectAscendingTriangle(candles), null);
});

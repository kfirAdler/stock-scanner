import test from 'node:test';
import assert from 'node:assert/strict';
import { scanSeries } from '../src/lib/patterns/engine/scan.mjs';
import { detectChannel } from '../src/lib/patterns/engine/detectors.mjs';
import { analyzeChannel } from '../src/lib/patterns/engine/channel-diagnostics.mjs';
const now = new Date('2026-09-09T12:00:00Z');
function candles() {return Array.from({length:160},(_,i)=>{const close=100+i*.15+3*Math.sin(i*Math.PI/10);return {date:new Date(now.getTime()-(159-i)*86400000).toISOString().slice(0,10),open:close-.1,high:close+.5,low:close-.5,close};});}
test('strict channels remain strict, with no duplicate developing result',()=>{
  const bars=candles();const strict=detectChannel(bars);const result=analyzeChannel(bars);
  assert.ok(strict);assert.deepEqual(result.match,strict);assert.equal(result.developing,null);assert.equal(result.reason,null);
});
test('2% upper breach is explained as developing and never promoted to strict',()=>{
  const bars=candles();bars.at(-1).high=detectChannel(bars).breakoutLevel*1.02;
  assert.equal(detectChannel(bars),null);
  const result=analyzeChannel(bars);
  assert.equal(result.reason,'upper_breach');assert.equal(result.match,null);
  assert.equal(result.developing.breachCount,1);assert.equal(result.developing.maxBreachPercent,2);
  assert.deepEqual(result.developing.breachIndices,[159]);
});
test('lower breaches are also highlighted, while breaches above 4% are excluded',()=>{
  const bars=candles();const lower=detectChannel(bars).invalidationLevel;
  bars.at(-1).low=lower*.98;
  assert.equal(analyzeChannel(bars).developing.breachCount,1);
  bars.at(-1).low=lower*.94;
  assert.equal(analyzeChannel(bars).developing,null);
});
test('developing rules do not loosen missing pivots or poor channel structure',()=>{
  const bars=candles().map(c=>({...c,open:95,close:95,high:100,low:90}));
  const result=analyzeChannel(bars);assert.equal(result.reason,'few_pivots');assert.equal(result.developing,null);
});
test('request results retain candles for near-matches and previews use original prices and indices',()=>{
  const bars=candles();bars.at(-1).high=detectChannel(bars).breakoutLevel*1.02;
  const row=scanSeries([{ticker:'TEST',candles:bars}],now,'channel')[0];
  assert.deepEqual(row.matches,[]);assert.equal(row.developing.length,1);assert.equal(row.candles.length,160);
  assert.equal(row.preview.offset,112);assert.equal(row.preview.candles.length,48);
  assert.deepEqual(row.preview.candles.at(-1),[bars[159].open,bars[159].high,bars[159].low,bars[159].close]);
});
test('stale and short histories have no diagnostics or developing candidates',()=>{
  for(const input of [candles().slice(0,20),candles().map(c=>({...c,date:c.date.replace('2026','2025')}))]){
    const row=scanSeries([{ticker:'TEST',candles:input}],now,'channel')[0];
    assert.deepEqual(row.developing,[]);assert.equal(row.rejectionReason,undefined);assert.deepEqual(row.candles,[]);
  }
});
test('scheduled snapshots preserve their existing database schema and strict-only results',()=>{
  const row=scanSeries([{ticker:'TEST',candles:candles()}],now)[0];
  for(const key of ['preview','developing','rejectionReason'])assert.equal(Object.hasOwn(row,key),false);
});

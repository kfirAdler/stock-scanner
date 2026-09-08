import test from 'node:test';
import assert from 'node:assert/strict';
import { scanSeries } from './scan.mjs';
import { detectChannel } from './detectors.mjs';
const now = new Date('2026-09-08T12:00:00Z');
function candles(n=160) {
  return Array.from({length:n},(_,i)=> {
    const close = 100+i*.15+3*Math.sin(i*Math.PI/10);
    return {date:new Date(now.getTime()-(n-1-i)*86400000).toISOString().slice(0,10),open:close-.1,high:close+.5,low:close-.5,close};
  });
}
test('scans all symbols beyond REST-sized input and retains only 160 ordered bars',()=>{
  const input = candles(200);
  const rows = scanSeries(Array.from({length:12},(_,i)=>({ticker:'T'+i,candles:[...input].reverse()})),now);
  assert.equal(rows.length,12);
  assert.ok(rows.every(r=>r.status==='scanned' && r.bars_count===160));
});
test('reports short, stale, and malformed histories without false empty coverage',()=>{
  const old = candles().map(c=>({...c,date:c.date.replace('2026','2025')}));
  const rows = scanSeries([{ticker:'SHORT',candles:candles(20)},{ticker:'OLD',candles:old},{ticker:'BAD',candles:[{...candles(1)[0],high:0}]}],now);
  assert.deepEqual(rows.map(r=>r.status),['insufficient_history','stale','insufficient_history']);
  assert.ok(rows.every(r=>r.matches.length===0 && r.candles.length===0));
});
test('preserves channel detection and overlay coordinates in stored candles',()=>{
  const input = candles();
  const match = detectChannel(input);
  assert.ok(match);
  const [row] = scanSeries([{ticker:'CHANNEL',candles:input}],now);
  assert.ok(row.matches.some(m=>m.pattern==='channel'));
  assert.equal(row.candles.length,160);
  for(const m of row.matches) for(const l of m.lines){assert.ok(row.candles[l.x1]);assert.ok(row.candles[l.x2]);}
});
test('deduplicates dates and clears prior matches on insufficient history',()=>{
  const input=candles(30);
  const [row]=scanSeries([{ticker:'DUP',candles:[...input,...input]}],now);
  assert.equal(row.bars_count,30);
  assert.deepEqual(row.matches,[]);
});

test('a selected pattern runs alone with no fallback to other detectors',()=>{
  const input=candles();
  const channel=scanSeries([{ticker:'TEST',candles:input}],now,'channel')[0];
  assert.deepEqual(channel.matches.map(m=>m.pattern),['channel']);
  const triangle=scanSeries([{ticker:'TEST',candles:input}],now,'ascending_triangle')[0];
  assert.deepEqual(triangle.matches,[]);
  assert.throws(()=>scanSeries([],now,'all'), /Invalid pattern/);
});

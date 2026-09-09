const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');
let engine;
before(async()=> { engine = await import(pathToFileURL(path.join(__dirname,'../src/lib/patterns/engine/scan.mjs'))); });
function load(relative, overrides) {
  const source=fs.readFileSync(path.join(__dirname,'../src',relative),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  new Function('require','module','exports',compiled)(name=>overrides[name]??require(name),mod,mod.exports);
  return mod.exports;
}
const job={id:'job',leaseId:'lease',pattern:'channel',market:'US'};
function series(ticker) {
  return {ticker,candles:Array.from({length:160},(_,i)=>{
    const close=100+i*.15+3*Math.sin(i*Math.PI/10);
    return {date:new Date(Date.now()-(159-i)*86400000).toISOString().slice(0,10),open:close-.1,high:close+.5,low:close-.5,close};
  })};
}
function workerFixture({jobs=[job,null],batches={'':[series('ABC')],ABC:[]}}={}) {
  jobs=[...jobs]; const calls=[];
  const db={rpc:(name,args)=>{calls.push([name,args]);const data=name==='claim_pattern_scan'?jobs.shift()??null:name==='pattern_scan_series'?batches[args.p_after]:true;return {abortSignal:async()=>({data,error:null})};}};
  return {worker:load('lib/patterns/worker.ts',{'server-only':{},'@/lib/supabase/server':{createServiceClient:async()=>db},'./engine/scan.mjs':engine}),calls};
}
test('in-app worker executes the real selected detector and publishes candles with coverage',async()=>{
  const f=workerFixture();
  assert.deepEqual(await f.worker.processPatternRequests(),{completed:1,failed:0});
  const payload=f.calls.find(c=>c[0]==='finish_pattern_scan')[1];
  assert.equal(payload.p_lease_id,'lease');
  assert.equal(payload.p_result.coverage.scanned,1);
  assert.equal(payload.p_result.rows[0].matches[0].pattern,'channel');
  assert.equal(payload.p_result.rows[0].candles.length,160);
});
test('preclaimed work is processed without trying to claim it again',async()=>{
  const f=workerFixture({jobs:[null]});
  assert.equal((await f.worker.processPatternRequests(job)).completed,1);
  assert.equal(f.calls[0][0],'pattern_scan_series');
  assert.equal(f.calls.filter(c=>c[0]==='claim_pattern_scan').length,1);
});
test('a scheduled worker that loses the claim race performs no history reads',async()=>{
  const f=workerFixture({jobs:[null]});
  assert.deepEqual(await f.worker.processPatternRequests(),{completed:0,failed:0});
  assert.equal(f.calls.length,1);
});
test('nonmatching selected patterns never fall back to a channel',async()=>{
  const f=workerFixture({jobs:[{...job,pattern:'ascending_triangle'},null]});
  await f.worker.processPatternRequests();
  const result=f.calls.find(c=>c[0]==='finish_pattern_scan')[1].p_result;
  assert.equal(result.coverage.scanned,1);
  assert.deepEqual(result.rows,[]);
});
test('failed scans publish a terminal failure rather than partial results',async()=>{
  const f=workerFixture({batches:{'':[]}});
  const old=console.error;console.error=()=>{};
  try{assert.equal((await f.worker.processPatternRequests()).failed,1);}finally{console.error=old;}
  assert.equal(f.calls.find(c=>c[0]==='finish_pattern_scan')[1].p_result,null);
});

test('worker aggregates rejection reasons and retains developing rows in results',async()=>{
  const input=series('NEAR');
  const baseline=engine.scanSeries([input],new Date(),'channel')[0].matches[0];
  input.candles.at(-1).high=baseline.breakoutLevel*1.02;
  const f=workerFixture({batches:{'':[input],NEAR:[]}});
  await f.worker.processPatternRequests();
  const result=f.calls.find(c=>c[0]==='finish_pattern_scan')[1].p_result;
  assert.equal(result.diagnostics.strictMatches,0);
  assert.equal(result.diagnostics.developingSetups,1);
  assert.equal(result.diagnostics.rejected.upper_breach,1);
  assert.equal(result.rows.length,1);
  assert.equal(result.rows[0].matches.length,0);
  assert.equal(result.rows[0].preview.candles.length,48);
});

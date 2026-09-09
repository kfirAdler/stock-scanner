const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');
function load(file, overrides) {
 const compiled=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 new Function('require','module','exports',compiled)(name=>Object.hasOwn(overrides,name)?overrides[name]:require(name),module,module.exports);
 return module.exports;
}
const candle={date:new Date().toISOString().slice(0,10),open:100,high:105,low:98,close:103};
const row={ticker:'TEST',market:'US',as_of:candle.date,updated_at:new Date().toISOString(),status:'scanned',matches:[{pattern:'ascending_triangle'}],candles:[candle]};
test('shared summaries contain real compact candles while detail retains dated OHLC',async()=>{
 const route=load('app/api/patterns/route.ts',{'next/server':{NextResponse},'@/lib/market-access':{getCurrentEntitlement:async()=>({loggedIn:true,canUseScreener:true})},'@/lib/patterns/data':{loadPatterns:async()=>[row],loadLastPatternAttempt:async()=>({startedAt:row.updated_at,status:"completed"})}});
 const summary=await (await route.GET(new NextRequest('http://localhost/api/patterns'))).json();
 assert.equal(summary.lastAttempt.status,"completed");
 assert.deepEqual(summary.rows[0].preview,{offset:0,candles:[[100,105,98,103]]});
 assert.equal(summary.rows[0].candles,undefined);
 const detail=await(await route.GET(new NextRequest('http://localhost/api/patterns?ticker=TEST'))).json();
 assert.deepEqual(detail.row.candles,[candle]);
});
test('shared cache coalesces reads and serves chart details without another database call',async()=>{
 let reads=0;
 const query={select(){return this;},eq(){return this;},order(){return this;},async range(){reads++;return {data:[row],error:null};}};
 const data=load('lib/patterns/data.ts',{'server-only':{},'@/lib/supabase/server':{createServiceClient:async()=>({from:()=>query})}});
 const [first,second]=await Promise.all([data.loadPatterns('US'),data.loadPatterns('US')]);
 assert.deepEqual(first,second);assert.equal(reads,1);
 assert.deepEqual(await data.loadPatterns('US','TEST'),[row]);assert.equal(reads,1);
});

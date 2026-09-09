const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const {NextResponse}=require('next/server');
test('manual search and status endpoints cannot enqueue or start work',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/app/api/patterns/requests/route.ts'),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const module={exports:{}};
 new Function('require','module','exports',compiled)(name=>{assert.equal(name,'next/server');return {NextResponse};},module,module.exports);
 for(const method of ['GET','POST']) {
  const response=module.exports[method]();
  assert.equal(response.status,410);
  assert.equal((await response.json()).code,'MANUAL_SEARCH_DISABLED');
 }
});

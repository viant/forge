import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const cacheDir=await mkdtemp(path.join(tmpdir(),'forge-warmup-evidence-'));
const output=path.join(root,'output/playwright/warmup-evidence');
const server=await createServer({root,cacheDir,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false}});
let browser;
try{
 await mkdir(output,{recursive:true});await server.listen();browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
 const errors=[];
 for(const width of [1440,768]){
  const page=await browser.newPage({viewport:{width,height:1000}});page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  const evidence=page.locator('.studio-warmup-run');
  for(const scenario of ['eight','single','legacy','absent','history']){
   await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/reader-cache-test.html?evidence=${scenario}`);await evidence.waitFor();
   assert.equal(await evidence.getByText('Resolving',{exact:false}).count(),0);assert.equal(await evidence.getByText('Component connector',{exact:false}).count(),0);
   if(['eight','single','history'].includes(scenario)){
    await evidence.locator('details[aria-label="Run targets"] > summary').click();
    const rows=evidence.locator('ol[aria-label="Scheduled warmup targets"] > li');assert.equal(await rows.count(),scenario==='eight'?8:1);
    await rows.first().locator('details > summary').click();
    if(scenario==='eight'||scenario==='single'){
     const work=rows.first().locator('[aria-label="Target population"] > li');assert.equal(await work.count(),2);assert.match(await work.nth(1).textContent(),/summary\/two.*aerospike/s);
     assert.match(await evidence.locator('[aria-label="Operation totals"]').textContent(),/2 \/ 2 cases.*80 entries.*12.0ms/s);
     assert.equal(await rows.first().getByText('Not supplied',{exact:true}).count(),0);
     const wraps=await rows.first().locator('dd').evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).whiteSpace==='normal'));assert.equal(wraps,true);
    }else{
     await page.locator('.studio-warmup-history button').filter({hasText:'historical-run'}).click();assert.match(await evidence.textContent(),/historical-cache/);assert.match(await evidence.textContent(),/historical-connector/);assert.doesNotMatch(await evidence.textContent(),/stored-cache-1|child-plan/);assert.match(await evidence.locator('[aria-label="Operation totals"]').textContent(),/40 entries/);
    }
   }else if(scenario==='legacy'){
    assert.match(await evidence.locator('[aria-label="Legacy target evidence"]').textContent(),/legacy-cache.*LegacyID.*LegacyInput/s);assert.equal(await evidence.locator('[aria-label="Run targets"]').count(),0);
   }else{
    await evidence.getByText('Target metadata unavailable.',{exact:true}).waitFor();assert.equal(await evidence.locator('[aria-label="Legacy target evidence"]').count(),0);
   }
   assert.deepEqual(await page.evaluate(()=>window.__readerCacheProof.operations),[]);assert.deepEqual(await page.evaluate(()=>window.__readerCacheProof.runs),[]);
   if(scenario==='eight'||scenario==='single')await evidence.locator('[aria-label="Target population"] > li').last().screenshot({path:path.join(output,`${scenario}-population-${width}.png`)});
   for(const details of await evidence.locator('ol[aria-label="Scheduled warmup targets"] > li > details[open]').all())await details.locator(':scope > summary').click();
   await page.getByRole('dialog',{name:'Cache & warmup',exact:true}).screenshot({path:path.join(output,`${scenario}-${width}.png`)});
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS stored warmup evidence: eight targets, single target with expanded work, legacy/absent evidence, historical settings, operation totals and read-only details at desktop/tablet widths');
}finally{await browser?.close();await server.close();await rm(cacheDir,{recursive:true,force:true});}

import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const cacheDir=await mkdtemp(path.join(tmpdir(),'forge-metadata-'));
const output=path.join(root,'output/playwright/reader-metadata');
const nativeURL=process.env.FORGE_METADATA_NATIVE_URL;
const server=await createServer({root,cacheDir,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,proxy:nativeURL?{'/v1/studio/sdk':nativeURL,'/proof':nativeURL}:{}}});
let browser,page;
try{
 await mkdir(output,{recursive:true});await server.listen();browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
 page=await browser.newPage({viewport:{width:1440,height:1050}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const url=`http://127.0.0.1:${server.httpServer.address().port}/reader-versions-test.html`;
 const picker=page.getByRole('combobox',{name:'Component version',exact:true});
 const calls=()=>page.evaluate(()=>window.__readerVersionsProof.calls.filter(call=>call.operation==='versions.inspect'));
 const noExecution=async()=>assert.deepEqual(await page.evaluate(()=>window.__readerVersionsProof.calls.filter(call=>['preview','warmup','publish','validate','versions.delete'].includes(call.operation))),[]);
 const choose=async no=>{await picker.selectOption(String(no));await page.waitForFunction(no=>document.querySelector('[aria-label="Component version"]')?.value===String(no)&&!document.querySelector('.studio-loading'),no);};
 const openWarmup=async()=>{await page.getByRole('button',{name:'More actions'}).click();await page.getByRole('menuitem',{name:'Cache & warmup',exact:true}).click();return page.getByRole('dialog',{name:'Cache & warmup',exact:true});};
 const closeDialog=dialog=>dialog.getByRole('button',{name:'Close',exact:true}).last().click();
 const graphOptions={discoverColumns:false,includePreviewInput:false,includeEffectiveWarmup:false};
 const previewOptions={...graphOptions,includePreviewInput:true},warmupOptions={...graphOptions,includeEffectiveWarmup:true};
 await page.goto(url);await picker.waitFor();
 const source=await page.evaluate(()=>window.__readerVersionsProof.storedSource());
 assert.deepEqual((await calls()).map(call=>call.parameters),[{reportId:'version-proof',versionNo:2,...graphOptions}]);await noExecution();
 await page.getByRole('button',{name:'Components',exact:true}).click();await page.getByRole('button',{name:'Reopen component'}).click();await picker.waitFor();assert.equal((await calls()).length,2);assert.deepEqual((await calls()).at(-1).parameters,{reportId:'version-proof',versionNo:2,...graphOptions});await noExecution();
 // Pending preview loading is distinct from unavailable and from a resolved empty schema.
 await page.evaluate(()=>{window.__readerVersionsProof.delayMetadata=true;});await page.getByRole('button',{name:'Run preview',exact:true}).click();await page.getByText('Loading preview parameter metadata…',{exact:true}).waitFor();await noExecution();
 assert.deepEqual((await calls()).at(-1).parameters,{reportId:'version-proof',versionNo:2,...previewOptions});
 await choose(1);await page.evaluate(()=>{window.__readerVersionsProof.delayMetadata=false;window.__readerVersionsProof.pendingMetadata.splice(0).forEach(finish=>finish());});
 assert.equal(await page.getByRole('button',{name:'Run with parameters'}).isVisible(),false);
 await page.getByRole('button',{name:'Run preview',exact:true}).click();await page.getByRole('button',{name:'Run with parameters'}).waitFor();await noExecution();
 // Partial projection response does not erase saved source or graph metadata.
 await page.getByRole('button',{name:'Close preview parameters'}).click();await page.getByRole('tab',{name:'SQL',exact:true}).click();await page.getByRole('tab',{name:'Advanced component DQL'}).click();await page.getByRole('button',{name:'Show raw DQL',exact:true}).click();assert.equal(await page.locator('.studio-dql-source').textContent(),'SELECT 1 AS id');
 // Unavailable preview is native-owned and can be retried into an empty contract.
 await choose(2);await page.evaluate(()=>{window.__readerVersionsProof.metadataUnavailable='preview';});await page.getByRole('button',{name:'Run preview',exact:true}).click();await page.getByText('Native preview metadata is unavailable.',{exact:false}).waitFor();assert.equal(await page.getByRole('button',{name:'Run with parameters'}).count(),0);
 await page.evaluate(()=>{window.__readerVersionsProof.metadataUnavailable='';});await page.getByRole('button',{name:'Refresh parameters'}).click();await page.getByRole('button',{name:'Run with parameters'}).waitFor();await noExecution();await page.getByRole('button',{name:'Close preview parameters'}).click();
 // Closing/switching while a warmup projection is pending cannot display its plans.
 await page.evaluate(()=>{window.__readerVersionsProof.delayMetadata=true;});let warmup=await openWarmup();await warmup.getByText('Loading effective warmup plans…',{exact:true}).waitFor();assert.deepEqual((await calls()).at(-1).parameters,{reportId:'version-proof',versionNo:2,...warmupOptions});await closeDialog(warmup);await choose(1);
 await page.evaluate(()=>{window.__readerVersionsProof.delayMetadata=false;window.__readerVersionsProof.pendingMetadata.splice(0).forEach(finish=>finish());window.__readerVersionsProof.metadataUnavailable='warmup';});
 warmup=await openWarmup();await warmup.getByText('Native warmup metadata is unavailable.',{exact:false}).waitFor();assert.equal(await warmup.getByText('No effective warmup plans for this saved version.',{exact:true}).count(),0);
 await page.evaluate(()=>{window.__readerVersionsProof.metadataUnavailable='';});await warmup.getByRole('button',{name:'Retry',exact:true}).click();await warmup.getByText('child-plan',{exact:false}).waitFor();await noExecution();await page.screenshot({path:path.join(output,'warmup-loaded.png')});await closeDialog(warmup);
 assert.equal(await page.evaluate(()=>window.__readerVersionsProof.storedSource()),source);
 const timings={synthetic:await page.evaluate(()=>window.__readerVersionsProof.timings)};
 if(nativeURL){
  await page.goto(`${url}?native`);await picker.waitFor();
  const stored=async(versionNo)=>{const response=await page.request.post(`${new URL(url).origin}/v1/studio/sdk/versions.get`,{data:{reportId:'version-proof',versionNo}});assert.equal(response.ok(),true);return response.json();};
  const before=await Promise.all([stored(1),stored(2)]);assert.deepEqual((await calls()).map(call=>call.parameters),[{reportId:'version-proof',versionNo:2,...graphOptions}]);
  await page.getByRole('button',{name:'Components',exact:true}).click();await page.getByRole('button',{name:'Reopen component'}).click();await picker.waitFor();assert.deepEqual((await calls()).at(-1).parameters,{reportId:'version-proof',versionNo:2,...graphOptions});
  await choose(1);await page.getByRole('button',{name:'Run preview',exact:true}).click();await page.getByRole('button',{name:'Run with parameters'}).waitFor();await noExecution();assert.deepEqual((await calls()).at(-1).parameters,{reportId:'version-proof',versionNo:1,...previewOptions});await page.getByRole('button',{name:'Close preview parameters'}).click();
  warmup=await openWarmup();await warmup.getByText('native-profile',{exact:false}).first().waitFor();assert.deepEqual((await calls()).at(-1).parameters,{reportId:'version-proof',versionNo:1,...warmupOptions});await noExecution();await closeDialog(warmup);
  const after=await Promise.all([stored(1),stored(2)]);for(let index=0;index<2;index++){assert.equal(after[index].authoredDql,before[index].authoredDql);assert.equal(after[index].generatedDql,before[index].generatedDql);assert.equal(after[index].sourceRevision,before[index].sourceRevision);}
  timings.native=await page.evaluate(()=>window.__readerVersionsProof.timings);
 }
 assert.deepEqual(errors,[]);await writeFile(path.join(output,'inspection-timings.json'),JSON.stringify(timings,null,2));console.log(JSON.stringify(timings));console.log('PASS deferred projections: graph-only open/reopen, scoped preview/warmup loading, stale responses, unavailable vs empty, unchanged source and no execution');
}catch(error){await page?.screenshot({path:path.join(output,'failure.png')});throw error;}finally{await browser?.close();await server.close();await rm(cacheDir,{recursive:true,force:true});}

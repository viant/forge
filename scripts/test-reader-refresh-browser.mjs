import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const cacheDir=await mkdtemp(path.join(tmpdir(),'forge-reader-refresh-'));
const output=path.join(root,'output/playwright/reader-refresh');
const nativeURL=process.env.FORGE_REFRESH_NATIVE_URL;
const server=await createServer({root,cacheDir,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,proxy:nativeURL?{'/v1/studio/sdk':nativeURL,'/proof':nativeURL}:{}}});
let browser,page;
try{
 await mkdir(output,{recursive:true});await server.listen();browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
 page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const url=`http://127.0.0.1:${server.httpServer.address().port}/reader-versions-test.html`;
 const toolbar=page.getByRole('toolbar',{name:'Component authoring commands'}),parameters=page.getByRole('region',{name:'Preview parameters',exact:true});
 const picker=page.getByRole('combobox',{name:'Component version',exact:true});
 const previews=()=>page.evaluate(()=>window.__readerVersionsProof.calls.filter(call=>['preview','preview.execute'].includes(call.operation)));
 const metadata=()=>page.evaluate(()=>window.__readerVersionsProof.calls.filter(call=>call.operation==='versions.inspect'&&call.parameters.includePreviewInput));
 const idle=()=>page.waitForFunction(()=>[...document.querySelectorAll('[aria-label="Component authoring commands"] button')].some(node=>node.textContent.trim()==='Run preview'&&!node.disabled));
 const choose=async no=>{await picker.selectOption(String(no));await page.waitForFunction(no=>document.querySelector('[aria-label="Component version"]')?.value===String(no)&&!document.querySelector('.studio-loading'),no);};
 const execute=async label=>{
  const before=(await previews()).length;await toolbar.getByRole('button',{name:label,exact:true}).click();
  await page.waitForFunction(before=>window.__readerVersionsProof.calls.filter(call=>['preview','preview.execute'].includes(call.operation)).length>before||[...document.querySelectorAll('[aria-label="Preview parameters"] button[type="submit"]')].some(node=>node.getClientRects().length&&!node.disabled),before);
  if((await previews()).length===before)await parameters.locator('button[type="submit"]').click();
  await idle();
 };
 await page.goto(url);await picker.waitFor();
 await toolbar.getByRole('button',{name:'Refresh schema and run preview',exact:true}).click();await parameters.getByRole('button',{name:'Refresh schema and run preview',exact:true}).waitFor();assert.equal((await previews()).length,0);
 await parameters.locator('button[type="submit"]').click();await idle();assert.equal((await previews()).at(-1).parameters.refreshSchema,true);assert.equal((await metadata()).length,2);
 await execute('Run preview');assert.equal(Object.hasOwn((await previews()).at(-1).parameters,'refreshSchema'),false);
 // A successful preview remains visible when only its follow-up inspection fails.
 await page.evaluate(()=>{window.__readerVersionsProof.metadataUnavailable='preview';});await execute('Refresh schema and run preview');
 await page.locator('.studio-preview-results').getByText('Native preview metadata is unavailable.',{exact:false}).waitFor();await page.getByText('version-2',{exact:true}).first().waitFor();const count=(await previews()).length;
 await page.evaluate(()=>{window.__readerVersionsProof.metadataUnavailable='';});await page.locator('.studio-preview-results').getByRole('button',{name:'Refresh parameters',exact:true}).click();await idle();assert.equal((await previews()).length,count);
 // Switching during execution must prevent its follow-up inspection entirely.
 await page.evaluate(()=>{window.__readerVersionsProof.delayPreview=true;});const metadataCount=(await metadata()).length;
 await toolbar.getByRole('button',{name:'Refresh schema and run preview',exact:true}).click();await choose(1);
 await page.evaluate(()=>{window.__readerVersionsProof.delayPreview=false;window.__readerVersionsProof.finishPreview();});assert.equal((await metadata()).length,metadataCount);assert.equal(await page.getByText('LATE_PREVIEW',{exact:true}).count(),0);
 // Switching during the trailing inspection cannot install the old contract.
 await toolbar.getByRole('button',{name:'Refresh schema and run preview',exact:true}).click();await parameters.locator('button[type="submit"]').waitFor();await page.evaluate(()=>{window.__readerVersionsProof.delayMetadata=true;});await parameters.locator('button[type="submit"]').click();await page.getByText('Refreshing preview parameter metadata…',{exact:true}).waitFor();await choose(2);
 await page.evaluate(()=>{window.__readerVersionsProof.delayMetadata=false;window.__readerVersionsProof.pendingMetadata.splice(0).forEach(resolve=>resolve());});assert.equal(await page.getByText('version-1',{exact:true}).count(),0);
 let evidence;
 if(nativeURL){
  await page.goto(`${url}?native`);await picker.waitFor();
  const stats=async()=>{const response=await page.request.get(`${new URL(url).origin}/proof/stats`);assert.equal(response.ok(),true);return response.json();};
  const control=async action=>{const response=await page.request.post(`${new URL(url).origin}/proof/${action}`);assert.equal(response.ok(),true);};
  await execute('Run preview');await page.getByText('initial',{exact:true}).first().waitFor();const initial=await stats();assert.ok(initial.discovery>0);assert.equal(initial.artifactCount,1);
  await control('change-schema');await execute('Run preview');await page.getByText('current',{exact:true}).first().waitFor();assert.equal(await page.getByText('schema-refresh',{exact:true}).count(),0);const ordinary=await stats();assert.equal(ordinary.discovery,initial.discovery);assert.equal(ordinary.artifactDigest,initial.artifactDigest);assert.equal(Object.hasOwn((await previews()).at(-1).parameters.input,'refreshSchema'),false);
  await execute('Refresh schema and run preview');await page.getByText('schema-refresh',{exact:true}).first().waitFor();const refreshed=await stats();assert.ok(refreshed.discovery>ordinary.discovery);assert.notEqual(refreshed.artifactDigest,ordinary.artifactDigest);assert.equal(refreshed.artifactCount,1);assert.equal(refreshed.sourceRevision,initial.sourceRevision);assert.equal(refreshed.source,initial.source);assert.equal((await previews()).at(-1).parameters.input.refreshSchema,true);
  await page.screenshot({path:path.join(output,'native-refreshed.png')});
  await control('break-schema');await execute('Refresh schema and run preview');const failure=(await previews()).at(-1);assert.ok(failure.error);await page.getByRole('alert').filter({hasText:failure.error}).waitFor();const failed=await stats();assert.equal(failed.artifactDigest,refreshed.artifactDigest);
  await control('restore-schema');await page.getByRole('button',{name:'Retry preview',exact:true}).click();await idle();assert.deepEqual((await previews()).at(-1).parameters,failure.parameters);await page.getByText('schema-refresh',{exact:true}).first().waitFor();const retried=await stats();assert.ok(retried.discovery>failed.discovery);assert.equal(retried.artifactDigest,refreshed.artifactDigest);
  const {source,...initialStats}=initial,{source:source2,...ordinaryStats}=ordinary,{source:source3,...refreshedStats}=refreshed,{source:source4,...failedStats}=failed,{source:source5,...retriedStats}=retried;
  evidence={initial:initialStats,ordinary:ordinaryStats,refreshed:refreshedStats,failed:failedStats,retried:retriedStats};await writeFile(path.join(output,'native-artifact-evidence.json'),JSON.stringify(evidence,null,2));
 }
 assert.deepEqual(errors,[]);if(evidence)console.log(JSON.stringify(evidence));console.log('PASS explicit schema refresh: parameter mode, ordinary omission, metadata-only retry, stale execution/inspection guards'+(nativeURL?', native artifact reuse/discovery and failure/retry':''));
}catch(error){await page?.screenshot({path:path.join(output,'failure.png')});throw error;}finally{await browser?.close();await server.close();await rm(cacheDir,{recursive:true,force:true});}

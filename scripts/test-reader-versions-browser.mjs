import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const cacheDir=await mkdtemp(path.join(tmpdir(),'forge-versions-'));
const output=path.join(root,'output/playwright/reader-versions');
const nativeURL=process.env.FORGE_VERSIONS_NATIVE_URL;
const proxy=nativeURL?{'/v1/studio/sdk':nativeURL,'/proof':nativeURL}:{};
const server=await createServer({root,cacheDir,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,proxy}});
let browser;
try{
 await mkdir(output,{recursive:true});await server.listen();
 browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const url=`http://127.0.0.1:${server.httpServer.address().port}/reader-versions-test.html`;
 const picker=page.getByRole('combobox',{name:'Component version',exact:true});
 const choose=async no=>{await picker.selectOption(String(no));await page.waitForFunction(no=>document.querySelector('[aria-label="Component version"]')?.value===String(no)&&!document.querySelector('.studio-loading'),no);};
 const calls=operation=>page.evaluate(op=>window.__readerVersionsProof.calls.filter(call=>call.operation===op),operation);
 await page.goto(url);await picker.waitFor();await choose(1);
 await page.getByRole('button',{name:'Run preview',exact:true}).click();await page.getByRole('button',{name:'Run with parameters',exact:true}).click();await page.getByText('version-1',{exact:true}).first().waitFor();assert.equal((await calls('preview')).at(-1).parameters.versionNo,1);
 await page.getByRole('button',{name:'Validate',exact:true}).click();
 const validation=page.getByRole('dialog',{name:'Validate reader draft'});await validation.getByRole('button',{name:'Validate revision',exact:true}).click();assert.equal((await calls('validate')).at(-1).parameters.versionNo,1);await validation.getByRole('button',{name:'Close',exact:true}).last().click();
 await page.getByRole('button',{name:'More actions'}).click();await page.getByRole('menuitem',{name:'Cache & warmup'}).click();
 const cache=page.getByRole('dialog',{name:'Cache & warmup'});await cache.getByRole('button',{name:'Run all effective plans'}).click();await cache.getByText('run-1',{exact:true}).waitFor();assert.equal((await calls('warmup')).at(-1).parameters.versionNo,1);await cache.getByRole('button',{name:'Close',exact:true}).last().click();
 await page.getByRole('button',{name:'Release',exact:true}).click();const release=page.getByRole('dialog',{name:/Publish|Release/});await release.getByRole('button',{name:'Publish selected version'}).waitFor();assert.equal(await release.getByRole('combobox',{name:'Publish version'}).inputValue(),'1');await release.getByRole('button',{name:'Close',exact:true}).last().click();
 await page.getByRole('button',{name:'More actions'}).click();await page.getByRole('menuitem',{name:'Source resources',exact:true}).click();
 const resources=page.getByRole('dialog',{name:'Source resources',exact:true});await resources.waitFor();assert.equal((await calls('resources')).at(-1).parameters.versionNo,1);await resources.getByRole('button',{name:'Close',exact:true}).last().click();
 await choose(2);await page.getByRole('button',{name:'Release',exact:true}).click();await release.getByRole('button',{name:'Publish selected version'}).click();
 await page.waitForFunction(()=>window.__readerVersionsProof.calls.some(call=>call.operation==='publish'));assert.equal((await calls('publish')).at(-1).parameters.versionNo,2);await release.getByRole('button',{name:'Close',exact:true}).last().click();
 // Dirty SQL survives canceled and failed switches.
 await page.getByRole('tab',{name:'SQL',exact:true}).click();
 const editor=page.locator('[aria-label="Records2 SQL source"] .cm-content, .cm-content[aria-label="Records2 SQL source"]');
 await editor.first().waitFor();await editor.first().fill('SELECT unsaved');
 await picker.selectOption('1');await page.getByRole('button',{name:'Keep editing',exact:true}).click();assert.equal(await picker.inputValue(),'2');assert.match(await editor.first().textContent(),/unsaved/);
 await page.evaluate(()=>{window.__readerVersionsProof.failVersion=1;});await picker.selectOption('1');await page.getByRole('button',{name:'Discard changes',exact:true}).click();await page.getByText(/Could not open version v1/).waitFor();assert.equal(await picker.inputValue(),'2');assert.match(await editor.first().textContent(),/unsaved/);
 await page.evaluate(()=>{window.__readerVersionsProof.failVersion=null;});await picker.selectOption('1');await page.getByRole('button',{name:'Discard changes',exact:true}).click();await page.getByRole('tab',{name:'Graph',exact:true,selected:true}).waitFor();assert.equal(await picker.inputValue(),'1');
 // Late execution responses cannot populate another selected version.
 await page.evaluate(()=>{window.__readerVersionsProof.delayPreview=true;});await page.getByRole('button',{name:'Run preview',exact:true}).click();await page.getByRole('button',{name:'Run with parameters',exact:true}).click();await choose(2);await page.evaluate(()=>window.__readerVersionsProof.finishPreview());assert.equal(await page.getByText('LATE_PREVIEW',{exact:true}).count(),0);
 await page.evaluate(()=>window.__readerVersionsProof.publishOlder());await choose(1);assert.equal(await page.getByRole('button',{name:'Validate',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'Create editable draft'}).waitFor();assert.match(await picker.locator('option:checked').textContent(),/published/);
 await page.screenshot({path:path.join(output,'published-version.png')});
 if(nativeURL){
  await page.goto(`${url}?native`);await picker.waitFor();await choose(1);
  await page.getByRole('tab',{name:'SQL',exact:true}).click();await page.getByRole('tab',{name:'Advanced component DQL'}).click();await page.getByRole('button',{name:'Show raw DQL',exact:true}).click();assert.match(await page.locator('.studio-dql-source').textContent(),/SELECT 1 AS id/);
  await choose(2);await page.getByRole('tab',{name:'SQL',exact:true}).click();await page.getByRole('tab',{name:'Advanced component DQL'}).click();await page.getByRole('button',{name:'Show raw DQL',exact:true}).click();const newerSource=await page.locator('.studio-dql-source').textContent();assert.match(newerSource,/SELECT 2 AS id/);await choose(1);
  await page.getByRole('button',{name:'Delete version v1',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal((await calls('versions.delete')).length,0);
  await page.getByRole('button',{name:'Delete version v1',exact:true}).click();await page.getByRole('button',{name:'Permanently delete version',exact:true}).click();await page.getByText('Returned to components',{exact:true}).waitFor();
  assert.deepEqual((await calls('versions.delete'))[0].parameters,{reportId:'version-proof',versionNo:1,expectedSourceRevision:7});
  const response=await page.request.post(`${url.split('/reader-versions')[0]}/v1/studio/sdk/versions.list`,{data:{reportId:'version-proof',input:{limit:100,offset:0}}});assert.equal(response.ok(),true);assert.deepEqual((await response.json()).items.map(item=>item.versionNo),[2]);
  const survivor=await page.request.post(`${url.split('/reader-versions')[0]}/v1/studio/sdk/versions.inspect`,{data:{reportId:'version-proof',versionNo:2}});assert.equal(survivor.ok(),true);const retained=await survivor.json();assert.equal(retained.dql,newerSource);assert.equal(retained.version.sourceRevision,7);
 }
 assert.deepEqual(errors,[]);console.log(`PASS version selection: dirty/failure preservation, exact execution versions, published restrictions, late responses${nativeURL?', native SQLite inspection and deletion':''}`);
}finally{await browser?.close();await server.close();await rm(cacheDir,{recursive:true,force:true});}

import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createServer} from 'vite';

const root=fileURLToPath(new URL('..',import.meta.url));
const cacheDir=await mkdtemp(path.join(tmpdir(),'forge-reader-cache-'));
const output=path.join(root,'output/playwright/reader-cache');
const nativeURL=process.env.FORGE_CACHE_NATIVE_URL;
const server=await createServer({root,cacheDir,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,proxy:nativeURL?{'/v1/studio/sdk':nativeURL,'/proof':nativeURL}:{}}});
let browser,page;
try{
 await mkdir(output,{recursive:true});await server.listen();browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
 const errors=[];const base=`http://127.0.0.1:${server.httpServer.address().port}`;
 for(const width of [1440,768]){
  page=await browser.newPage({viewport:{width,height:1000}});page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  const editor=page.getByRole('region',{name:'View inline warmup plans',exact:true});
  const storage=page.getByRole('region',{name:'View cache storage',exact:true});
  const choose=()=>storage.getByLabel('Cache storage',{exact:true});
  const save=()=>storage.locator('button').filter({hasText:'Save storage reference'});
  const target=name=>editor.getByLabel('Target view',{exact:true}).selectOption(name);
  if(!nativeURL){
   for(const scenario of ['empty','inline','named','bound']){
    await page.goto(`${base}/reader-cache-test.html?scenario=${scenario}`);await storage.waitFor();
    const plans=page.getByRole('region',{name:'Effective warmup plans',exact:true});await plans.getByText('child-plan',{exact:false}).waitFor();
    assert.equal(await plans.locator('input, select, textarea').count(),0);
    assert.ok((await plans.boundingBox()).y<(await storage.boundingBox()).y,'Effective plans precede storage');
    assert.equal(await page.locator('#cache-backend,#cache-ttl,#cache-name,#cache-provider,#cache-location').count(),0);
    if(scenario==='empty'){
     await storage.getByText(/No host cache storage configurations/).waitFor();assert.equal(await choose().count(),0);assert.equal(await save().isDisabled(),true);
    }else{
     assert.deepEqual(await choose().locator('option:not([disabled])').allTextContents(),['bound-storage','host-storage','shared']);
     if(scenario==='named'){assert.equal(await choose().inputValue(),'host-storage');assert.equal(await save().isDisabled(),true);}
     if(scenario==='inline'){
      const authored=page.getByRole('region',{name:'Authored component cache',exact:true});assert.equal(await authored.locator('input,select,textarea,button').count(),0);assert.match(await authored.textContent(),/records.*synthetic\/cache.*1m/s);
     }
     await choose().selectOption('shared');await save().click();
     const expected=scenario==='bound'?{type:'updateFunction',function:{name:'use_cache',occurrence:0,expectedArgs:['records',"'bound-storage'"],args:['records',"'shared'"]}}:{type:'addFunction',function:{name:'use_cache',args:['records',"'shared'"]}};
     assert.deepEqual(await page.evaluate(()=>window.__readerCacheProof.operations),[expected]);
     await target('items');await choose().selectOption('shared');await save().click();
     assert.deepEqual((await page.evaluate(()=>window.__readerCacheProof.operations)).at(-1),{type:'addFunction',function:{name:'use_cache',args:['items',"'shared'"]}});
     const resolved=storage.locator('[aria-label="Resolved cache storage"]');assert.match(await resolved.textContent(),/child-storage.*afs/s);
    }
    await page.getByRole('button',{name:'Run all effective plans',exact:true}).click();await page.getByText('synthetic-completed',{exact:true}).waitFor();assert.deepEqual(await page.evaluate(()=>window.__readerCacheProof.runs),[{componentId:'records',versionNo:2,sourceRevision:4}]);
    await page.getByRole('dialog',{name:'Cache & warmup',exact:true}).screenshot({path:path.join(output,`${scenario}-${width}.png`)});
   }
  }else{
   const calls=()=>page.evaluate(()=>window.__targetedWarmupProof.calls.filter(call=>call.operation==='versions.builder'));
   const openPanel=async()=>{await page.getByRole('button',{name:'More actions',exact:true}).click();await page.getByRole('menuitem',{name:'Cache & warmup',exact:true}).click();await storage.waitFor();};
   const open=async scenario=>{await page.request.get(`${base}/proof/reset?scenario=${scenario}`);await page.goto(`${base}/targeted-warmup-test.html?native`);await openPanel();};
   const source=()=>page.request.get(`${base}/proof/source`).then(response=>response.json());
   const inspect=async()=>{
    const component=await page.request.get(`${base}/proof/component`).then(response=>response.json());
    return page.request.post(`${base}/v1/studio/sdk/versions.inspect`,{data:{reportId:component.id,versionNo:1,discoverColumns:false,includePreviewInput:false,includeEffectiveWarmup:false}}).then(response=>response.json());
   };
   const saved=async(revision)=>page.waitForFunction(rev=>document.querySelector('[aria-label="Component revision status"]')?.textContent.includes(`rev ${rev}`),revision);
   await open('mixed');const before=await inspect();await choose().selectOption('shared');await save().click();await saved(before.version.sourceRevision+1);
   let last=(await calls()).at(-1);assert.equal(last.parameters.command.expectedSourceRevision,before.version.sourceRevision);assert.deepEqual(last.parameters.command.operation,{type:'updateFunction',function:{name:'use_cache',occurrence:0,expectedArgs:['r',"'storage'"],args:['r',"'shared'"]}});
   await target('c');await choose().selectOption('shared');await save().click();await saved(before.version.sourceRevision+2);
   const after=await inspect();const expected=structuredClone(before.structure.component);expected.rootView.source.bindings.cacheName='shared';expected.rootView.relations[0].view.source.bindings.cacheName='shared';assert.deepEqual(after.structure.component,expected);
   const stored=await source();assert.equal((stored.authoredDql.match(/use_cache\(/g)||[]).length,2);assert.match(stored.authoredDql,/CaseRefs=recent/);assert.match(stored.authoredDql,/Period=older/);assert.match(stored.authoredDql,/Period=oldest/);
   await page.getByRole('button',{name:'Close',exact:true}).last().click();await openPanel();assert.equal(await choose().inputValue(),'shared');assert.equal(await save().isDisabled(),true);await target('c');assert.equal(await choose().inputValue(),'shared');assert.equal(await save().isDisabled(),true);
   await editor.getByRole('button',{name:'Edit inline plan 1',exact:true}).click();for(const field of await editor.locator('fieldset').all())await field.getByLabel('Plan name',{exact:true}).fill('renamed');await editor.getByRole('button',{name:'Save view inline plan',exact:true}).click();await saved(before.version.sourceRevision+3);const planEdited=await inspect();assert.equal(planEdited.structure.component.rootView.source.bindings.cacheName,'shared');assert.equal(planEdited.structure.component.rootView.relations[0].view.source.bindings.cacheName,'shared');
   await choose().selectOption('aerospike-label');await save().click();await saved(before.version.sourceRevision+4);const resolved=storage.locator('[aria-label="Resolved cache storage"]');await resolved.getByText('aerospike-label',{exact:true}).first().waitFor();assert.match(await resolved.textContent(),/afs/);
   await page.getByRole('dialog',{name:'Cache & warmup',exact:true}).screenshot({path:path.join(output,`native-shared-${width}.png`)});
   for(const scenario of ['component','inline']){
    await open(scenario);const original=await source();const originalInspection=await inspect();const authored=page.getByRole('region',{name:'Authored component cache',exact:true});assert.equal(await authored.locator('input,select,textarea,button').count(),0);
    if(scenario==='component'){assert.equal(await choose().inputValue(),'shared');assert.equal(await save().isDisabled(),true);assert.equal((await calls()).length,0);await choose().selectOption('aerospike-label');}else await choose().selectOption('shared');
    await save().click();await saved(original.sourceRevision+1);const current=await inspect();assert.deepEqual(current.structure.component.settings,originalInspection.structure.component.settings);assert.match((await source()).authoredDql,scenario==='component'?/\$cache\('shared'\)/:/\$cache\('component','1m'\).WithLocation\(/);
   }
   await open('empty');await storage.getByText(/No host cache storage configurations/).waitFor();assert.equal(await choose().count(),0);assert.match(await storage.textContent(),/storage.*not in the supplied host catalog/s);assert.equal(await save().isDisabled(),true);
   await open('mixed');await choose().selectOption('shared');await page.request.get(`${base}/proof/revoke-cache?name=shared`);await save().click();await editor.getByRole('alert').waitFor();assert.equal(await choose().inputValue(),'shared');assert.equal((await source()).sourceRevision,1);assert.match(await editor.textContent(),/no enabled configuration/);await storage.getByRole('button',{name:'Cancel storage edit',exact:true}).click();
   await open('mixed');await choose().selectOption('shared');await page.evaluate(()=>{window.__targetedWarmupProof.denyApply=true;});await save().click();await editor.getByRole('alert').waitFor();assert.equal((await source()).sourceRevision,1);
   await open('mixed');await choose().selectOption('shared');await page.request.get(`${base}/proof/conflict`);await save().click();await page.getByRole('dialog',{name:'Reader changed elsewhere',exact:true}).waitFor();assert.equal(await choose().inputValue(),'shared');assert.equal((await source()).sourceRevision,2);await page.getByRole('button',{name:'Review my draft',exact:true}).click();
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS host cache storage UI: root/child references, read-only authored storage, supplied backend evidence, empty catalogs'+(nativeURL?', native save/reopen, shared references, plan preservation, stale revisions, denied edits and native validation failures':' and unchanged saved-version warmup'));
}catch(error){if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'failure.png')});throw error;}
finally{await browser?.close();await server.close();await rm(cacheDir,{recursive:true,force:true});}

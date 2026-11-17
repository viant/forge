import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const cacheDir=await mkdtemp(path.join(tmpdir(),'forge-targeted-warmup-'));
const output=path.join(root,'output/playwright/targeted-warmup');
const nativeURL=process.env.FORGE_WARMUP_NATIVE_URL;
const server=await createServer({root,cacheDir,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,proxy:nativeURL?{'/v1/studio/sdk':nativeURL,'/proof':nativeURL}:{}}});
let browser,page;
try{
 await mkdir(output,{recursive:true});await server.listen();browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
 page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const base=`http://127.0.0.1:${server.httpServer.address().port}`;
 const editor=page.getByRole('region',{name:'View inline warmup plans',exact:true});
 const save=()=>editor.locator('button').filter({hasText:'Save view inline plan'});
 const builders=()=>page.evaluate(()=>window.__targetedWarmupProof.calls.filter(call=>call.operation==='versions.builder'));
 const open=async(scenario='mixed')=>{
  if(nativeURL)await page.request.get(`${base}/proof/reset?scenario=${scenario}`);
  await page.goto(`${base}/targeted-warmup-test.html${nativeURL?'?native':''}`);
  await page.getByRole('button',{name:'More actions',exact:true}).click();await page.getByRole('menuitem',{name:'Cache & warmup',exact:true}).click();await editor.getByLabel('Target view',{exact:true}).waitFor();
 };
 const selectChild=()=>editor.getByLabel('Target view',{exact:true}).selectOption('c');
 await open();await selectChild();
 await editor.getByRole('button',{name:'Edit inline plan 1',exact:true}).click();
 const definitions=editor.locator('fieldset');assert.equal(await definitions.count(),2);
 await definitions.nth(0).getByLabel('Plan name',{exact:true}).fill('renamed');await definitions.nth(1).getByLabel('Plan name',{exact:true}).fill('renamed');
 await editor.screenshot({path:path.join(output,nativeURL?'native-merged-editor.png':'merged-editor.png')});
 const firstRevision=nativeURL?(await page.request.get(`${base}/proof/source`)).ok():true;assert.ok(firstRevision);
 await save().click();await editor.getByRole('button',{name:'Add view inline plan',exact:true}).waitFor();
 const first=(await builders()).at(-1);assert.equal(first.parameters.versionNo,1);assert.ok(Number.isInteger(first.parameters.command.expectedSourceRevision));
 assert.deepEqual(first.parameters.command.operation.operations.map(op=>op.function.occurrence),[3,2]);
 assert.match(first.parameters.command.operation.operations[0].function.args.join('|'),/Period=oldest/);
 assert.match(first.parameters.command.operation.operations[1].function.args.join('|'),/CaseRefs=recent.*Period=older.*ExcludeDefault=Period/);
 assert.ok(first.parameters.command.operation.operations.every(op=>!op.function.args.some(arg=>arg.includes('MaxCases='))));
 if(nativeURL){
  await editor.getByRole('heading',{name:'renamed',exact:true}).waitFor();
  const stored=await page.request.get(`${base}/proof/source`).then(r=>r.json());assert.match(stored.authoredDql,/cache_warmup\(c,'host'\)/);assert.match(stored.authoredDql,/\$cache_warmup_cases\(/);assert.match(stored.authoredDql,/\$cache_warmup\('ID','Limit=77'\)/);assert.match(stored.authoredDql,/use_cache\(c,'storage'\)/);
  await editor.getByRole('button',{name:'Edit inline plan 1',exact:true}).click();
  await editor.getByRole('button',{name:'Add case group',exact:true}).click();
  await editor.locator('fieldset').last().getByLabel('Case dimensions and additional native options',{exact:true}).fill('Period=ancient');
  await editor.locator('fieldset').last().getByLabel('Max cases',{exact:true}).fill('0');
  await save().click();await editor.getByRole('button',{name:'Add view inline plan',exact:true}).waitFor();
  assert.match(await editor.locator('[aria-label="Inline plan 1"]').textContent(),/MaxCases: 0.*3 authored case groups.*recent/s);
  const countBeforeCancel=(await builders()).length;
  await editor.getByRole('button',{name:'Remove inline plan 1',exact:true}).click();await page.getByRole('button',{name:'Keep plan',exact:true}).click();assert.equal((await builders()).length,countBeforeCancel);
  await editor.getByRole('button',{name:'Remove inline plan 1',exact:true}).click();await page.getByRole('button',{name:'Remove targeted plan',exact:true}).click();await editor.getByRole('heading',{name:'by_id',exact:true}).waitFor();
  assert.deepEqual((await builders()).at(-1).parameters.command.operation.operations.map(op=>op.function.occurrence),[5,3,2]);
  await editor.getByRole('button',{name:'Remove inline plan 1',exact:true}).click();await page.getByRole('button',{name:'Remove targeted plan',exact:true}).click();await editor.getByText('No targeted inline plans authored for this view.',{exact:true}).waitFor();
  await editor.getByLabel('Target view',{exact:true}).selectOption('r');await selectChild();await editor.getByText('host-fallback · host · host',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Run all effective plans',exact:true}).click();
  await page.locator('.studio-warmup-run .bp6-tag').filter({hasText:/^completed$/}).waitFor();
  const mixedTargets=page.locator('.studio-warmup-run details[aria-label="Run targets"]');await mixedTargets.locator(':scope > summary').click();
  assert.equal(await mixedTargets.locator('ol > li').count(),2);assert.match(await mixedTargets.textContent(),/host-fallback/);
 }
 // Add an unindexed plan without inventing optional budgets or touching storage.
 await editor.getByRole('button',{name:'Add view inline plan',exact:true}).click();
 await save().click();await editor.getByRole('button',{name:'Add view inline plan',exact:true}).waitFor();
 assert.deepEqual((await builders()).at(-1).parameters.command.operation.operations,[{type:'addFunction',function:{name:'cache_warmup',args:['c',"''","'Priority=0'"]}}]);
 if(nativeURL){
  for(const scenario of ['root','child']){
   await open(scenario);if(scenario==='child')await selectChild();
   await editor.getByRole('button',{name:'Edit inline plan 1',exact:true}).click();
   await editor.getByLabel('Row limit',{exact:true}).fill('10');await save().click();await editor.getByRole('button',{name:'Add view inline plan',exact:true}).waitFor();
   await page.getByRole('button',{name:'Run all effective plans',exact:true}).click();await page.locator('.studio-warmup-run .bp6-tag').filter({hasText:/^completed$/}).waitFor();
   const targets=page.locator('.studio-warmup-run details[aria-label="Run targets"]');await targets.locator(':scope > summary').click();assert.equal(await targets.locator('ol > li').count(),1);
   const stored=await page.request.get(`${base}/proof/source`).then(r=>r.json());assert.match(stored.authoredDql,/Limit=10/);
  }
  await open('child');await selectChild();await editor.getByRole('button',{name:'Edit inline plan 1',exact:true}).click();await editor.getByLabel('Row limit',{exact:true}).fill('25');
  await page.evaluate(()=>{window.__targetedWarmupProof.denyApply=true;});await save().click();await editor.getByRole('alert').waitFor();assert.equal(await editor.getByLabel('Row limit',{exact:true}).inputValue(),'25');
  const deniedSource=await page.request.get(base+'/proof/source').then(r=>r.json());assert.equal(deniedSource.sourceRevision,1);assert.match(deniedSource.authoredDql,/Limit=0/);
  await open();await selectChild();await editor.getByRole('button',{name:'Edit inline plan 1',exact:true}).click();await editor.locator('fieldset').first().getByLabel('Row limit',{exact:true}).fill('25');
  await page.request.get(`${base}/proof/conflict`);await save().click();await editor.getByRole('alert').waitFor();assert.equal(await editor.locator('fieldset').first().getByLabel('Row limit',{exact:true}).inputValue(),'25');
  await page.getByRole('button',{name:'Review my draft',exact:true}).click();await editor.getByRole('button',{name:'Cancel view edit',exact:true}).click();
  await open('uneditable');await selectChild();assert.equal(await editor.getByRole('button',{name:'Edit inline plan 1',exact:true}).isDisabled(),true);await editor.getByText(/not completely represented/).waitFor();
 }else{
  await page.evaluate(()=>{window.__targetedWarmupProof.unavailable=true;});
  // Reopening requests metadata again, independently of authored inspection.
  await page.getByRole('button',{name:'Close',exact:true}).last().click();await page.getByRole('button',{name:'More actions',exact:true}).click();await page.getByRole('menuitem',{name:'Cache & warmup',exact:true}).click();
  await page.getByText('Synthetic producer resolution unavailable.',{exact:false}).waitFor();await selectChild();await editor.getByRole('button',{name:'Edit inline plan 1',exact:true}).click();assert.equal(await save().isDisabled(),true);
  await editor.locator('fieldset').first().getByLabel('Index column',{exact:true}).fill('other');assert.equal(await save().isDisabled(),false);
  await page.evaluate(()=>{window.__targetedWarmupProof.delayApply=true;});await save().click();assert.equal(await editor.getByLabel('Target view',{exact:true}).isDisabled(),true);assert.equal(await save().isDisabled(),true);
  await page.evaluate(()=>window.__targetedWarmupProof.finishApply());await editor.getByRole('button',{name:'Add view inline plan',exact:true}).waitFor();
 }
 if(!nativeURL){
  await page.goto(`${base}/targeted-warmup-test.html?denied`);await page.getByRole('button',{name:'More actions',exact:true}).click();
  assert.equal(await page.getByRole('menuitem',{name:'Cache & warmup',exact:true}).getAttribute('aria-disabled'),'true');assert.deepEqual(await builders(),[]);
 }
 await page.screenshot({path:path.join(output,nativeURL?'native-targeted.png':'targeted.png')});assert.deepEqual(errors,[]);
 console.log(`PASS targeted warmup UI: guarded contributor updates, optional budgets, unindexed creation${nativeURL?', native merged roundtrip, cancellation/removal/fallback, root/child execution, conflicts and read-only provenance':', unavailable effective metadata and pending submission'}`);
}catch(error){if(page){console.error((await page.locator('.studio-warmup-run').allTextContents()).join('\n'));await page.screenshot({path:path.join(output,'failure.png')});}throw error;}finally{await browser?.close();await server.close();await rm(cacheDir,{recursive:true,force:true});}

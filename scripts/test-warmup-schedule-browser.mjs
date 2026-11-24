import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const cacheDir=await mkdtemp(path.join(tmpdir(),'forge-warmup-schedule-'));
const output=path.join(root,'output/playwright/warmup-schedule');
const nativeURL=process.env.FORGE_SCHEDULE_NATIVE_URL;
const server=await createServer({root,cacheDir,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,proxy:nativeURL?{'/v1/studio/sdk':nativeURL,'/proof':nativeURL}:{}}});
let browser,page;
try{
 await mkdir(output,{recursive:true});await server.listen();browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
 page=await browser.newPage({viewport:{width:1440,height:1100},timezoneId:'America/New_York'});await page.clock.setFixedTime(new Date('2026-11-25T02:00:00Z'));page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const base='http://127.0.0.1:'+server.httpServer.address().port;if(nativeURL)await page.request.get(base+'/proof/reset');await page.goto(base+'/warmup-schedule-test.html'+(nativeURL?'?native':''));
 const before=nativeURL?await page.request.get(base+'/proof/source').then(response=>response.json()):null;
 const schedule=page.getByRole('region',{name:'Warmup schedule',exact:true});
 const first=()=>schedule.getByLabel('First-run time (America/New_York)',{exact:true});
 const date=()=>schedule.getByLabel('First-run date (America/New_York)',{exact:true});
 const setFirst=async()=>{await date().fill('2026-12-01');await first().fill('01:00');};
 const interval=()=>schedule.getByLabel('Interval (seconds)',{exact:true});
 const save=()=>schedule.locator('button').filter({hasText:/^Save schedule$/});
 const saves=()=>page.evaluate(()=>window.__scheduleProof.calls.filter(call=>call.operation==='versions.warmup_schedule_save'));
 const gets=()=>page.evaluate(()=>window.__scheduleProof.calls.filter(call=>call.operation==='versions.warmup_schedule_get'));
 const removes=()=>page.evaluate(()=>window.__scheduleProof.calls.filter(call=>call.operation==='versions.warmup_schedule_delete'));
 const ready=()=>page.waitForFunction(()=>document.querySelector('#warmup-schedule-first')&&!document.querySelector('#warmup-schedule-first').disabled);
 const open=async(wait=true)=>{await page.getByRole('button',{name:'More actions',exact:true}).click();await page.getByRole('menuitem',{name:'Cache & warmup',exact:true}).click();await schedule.waitFor();if(wait)await ready();};
 const idle=()=>page.waitForFunction(()=>window.__scheduleProof.pending===0);
 const changeVersion=async no=>{await page.evaluate(no=>window.__scheduleProof.switchVersion(no),no);await page.getByRole('combobox',{name:'Component version',exact:true}).waitFor();await page.waitForFunction(no=>document.querySelector('[aria-label="Component version"]')?.value===String(no),no);};
 const reload=async()=>{await schedule.getByRole('button',{name:'Reload schedule',exact:true}).click();const confirm=page.getByRole('button',{name:'Discard and reload',exact:true});if(await confirm.count())await confirm.click();await ready();};
 const firstRunAt='2026-12-01T06:00:00.000Z';
 await open();assert.equal(await schedule.count(),1);await schedule.getByText('No schedule for this saved version.',{exact:true}).waitFor();
 assert.equal(await date().inputValue(),'2026-11-24');await interval().fill('3601');await setFirst();await save().click();await idle();await schedule.getByText('Schedule disabled',{exact:true}).waitFor();
 let sent=(await saves()).at(-1).parameters;assert.equal(sent.versionNo,2);assert.deepEqual(sent.input,{expectedRevision:0,intervalSeconds:3601,firstRunAt,enabled:false});
 assert.equal((await page.evaluate(()=>window.__scheduleProof.calls.filter(call=>call.operation==='versions.warmup'))).length,0);
 await interval().fill('4001');await save().click();await idle();
 await schedule.locator('label.bp6-checkbox').click();await save().click();await idle();
 sent=(await saves()).at(-1).parameters;assert.equal(sent.input.expectedRevision,2);assert.equal(sent.input.intervalSeconds,4001);assert.equal(sent.input.firstRunAt,firstRunAt);assert.equal(sent.input.enabled,true);
 assert.equal(await schedule.getByText('Scheduler running',{exact:true}).count(),0);
 await interval().fill('4444');const readCount=(await gets()).length;
 if(nativeURL){const response=await page.request.get(base+'/proof/admit');assert.equal(response.ok(),true,await response.text());}else await page.evaluate(()=>window.__scheduleProof.admitFake());
 await save().click();await idle();await schedule.getByText('Schedule revision conflict',{exact:true}).waitFor();assert.equal(await interval().inputValue(),'4444');assert.equal((await gets()).length,readCount);
 await schedule.getByRole('button',{name:'Reload schedule',exact:true}).click();await page.getByRole('button',{name:'Keep editing',exact:true}).click();assert.equal(await interval().inputValue(),'4444');
 await reload();assert.equal(await interval().inputValue(),'4001');assert.equal(await first().inputValue(),'01:00');
 const linked=schedule.locator('[aria-label="Latest scheduled run"]');await linked.getByText('Status: completed',{exact:true}).waitFor();
 await interval().fill('4444');const getsBeforeRun=(await gets()).length;await linked.getByRole('button',{name:'Refresh linked run',exact:true}).click();await linked.getByText('Status: completed',{exact:true}).waitFor();assert.equal(await interval().inputValue(),'4444');assert.equal((await gets()).length,getsBeforeRun);
 await linked.getByRole('button',{name:'View linked run',exact:true}).click();await page.locator('.studio-warmup-run').waitFor();
 await page.getByRole('dialog',{name:'Cache & warmup',exact:true}).screenshot({path:path.join(output,nativeURL?'native-linked-run.png':'linked-run.png')});
 await reload();await schedule.locator('label.bp6-checkbox').click();await save().click();await idle();sent=(await saves()).at(-1).parameters;assert.equal(sent.input.expectedRevision,4);assert.equal(sent.input.intervalSeconds,4001);assert.equal(sent.input.firstRunAt,firstRunAt);assert.equal(sent.input.enabled,false);
 await schedule.getByRole('button',{name:'Remove schedule',exact:true}).click();await page.getByRole('button',{name:'Keep editing',exact:true}).click();assert.equal((await removes()).length,0);
 await schedule.getByRole('button',{name:'Remove schedule',exact:true}).click();await page.locator('.bp6-alert').getByRole('button',{name:'Remove schedule',exact:true}).click();await idle();await schedule.getByText('No schedule for this saved version.',{exact:true}).waitFor();assert.equal((await removes()).at(-1).parameters.input.expectedRevision,5);
 // The backend commits first; hold only delivery to the authored operation caller.
 for(const action of ['save','remove']){
  if(action==='save'){await setFirst();await interval().fill('67');}
  await page.evaluate(()=>{window.__scheduleProof.holdMutation=true;});
  if(action==='save')await save().click();else{await schedule.getByRole('button',{name:'Remove schedule',exact:true}).click();await page.locator('.bp6-alert').getByRole('button',{name:'Remove schedule',exact:true}).click();}
  await page.waitForFunction(()=>Boolean(window.__scheduleProof.held));await changeVersion(1);await page.evaluate(()=>window.__scheduleProof.release());await idle();await open();await schedule.getByText('No schedule for this saved version.',{exact:true}).waitFor();
  await changeVersion(2);await open();if(action==='save')assert.equal(await interval().inputValue(),'67');else await schedule.getByText('No schedule for this saved version.',{exact:true}).waitFor();
 }
 await changeVersion(2);await page.evaluate(()=>{window.__scheduleProof.failGet=true;});await open(false);await schedule.getByText('Schedule request failed',{exact:false}).waitFor();assert.equal(await save().isDisabled(),true);assert.equal(await schedule.getByText('No schedule for this saved version.',{exact:true}).count(),0);
 await schedule.getByRole('button',{name:'Retry schedule load',exact:true}).click();await ready();await setFirst();
 if(nativeURL){await interval().fill('0');await save().click();await idle();await schedule.getByText(/intervalSeconds must be positive/).waitFor();assert.equal(await interval().inputValue(),'0');}
 await interval().fill('3601');await page.evaluate(()=>{window.__scheduleProof.deny=true;});await save().click();await idle();await schedule.getByText(/permission denied/i).waitFor();assert.equal(await interval().inputValue(),'3601');assert.equal(await first().inputValue(),'01:00');
 // Local authoring uses the browser zone; only complete resolved instants are sent.
 await page.evaluate(()=>{window.__scheduleProof.deny=false;});
 let submitted=(await saves()).length;
 await first().fill('');await first().focus();await first().press('Home');await first().press('2');assert.equal(await first().evaluate(node=>node.validity.badInput),true);await save().click();await schedule.getByText('Choose a complete first-run date and time.',{exact:true}).waitFor();assert.equal((await saves()).length,submitted);assert.equal(await first().isEnabled(),true);assert.equal(await first().evaluate(node=>node.validity.badInput),true);
 await date().fill('2026-11-24');await first().fill('23:14');await save().click();await idle();assert.equal((await saves()).at(-1).parameters.input.firstRunAt,'2026-11-25T04:14:00.000Z');
 await date().fill('2026-07-15');await first().fill('23:14');await save().click();await idle();assert.equal((await saves()).at(-1).parameters.input.firstRunAt,'2026-07-16T03:14:00.000Z');
 await changeVersion(1);await open();await changeVersion(2);await open();assert.equal(await date().inputValue(),'2026-07-15');assert.equal(await first().inputValue(),'23:14');
 await schedule.getByText(/selected first-run time is in the past/).waitFor();
 submitted=(await saves()).length;await date().fill('2026-03-08');await first().fill('02:30');await save().click();await schedule.getByText(/does not exist/).waitFor();assert.equal((await saves()).length,submitted);assert.equal(await first().inputValue(),'02:30');
 await first().fill('03:30');await save().click();await idle();assert.equal((await saves()).at(-1).parameters.input.firstRunAt,'2026-03-08T07:30:00.000Z');
 for(const [choice,expected] of [['earlier','2026-11-01T05:30:00.000Z'],['later','2026-11-01T06:30:00.000Z']]){
  submitted=(await saves()).length;await first().fill('01:31');await date().fill('2026-11-01');await first().fill('01:30');await save().click();await schedule.getByText(/local time occurs twice/).waitFor();assert.equal((await saves()).length,submitted);
  await schedule.getByLabel('Repeated local time',{exact:true}).selectOption(choice);await save().click();await idle();assert.equal((await saves()).at(-1).parameters.input.firstRunAt,expected);
  await changeVersion(1);await open();await changeVersion(2);await open();assert.equal(await first().inputValue(),'01:30');assert.equal(await schedule.getByLabel('Repeated local time',{exact:true}).count(),0);
  await schedule.locator('label.bp6-checkbox').click();await save().click();await idle();assert.equal((await saves()).at(-1).parameters.input.firstRunAt,expected);
 }
 if(nativeURL){const after=await page.request.get(base+'/proof/source').then(response=>response.json());assert.deepEqual(after,before);}
 assert.equal((await page.evaluate(()=>window.__scheduleProof.calls.filter(call=>call.operation==='versions.builder'))).length,0);
 await page.getByRole('dialog',{name:'Cache & warmup',exact:true}).screenshot({path:path.join(output,nativeURL?'native-schedule.png':'schedule.png')});assert.deepEqual(errors,[]);
 console.log('PASS recurring schedule UI: local date/time, DST choices, invalid-input protection, exact seconds and saved UTC precision, zero/false inputs, separate revisions, linked evidence, confirmation, failed loads, denied edits, late committed save/removal and fresh reopen'+(nativeURL?', authored Studio bindings against native backend, admission conflict and unchanged reader source':''));
}catch(error){if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'failure.png')});throw error;}
finally{await browser?.close();await server.close();await rm(cacheDir,{recursive:true,force:true});}

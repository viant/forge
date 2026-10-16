import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const cacheDir=await mkdtemp(path.join(tmpdir(),'forge-cursor-paging-'));
let browser;let roundingRequests=0;
const server=await createServer({root,cacheDir,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0,fs:{allow:[path.dirname(root)]}},plugins:[{name:'cursor-precision-fixture',configureServer(server){
server.middlewares.use((req,res,next)=>{if(!req.url.startsWith('/cursor-rounded-numeric'))return next();roundingRequests++;res.setHeader('Content-Type','application/json');const token=req.url.includes('object=1')?'{"ordinal":1.00000000000000001,"tag":"opaque"}':'1.00000000000000001';res.end('{"reply":{"widgets":[{"id":"must-not-release"}]},"nav":{"remaining":true,"nextToken":'+token+'}}');});
}}]});
try {
 await server.listen();browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/cursor-paging-test.html`);
 const next=page.getByRole('button',{name:'Next Page',exact:true}),back=page.getByRole('button',{name:'Previous Page',exact:true});
 await page.waitForFunction(()=>document.querySelector('#rows')?.textContent.includes('alpha'));
 assert.equal(await next.isEnabled(),true);assert.equal(await back.isEnabled(),false);
 await next.click();await page.waitForFunction(()=>document.querySelector('#rows')?.textContent.includes('beta'));
 assert.equal(await next.isEnabled(),false);assert.equal(await back.isEnabled(),true);
 assert.equal(await page.getByRole('button',{name:'Last Page',exact:true}).isEnabled(),false);
 await back.click();await page.waitForFunction(()=>document.querySelector('#rows')?.textContent.includes('alpha'));
 for(const key of ['query','filter','sort','window','target']) {
  await next.click();await page.waitForFunction(()=>document.querySelector('#rows')?.textContent.includes('beta'));
  await page.getByRole('button',{name:'Change '+key,exact:true}).click();await page.waitForFunction(()=>document.querySelector('#rows')?.textContent.includes('alpha'));
  assert.equal(await back.isEnabled(),false);
 }
 const calls=JSON.parse(await page.locator('#calls').textContent());
 for(let i=0;i<calls.length;i++){assert.deepEqual(Object.keys(calls[i]).sort(),i%2===1?['batchSize','resumeToken','term']:['batchSize','term']);if(i%2===1)assert.equal(calls[i].resumeToken,'opaque+/=😎');}
 await page.getByRole('button',{name:'Render explicit final offset',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#rows')?.textContent==='offset-final');
 assert.equal(await next.isEnabled(),false);
 await page.getByRole('button',{name:'Render legacy full page',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#rows')?.textContent==='legacy-full');
 assert.equal(await next.isEnabled(),true);
 await page.getByRole('button',{name:'Verify rounded numeric cursors',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#precision')?.textContent);
 assert.equal(await page.locator('#precision').textContent(),'rounded scalar/object refused; no rows or continuation');
 assert.equal(roundingRequests,2);
 assert.equal(await page.locator('#rows').textContent(),'legacy-full');
 assert.deepEqual(errors,[]);
 await mkdir(path.join(root,'output/playwright'),{recursive:true});
 await page.screenshot({path:path.join(root,'output/playwright/cursor-paging-controls.png')});
 console.log('Rendered cursor Table: Next/Back/end and query/filter/sort/parent/target resets and explicit offset EOF/legacy full-page behavior passed; '+calls.length+' strict fixture calls; two actual HTTP rounded numeric tokens refused without continuation');
} finally {await browser?.close();await server.close();await rm(cacheDir,{recursive:true,force:true});}

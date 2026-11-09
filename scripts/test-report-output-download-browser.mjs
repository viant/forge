// Independently authored synthetic bytes; no producer or application fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=process.env.REPORT_OUTPUT_EVIDENCE||path.join(root,'output/playwright/report-output-download');
await fs.mkdir(output,{recursive:true});
const html=`<!doctype html><html><body><div id="root"></div><script type="module">
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {useReportOutput} from '/src/components/dashboard/useReportOutput.js';
const value={format:'csv',filename:'synthetic.csv',contentType:'text/csv',data:btoa('item,value\\nexample,3\\n')};
function Fixture(){const [scope,setScope]=useState(0),[delay,setDelay]=useState(false);
 const output=useReportOutput({scopeKey:scope,onExport:()=>delay?new Promise(resolve=>{window.releaseProducer=()=>resolve(value)}):Promise.resolve(value)});
 return React.createElement('main',null,
 React.createElement('label',null,'Delay producer',React.createElement('input',{type:'checkbox',checked:delay,onChange:e=>setDelay(e.target.checked)})),
 React.createElement('button',{disabled:!!output.busy,onClick:()=>{window.lastOutcome=null;output.exportReport('csv').then(value=>{window.lastOutcome=value})}},'Export CSV'),
 React.createElement('button',{onClick:()=>setScope(value=>value+1)},'Change scope'),
 React.createElement('button',{onClick:output.cancelOutput},'Cancel'),
 React.createElement('output',{role:'status'},output.busy||output.error||'Ready'));
}createRoot(document.getElementById('root')).render(React.createElement(Fixture));
</script></body></html>`;
const server=await createServer({root,configFile:false,server:{host:'127.0.0.1',port:0},plugins:[{name:'synthetic-report-output',configureServer(server){server.middlewares.use('/__report-output',async(req,res)=>{res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml('/__report-output',html));});}}]});
let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({acceptDownloads:true});const downloads=[],errors=[];
 page.on('download',value=>downloads.push(value));page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.httpServer.address().port+'/__report-output');
 const saved=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV'}).click();const download=await saved;
 await download.saveAs(path.join(output,'synthetic.csv'));assert.equal(await fs.readFile(path.join(output,'synthetic.csv'),'utf8'),'item,value\nexample,3\n');
 await page.getByLabel('Delay producer').check();
 for(const action of ['Change scope','Cancel']){
  await page.getByRole('button',{name:'Export CSV'}).click();await page.getByRole('status').filter({hasText:'csv'}).waitFor();
  await page.getByRole('button',{name:action,exact:true}).click();await page.evaluate(()=>window.releaseProducer());
  await page.waitForFunction(()=>window.lastOutcome?.status==='cancelled');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(downloads.length,1,'obsolete export delivered a file');
 }
 assert.deepEqual(errors,[]);await page.screenshot({path:path.join(output,'native.png')});
 const receipt={synthetic:true,nativeDownloads:downloads.length,bytesVerified:true,scopeChangeDropsLateExport:true,cancelDropsLateExport:true,errors};
 await fs.writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
}finally{await browser?.close();await server.close();}

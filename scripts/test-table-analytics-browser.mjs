import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const server=await createServer({root,server:{host:'127.0.0.1',port:0}});
let browser;
try{
 await server.listen();browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome'});
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const page=await browser.newPage({viewport}),failures=[];page.on('pageerror',error=>failures.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/table-analytics-preview.html`);
  const table=page.locator('.forge-report-runtime-table-panel').first();
  const expand=table.getByRole('button',{name:'Expand Room 101',exact:true});await expand.waitFor();
  assert.equal(await table.locator('tbody tr').count(),4);
  assert.equal((await table.locator('thead').textContent()).includes('Hierarchy path'),false);
  await table.getByRole('searchbox',{name:'Filter table rows'}).fill('Atlas');
  assert.deepEqual(await table.locator('tbody tr').evaluateAll(rows=>rows.map(row=>row.dataset.hierarchyKey)),['atlas']);
  await table.getByRole('searchbox',{name:'Filter table rows'}).fill('');
  await expand.focus();await expand.press('Space');assert.equal(await table.locator('[data-hierarchy-key="atlas-101-optics"]').count(),1);
  const nested=table.getByRole('button',{name:'Collapse Room 101',exact:true});assert.equal(await nested.getAttribute('aria-expanded'),'true');
  assert.equal(await nested.evaluate(node=>getComputedStyle(node).outlineStyle),'solid');
  await table.getByRole('button',{name:'Collapse Atlas',exact:true}).press('Enter');assert.equal(await table.locator('tbody tr').count(),2);
  await table.getByRole('button',{name:'Expand Atlas',exact:true}).press('Enter');assert.equal(await table.locator('[data-hierarchy-key="atlas-101-optics"]').count(),1);
  await table.getByRole('searchbox',{name:'Filter table rows'}).fill('Sensors');
  assert.equal(await table.locator('[data-hierarchy-key="atlas-101-sensors"]').count(),1);assert.equal(await table.locator('[data-hierarchy-key="birch-201-sensors"]').count(),1);
  assert.equal(await table.locator('[data-hierarchy-key="atlas-101-optics"]').count(),0);
  await table.getByRole('searchbox',{name:'Filter table rows'}).fill('');
  const pivot=page.locator('.forge-report-runtime-table-panel').nth(1);
  assert.deepEqual(await pivot.locator('th[scope="colgroup"]').allTextContents(),['Rows','Electrical','Mechanical','Safety']);
  assert.equal(await pivot.getByRole('button',{name:'Sort by Mechanical / Inspections'}).count(),1);
  assert.equal(await pivot.locator('tbody tr').count(),3);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(failures,[]);
  console.log(`PASS table analytics browser: ${viewport.width}px, keyboard disclosures, stable nested state, ancestor filter, grouped pivot headers and local scrolling`);
  await page.close();
 }
}finally{await browser?.close();await server.close();}

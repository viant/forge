import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.PREVIEW_URL || 'http://127.0.0.1:8108/?window=advertiser&parameters=%7B%22AdvertiserId%22%3A%5B700001%5D%7D';
const output=process.env.OUTPUT_DIR;
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:1000});await page.goto(base);
  let panelHeight;
  for(const name of ['Campaigns','History']) {
   await page.getByRole('tab',{name,exact:true}).click();
   const table=page.locator('.basic-table-wrapper').filter({visible:true}).first();await table.waitFor();
   await page.locator('.basic-table-wrapper tbody tr').filter({visible:true}).first().waitFor();
   const metrics=await table.evaluate(el=>{
    const panel=el.closest('[role=tabpanel]');const box=el.getBoundingClientRect();
    const rows=[...el.querySelectorAll('tbody tr')].map(r=>r.getBoundingClientRect().height);
    const data=el.querySelector('.basic-table-scroll')?.getBoundingClientRect();
    const cues=[...el.querySelectorAll('.basic-table-overflow-cue')].map(e=>e.getBoundingClientRect());
    return {height:box.height,panelHeight:panel.getBoundingClientRect().height,rows,overlap:cues.some(c=>data && c.top<data.bottom && c.bottom>data.top && c.left<data.right && c.right>data.left)};
   });
   assert.equal(metrics.overlap,false,`${name}: overflow button covers data`);
   assert.ok(metrics.rows.every(h=>h<100),`${name}: stretched row ${metrics.rows}`);
   if(name==='Campaigns') {assert.ok(metrics.height<400,JSON.stringify(metrics));panelHeight=metrics.panelHeight;}
   else assert.ok(Math.abs(panelHeight-metrics.panelHeight)<2,'Tab panel allocation changed');
   const indicators=await page.locator('.window-control__indicator').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return [r.width,r.height]}));
   assert.ok(indicators.length>0 && indicators.every(([w,h])=>w===12 && h===12));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page horizontally overflows');
   if(output)await page.screenshot({path:`${output}/forge-${name.toLowerCase()}-${width}.png`});
  }
  // Roving focus must bring a selected section into view without covering it.
  const tab=page.getByRole('tab',{name:'History',exact:true});await tab.focus();await page.keyboard.press('Home');
  await page.getByRole('tab',{name:'Properties',exact:true}).waitFor();
  assert.equal(await page.getByRole('tab',{name:'Properties',exact:true}).getAttribute('aria-selected'),'true');
 }
 await page.setViewportSize({width:1440,height:1000});
 const url=new URL(base);url.searchParams.set('variant','error');await page.goto(url.href);
 await page.getByRole('tab',{name:'Campaigns',exact:true}).click();
 const error=page.locator('[data-forge-primitive="dataStateBoundary"][role="alert"]').filter({visible:true}).first();await error.waitFor();
 assert.match(await error.innerText(),/Unable to load data/);
 assert.ok((await error.innerText()).replace(/Unable to load data|Retry/g,'').trim().length>10);
 if(output)await page.screenshot({path:`${output}/forge-campaigns-error.png`});
 assert.deepEqual(errors,[]);
 console.log('Advertiser consistency: Campaigns, History, narrow overflow, keyboard tabs, circular controls and error fallback passed.');
}finally{await browser.close();}

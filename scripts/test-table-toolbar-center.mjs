import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:1000});
  await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:8119/?window=advertiser&parameters=%7B%22AdvertiserId%22%3A%5B700001%5D%7D');
  for(const name of ['Campaigns','History']) {
   await page.getByRole('tab',{name,exact:true}).click();
   const table=page.locator('.basic-table-wrapper').filter({visible:true}).first();await table.waitFor();
   const metrics=await table.evaluate(el=>{
    const toolbar=el.querySelector('.has-table-navigation'),center=toolbar.querySelector('.toolbar-center');
    const t=toolbar.getBoundingClientRect(),c=center.getBoundingClientRect();
    return {centerOffset:Math.abs((t.left+t.width/2)-(c.left+c.width/2)),centerHeight:c.height,pagers:el.querySelectorAll('.pagination-bar').length,footer:el.querySelectorAll('.basic-table-footer,.basic-table-paginationbar').length,arrows:el.querySelectorAll('.basic-table-overflow-cue').length};
   });
   assert.ok(metrics.centerOffset<2,JSON.stringify({width,name,...metrics}));if(metrics.pagers>0)assert.ok(metrics.centerHeight>0);
   assert.ok(metrics.pagers<=1);assert.equal(metrics.footer,0);assert.equal(metrics.arrows,0);
  }
  await page.getByRole('combobox',{name:'Table layout'}).selectOption('reserve10');
  const table=page.locator('.basic-table-wrapper').filter({visible:true}).first();
  await page.waitForFunction(()=>[...document.querySelectorAll('.has-fixed-row-slots')].some(e=>e.getBoundingClientRect().height>0));
  assert.equal(await table.locator('.basic-table-footer').count(),0);
 }
 assert.deepEqual(errors,[]);console.log('Shared toolbar center: desktop/narrow, one pager, no pagination footer or column-arrow cluster, both table modes passed.');
}finally{await browser.close();}
